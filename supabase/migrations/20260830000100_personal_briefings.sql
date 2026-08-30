begin;

alter table public.ai_runs drop constraint ai_runs_purpose_check;
alter table public.ai_runs add constraint ai_runs_purpose_check
check (purpose in ('connectivity_test', 'chat', 'summarize', 'structure', 'embed', 'briefing'));

create table public.ai_briefings (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  briefing_date date not null default current_date,
  model text not null,
  summary text not null check (char_length(summary) between 1 and 1200),
  recommendations jsonb not null default '[]'::jsonb
    check (jsonb_typeof(recommendations) = 'array' and jsonb_array_length(recommendations) between 1 and 3),
  source_items jsonb not null default '[]'::jsonb
    check (jsonb_typeof(source_items) = 'array'),
  generated_at timestamptz not null default now(),
  unique (owner_id, briefing_date)
);

create index ai_briefings_owner_generated_idx
on public.ai_briefings (owner_id, generated_at desc);

alter table public.ai_briefings enable row level security;
revoke all on table public.ai_briefings from public, anon, authenticated;
grant select on table public.ai_briefings to authenticated;

create policy ai_briefings_owner_select on public.ai_briefings
for select to authenticated using ((select auth.uid()) = owner_id);

create or replace function public.reserve_ai_request(
  p_provider text,
  p_model text,
  p_purpose text,
  p_estimated_input_tokens integer
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  current_owner uuid := auth.uid();
  settings public.ai_provider_settings%rowtype;
  usage public.ai_usage_daily%rowtype;
  run_id uuid := extensions.gen_random_uuid();
  safe_estimate integer := greatest(coalesce(p_estimated_input_tokens, 0), 0);
begin
  if current_owner is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if safe_estimate > 20000 then raise exception 'AI_INPUT_TOO_LARGE'; end if;
  if p_purpose not in ('connectivity_test', 'chat', 'summarize', 'structure', 'embed', 'briefing') then
    raise exception 'AI_PURPOSE_INVALID';
  end if;
  insert into public.ai_provider_settings (owner_id) values (current_owner)
  on conflict (owner_id) do nothing;
  select * into settings from public.ai_provider_settings where owner_id = current_owner for update;
  if not settings.is_enabled then raise exception 'AI_DISABLED'; end if;
  if settings.provider <> p_provider
    or (p_purpose = 'embed' and settings.embedding_model <> p_model)
    or (p_purpose <> 'embed' and settings.chat_model <> p_model) then
    raise exception 'AI_PROVIDER_CONFIGURATION_MISMATCH';
  end if;
  if p_purpose = 'briefing' and (
    select count(*) from public.ai_runs
    where owner_id = current_owner
      and purpose = 'briefing'
      and created_at >= current_date
      and created_at < current_date + interval '1 day'
  ) >= 2 then
    raise exception 'AI_DAILY_BRIEFING_LIMIT';
  end if;
  insert into public.ai_usage_daily (owner_id, usage_date) values (current_owner, current_date)
  on conflict (owner_id, usage_date) do nothing;
  select * into usage from public.ai_usage_daily
  where owner_id = current_owner and usage_date = current_date for update;
  if usage.request_count >= settings.daily_request_limit then raise exception 'AI_DAILY_REQUEST_LIMIT'; end if;
  if usage.input_tokens + safe_estimate > settings.daily_input_token_limit then raise exception 'AI_DAILY_TOKEN_LIMIT'; end if;

  insert into public.ai_runs (
    id, owner_id, provider, model, purpose, estimated_input_tokens
  ) values (
    run_id, current_owner, p_provider, p_model, p_purpose, safe_estimate
  );
  update public.ai_usage_daily set
    request_count = request_count + 1,
    input_tokens = input_tokens + safe_estimate,
    updated_at = now()
  where owner_id = current_owner and usage_date = current_date;
  return jsonb_build_object('run_id', run_id, 'request_count', usage.request_count + 1,
    'request_limit', settings.daily_request_limit,
    'input_tokens', usage.input_tokens + safe_estimate,
    'input_token_limit', settings.daily_input_token_limit);
end;
$function$;

create or replace function public.save_ai_briefing(
  p_model text,
  p_summary text,
  p_recommendations jsonb,
  p_source_items jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  current_owner uuid := auth.uid();
  saved public.ai_briefings%rowtype;
begin
  if current_owner is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if char_length(trim(coalesce(p_summary, ''))) not between 1 and 1200 then
    raise exception 'AI_BRIEFING_SUMMARY_INVALID';
  end if;
  if jsonb_typeof(coalesce(p_recommendations, '[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(p_recommendations, '[]'::jsonb)) not between 1 and 3 then
    raise exception 'AI_BRIEFING_RECOMMENDATIONS_INVALID';
  end if;
  if jsonb_typeof(coalesce(p_source_items, '[]'::jsonb)) <> 'array' then
    raise exception 'AI_BRIEFING_SOURCES_INVALID';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_source_items) as source(value)
    left join public.knowledge_items as item
      on item.id = (source.value->>'id')::uuid
      and item.owner_id = current_owner
      and item.deleted_at is null
    where item.id is null
  ) then
    raise exception 'AI_BRIEFING_SOURCE_NOT_FOUND';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_recommendations) as recommendation(value),
      jsonb_array_elements_text(coalesce(recommendation.value->'sourceIds', '[]'::jsonb)) as source_id(value)
    left join public.knowledge_items as item
      on item.id = source_id.value::uuid
      and item.owner_id = current_owner
      and item.deleted_at is null
    where item.id is null
  ) then
    raise exception 'AI_BRIEFING_RECOMMENDATION_SOURCE_NOT_FOUND';
  end if;

  insert into public.ai_briefings (
    owner_id, briefing_date, model, summary, recommendations, source_items, generated_at
  ) values (
    current_owner, current_date, left(trim(p_model), 120), left(trim(p_summary), 1200),
    p_recommendations, p_source_items, now()
  )
  on conflict (owner_id, briefing_date) do update set
    model = excluded.model,
    summary = excluded.summary,
    recommendations = excluded.recommendations,
    source_items = excluded.source_items,
    generated_at = now()
  returning * into saved;

  return jsonb_build_object(
    'id', saved.id,
    'briefingDate', saved.briefing_date,
    'model', saved.model,
    'summary', saved.summary,
    'recommendations', saved.recommendations,
    'sourceItems', saved.source_items,
    'generatedAt', saved.generated_at
  );
end;
$function$;

revoke all on function public.save_ai_briefing(text, text, jsonb, jsonb) from public, anon;
grant execute on function public.save_ai_briefing(text, text, jsonb, jsonb) to authenticated;

commit;

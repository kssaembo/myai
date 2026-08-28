begin;

create table public.ai_provider_settings (
  owner_id uuid primary key references public.profiles(id) on delete cascade,
  provider text not null default 'gemini' check (provider in ('gemini', 'openai')),
  chat_model text not null default 'gemini-2.5-flash-lite',
  embedding_model text not null default 'gemini-embedding-001',
  daily_request_limit integer not null default 15 check (daily_request_limit between 1 and 100),
  daily_input_token_limit integer not null default 100000 check (daily_input_token_limit between 1000 and 1000000),
  is_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.ai_usage_daily (
  owner_id uuid not null references public.profiles(id) on delete cascade,
  usage_date date not null default current_date,
  request_count integer not null default 0 check (request_count >= 0),
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  updated_at timestamptz not null default now(),
  primary key (owner_id, usage_date)
);

create table public.ai_runs (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null,
  model text not null,
  purpose text not null check (purpose in ('connectivity_test', 'chat', 'summarize', 'structure', 'embed')),
  status text not null default 'reserved' check (status in ('reserved', 'completed', 'failed')),
  estimated_input_tokens integer not null default 0 check (estimated_input_tokens >= 0),
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  error_code text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint ai_runs_id_owner_unique unique (id, owner_id)
);

insert into public.ai_provider_settings (owner_id)
select id from public.profiles on conflict (owner_id) do nothing;

alter table public.ai_provider_settings enable row level security;
alter table public.ai_usage_daily enable row level security;
alter table public.ai_runs enable row level security;

revoke all on table public.ai_provider_settings, public.ai_usage_daily, public.ai_runs from anon, authenticated;
grant select, update on table public.ai_provider_settings to authenticated;
grant select on table public.ai_usage_daily, public.ai_runs to authenticated;

create policy ai_provider_settings_owner_select on public.ai_provider_settings
for select to authenticated using ((select auth.uid()) = owner_id);
create policy ai_provider_settings_owner_update on public.ai_provider_settings
for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy ai_usage_daily_owner_select on public.ai_usage_daily
for select to authenticated using ((select auth.uid()) = owner_id);
create policy ai_runs_owner_select on public.ai_runs
for select to authenticated using ((select auth.uid()) = owner_id);

create or replace function public.get_ai_status()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  current_owner uuid := auth.uid();
  result jsonb;
begin
  if current_owner is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  insert into public.ai_provider_settings (owner_id) values (current_owner)
  on conflict (owner_id) do nothing;
  insert into public.ai_usage_daily (owner_id, usage_date) values (current_owner, current_date)
  on conflict (owner_id, usage_date) do nothing;
  select jsonb_build_object(
    'settings', to_jsonb(settings) - 'owner_id',
    'usage', to_jsonb(usage) - 'owner_id'
  ) into result
  from public.ai_provider_settings as settings
  join public.ai_usage_daily as usage on usage.owner_id = settings.owner_id and usage.usage_date = current_date
  where settings.owner_id = current_owner;
  return result;
end;
$function$;

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
  insert into public.ai_provider_settings (owner_id) values (current_owner)
  on conflict (owner_id) do nothing;
  select * into settings from public.ai_provider_settings where owner_id = current_owner for update;
  if not settings.is_enabled then raise exception 'AI_DISABLED'; end if;
  if settings.provider <> p_provider or settings.chat_model <> p_model then
    raise exception 'AI_PROVIDER_CONFIGURATION_MISMATCH';
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

create or replace function public.complete_ai_request(
  p_run_id uuid,
  p_status text,
  p_input_tokens integer,
  p_output_tokens integer,
  p_duration_ms integer,
  p_error_code text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  current_owner uuid := auth.uid();
  run_record public.ai_runs%rowtype;
  safe_input integer := greatest(coalesce(p_input_tokens, 0), 0);
  safe_output integer := greatest(coalesce(p_output_tokens, 0), 0);
begin
  if current_owner is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if p_status not in ('completed', 'failed') then raise exception 'AI_RUN_STATUS_INVALID'; end if;
  select * into run_record from public.ai_runs
  where id = p_run_id and owner_id = current_owner and status = 'reserved' for update;
  if not found then raise exception 'AI_RUN_NOT_FOUND'; end if;
  update public.ai_runs set status = p_status, input_tokens = safe_input,
    output_tokens = safe_output, duration_ms = greatest(coalesce(p_duration_ms, 0), 0),
    error_code = p_error_code, completed_at = now()
  where id = p_run_id and owner_id = current_owner;
  update public.ai_usage_daily set
    input_tokens = greatest(input_tokens - run_record.estimated_input_tokens + safe_input, 0),
    output_tokens = output_tokens + safe_output,
    updated_at = now()
  where owner_id = current_owner and usage_date = run_record.created_at::date;
end;
$function$;

revoke all on function public.get_ai_status() from public, anon;
revoke all on function public.reserve_ai_request(text, text, text, integer) from public, anon;
revoke all on function public.complete_ai_request(uuid, text, integer, integer, integer, text) from public, anon;
grant execute on function public.get_ai_status() to authenticated;
grant execute on function public.reserve_ai_request(text, text, text, integer) to authenticated;
grant execute on function public.complete_ai_request(uuid, text, integer, integer, integer, text) to authenticated;

commit;

begin;

alter table public.document_sections
  drop constraint if exists document_sections_v1_embedding_disabled;

alter table public.document_sections
  alter column embedding type extensions.vector(768)
  using embedding::extensions.vector(768);

alter table public.document_sections
  add constraint document_sections_embedding_consistency
  check (
    (embedding is null and embedding_model is null and embedded_at is null)
    or
    (
      embedding is not null
      and embedding_model is not null
      and length(btrim(embedding_model)) > 0
      and embedded_at is not null
    )
  );

create index document_sections_embedding_hnsw_idx
  on public.document_sections
  using hnsw (embedding extensions.vector_cosine_ops)
  where embedding is not null;

create or replace function public.get_embedding_status()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  current_owner uuid := auth.uid();
  current_model text;
  eligible_count integer;
  embedded_count integer;
begin
  if current_owner is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;

  insert into public.ai_provider_settings (owner_id) values (current_owner)
  on conflict (owner_id) do nothing;

  select settings.embedding_model into current_model
  from public.ai_provider_settings as settings
  where settings.owner_id = current_owner;

  select
    count(*)::integer,
    count(*) filter (
      where section.embedding is not null and section.embedding_model = current_model
    )::integer
  into eligible_count, embedded_count
  from public.document_sections as section
  join public.documents as document
    on document.item_id = section.document_id and document.owner_id = section.owner_id
  join public.knowledge_items as item
    on item.id = document.item_id and item.owner_id = document.owner_id
  where section.owner_id = current_owner
    and document.ai_allowed
    and document.active_version_id = section.version_id
    and item.deleted_at is null;

  return jsonb_build_object(
    'model', current_model,
    'dimensions', 768,
    'eligible_count', eligible_count,
    'embedded_count', embedded_count,
    'pending_count', greatest(eligible_count - embedded_count, 0)
  );
end;
$function$;

create or replace function public.get_pending_embedding_sections(p_limit integer default 12)
returns table (
  section_id uuid,
  title text,
  heading text,
  content text,
  token_estimate integer
)
language sql
stable
security invoker
set search_path = ''
as $function$
  select
    section.id,
    item.title,
    section.heading,
    section.content,
    coalesce(section.token_estimate, greatest(1, ceil(length(section.content)::numeric / 4)::integer))
  from public.document_sections as section
  join public.documents as document
    on document.item_id = section.document_id and document.owner_id = section.owner_id
  join public.knowledge_items as item
    on item.id = document.item_id and item.owner_id = document.owner_id
  join public.ai_provider_settings as settings on settings.owner_id = section.owner_id
  where section.owner_id = auth.uid()
    and document.ai_allowed
    and document.active_version_id = section.version_id
    and item.deleted_at is null
    and (section.embedding is null or section.embedding_model <> settings.embedding_model)
  order by item.updated_at desc, section.ordinal
  limit least(greatest(coalesce(p_limit, 12), 1), 20);
$function$;

create or replace function public.save_section_embeddings(
  p_model text,
  p_embeddings jsonb
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  current_owner uuid := auth.uid();
  current_model text;
  saved_count integer;
begin
  if current_owner is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if jsonb_typeof(p_embeddings) <> 'array' or jsonb_array_length(p_embeddings) > 20 then
    raise exception 'EMBEDDING_PAYLOAD_INVALID';
  end if;

  select settings.embedding_model into current_model
  from public.ai_provider_settings as settings
  where settings.owner_id = current_owner;
  if current_model is null or p_model <> current_model then
    raise exception 'EMBEDDING_MODEL_MISMATCH';
  end if;

  with payload as (
    select value->>'section_id' as section_id, value->'embedding' as embedding
    from jsonb_array_elements(p_embeddings)
  ), validated as (
    select
      payload.section_id::uuid as section_id,
      payload.embedding::text::extensions.vector(768) as embedding
    from payload
    where jsonb_typeof(payload.embedding) = 'array'
      and jsonb_array_length(payload.embedding) = 768
  )
  update public.document_sections as section set
    embedding = validated.embedding,
    embedding_model = current_model,
    embedded_at = now()
  from validated, public.documents as document, public.knowledge_items as item
  where section.id = validated.section_id
    and section.owner_id = current_owner
    and document.item_id = section.document_id
    and document.owner_id = section.owner_id
    and item.id = document.item_id
    and item.owner_id = document.owner_id
    and document.ai_allowed
    and document.active_version_id = section.version_id
    and item.deleted_at is null;

  get diagnostics saved_count = row_count;
  return saved_count;
end;
$function$;

create or replace function public.match_document_sections(
  p_query_embedding extensions.vector(768),
  p_match_count integer default 8,
  p_min_similarity real default 0.25
)
returns table (
  item_id uuid,
  section_id uuid,
  title text,
  node_type_label text,
  heading_path text[],
  snippet text,
  score real
)
language sql
stable
security invoker
set search_path = ''
as $function$
  select
    item.id,
    section.id,
    item.title,
    node_type.label_ko,
    section.heading_path,
    left(section.content, 1600),
    (1 - (section.embedding OPERATOR(extensions.<=>) p_query_embedding))::real as score
  from public.document_sections as section
  join public.documents as document
    on document.item_id = section.document_id and document.owner_id = section.owner_id
  join public.knowledge_items as item
    on item.id = document.item_id and item.owner_id = document.owner_id
  join public.node_types as node_type on node_type.id = item.node_type_id
  join public.ai_provider_settings as settings on settings.owner_id = section.owner_id
  where section.owner_id = auth.uid()
    and document.ai_allowed
    and document.active_version_id = section.version_id
    and item.deleted_at is null
    and section.embedding is not null
    and section.embedding_model = settings.embedding_model
    and (1 - (section.embedding OPERATOR(extensions.<=>) p_query_embedding)) >= greatest(coalesce(p_min_similarity, 0.25), 0)
  order by section.embedding OPERATOR(extensions.<=>) p_query_embedding
  limit least(greatest(coalesce(p_match_count, 8), 1), 20);
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
  if settings.provider <> p_provider
    or (p_purpose = 'embed' and settings.embedding_model <> p_model)
    or (p_purpose <> 'embed' and settings.chat_model <> p_model) then
    raise exception 'AI_PROVIDER_CONFIGURATION_MISMATCH';
  end if;
  insert into public.ai_usage_daily (owner_id, usage_date) values (current_owner, current_date)
  on conflict (owner_id, usage_date) do nothing;
  select * into usage from public.ai_usage_daily
  where owner_id = current_owner and usage_date = current_date for update;
  if usage.request_count >= settings.daily_request_limit then raise exception 'AI_DAILY_REQUEST_LIMIT'; end if;
  if usage.input_tokens + safe_estimate > settings.daily_input_token_limit then raise exception 'AI_DAILY_TOKEN_LIMIT'; end if;

  insert into public.ai_runs (id, owner_id, provider, model, purpose, estimated_input_tokens)
  values (run_id, current_owner, p_provider, p_model, p_purpose, safe_estimate);
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

revoke all on function public.get_embedding_status() from public, anon;
revoke all on function public.get_pending_embedding_sections(integer) from public, anon;
revoke all on function public.save_section_embeddings(text, jsonb) from public, anon;
revoke all on function public.match_document_sections(extensions.vector, integer, real) from public, anon;
grant execute on function public.get_embedding_status() to authenticated;
grant execute on function public.get_pending_embedding_sections(integer) to authenticated;
grant execute on function public.save_section_embeddings(text, jsonb) to authenticated;
grant execute on function public.match_document_sections(extensions.vector, integer, real) to authenticated;

commit;

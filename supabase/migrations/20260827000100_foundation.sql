begin;

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists vector with schema extensions;

create type public.app_theme as enum ('system', 'light', 'dark');
create type public.default_view as enum ('dashboard', 'knowledge', 'projects', 'graph');
create type public.item_status as enum ('draft', 'active', 'completed', 'on_hold', 'archived');
create type public.content_origin as enum (
  'user',
  'imported',
  'rule_import',
  'ai_proposed',
  'ai_accepted'
);
create type public.verification_status as enum ('confirmed', 'unconfirmed', 'conflicted');
create type public.project_kind as enum (
  'service',
  'lesson',
  'research',
  'system',
  'utility',
  'idea',
  'other'
);
create type public.project_lifecycle_status as enum (
  'idea',
  'planning',
  'developing',
  'testing',
  'deployed',
  'paused',
  'completed'
);
create type public.document_kind as enum (
  'note',
  'reference',
  'ref',
  'research',
  'manual',
  'source_record',
  'other'
);
create type public.document_format as enum ('md', 'txt', 'pdf', 'docx');
create type public.parse_status as enum (
  'pending',
  'processing',
  'parsed',
  'partial',
  'failed',
  'needs_ocr'
);
create type public.version_change_reason as enum ('upload', 'edit', 'replace', 'reparse');
create type public.section_chunk_kind as enum (
  'section',
  'paragraph_group',
  'table',
  'code',
  'list'
);
create type public.evidence_role as enum (
  'definition',
  'support',
  'contradiction',
  'example',
  'implementation_status'
);
create type public.relation_status as enum ('proposed', 'active', 'rejected', 'archived');
create type public.import_type as enum ('files', 'zip', 'ref_zip');
create type public.import_job_status as enum (
  'queued',
  'validating',
  'uploading',
  'parsing',
  'structuring',
  'completed',
  'partial',
  'failed',
  'cancelled'
);
create type public.import_entry_status as enum (
  'queued',
  'validating',
  'duplicate',
  'uploaded',
  'parsed',
  'partial',
  'failed',
  'skipped'
);

create or replace function public.normalize_lookup_text(input_value text)
returns text
language sql
immutable
parallel safe
returns null on null input
set search_path = ''
as $$
  select lower(regexp_replace(btrim(input_value), '[[:space:]]+', ' ', 'g'));
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  timezone text not null default 'Asia/Seoul',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_not_blank
    check (display_name is null or length(btrim(display_name)) > 0),
  constraint profiles_timezone_not_blank check (length(btrim(timezone)) > 0)
);

create table public.user_settings (
  owner_id uuid primary key references public.profiles(id) on delete cascade,
  theme public.app_theme not null default 'system',
  default_view public.default_view not null default 'dashboard',
  default_ai_allowed boolean not null default false,
  graph_settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint user_settings_graph_settings_object
    check (jsonb_typeof(graph_settings) = 'object')
);

create table public.node_types (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_id uuid references public.profiles(id) on delete cascade,
  key text not null,
  label_ko text not null,
  label_en text not null,
  description text not null,
  color text not null,
  icon_key text not null,
  is_system boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  constraint node_types_key_format check (key ~ '^[a-z][a-z0-9_]*$'),
  constraint node_types_labels_not_blank
    check (length(btrim(label_ko)) > 0 and length(btrim(label_en)) > 0),
  constraint node_types_system_owner_consistency check (
    (is_system and owner_id is null)
    or (not is_system and owner_id is not null)
  )
);

create unique index node_types_system_key_uidx
  on public.node_types (key)
  where owner_id is null;
create unique index node_types_owner_key_uidx
  on public.node_types (owner_id, key)
  where owner_id is not null;

create table public.relation_types (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_id uuid references public.profiles(id) on delete cascade,
  key text not null,
  label_ko text not null,
  label_en text not null,
  inverse_label_ko text not null,
  description text not null,
  is_directional boolean not null default true,
  is_symmetric boolean not null default false,
  allowed_source_types text[] not null default '{}'::text[],
  allowed_target_types text[] not null default '{}'::text[],
  color text not null,
  line_style text not null default 'solid',
  is_system boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  constraint relation_types_key_format check (key ~ '^[A-Z][A-Z0-9_]*$'),
  constraint relation_types_direction_consistency
    check (not is_symmetric or not is_directional),
  constraint relation_types_line_style_allowed
    check (line_style in ('solid', 'dashed', 'dotted')),
  constraint relation_types_system_owner_consistency check (
    (is_system and owner_id is null)
    or (not is_system and owner_id is not null)
  )
);

create unique index relation_types_system_key_uidx
  on public.relation_types (key)
  where owner_id is null;
create unique index relation_types_owner_key_uidx
  on public.relation_types (owner_id, key)
  where owner_id is not null;

create table public.categories (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  normalized_name text generated always as (public.normalize_lookup_text(name)) stored,
  parent_id uuid,
  color text,
  icon_key text,
  sort_order integer not null default 0,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint categories_id_owner_unique unique (id, owner_id),
  constraint categories_parent_not_self check (parent_id is null or parent_id <> id),
  constraint categories_name_not_blank check (length(btrim(name)) > 0),
  constraint categories_parent_owner_fk
    foreign key (parent_id, owner_id)
    references public.categories(id, owner_id)
    on delete restrict
);

create unique index categories_root_name_uidx
  on public.categories (owner_id, normalized_name)
  where parent_id is null;
create unique index categories_child_name_uidx
  on public.categories (owner_id, parent_id, normalized_name)
  where parent_id is not null;

create table public.tags (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  normalized_name text generated always as (public.normalize_lookup_text(name)) stored,
  color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tags_id_owner_unique unique (id, owner_id),
  constraint tags_name_not_blank check (length(btrim(name)) > 0),
  constraint tags_owner_normalized_name_unique unique (owner_id, normalized_name)
);

create table public.tag_aliases (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  tag_id uuid not null,
  alias text not null,
  normalized_alias text generated always as (public.normalize_lookup_text(alias)) stored,
  created_at timestamptz not null default now(),
  constraint tag_aliases_alias_not_blank check (length(btrim(alias)) > 0),
  constraint tag_aliases_owner_alias_unique unique (owner_id, normalized_alias),
  constraint tag_aliases_tag_owner_fk
    foreign key (tag_id, owner_id)
    references public.tags(id, owner_id)
    on delete cascade
);

create table public.knowledge_items (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  node_type_id uuid not null references public.node_types(id) on delete restrict,
  title text not null,
  normalized_title text generated always as (public.normalize_lookup_text(title)) stored,
  summary text,
  category_id uuid,
  status public.item_status not null default 'draft',
  origin public.content_origin not null default 'user',
  verification_status public.verification_status not null default 'confirmed',
  importance smallint not null default 0,
  properties jsonb not null default '{}'::jsonb,
  dedupe_key text,
  merged_into_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  deleted_at timestamptz,
  constraint knowledge_items_id_owner_unique unique (id, owner_id),
  constraint knowledge_items_title_not_blank check (length(btrim(title)) > 0),
  constraint knowledge_items_importance_range check (importance between 0 and 5),
  constraint knowledge_items_properties_object check (jsonb_typeof(properties) = 'object'),
  constraint knowledge_items_not_merged_into_self
    check (merged_into_id is null or merged_into_id <> id),
  constraint knowledge_items_category_owner_fk
    foreign key (category_id, owner_id)
    references public.categories(id, owner_id)
    on delete restrict,
  constraint knowledge_items_merged_owner_fk
    foreign key (merged_into_id, owner_id)
    references public.knowledge_items(id, owner_id)
    on delete restrict
);

create unique index knowledge_items_dedupe_uidx
  on public.knowledge_items (owner_id, node_type_id, dedupe_key)
  where dedupe_key is not null and deleted_at is null and merged_into_id is null;

create table public.item_aliases (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  item_id uuid not null,
  alias text not null,
  normalized_alias text generated always as (public.normalize_lookup_text(alias)) stored,
  origin public.content_origin not null default 'user',
  created_at timestamptz not null default now(),
  constraint item_aliases_alias_not_blank check (length(btrim(alias)) > 0),
  constraint item_aliases_origin_allowed
    check (origin in ('user', 'imported', 'rule_import')),
  constraint item_aliases_owner_alias_unique unique (owner_id, normalized_alias),
  constraint item_aliases_item_owner_fk
    foreign key (item_id, owner_id)
    references public.knowledge_items(id, owner_id)
    on delete cascade
);

create table public.item_tags (
  owner_id uuid not null references public.profiles(id) on delete cascade,
  item_id uuid not null,
  tag_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (item_id, tag_id),
  constraint item_tags_item_owner_fk
    foreign key (item_id, owner_id)
    references public.knowledge_items(id, owner_id)
    on delete cascade,
  constraint item_tags_tag_owner_fk
    foreign key (tag_id, owner_id)
    references public.tags(id, owner_id)
    on delete cascade
);

create table public.projects (
  item_id uuid primary key,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  project_kind public.project_kind not null default 'other',
  lifecycle_status public.project_lifecycle_status not null default 'idea',
  started_at date,
  completed_at date,
  repository_url text,
  service_url text,
  current_version_label text,
  constraint projects_item_owner_unique unique (item_id, owner_id),
  constraint projects_date_order
    check (completed_at is null or started_at is null or completed_at >= started_at),
  constraint projects_item_owner_fk
    foreign key (item_id, owner_id)
    references public.knowledge_items(id, owner_id)
    on delete cascade
);

create table public.documents (
  item_id uuid primary key,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  document_kind public.document_kind not null default 'other',
  active_version_id uuid,
  ai_allowed boolean not null default false,
  is_editable boolean not null default false,
  constraint documents_item_owner_unique unique (item_id, owner_id),
  constraint documents_item_owner_fk
    foreign key (item_id, owner_id)
    references public.knowledge_items(id, owner_id)
    on delete cascade
);

create table public.document_versions (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  document_id uuid not null,
  version_number integer not null,
  source_filename text not null,
  format public.document_format not null,
  mime_type text not null,
  size_bytes bigint not null,
  storage_path text not null,
  content_hash text not null,
  content_text text,
  raw_markdown text,
  language text not null default 'ko',
  parse_status public.parse_status not null default 'pending',
  parser_name text,
  parser_version text,
  parse_error_code text,
  parse_error_message text,
  change_reason public.version_change_reason not null,
  created_at timestamptz not null default now(),
  constraint document_versions_id_document_owner_unique
    unique (id, document_id, owner_id),
  constraint document_versions_number_unique unique (document_id, version_number),
  constraint document_versions_version_positive check (version_number > 0),
  constraint document_versions_filename_not_blank check (length(btrim(source_filename)) > 0),
  constraint document_versions_size_nonnegative check (size_bytes >= 0),
  constraint document_versions_storage_path_not_blank check (length(btrim(storage_path)) > 0),
  constraint document_versions_hash_sha256 check (content_hash ~ '^[0-9a-f]{64}$'),
  constraint document_versions_language_not_blank check (length(btrim(language)) > 0),
  constraint document_versions_markdown_consistency
    check (raw_markdown is null or format in ('md', 'txt')),
  constraint document_versions_document_owner_fk
    foreign key (document_id, owner_id)
    references public.documents(item_id, owner_id)
    on delete cascade
);

alter table public.documents
  add constraint documents_active_version_owner_fk
  foreign key (active_version_id, item_id, owner_id)
  references public.document_versions(id, document_id, owner_id)
  deferrable initially deferred;

create table public.document_sections (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  document_id uuid not null,
  version_id uuid not null,
  parent_section_id uuid,
  ordinal integer not null,
  canonical_section_key text,
  heading text,
  heading_level smallint,
  heading_path text[] not null default '{}'::text[],
  content text not null,
  chunk_kind public.section_chunk_kind not null default 'section',
  locator jsonb not null default '{}'::jsonb,
  content_hash text not null,
  token_estimate integer,
  embedding extensions.vector,
  embedding_model text,
  embedded_at timestamptz,
  created_at timestamptz not null default now(),
  constraint document_sections_id_version_document_owner_unique
    unique (id, version_id, document_id, owner_id),
  constraint document_sections_version_ordinal_unique unique (version_id, ordinal),
  constraint document_sections_ordinal_nonnegative check (ordinal >= 0),
  constraint document_sections_heading_level_range
    check (heading_level is null or heading_level between 1 and 6),
  constraint document_sections_locator_object check (jsonb_typeof(locator) = 'object'),
  constraint document_sections_hash_sha256 check (content_hash ~ '^[0-9a-f]{64}$'),
  constraint document_sections_token_nonnegative
    check (token_estimate is null or token_estimate >= 0),
  constraint document_sections_v1_embedding_disabled
    check (embedding is null and embedding_model is null and embedded_at is null),
  constraint document_sections_version_owner_fk
    foreign key (version_id, document_id, owner_id)
    references public.document_versions(id, document_id, owner_id)
    on delete cascade,
  constraint document_sections_parent_owner_fk
    foreign key (parent_section_id, version_id, document_id, owner_id)
    references public.document_sections(id, version_id, document_id, owner_id)
    on delete cascade
);

create table public.item_evidence (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  item_id uuid not null,
  document_id uuid,
  version_id uuid,
  section_id uuid,
  evidence_role public.evidence_role not null,
  evidence_text text not null,
  origin public.content_origin not null default 'user',
  created_at timestamptz not null default now(),
  constraint item_evidence_text_not_blank check (length(btrim(evidence_text)) > 0),
  constraint item_evidence_reference_chain check (
    (document_id is null and version_id is null and section_id is null)
    or (document_id is not null and version_id is not null)
  ),
  constraint item_evidence_item_owner_fk
    foreign key (item_id, owner_id)
    references public.knowledge_items(id, owner_id)
    on delete cascade,
  constraint item_evidence_version_owner_fk
    foreign key (version_id, document_id, owner_id)
    references public.document_versions(id, document_id, owner_id)
    on delete cascade,
  constraint item_evidence_section_owner_fk
    foreign key (section_id, version_id, document_id, owner_id)
    references public.document_sections(id, version_id, document_id, owner_id)
    on delete cascade
);

create table public.relations (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  source_item_id uuid not null,
  target_item_id uuid not null,
  canonical_source_item_id uuid not null,
  canonical_target_item_id uuid not null,
  relation_type_id uuid not null references public.relation_types(id) on delete restrict,
  origin public.content_origin not null default 'user',
  status public.relation_status not null default 'active',
  confidence numeric(4, 3),
  rationale text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  deleted_at timestamptz,
  constraint relations_id_owner_unique unique (id, owner_id),
  constraint relations_not_self check (source_item_id <> target_item_id),
  constraint relations_confidence_range
    check (confidence is null or confidence between 0 and 1),
  constraint relations_source_owner_fk
    foreign key (source_item_id, owner_id)
    references public.knowledge_items(id, owner_id)
    on delete cascade,
  constraint relations_target_owner_fk
    foreign key (target_item_id, owner_id)
    references public.knowledge_items(id, owner_id)
    on delete cascade,
  constraint relations_canonical_source_owner_fk
    foreign key (canonical_source_item_id, owner_id)
    references public.knowledge_items(id, owner_id)
    on delete cascade,
  constraint relations_canonical_target_owner_fk
    foreign key (canonical_target_item_id, owner_id)
    references public.knowledge_items(id, owner_id)
    on delete cascade
);

create unique index relations_active_pair_uidx
  on public.relations (
    owner_id,
    relation_type_id,
    canonical_source_item_id,
    canonical_target_item_id
  )
  where status = 'active' and deleted_at is null;

create table public.relation_evidence (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  relation_id uuid not null,
  document_id uuid not null,
  version_id uuid not null,
  section_id uuid,
  evidence_text text not null,
  origin public.content_origin not null default 'user',
  created_at timestamptz not null default now(),
  constraint relation_evidence_text_not_blank check (length(btrim(evidence_text)) > 0),
  constraint relation_evidence_relation_owner_fk
    foreign key (relation_id, owner_id)
    references public.relations(id, owner_id)
    on delete cascade,
  constraint relation_evidence_version_owner_fk
    foreign key (version_id, document_id, owner_id)
    references public.document_versions(id, document_id, owner_id)
    on delete cascade,
  constraint relation_evidence_section_owner_fk
    foreign key (section_id, version_id, document_id, owner_id)
    references public.document_sections(id, version_id, document_id, owner_id)
    on delete cascade
);

create table public.import_jobs (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  import_type public.import_type not null,
  status public.import_job_status not null default 'queued',
  total_count integer not null default 0,
  success_count integer not null default 0,
  partial_count integer not null default 0,
  failed_count integer not null default 0,
  duplicate_count integer not null default 0,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint import_jobs_id_owner_unique unique (id, owner_id),
  constraint import_jobs_counts_nonnegative check (
    total_count >= 0
    and success_count >= 0
    and partial_count >= 0
    and failed_count >= 0
    and duplicate_count >= 0
  )
);

create table public.import_entries (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  import_job_id uuid not null,
  source_filename text not null,
  relative_path text not null,
  size_bytes bigint not null,
  format public.document_format,
  content_hash text,
  status public.import_entry_status not null default 'queued',
  document_id uuid,
  version_id uuid,
  error_code text,
  error_message text,
  detected_ref_profile text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint import_entries_filename_not_blank check (length(btrim(source_filename)) > 0),
  constraint import_entries_relative_path_not_blank check (length(btrim(relative_path)) > 0),
  constraint import_entries_path_safe check (
    relative_path !~ '(^|/)\.\.(/|$)'
    and relative_path !~ '^/'
    and relative_path !~ '^[A-Za-z]:[\\/]'
  ),
  constraint import_entries_size_nonnegative check (size_bytes >= 0),
  constraint import_entries_hash_sha256
    check (content_hash is null or content_hash ~ '^[0-9a-f]{64}$'),
  constraint import_entries_document_version_chain
    check (version_id is null or document_id is not null),
  constraint import_entries_job_owner_fk
    foreign key (import_job_id, owner_id)
    references public.import_jobs(id, owner_id)
    on delete cascade,
  constraint import_entries_document_owner_fk
    foreign key (document_id, owner_id)
    references public.documents(item_id, owner_id)
    on delete set null (document_id),
  constraint import_entries_version_owner_fk
    foreign key (version_id, document_id, owner_id)
    references public.document_versions(id, document_id, owner_id)
    on delete set null (version_id)
);

create index knowledge_items_primary_filter_idx
  on public.knowledge_items (owner_id, node_type_id, status, updated_at desc);
create index knowledge_items_category_idx
  on public.knowledge_items (owner_id, category_id, updated_at desc);
create index document_versions_recent_idx
  on public.document_versions (document_id, version_number desc);
create index document_sections_document_idx
  on public.document_sections (owner_id, document_id, version_id, ordinal);
create index relations_source_idx
  on public.relations (owner_id, source_item_id, status);
create index relations_target_idx
  on public.relations (owner_id, target_item_id, status);
create index item_evidence_item_idx
  on public.item_evidence (owner_id, item_id);
create index relation_evidence_relation_idx
  on public.relation_evidence (owner_id, relation_id);
create index import_entries_status_idx
  on public.import_entries (import_job_id, status);

create index knowledge_items_title_trgm_idx
  on public.knowledge_items using gin (normalized_title extensions.gin_trgm_ops);
create index item_aliases_alias_trgm_idx
  on public.item_aliases using gin (normalized_alias extensions.gin_trgm_ops);
create index document_sections_heading_trgm_idx
  on public.document_sections using gin (heading extensions.gin_trgm_ops)
  where heading is not null;
create index document_sections_content_trgm_idx
  on public.document_sections using gin (content extensions.gin_trgm_ops)
  where length(btrim(content)) > 0;
create index tags_name_trgm_idx
  on public.tags using gin (normalized_name extensions.gin_trgm_ops);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger user_settings_set_updated_at
before update on public.user_settings
for each row execute function public.set_updated_at();

create trigger categories_set_updated_at
before update on public.categories
for each row execute function public.set_updated_at();

create trigger tags_set_updated_at
before update on public.tags
for each row execute function public.set_updated_at();

create trigger knowledge_items_set_updated_at
before update on public.knowledge_items
for each row execute function public.set_updated_at();

create trigger import_entries_set_updated_at
before update on public.import_entries
for each row execute function public.set_updated_at();

create or replace function public.enforce_category_depth()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  parent_parent_id uuid;
begin
  if new.parent_id is null then
    return new;
  end if;

  select parent.parent_id
  into parent_parent_id
  from public.categories as parent
  where parent.id = new.parent_id
    and parent.owner_id = new.owner_id;

  if not found then
    raise exception 'CATEGORY_PARENT_NOT_OWNED';
  end if;

  if parent_parent_id is not null then
    raise exception 'CATEGORY_MAX_DEPTH_EXCEEDED';
  end if;

  return new;
end;
$$;

create trigger categories_enforce_depth
before insert or update of parent_id, owner_id on public.categories
for each row execute function public.enforce_category_depth();

create or replace function public.validate_knowledge_node_type()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.node_types
    where id = new.node_type_id
      and is_active
      and (owner_id is null or owner_id = new.owner_id)
  ) then
    raise exception 'NODE_TYPE_NOT_AVAILABLE';
  end if;

  if tg_op = 'UPDATE' and new.node_type_id <> old.node_type_id then
    if exists (select 1 from public.projects where item_id = old.id)
       and not exists (
         select 1 from public.node_types
         where id = new.node_type_id and key = 'project'
       ) then
      raise exception 'PROJECT_NODE_TYPE_IMMUTABLE';
    end if;

    if exists (select 1 from public.documents where item_id = old.id)
       and not exists (
         select 1 from public.node_types
         where id = new.node_type_id and key = 'document'
       ) then
      raise exception 'DOCUMENT_NODE_TYPE_IMMUTABLE';
    end if;
  end if;

  return new;
end;
$$;

create trigger knowledge_items_validate_node_type
before insert or update of node_type_id, owner_id on public.knowledge_items
for each row execute function public.validate_knowledge_node_type();

create or replace function public.validate_item_extension_type()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actual_type text;
begin
  select node_type.key
  into actual_type
  from public.knowledge_items as item
  join public.node_types as node_type on node_type.id = item.node_type_id
  where item.id = new.item_id
    and item.owner_id = new.owner_id;

  if actual_type is distinct from tg_argv[0] then
    raise exception 'ITEM_EXTENSION_TYPE_MISMATCH: expected %, received %', tg_argv[0], actual_type;
  end if;

  return new;
end;
$$;

create trigger projects_validate_item_type
before insert or update of item_id, owner_id on public.projects
for each row execute function public.validate_item_extension_type('project');

create trigger documents_validate_item_type
before insert or update of item_id, owner_id on public.documents
for each row execute function public.validate_item_extension_type('document');

create or replace function public.protect_document_version_source()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.owner_id <> old.owner_id
    or new.document_id <> old.document_id
    or new.version_number <> old.version_number
    or new.source_filename <> old.source_filename
    or new.format <> old.format
    or new.mime_type <> old.mime_type
    or new.size_bytes <> old.size_bytes
    or new.storage_path <> old.storage_path
    or new.content_hash <> old.content_hash
    or new.raw_markdown is distinct from old.raw_markdown
    or new.change_reason <> old.change_reason
    or new.created_at <> old.created_at
  then
    raise exception 'DOCUMENT_VERSION_SOURCE_IS_IMMUTABLE';
  end if;

  return new;
end;
$$;

create trigger document_versions_protect_source
before update on public.document_versions
for each row execute function public.protect_document_version_source();

create or replace function public.normalize_and_validate_relation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  relation_type_record public.relation_types%rowtype;
  source_type_key text;
  target_type_key text;
begin
  select *
  into relation_type_record
  from public.relation_types
  where id = new.relation_type_id
    and is_active
    and (owner_id is null or owner_id = new.owner_id);

  if not found then
    raise exception 'RELATION_TYPE_NOT_AVAILABLE';
  end if;

  select node_type.key
  into source_type_key
  from public.knowledge_items as item
  join public.node_types as node_type on node_type.id = item.node_type_id
  where item.id = new.source_item_id and item.owner_id = new.owner_id;

  select node_type.key
  into target_type_key
  from public.knowledge_items as item
  join public.node_types as node_type on node_type.id = item.node_type_id
  where item.id = new.target_item_id and item.owner_id = new.owner_id;

  if source_type_key is null or target_type_key is null then
    raise exception 'RELATION_ENDPOINT_NOT_OWNED';
  end if;

  if cardinality(relation_type_record.allowed_source_types) > 0
     and not source_type_key = any(relation_type_record.allowed_source_types) then
    raise exception 'RELATION_SOURCE_TYPE_NOT_ALLOWED';
  end if;

  if cardinality(relation_type_record.allowed_target_types) > 0
     and not target_type_key = any(relation_type_record.allowed_target_types) then
    raise exception 'RELATION_TARGET_TYPE_NOT_ALLOWED';
  end if;

  if relation_type_record.is_symmetric and new.source_item_id > new.target_item_id then
    new.canonical_source_item_id = new.target_item_id;
    new.canonical_target_item_id = new.source_item_id;
  else
    new.canonical_source_item_id = new.source_item_id;
    new.canonical_target_item_id = new.target_item_id;
  end if;

  return new;
end;
$$;

create trigger relations_normalize_and_validate
before insert or update of owner_id, source_item_id, target_item_id, relation_type_id
on public.relations
for each row execute function public.normalize_and_validate_relation();

insert into public.node_types (
  owner_id,
  key,
  label_ko,
  label_en,
  description,
  color,
  icon_key,
  is_system,
  sort_order
)
values
  (null, 'document', '문서', 'Document', '원본 파일 또는 사용자가 작성한 문서', '#60A5FA', 'file-text', true, 10),
  (null, 'project', '프로젝트', 'Project', '독립된 서비스·수업·연구·시스템', '#A78BFA', 'folder-kanban', true, 20),
  (null, 'concept', '개념', 'Concept', '설명하고 연결할 가치가 있는 일반 개념', '#34D399', 'lightbulb', true, 30),
  (null, 'technology', '기술', 'Technology', '라이브러리·프로토콜·플랫폼·API', '#22D3EE', 'cpu', true, 40),
  (null, 'problem', '문제', 'Problem', '특정 맥락에서 실제 발생한 실패·오류·제약', '#F87171', 'circle-alert', true, 50),
  (null, 'solution', '해결', 'Solution', '문제를 해결한 조치 또는 구조', '#4ADE80', 'circle-check', true, 60),
  (null, 'decision', '결정', 'Decision', '대안을 비교해 선택한 판단 또는 변경', '#FBBF24', 'git-branch', true, 70),
  (null, 'pattern', '재사용 패턴', 'Pattern', '여러 프로젝트에 적용 가능한 재사용 구조', '#2DD4BF', 'workflow', true, 80),
  (null, 'anti_pattern', '위험·금지 패턴', 'Anti-pattern', '반복하지 않아야 하는 일반화된 접근', '#FB7185', 'ban', true, 90),
  (null, 'idea', '아이디어', 'Idea', '아직 실행·검증되지 않은 제안', '#E879F9', 'sparkles', true, 100),
  (null, 'lesson', '현장 교훈', 'Lesson', '실제 환경에서 얻은 재사용 가능한 교훈', '#FB923C', 'graduation-cap', true, 110);

insert into public.relation_types (
  owner_id,
  key,
  label_ko,
  label_en,
  inverse_label_ko,
  description,
  is_directional,
  is_symmetric,
  allowed_source_types,
  allowed_target_types,
  color,
  line_style,
  is_system,
  sort_order
)
values
  (null, 'DOCUMENTS', '기록한다', 'Documents', '기록된다', '문서가 대상 Node를 주로 기록한다', true, false, array['document'], array['project','concept','technology','problem','solution','decision','pattern','anti_pattern','idea','lesson'], '#60A5FA', 'solid', true, 10),
  (null, 'PART_OF', '일부이다', 'Part of', '포함한다', '구성 또는 소속 관계', true, false, '{}'::text[], array['project','concept'], '#94A3B8', 'solid', true, 20),
  (null, 'RELATED_TO', '관련 있다', 'Related to', '관련 있다', '더 구체적인 관계가 없을 때만 사용하는 대칭 관계', false, true, '{}'::text[], '{}'::text[], '#64748B', 'dashed', true, 30),
  (null, 'USES', '사용한다', 'Uses', '사용된다', '실제 사용이 근거로 확인된 관계', true, false, array['project','pattern'], array['technology','concept'], '#22D3EE', 'solid', true, 40),
  (null, 'HAS_PROBLEM', '문제를 가진다', 'Has problem', '문제로 발생한다', '프로젝트에서 발생한 실제 문제', true, false, array['project'], array['problem'], '#F87171', 'solid', true, 50),
  (null, 'RESOLVED_BY', '해결된다', 'Resolved by', '해결한다', '문제와 확인된 해결 방법', true, false, array['problem'], array['solution'], '#4ADE80', 'solid', true, 60),
  (null, 'MADE_DECISION', '결정을 내렸다', 'Made decision', '결정되었다', '프로젝트의 선택 이유가 있는 판단 이력', true, false, array['project'], array['decision'], '#FBBF24', 'solid', true, 70),
  (null, 'CHANGED_TO', '변경되었다', 'Changed to', '변경 전이다', '이전과 이후가 명확한 변경', true, false, array['decision','technology','pattern'], array['decision','technology','pattern'], '#F59E0B', 'solid', true, 80),
  (null, 'REUSES_PATTERN', '패턴을 재사용한다', 'Reuses pattern', '재사용된다', '프로젝트에 실제 적용되었거나 명시된 패턴', true, false, array['project'], array['pattern'], '#2DD4BF', 'solid', true, 90),
  (null, 'AVOIDS', '피한다', 'Avoids', '회피 대상이다', '의도적으로 배제한 방식', true, false, array['project','decision'], array['anti_pattern'], '#FB7185', 'dashed', true, 100),
  (null, 'SUPPORTS', '뒷받침한다', 'Supports', '뒷받침된다', '의미적 또는 근거상 지원 관계', true, false, '{}'::text[], '{}'::text[], '#34D399', 'solid', true, 110),
  (null, 'CONTRADICTS', '충돌한다', 'Contradicts', '충돌한다', '양립할 수 없거나 불일치하는 대칭 관계', false, true, '{}'::text[], '{}'::text[], '#EF4444', 'dashed', true, 120),
  (null, 'INSPIRED_BY', '영감을 받았다', 'Inspired by', '영감을 주었다', '아이디어 또는 프로젝트의 파생 근거', true, false, array['idea','project'], '{}'::text[], '#E879F9', 'dotted', true, 130);

create or replace function public.seed_profile_defaults()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_settings (owner_id)
  values (new.id)
  on conflict (owner_id) do nothing;

  insert into public.categories (owner_id, name, color, icon_key, sort_order)
  values
    (new.id, 'Education', '#3B82F6', 'graduation-cap', 10),
    (new.id, 'Development', '#06B6D4', 'code-2', 20),
    (new.id, 'Genius Games', '#8B5CF6', 'brain', 30),
    (new.id, 'School Operations', '#64748B', 'school', 40),
    (new.id, 'Research', '#10B981', 'flask-conical', 50),
    (new.id, 'Ideas', '#D946EF', 'sparkles', 60),
    (new.id, 'Utilities', '#F59E0B', 'wrench', 70),
    (new.id, 'References', '#6366F1', 'library', 80),
    (new.id, 'Personal Notes', '#EC4899', 'notebook-pen', 90)
  on conflict do nothing;

  return new;
end;
$$;

create trigger profiles_seed_defaults
after insert on public.profiles
for each row execute function public.seed_profile_defaults();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''))
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_knowledge_os_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

insert into public.profiles (id, display_name)
select
  auth_user.id,
  nullif(btrim(auth_user.raw_user_meta_data ->> 'display_name'), '')
from auth.users as auth_user
on conflict (id) do nothing;

insert into public.user_settings (owner_id)
select id from public.profiles
on conflict (owner_id) do nothing;

insert into public.categories (owner_id, name, color, icon_key, sort_order)
select profile.id, default_category.name, default_category.color, default_category.icon_key, default_category.sort_order
from public.profiles as profile
cross join (
  values
    ('Education', '#3B82F6', 'graduation-cap', 10),
    ('Development', '#06B6D4', 'code-2', 20),
    ('Genius Games', '#8B5CF6', 'brain', 30),
    ('School Operations', '#64748B', 'school', 40),
    ('Research', '#10B981', 'flask-conical', 50),
    ('Ideas', '#D946EF', 'sparkles', 60),
    ('Utilities', '#F59E0B', 'wrench', 70),
    ('References', '#6366F1', 'library', 80),
    ('Personal Notes', '#EC4899', 'notebook-pen', 90)
) as default_category(name, color, icon_key, sort_order)
on conflict do nothing;

do $$
declare
  owned_table text;
begin
  foreach owned_table in array array[
    'categories',
    'tags',
    'tag_aliases',
    'knowledge_items',
    'item_aliases',
    'item_tags',
    'projects',
    'documents',
    'document_versions',
    'document_sections',
    'item_evidence',
    'relations',
    'relation_evidence',
    'import_jobs',
    'import_entries'
  ]
  loop
    execute format('alter table public.%I enable row level security', owned_table);
    execute format('revoke all on table public.%I from anon, authenticated', owned_table);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', owned_table);
    execute format(
      'create policy %I on public.%I for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id)',
      owned_table || '_owner_all',
      owned_table
    );
  end loop;
end;
$$;

revoke delete on table public.document_versions from authenticated;

alter table public.profiles enable row level security;
revoke all on table public.profiles from anon, authenticated;
grant select, update on table public.profiles to authenticated;
create policy profiles_owner_select
on public.profiles for select to authenticated
using ((select auth.uid()) = id);
create policy profiles_owner_update
on public.profiles for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

alter table public.user_settings enable row level security;
revoke all on table public.user_settings from anon, authenticated;
grant select, update on table public.user_settings to authenticated;
create policy user_settings_owner_select
on public.user_settings for select to authenticated
using ((select auth.uid()) = owner_id);
create policy user_settings_owner_update
on public.user_settings for update to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

alter table public.node_types enable row level security;
revoke all on table public.node_types from anon, authenticated;
grant select, insert, update, delete on table public.node_types to authenticated;
create policy node_types_available_select
on public.node_types for select to authenticated
using (owner_id is null or owner_id = (select auth.uid()));
create policy node_types_custom_insert
on public.node_types for insert to authenticated
with check (owner_id = (select auth.uid()) and not is_system);
create policy node_types_custom_update
on public.node_types for update to authenticated
using (owner_id = (select auth.uid()) and not is_system)
with check (owner_id = (select auth.uid()) and not is_system);
create policy node_types_custom_delete
on public.node_types for delete to authenticated
using (owner_id = (select auth.uid()) and not is_system);

alter table public.relation_types enable row level security;
revoke all on table public.relation_types from anon, authenticated;
grant select, insert, update, delete on table public.relation_types to authenticated;
create policy relation_types_available_select
on public.relation_types for select to authenticated
using (owner_id is null or owner_id = (select auth.uid()));
create policy relation_types_custom_insert
on public.relation_types for insert to authenticated
with check (owner_id = (select auth.uid()) and not is_system);
create policy relation_types_custom_update
on public.relation_types for update to authenticated
using (owner_id = (select auth.uid()) and not is_system)
with check (owner_id = (select auth.uid()) and not is_system);
create policy relation_types_custom_delete
on public.relation_types for delete to authenticated
using (owner_id = (select auth.uid()) and not is_system);

grant usage on schema public to authenticated;
grant usage on type
  public.app_theme,
  public.default_view,
  public.item_status,
  public.content_origin,
  public.verification_status,
  public.project_kind,
  public.project_lifecycle_status,
  public.document_kind,
  public.document_format,
  public.parse_status,
  public.version_change_reason,
  public.section_chunk_kind,
  public.evidence_role,
  public.relation_status,
  public.import_type,
  public.import_job_status,
  public.import_entry_status
to authenticated;
revoke all on function public.normalize_lookup_text(text) from public, anon;
grant execute on function public.normalize_lookup_text(text) to authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.enforce_category_depth() from public, anon, authenticated;
revoke all on function public.validate_knowledge_node_type() from public, anon, authenticated;
revoke all on function public.validate_item_extension_type() from public, anon, authenticated;
revoke all on function public.protect_document_version_source() from public, anon, authenticated;
revoke all on function public.normalize_and_validate_relation() from public, anon, authenticated;
revoke all on function public.seed_profile_defaults() from public, anon, authenticated;
revoke all on function public.handle_new_auth_user() from public, anon, authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'knowledge-originals',
  'knowledge-originals',
  false,
  52428800,
  array[
    'text/markdown',
    'text/plain',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy knowledge_originals_owner_select
on storage.objects for select to authenticated
using (
  bucket_id = 'knowledge-originals'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy knowledge_originals_owner_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'knowledge-originals'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy knowledge_originals_owner_update
on storage.objects for update to authenticated
using (
  bucket_id = 'knowledge-originals'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'knowledge-originals'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy knowledge_originals_owner_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'knowledge-originals'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

commit;

begin;

create type public.visual_analysis_kind as enum (
  'relationship',
  'comparison',
  'pattern'
);

create type public.visual_analysis_status as enum (
  'queued',
  'processing',
  'completed',
  'partial',
  'failed',
  'superseded'
);

create type public.visual_insight_kind as enum (
  'commonality',
  'difference',
  'technical_link',
  'reusable_component',
  'recurring_problem',
  'solution_pattern',
  'development_pattern',
  'educational_link'
);

create type public.visual_insight_status as enum (
  'proposed',
  'accepted',
  'rejected',
  'superseded'
);

create type public.visual_insight_item_role as enum (
  'subject',
  'source',
  'target',
  'contrast',
  'example',
  'problem',
  'solution'
);

create table public.visual_analysis_runs (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  analysis_kind public.visual_analysis_kind not null,
  status public.visual_analysis_status not null default 'queued',
  model text,
  schema_version text not null default 'visual-relations-v1',
  prompt_version text,
  input_fingerprint text,
  source_revision_at timestamptz not null default now(),
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  constraint visual_analysis_runs_id_owner_unique unique (id, owner_id),
  constraint visual_analysis_runs_model_not_blank
    check (model is null or length(btrim(model)) > 0),
  constraint visual_analysis_runs_schema_version_not_blank
    check (length(btrim(schema_version)) > 0),
  constraint visual_analysis_runs_input_fingerprint_sha256
    check (input_fingerprint is null or input_fingerprint ~ '^[0-9a-f]{64}$'),
  constraint visual_analysis_runs_time_order check (
    (started_at is null or started_at >= created_at)
    and (completed_at is null or started_at is null or completed_at >= started_at)
  )
);

create index visual_analysis_runs_owner_kind_created_idx
on public.visual_analysis_runs (owner_id, analysis_kind, created_at desc);

create unique index visual_analysis_runs_owner_active_fingerprint_uidx
on public.visual_analysis_runs (owner_id, analysis_kind, input_fingerprint)
where input_fingerprint is not null and status in ('queued', 'processing', 'completed');

create table public.visual_analysis_scope (
  owner_id uuid not null references public.profiles(id) on delete cascade,
  analysis_id uuid not null,
  item_id uuid not null,
  scope_role text not null default 'subject',
  ordinal integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (analysis_id, item_id),
  constraint visual_analysis_scope_role_allowed
    check (scope_role in ('focus', 'subject', 'context', 'comparison')),
  constraint visual_analysis_scope_ordinal_nonnegative check (ordinal >= 0),
  constraint visual_analysis_scope_analysis_owner_fk
    foreign key (analysis_id, owner_id)
    references public.visual_analysis_runs(id, owner_id)
    on delete cascade,
  constraint visual_analysis_scope_item_owner_fk
    foreign key (item_id, owner_id)
    references public.knowledge_items(id, owner_id)
    on delete cascade
);

create index visual_analysis_scope_owner_item_idx
on public.visual_analysis_scope (owner_id, item_id, analysis_id);

create table public.visual_insights (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  analysis_id uuid not null,
  insight_kind public.visual_insight_kind not null,
  dimension text not null,
  title text not null,
  summary text not null,
  confidence numeric(4, 3),
  importance smallint not null default 0,
  status public.visual_insight_status not null default 'proposed',
  origin public.content_origin not null default 'ai_proposed',
  properties jsonb not null default '{}'::jsonb,
  promoted_relation_id uuid,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  constraint visual_insights_id_owner_unique unique (id, owner_id),
  constraint visual_insights_title_not_blank check (length(btrim(title)) > 0),
  constraint visual_insights_summary_not_blank check (length(btrim(summary)) > 0),
  constraint visual_insights_dimension_format check (dimension ~ '^[a-z][a-z0-9_]*$'),
  constraint visual_insights_confidence_range
    check (confidence is null or confidence between 0 and 1),
  constraint visual_insights_importance_range check (importance between 0 and 5),
  constraint visual_insights_properties_object check (jsonb_typeof(properties) = 'object'),
  constraint visual_insights_origin_allowed
    check (origin in ('user', 'ai_proposed', 'ai_accepted')),
  constraint visual_insights_acceptance_consistency check (
    (status = 'accepted' and origin in ('user', 'ai_accepted'))
    or status <> 'accepted'
  ),
  constraint visual_insights_analysis_owner_fk
    foreign key (analysis_id, owner_id)
    references public.visual_analysis_runs(id, owner_id)
    on delete cascade,
  constraint visual_insights_promoted_relation_owner_fk
    foreign key (promoted_relation_id, owner_id)
    references public.relations(id, owner_id)
    on delete set null (promoted_relation_id)
);

create index visual_insights_owner_kind_status_idx
on public.visual_insights (owner_id, insight_kind, status, importance desc);

create index visual_insights_owner_dimension_idx
on public.visual_insights (owner_id, dimension, status);

create table public.visual_insight_items (
  owner_id uuid not null references public.profiles(id) on delete cascade,
  insight_id uuid not null,
  item_id uuid not null,
  item_role public.visual_insight_item_role not null default 'subject',
  ordinal integer not null default 0,
  weight numeric(4, 3),
  created_at timestamptz not null default now(),
  primary key (insight_id, item_id, item_role),
  constraint visual_insight_items_ordinal_nonnegative check (ordinal >= 0),
  constraint visual_insight_items_weight_range check (weight is null or weight between 0 and 1),
  constraint visual_insight_items_insight_owner_fk
    foreign key (insight_id, owner_id)
    references public.visual_insights(id, owner_id)
    on delete cascade,
  constraint visual_insight_items_item_owner_fk
    foreign key (item_id, owner_id)
    references public.knowledge_items(id, owner_id)
    on delete cascade
);

create index visual_insight_items_owner_item_idx
on public.visual_insight_items (owner_id, item_id, insight_id);

create table public.visual_insight_evidence (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  insight_id uuid not null,
  item_id uuid not null,
  document_id uuid not null,
  version_id uuid not null,
  section_id uuid,
  evidence_text text not null,
  created_at timestamptz not null default now(),
  constraint visual_insight_evidence_text_not_blank check (length(btrim(evidence_text)) > 0),
  constraint visual_insight_evidence_insight_owner_fk
    foreign key (insight_id, owner_id)
    references public.visual_insights(id, owner_id)
    on delete cascade,
  constraint visual_insight_evidence_item_owner_fk
    foreign key (item_id, owner_id)
    references public.knowledge_items(id, owner_id)
    on delete cascade,
  constraint visual_insight_evidence_version_owner_fk
    foreign key (version_id, document_id, owner_id)
    references public.document_versions(id, document_id, owner_id)
    on delete cascade,
  constraint visual_insight_evidence_section_owner_fk
    foreign key (section_id, version_id, document_id, owner_id)
    references public.document_sections(id, version_id, document_id, owner_id)
    on delete cascade
);

create index visual_insight_evidence_owner_insight_idx
on public.visual_insight_evidence (owner_id, insight_id, created_at);

alter table public.visual_analysis_runs enable row level security;
alter table public.visual_analysis_scope enable row level security;
alter table public.visual_insights enable row level security;
alter table public.visual_insight_items enable row level security;
alter table public.visual_insight_evidence enable row level security;

revoke all on table
  public.visual_analysis_runs,
  public.visual_analysis_scope,
  public.visual_insights,
  public.visual_insight_items,
  public.visual_insight_evidence
from public, anon, authenticated;

grant select on table
  public.visual_analysis_runs,
  public.visual_analysis_scope,
  public.visual_insights,
  public.visual_insight_items,
  public.visual_insight_evidence
to authenticated;

create policy visual_analysis_runs_owner_select on public.visual_analysis_runs
for select to authenticated using ((select auth.uid()) = owner_id);

create policy visual_analysis_scope_owner_select on public.visual_analysis_scope
for select to authenticated using ((select auth.uid()) = owner_id);

create policy visual_insights_owner_select on public.visual_insights
for select to authenticated using ((select auth.uid()) = owner_id);

create policy visual_insight_items_owner_select on public.visual_insight_items
for select to authenticated using ((select auth.uid()) = owner_id);

create policy visual_insight_evidence_owner_select on public.visual_insight_evidence
for select to authenticated using ((select auth.uid()) = owner_id);

create or replace function public.get_visual_relationship_foundation(
  p_item_ids uuid[] default null,
  p_insight_kinds public.visual_insight_kind[] default null,
  p_limit integer default 200
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $function$
declare
  current_owner uuid := auth.uid();
  safe_limit integer := least(greatest(coalesce(p_limit, 200), 1), 500);
  result jsonb;
begin
  if current_owner is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if p_item_ids is not null and exists (
    select 1 from unnest(p_item_ids) as requested(item_id)
    left join public.knowledge_items as item
      on item.id = requested.item_id and item.owner_id = current_owner
        and item.deleted_at is null and item.merged_into_id is null
    where item.id is null
  ) then raise exception 'VISUAL_SCOPE_ITEM_NOT_FOUND'; end if;

  with eligible_insights as (
    select insight.*
    from public.visual_insights as insight
    where insight.owner_id = current_owner
      and insight.status in ('proposed', 'accepted')
      and (p_insight_kinds is null or insight.insight_kind = any(p_insight_kinds))
      and (
        p_item_ids is null
        or cardinality(p_item_ids) = 0
        or exists (
          select 1 from public.visual_insight_items as member
          where member.insight_id = insight.id
            and member.owner_id = current_owner
            and member.item_id = any(p_item_ids)
        )
      )
    order by insight.importance desc, insight.confidence desc nulls last, insight.created_at desc
    limit safe_limit
  ),
  insight_rows as (
    select jsonb_build_object(
      'id', insight.id,
      'analysis_id', insight.analysis_id,
      'insight_kind', insight.insight_kind,
      'dimension', insight.dimension,
      'title', insight.title,
      'summary', insight.summary,
      'confidence', insight.confidence,
      'importance', insight.importance,
      'status', insight.status,
      'origin', insight.origin,
      'properties', insight.properties,
      'promoted_relation_id', insight.promoted_relation_id,
      'items', coalesce(members.rows, '[]'::jsonb),
      'evidence', coalesce(evidence.rows, '[]'::jsonb)
    ) as value
    from eligible_insights as insight
    left join lateral (
      select jsonb_agg(jsonb_build_object(
        'item_id', member.item_id,
        'title', item.title,
        'summary', item.summary,
        'node_type_key', node_type.key,
        'node_type_label', node_type.label_ko,
        'node_type_color', node_type.color,
        'item_role', member.item_role,
        'ordinal', member.ordinal,
        'weight', member.weight
      ) order by member.ordinal, item.title) as rows
      from public.visual_insight_items as member
      join public.knowledge_items as item on item.id = member.item_id
      join public.node_types as node_type on node_type.id = item.node_type_id
      where member.insight_id = insight.id and member.owner_id = current_owner
    ) as members on true
    left join lateral (
      select jsonb_agg(jsonb_build_object(
        'id', source.id,
        'item_id', source.item_id,
        'document_id', source.document_id,
        'version_id', source.version_id,
        'section_id', source.section_id,
        'heading_path', section.heading_path,
        'evidence_text', source.evidence_text
      ) order by source.created_at) as rows
      from public.visual_insight_evidence as source
      left join public.document_sections as section on section.id = source.section_id
      where source.insight_id = insight.id and source.owner_id = current_owner
    ) as evidence on true
  ),
  existing_relation_rows as (
    select jsonb_build_object(
      'id', relation.id,
      'source_item_id', relation.source_item_id,
      'target_item_id', relation.target_item_id,
      'relation_type_key', relation_type.key,
      'relation_type_label', relation_type.label_ko,
      'color', relation_type.color,
      'line_style', relation_type.line_style,
      'status', relation.status,
      'confidence', relation.confidence,
      'rationale', relation.rationale,
      'evidence_count', (
        select count(*) from public.relation_evidence
        where relation_id = relation.id and owner_id = current_owner
      )
    ) as value
    from public.relations as relation
    join public.relation_types as relation_type on relation_type.id = relation.relation_type_id
    where relation.owner_id = current_owner
      and relation.deleted_at is null
      and relation.status in ('active', 'proposed')
      and (
        p_item_ids is null
        or cardinality(p_item_ids) = 0
        or relation.source_item_id = any(p_item_ids)
        or relation.target_item_id = any(p_item_ids)
      )
    order by case when relation.status = 'active' then 0 else 1 end, relation.created_at desc
    limit safe_limit
  ),
  dimension_rows as (
    select jsonb_build_object(
      'dimension', insight.dimension,
      'count', count(*),
      'accepted_count', count(*) filter (where insight.status = 'accepted')
    ) as value
    from eligible_insights as insight
    group by insight.dimension
    order by count(*) desc, insight.dimension
  )
  select jsonb_build_object(
    'schema_version', 'visual-relations-v1',
    'insights', coalesce((select jsonb_agg(value) from insight_rows), '[]'::jsonb),
    'existing_relations', coalesce((select jsonb_agg(value) from existing_relation_rows), '[]'::jsonb),
    'dimensions', coalesce((select jsonb_agg(value) from dimension_rows), '[]'::jsonb)
  ) into result;
  return result;
end;
$function$;

revoke all on function public.get_visual_relationship_foundation(
  uuid[], public.visual_insight_kind[], integer
) from public, anon;
grant execute on function public.get_visual_relationship_foundation(
  uuid[], public.visual_insight_kind[], integer
) to authenticated;

commit;

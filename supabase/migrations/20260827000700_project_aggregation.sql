begin;

create or replace function public.get_project_aggregate(p_project_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $function$
declare
  current_owner uuid := auth.uid();
  result jsonb;
begin
  if current_owner is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  perform 1
  from public.projects as project
  join public.knowledge_items as item on item.id = project.item_id
  where project.item_id = p_project_id
    and project.owner_id = current_owner
    and item.deleted_at is null
    and item.merged_into_id is null;
  if not found then
    raise exception 'PROJECT_NOT_FOUND';
  end if;

  with project_documents as (
    select distinct relation.source_item_id as document_id
    from public.relations as relation
    join public.relation_types as relation_type on relation_type.id = relation.relation_type_id
    join public.documents as document on document.item_id = relation.source_item_id
    where relation.owner_id = current_owner
      and relation.target_item_id = p_project_id
      and relation_type.key = 'DOCUMENTS'
      and relation.status in ('active', 'proposed')
      and relation.deleted_at is null
    union
    select (item.properties ->> 'source_document_id')::uuid
    from public.knowledge_items as item
    where item.id = p_project_id
      and item.owner_id = current_owner
      and coalesce(item.properties ->> 'source_document_id', '')
        ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ),
  related_ids as (
    select p_project_id as item_id
    union
    select document_id from project_documents
    union
    select case
      when relation.source_item_id = p_project_id then relation.target_item_id
      else relation.source_item_id
    end
    from public.relations as relation
    where relation.owner_id = current_owner
      and relation.deleted_at is null
      and relation.status in ('active', 'proposed')
      and (relation.source_item_id = p_project_id or relation.target_item_id = p_project_id)
    union
    select item.id
    from public.knowledge_items as item
    where item.owner_id = current_owner
      and item.deleted_at is null
      and item.merged_into_id is null
      and case
        when coalesce(item.properties ->> 'source_document_id', '')
          ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then (item.properties ->> 'source_document_id')::uuid
        else null
      end in (select document_id from project_documents)
    union
    select case
      when relation.source_item_id in (
        select case
          when direct_relation.source_item_id = p_project_id then direct_relation.target_item_id
          else direct_relation.source_item_id
        end
        from public.relations as direct_relation
        where direct_relation.owner_id = current_owner
          and direct_relation.deleted_at is null
          and direct_relation.status in ('active', 'proposed')
          and (
            direct_relation.source_item_id = p_project_id
            or direct_relation.target_item_id = p_project_id
          )
      ) then relation.target_item_id
      else relation.source_item_id
    end
    from public.relations as relation
    join public.relation_types as relation_type on relation_type.id = relation.relation_type_id
    where relation.owner_id = current_owner
      and relation.deleted_at is null
      and relation.status in ('active', 'proposed')
      and relation_type.key = 'RESOLVED_BY'
      and (
        relation.source_item_id in (
          select case
            when direct_relation.source_item_id = p_project_id then direct_relation.target_item_id
            else direct_relation.source_item_id
          end
          from public.relations as direct_relation
          where direct_relation.owner_id = current_owner
            and direct_relation.deleted_at is null
            and direct_relation.status in ('active', 'proposed')
            and (
              direct_relation.source_item_id = p_project_id
              or direct_relation.target_item_id = p_project_id
            )
        )
        or relation.target_item_id in (
          select case
            when direct_relation.source_item_id = p_project_id then direct_relation.target_item_id
            else direct_relation.source_item_id
          end
          from public.relations as direct_relation
          where direct_relation.owner_id = current_owner
            and direct_relation.deleted_at is null
            and direct_relation.status in ('active', 'proposed')
            and (
              direct_relation.source_item_id = p_project_id
              or direct_relation.target_item_id = p_project_id
            )
        )
      )
  ),
  node_rows as (
    select
      item.id,
      node_type.key as node_type_key,
      node_type.label_ko as node_type_label,
      node_type.color as node_type_color,
      item.title,
      item.summary,
      item.status,
      item.verification_status,
      item.updated_at,
      category.name as category_name,
      evidence.document_id,
      evidence.version_id,
      evidence.section_id,
      evidence.evidence_text,
      evidence.evidence_role,
      evidence.heading_path,
      evidence.locator
    from related_ids
    join public.knowledge_items as item on item.id = related_ids.item_id
    join public.node_types as node_type on node_type.id = item.node_type_id
    left join public.categories as category on category.id = item.category_id
    left join lateral (
      select
        item_evidence.document_id,
        item_evidence.version_id,
        item_evidence.section_id,
        item_evidence.evidence_text,
        item_evidence.evidence_role,
        section.heading_path,
        section.locator
      from public.item_evidence as item_evidence
      left join public.document_sections as section on section.id = item_evidence.section_id
      where item_evidence.item_id = item.id
        and item_evidence.owner_id = current_owner
      order by
        case item_evidence.evidence_role
          when 'definition' then 0
          when 'implementation_status' then 1
          else 2
        end,
        item_evidence.created_at
      limit 1
    ) as evidence on true
    where item.owner_id = current_owner
      and item.id <> p_project_id
      and item.deleted_at is null
      and item.merged_into_id is null
  ),
  document_rows as (
    select
      item.id,
      item.title,
      item.summary,
      item.status,
      item.verification_status,
      document.document_kind,
      version.id as version_id,
      version.format,
      version.source_filename,
      version.parse_status,
      section.id as section_id,
      section.heading_path,
      section.locator
    from project_documents
    join public.knowledge_items as item on item.id = project_documents.document_id
    join public.documents as document on document.item_id = item.id
    left join public.document_versions as version on version.id = document.active_version_id
    left join lateral (
      select id, heading_path, locator
      from public.document_sections
      where version_id = version.id and owner_id = current_owner
      order by ordinal
      limit 1
    ) as section on true
    where item.owner_id = current_owner and item.deleted_at is null
  ),
  relation_rows as (
    select
      relation.id,
      relation.source_item_id,
      relation.target_item_id,
      relation_type.key as relation_type_key,
      relation_type.label_ko as relation_type_label,
      relation.status,
      relation.rationale
    from public.relations as relation
    join public.relation_types as relation_type on relation_type.id = relation.relation_type_id
    where relation.owner_id = current_owner
      and relation.deleted_at is null
      and relation.status in ('active', 'proposed')
      and relation.source_item_id in (select item_id from related_ids)
      and relation.target_item_id in (select item_id from related_ids)
  ),
  stats as (
    select jsonb_build_object(
      'documents', (select count(*) from document_rows),
      'problems', (select count(*) from node_rows where node_type_key = 'problem'),
      'solutions', (select count(*) from node_rows where node_type_key = 'solution'),
      'decisions', (select count(*) from node_rows where node_type_key = 'decision'),
      'patterns', (select count(*) from node_rows where node_type_key in ('pattern', 'anti_pattern')),
      'lessons', (select count(*) from node_rows where node_type_key = 'lesson'),
      'confirmed', (select count(*) from node_rows where verification_status = 'confirmed'),
      'needs_review', (select count(*) from node_rows where verification_status <> 'confirmed'),
      'evidence_coverage', coalesce((
        select round(100.0 * count(*) filter (where section_id is not null) / nullif(count(*), 0))
        from node_rows
      ), 0)
    ) as value
  )
  select jsonb_build_object(
    'stats', (select value from stats),
    'documents', coalesce((select jsonb_agg(to_jsonb(document_rows) order by title) from document_rows), '[]'::jsonb),
    'nodes', coalesce((select jsonb_agg(to_jsonb(node_rows) order by node_type_key, title) from node_rows), '[]'::jsonb),
    'relations', coalesce((select jsonb_agg(to_jsonb(relation_rows) order by relation_type_key) from relation_rows), '[]'::jsonb)
  ) into result;

  return result;
end;
$function$;

revoke all on function public.get_project_aggregate(uuid) from public, anon;
grant execute on function public.get_project_aggregate(uuid) to authenticated;

commit;

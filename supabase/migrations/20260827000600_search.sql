begin;

create index if not exists knowledge_items_summary_trgm_idx
  on public.knowledge_items using gin (
    (public.normalize_lookup_text(coalesce(summary, ''))) extensions.gin_trgm_ops
  );

create or replace function public.search_knowledge(
  p_query text default '',
  p_node_type_keys text[] default null,
  p_category_ids uuid[] default null,
  p_tag_ids uuid[] default null,
  p_project_ids uuid[] default null,
  p_formats public.document_format[] default null,
  p_verification_statuses public.verification_status[] default null,
  p_statuses public.item_status[] default null,
  p_date_from timestamptz default null,
  p_date_to timestamptz default null,
  p_page integer default 1,
  p_page_size integer default 20
)
returns table (
  item_id uuid,
  section_id uuid,
  document_id uuid,
  version_id uuid,
  node_type_key text,
  node_type_label text,
  node_type_color text,
  title text,
  summary text,
  category_id uuid,
  category_name text,
  tags jsonb,
  project_id uuid,
  project_title text,
  format public.document_format,
  heading_path text[],
  locator jsonb,
  snippet text,
  match_reason text,
  score numeric,
  verification_status public.verification_status,
  status public.item_status,
  updated_at timestamptz,
  total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $function$
  with params as (
    select
      public.normalize_lookup_text(coalesce(p_query, '')) as query,
      greatest(coalesce(p_page, 1), 1) as page_number,
      least(greatest(coalesce(p_page_size, 20), 1), 100) as page_size
  ),
  candidates as (
    select
      item.id as item_id,
      best_section.section_id,
      coalesce(best_section.document_id, direct_document.item_id) as document_id,
      coalesce(best_section.version_id, direct_version.id) as version_id,
      node_type.key as node_type_key,
      node_type.label_ko as node_type_label,
      node_type.color as node_type_color,
      item.title,
      item.summary,
      category.id as category_id,
      category.name as category_name,
      coalesce(tag_data.tags, '[]'::jsonb) as tags,
      related_project.project_id,
      related_project.project_title,
      coalesce(best_section.format, direct_version.format) as format,
      coalesce(best_section.heading_path, '{}'::text[]) as heading_path,
      coalesce(best_section.locator, '{}'::jsonb) as locator,
      case
        when best_section.content is null then coalesce(item.summary, item.title)
        when params.query = '' then left(best_section.content, 280)
        when strpos(public.normalize_lookup_text(best_section.content), params.query) > 0 then
          case when strpos(public.normalize_lookup_text(best_section.content), params.query) > 80 then '…' else '' end
          || substring(
            best_section.content
            from greatest(strpos(public.normalize_lookup_text(best_section.content), params.query) - 80, 1)
            for 280
          )
          || case when length(best_section.content) > 280 then '…' else '' end
        else left(best_section.content, 280)
      end as snippet,
      concat_ws(', ',
        case when params.query <> '' and item.normalized_title = params.query then '제목 일치' end,
        case when params.query <> '' and strpos(item.normalized_title, params.query) > 0
          and item.normalized_title <> params.query then '제목 부분 일치' end,
        case when params.query <> '' and strpos(public.normalize_lookup_text(coalesce(item.summary, '')), params.query) > 0
          then '요약 일치' end,
        case when params.query <> '' and strpos(coalesce(alias_data.search_text, ''), params.query) > 0
          then '별칭 일치' end,
        case when params.query <> '' and strpos(coalesce(tag_data.search_text, ''), params.query) > 0
          then '태그 일치' end,
        case when params.query <> '' and strpos(public.normalize_lookup_text(coalesce(category.name, '')), params.query) > 0
          then '카테고리 일치' end,
        case when params.query <> '' and strpos(public.normalize_lookup_text(coalesce(best_section.heading, '')), params.query) > 0
          then 'Section 제목 일치' end,
        case when params.query <> '' and strpos(public.normalize_lookup_text(coalesce(best_section.content, '')), params.query) > 0
          then '원문 일치' end,
        case when params.query = '' then '필터 일치' end
      ) as match_reason,
      (
        case when item.normalized_title = params.query and params.query <> '' then 100 else 0 end
        + case when strpos(item.normalized_title, params.query) > 0 and params.query <> '' then 45 else 0 end
        + case when strpos(public.normalize_lookup_text(coalesce(item.summary, '')), params.query) > 0 and params.query <> '' then 24 else 0 end
        + case when strpos(coalesce(alias_data.search_text, ''), params.query) > 0 and params.query <> '' then 42 else 0 end
        + case when strpos(coalesce(tag_data.search_text, ''), params.query) > 0 and params.query <> '' then 28 else 0 end
        + case when strpos(public.normalize_lookup_text(coalesce(category.name, '')), params.query) > 0 and params.query <> '' then 12 else 0 end
        + case when strpos(public.normalize_lookup_text(coalesce(best_section.heading, '')), params.query) > 0 and params.query <> '' then 34 else 0 end
        + case when strpos(public.normalize_lookup_text(coalesce(best_section.content, '')), params.query) > 0 and params.query <> '' then 18 else 0 end
        + round(
          20 * greatest(
            extensions.similarity(item.normalized_title, params.query),
            extensions.similarity(public.normalize_lookup_text(coalesce(item.summary, '')), params.query),
            extensions.similarity(public.normalize_lookup_text(coalesce(best_section.heading, '')), params.query)
          )
        )
      )::numeric as score,
      item.verification_status,
      item.status,
      item.updated_at,
      params.page_number,
      params.page_size
    from public.knowledge_items as item
    join public.node_types as node_type on node_type.id = item.node_type_id
    cross join params
    left join public.categories as category on category.id = item.category_id
    left join public.documents as direct_document on direct_document.item_id = item.id
    left join public.document_versions as direct_version
      on direct_version.id = direct_document.active_version_id
    left join lateral (
      select
        jsonb_agg(
          jsonb_build_object('id', tag.id, 'name', tag.name, 'color', tag.color)
          order by tag.name
        ) as tags,
        string_agg(tag.normalized_name || ' ' || coalesce(tag_alias_data.search_text, ''), ' ')
          as search_text,
        array_agg(tag.id) as ids
      from public.item_tags as item_tag
      join public.tags as tag on tag.id = item_tag.tag_id
      left join lateral (
        select string_agg(tag_alias.normalized_alias, ' ') as search_text
        from public.tag_aliases as tag_alias
        where tag_alias.tag_id = tag.id
      ) as tag_alias_data on true
      where item_tag.item_id = item.id
    ) as tag_data on true
    left join lateral (
      select string_agg(alias.normalized_alias, ' ') as search_text
      from public.item_aliases as alias
      where alias.item_id = item.id
    ) as alias_data on true
    left join lateral (
      select
        project_item.id as project_id,
        project_item.title as project_title
      from public.knowledge_items as project_item
      join public.projects as project on project.item_id = project_item.id
      where project_item.deleted_at is null
        and (
          project_item.id = item.id
          or exists (
            select 1
            from public.relations as relation
            where relation.deleted_at is null
              and relation.status = 'active'
              and (
                (relation.source_item_id = item.id and relation.target_item_id = project_item.id)
                or (relation.target_item_id = item.id and relation.source_item_id = project_item.id)
              )
          )
        )
      order by case when project_item.id = item.id then 0 else 1 end, project_item.updated_at desc
      limit 1
    ) as related_project on true
    left join lateral (
      select
        section.id as section_id,
        section.document_id,
        section.version_id,
        version.format,
        section.heading,
        section.heading_path,
        section.locator,
        section.content
      from public.document_sections as section
      join public.document_versions as version on version.id = section.version_id
      where
        (
          exists (
            select 1
            from public.documents as document
            where document.item_id = item.id
              and document.active_version_id = section.version_id
              and section.document_id = item.id
          )
          or exists (
            select 1
            from public.item_evidence as evidence
            where evidence.item_id = item.id
              and evidence.section_id = section.id
          )
        )
      order by
        case when params.query <> '' and strpos(public.normalize_lookup_text(coalesce(section.heading, '')), params.query) > 0 then 0 else 1 end,
        case when params.query <> '' and strpos(public.normalize_lookup_text(section.content), params.query) > 0 then 0 else 1 end,
        extensions.similarity(public.normalize_lookup_text(coalesce(section.heading, '')), params.query) desc,
        section.ordinal
      limit 1
    ) as best_section on true
    where item.owner_id = auth.uid()
      and item.deleted_at is null
      and item.merged_into_id is null
      and (p_node_type_keys is null or node_type.key = any(p_node_type_keys))
      and (p_category_ids is null or item.category_id = any(p_category_ids))
      and (p_tag_ids is null or tag_data.ids && p_tag_ids)
      and (
        p_project_ids is null
        or item.id = any(p_project_ids)
        or exists (
          select 1
          from public.relations as project_relation
          where project_relation.deleted_at is null
            and project_relation.status = 'active'
            and (
              (
                project_relation.source_item_id = item.id
                and project_relation.target_item_id = any(p_project_ids)
              )
              or (
                project_relation.target_item_id = item.id
                and project_relation.source_item_id = any(p_project_ids)
              )
            )
        )
      )
      and (p_formats is null or coalesce(best_section.format, direct_version.format) = any(p_formats))
      and (p_verification_statuses is null or item.verification_status = any(p_verification_statuses))
      and (p_statuses is null or item.status = any(p_statuses))
      and (p_date_from is null or item.updated_at >= p_date_from)
      and (p_date_to is null or item.updated_at < p_date_to + interval '1 day')
      and (
        params.query = ''
        or strpos(item.normalized_title, params.query) > 0
        or strpos(public.normalize_lookup_text(coalesce(item.summary, '')), params.query) > 0
        or strpos(coalesce(alias_data.search_text, ''), params.query) > 0
        or strpos(coalesce(tag_data.search_text, ''), params.query) > 0
        or strpos(public.normalize_lookup_text(coalesce(category.name, '')), params.query) > 0
        or strpos(public.normalize_lookup_text(coalesce(best_section.heading, '')), params.query) > 0
        or strpos(public.normalize_lookup_text(coalesce(best_section.content, '')), params.query) > 0
        or extensions.similarity(item.normalized_title, params.query) >= 0.22
        or extensions.similarity(public.normalize_lookup_text(coalesce(best_section.heading, '')), params.query) >= 0.28
      )
  ),
  ranked as (
    select candidates.*, count(*) over () as total_count
    from candidates
  )
  select
    ranked.item_id,
    ranked.section_id,
    ranked.document_id,
    ranked.version_id,
    ranked.node_type_key,
    ranked.node_type_label,
    ranked.node_type_color,
    ranked.title,
    ranked.summary,
    ranked.category_id,
    ranked.category_name,
    ranked.tags,
    ranked.project_id,
    ranked.project_title,
    ranked.format,
    ranked.heading_path,
    ranked.locator,
    ranked.snippet,
    nullif(ranked.match_reason, ''),
    ranked.score,
    ranked.verification_status,
    ranked.status,
    ranked.updated_at,
    ranked.total_count
  from ranked
  order by ranked.score desc, ranked.updated_at desc, ranked.item_id
  limit (select page_size from params)
  offset (select (page_number - 1) * page_size from params);
$function$;

revoke all on function public.search_knowledge(
  text,
  text[],
  uuid[],
  uuid[],
  uuid[],
  public.document_format[],
  public.verification_status[],
  public.item_status[],
  timestamptz,
  timestamptz,
  integer,
  integer
) from public, anon;

grant execute on function public.search_knowledge(
  text,
  text[],
  uuid[],
  uuid[],
  uuid[],
  public.document_format[],
  public.verification_status[],
  public.item_status[],
  timestamptz,
  timestamptz,
  integer,
  integer
) to authenticated;

commit;

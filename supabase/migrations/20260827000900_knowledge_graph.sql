begin;

create or replace function public.get_knowledge_graph(
  p_project_id uuid default null,
  p_offset integer default 0,
  p_limit integer default 100
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $function$
declare
  current_owner uuid := auth.uid();
  safe_offset integer := greatest(coalesce(p_offset, 0), 0);
  safe_limit integer := least(greatest(coalesce(p_limit, 100), 1), 200);
  result jsonb;
begin
  if current_owner is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if p_project_id is not null and not exists (
    select 1 from public.projects
    where item_id = p_project_id and owner_id = current_owner
  ) then raise exception 'PROJECT_NOT_FOUND'; end if;

  with recursive reachable(item_id, depth) as (
    select p_project_id, 0 where p_project_id is not null
    union
    select
      case when relation.source_item_id = reachable.item_id
        then relation.target_item_id else relation.source_item_id end,
      reachable.depth + 1
    from reachable
    join public.relations as relation
      on relation.source_item_id = reachable.item_id or relation.target_item_id = reachable.item_id
    where reachable.depth < 2
      and relation.owner_id = current_owner
      and relation.deleted_at is null
      and relation.status in ('active', 'proposed')
  ),
  eligible_edges as (
    select
      relation.id,
      relation.source_item_id,
      relation.target_item_id,
      relation.status,
      relation_type.key as relation_type_key,
      relation_type.label_ko as relation_type_label,
      relation_type.color,
      relation_type.line_style,
      relation_type.is_symmetric,
      relation.confidence,
      relation.rationale,
      (select count(*) from public.relation_evidence where relation_id = relation.id) as evidence_count
    from public.relations as relation
    join public.relation_types as relation_type on relation_type.id = relation.relation_type_id
    where relation.owner_id = current_owner
      and relation.deleted_at is null
      and relation.status in ('active', 'proposed')
      and (
        p_project_id is null
        or (
          relation.source_item_id in (select item_id from reachable)
          and relation.target_item_id in (select item_id from reachable)
        )
      )
  ),
  counted_edges as (
    select eligible_edges.*, count(*) over () as total_count
    from eligible_edges
  ),
  page_edges as (
    select * from counted_edges
    order by case when status = 'active' then 0 else 1 end, relation_type_key, id
    limit safe_limit offset safe_offset
  ),
  page_node_ids as (
    select source_item_id as id from page_edges
    union
    select target_item_id from page_edges
    union
    select p_project_id where p_project_id is not null
  ),
  page_nodes as (
    select
      item.id,
      item.title,
      item.summary,
      item.status,
      item.verification_status,
      item.importance,
      node_type.key as node_type_key,
      node_type.label_ko as node_type_label,
      node_type.color,
      category.name as category_name,
      (select count(*) from public.item_evidence where item_id = item.id) as evidence_count,
      item.id = p_project_id as is_center
    from page_node_ids
    join public.knowledge_items as item on item.id = page_node_ids.id
    join public.node_types as node_type on node_type.id = item.node_type_id
    left join public.categories as category on category.id = item.category_id
    where item.owner_id = current_owner
      and item.deleted_at is null and item.merged_into_id is null
  )
  select jsonb_build_object(
    'nodes', coalesce((select jsonb_agg(to_jsonb(page_nodes) order by is_center desc, title) from page_nodes), '[]'::jsonb),
    'edges', coalesce((select jsonb_agg(to_jsonb(page_edges) - 'total_count' order by id) from page_edges), '[]'::jsonb),
    'offset', safe_offset,
    'next_offset', safe_offset + (select count(*) from page_edges),
    'total_edges', coalesce((select max(total_count) from page_edges), 0),
    'has_more', safe_offset + (select count(*) from page_edges) < coalesce((select max(total_count) from page_edges), 0)
  ) into result;
  return result;
end;
$function$;

revoke all on function public.get_knowledge_graph(uuid, integer, integer) from public, anon;
grant execute on function public.get_knowledge_graph(uuid, integer, integer) to authenticated;

commit;

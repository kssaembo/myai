begin;

create or replace function public.export_knowledge_item(p_item_id uuid)
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
  if current_owner is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if not exists (
    select 1 from public.knowledge_items
    where id = p_item_id and owner_id = current_owner
  ) then raise exception 'KNOWLEDGE_NOT_FOUND'; end if;

  select jsonb_build_object(
    'schema_version', 1,
    'exported_at', now(),
    'item', to_jsonb(item) - 'owner_id',
    'node_type', (select to_jsonb(node_type) from public.node_types as node_type where node_type.id = item.node_type_id),
    'category', (select to_jsonb(category) - 'owner_id' from public.categories as category where category.id = item.category_id and category.owner_id = current_owner),
    'tags', coalesce((select jsonb_agg(to_jsonb(tag) - 'owner_id' order by tag.name) from public.item_tags as link join public.tags as tag on tag.id = link.tag_id where link.item_id = item.id and link.owner_id = current_owner), '[]'::jsonb),
    'project', (select to_jsonb(project) - 'owner_id' from public.projects as project where project.item_id = item.id and project.owner_id = current_owner),
    'document', (select to_jsonb(document) - 'owner_id' from public.documents as document where document.item_id = item.id and document.owner_id = current_owner),
    'versions', coalesce((select jsonb_agg((to_jsonb(version) - 'owner_id') || jsonb_build_object(
      'sections', coalesce((select jsonb_agg(to_jsonb(section) - 'owner_id' - 'embedding' order by section.ordinal) from public.document_sections as section where section.version_id = version.id and section.owner_id = current_owner), '[]'::jsonb)
    ) order by version.version_number) from public.document_versions as version where version.document_id = item.id and version.owner_id = current_owner), '[]'::jsonb),
    'item_evidence', coalesce((select jsonb_agg(to_jsonb(evidence) - 'owner_id' order by evidence.created_at) from public.item_evidence as evidence where evidence.item_id = item.id and evidence.owner_id = current_owner), '[]'::jsonb),
    'relations', coalesce((select jsonb_agg((to_jsonb(relation) - 'owner_id') || jsonb_build_object(
      'relation_type', (select to_jsonb(relation_type) from public.relation_types as relation_type where relation_type.id = relation.relation_type_id),
      'evidence', coalesce((select jsonb_agg(to_jsonb(relation_evidence) - 'owner_id' order by relation_evidence.created_at) from public.relation_evidence where relation_evidence.relation_id = relation.id and relation_evidence.owner_id = current_owner), '[]'::jsonb)
    ) order by relation.created_at) from public.relations as relation where relation.owner_id = current_owner and (relation.source_item_id = item.id or relation.target_item_id = item.id)), '[]'::jsonb)
  ) into result
  from public.knowledge_items as item
  where item.id = p_item_id and item.owner_id = current_owner;

  return result;
end;
$function$;

create or replace function public.trash_knowledge_item(p_item_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  current_owner uuid := auth.uid();
  relation_states jsonb;
begin
  if current_owner is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;

  select coalesce(jsonb_object_agg(id::text, status::text), '{}'::jsonb)
  into relation_states
  from public.relations
  where owner_id = current_owner and deleted_at is null
    and (source_item_id = p_item_id or target_item_id = p_item_id);

  update public.knowledge_items
  set properties = jsonb_set(
        jsonb_set(properties, '{_trash_previous_status}', to_jsonb(status::text), true),
        '{_trash_relations}', relation_states, true
      ),
      status = 'archived', archived_at = coalesce(archived_at, now()),
      deleted_at = now(), updated_at = now()
  where id = p_item_id and owner_id = current_owner and deleted_at is null and merged_into_id is null;
  if not found then raise exception 'KNOWLEDGE_NOT_FOUND'; end if;

  update public.relations
  set status = 'archived', deleted_at = now(), reviewed_at = now()
  where owner_id = current_owner and deleted_at is null
    and (source_item_id = p_item_id or target_item_id = p_item_id);
end;
$function$;

create or replace function public.restore_knowledge_item(p_item_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  current_owner uuid := auth.uid();
  saved_properties jsonb;
  previous_status text;
  relation_entry record;
begin
  if current_owner is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  select properties into saved_properties from public.knowledge_items
  where id = p_item_id and owner_id = current_owner and deleted_at is not null for update;
  if not found then raise exception 'TRASH_ITEM_NOT_FOUND'; end if;

  previous_status := coalesce(saved_properties ->> '_trash_previous_status', 'active');

  update public.knowledge_items
  set status = previous_status::public.item_status,
      archived_at = case when previous_status = 'archived' then now() else null end,
      deleted_at = null,
      properties = properties - '_trash_previous_status' - '_trash_relations', updated_at = now()
  where id = p_item_id and owner_id = current_owner;

  for relation_entry in select key, value from jsonb_each_text(coalesce(saved_properties -> '_trash_relations', '{}'::jsonb)) loop
    update public.relations
    set status = relation_entry.value::public.relation_status, deleted_at = null, reviewed_at = now()
    where id = relation_entry.key::uuid and owner_id = current_owner
      and (source_item_id = p_item_id or target_item_id = p_item_id);
  end loop;
end;
$function$;

create or replace function public.permanently_delete_knowledge_item(p_item_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  current_owner uuid := auth.uid();
  storage_paths jsonb;
begin
  if current_owner is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if not exists (
    select 1 from public.knowledge_items
    where id = p_item_id and owner_id = current_owner and deleted_at is not null
  ) then raise exception 'TRASH_ITEM_NOT_FOUND'; end if;

  select coalesce(jsonb_agg(storage_path order by version_number), '[]'::jsonb)
  into storage_paths from public.document_versions
  where document_id = p_item_id and owner_id = current_owner;

  update public.documents set active_version_id = null
  where item_id = p_item_id and owner_id = current_owner;
  delete from public.knowledge_items
  where id = p_item_id and owner_id = current_owner and deleted_at is not null;

  return jsonb_build_object('storage_paths', storage_paths);
end;
$function$;

revoke all on function public.export_knowledge_item(uuid) from public, anon;
revoke all on function public.trash_knowledge_item(uuid) from public, anon;
revoke all on function public.restore_knowledge_item(uuid) from public, anon;
revoke all on function public.permanently_delete_knowledge_item(uuid) from public, anon;
grant execute on function public.export_knowledge_item(uuid) to authenticated;
grant execute on function public.trash_knowledge_item(uuid) to authenticated;
grant execute on function public.restore_knowledge_item(uuid) to authenticated;
grant execute on function public.permanently_delete_knowledge_item(uuid) to authenticated;

commit;

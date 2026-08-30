begin;

-- Reuses evidence-backed REF nodes when the browser structurer improves their
-- display title. This keeps existing Relation/Evidence records attached and
-- prevents a friendlier title from creating a second Knowledge Item.
create or replace function public.prepare_ref_auto_structure(
  p_document_id uuid,
  p_version_id uuid,
  p_nodes jsonb
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_owner uuid := auth.uid();
  node_data record;
  current_node_type_id uuid;
  existing_item_id uuid;
  stable_dedupe_key text;
  claimed_item_ids uuid[] := '{}'::uuid[];
  updated_count integer := 0;
begin
  if current_owner is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;
  if jsonb_typeof(coalesce(p_nodes, '[]'::jsonb)) <> 'array' then
    raise exception 'INVALID_REF_AUTO_STRUCTURE_PAYLOAD';
  end if;

  perform 1
  from public.document_versions
  where id = p_version_id
    and document_id = p_document_id
    and owner_id = current_owner
    and parse_status in ('parsed', 'partial');
  if not found then
    raise exception 'PARSED_DOCUMENT_VERSION_NOT_FOUND';
  end if;

  for node_data in
    select * from jsonb_to_recordset(coalesce(p_nodes, '[]'::jsonb)) as proposed_node(
      node_type_key text,
      title text,
      summary text,
      section_id uuid
    )
  loop
    if nullif(btrim(node_data.title), '') is null or node_data.section_id is null then
      continue;
    end if;

    select id into current_node_type_id
    from public.node_types
    where key = node_data.node_type_key and owner_id is null and is_active;
    if current_node_type_id is null then
      continue;
    end if;

    stable_dedupe_key := 'ref:' || p_document_id::text || ':' || node_data.node_type_key || ':' ||
      public.normalize_lookup_text(node_data.title);

    -- A previous structuring pass can have a raw Markdown/code title and thus a
    -- different dedupe key. Evidence is the stable identity across title styles.
    select ki.id into existing_item_id
    from public.knowledge_items ki
    join public.item_evidence ie
      on ie.item_id = ki.id and ie.owner_id = ki.owner_id
    where ki.owner_id = current_owner
      and ki.node_type_id = current_node_type_id
      and ki.deleted_at is null
      and ki.merged_into_id is null
      and ie.document_id = p_document_id
      and ie.version_id = p_version_id
      and ie.section_id = node_data.section_id
      and not (ki.id = any(claimed_item_ids))
    order by ki.created_at, ki.id
    limit 1;

    if existing_item_id is null then
      continue;
    end if;
    claimed_item_ids := array_append(claimed_item_ids, existing_item_id);

    if exists (
      select 1
      from public.knowledge_items other
      where other.owner_id = current_owner
        and other.id <> existing_item_id
        and other.node_type_id = current_node_type_id
        and other.dedupe_key = stable_dedupe_key
        and other.deleted_at is null
        and other.merged_into_id is null
    ) then
      continue;
    end if;

    update public.knowledge_items
    set
      title = btrim(node_data.title),
      summary = nullif(btrim(node_data.summary), ''),
      dedupe_key = stable_dedupe_key,
      properties = properties || jsonb_build_object(
        'source_document_id', p_document_id,
        'source_version_id', p_version_id,
        'display_style', 'plain_language_v1'
      ),
      updated_at = now()
    where id = existing_item_id and owner_id = current_owner;
    updated_count := updated_count + 1;
  end loop;

  return updated_count;
end;
$$;

revoke all on function public.prepare_ref_auto_structure(uuid, uuid, jsonb) from public, anon;
grant execute on function public.prepare_ref_auto_structure(uuid, uuid, jsonb) to authenticated;

notify pgrst, 'reload schema';

commit;

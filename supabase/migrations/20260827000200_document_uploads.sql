begin;

create index if not exists document_versions_owner_hash_idx
  on public.document_versions (owner_id, content_hash);

create or replace function public.create_document_upload(
  p_item_id uuid,
  p_version_id uuid,
  p_title text,
  p_source_filename text,
  p_summary text,
  p_category_id uuid,
  p_document_kind public.document_kind,
  p_format public.document_format,
  p_mime_type text,
  p_size_bytes bigint,
  p_storage_path text,
  p_content_hash text,
  p_raw_markdown text,
  p_is_editable boolean,
  p_tag_ids uuid[]
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_owner uuid := auth.uid();
  document_node_type_id uuid;
begin
  if current_owner is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  if exists (
    select 1
    from public.document_versions
    where owner_id = current_owner and content_hash = p_content_hash
  ) then
    raise exception 'DUPLICATE_DOCUMENT_HASH';
  end if;

  select id into document_node_type_id
  from public.node_types
  where key = 'document' and owner_id is null and is_active
  limit 1;

  if document_node_type_id is null then
    raise exception 'DOCUMENT_NODE_TYPE_NOT_FOUND';
  end if;

  insert into public.knowledge_items (
    id, owner_id, node_type_id, title, summary, category_id,
    status, origin, verification_status
  ) values (
    p_item_id, current_owner, document_node_type_id, btrim(p_title), nullif(btrim(p_summary), ''),
    p_category_id, 'active', 'user', 'confirmed'
  );

  insert into public.documents (
    item_id, owner_id, document_kind, active_version_id, ai_allowed, is_editable
  ) values (
    p_item_id, current_owner, p_document_kind, null, false, p_is_editable
  );

  insert into public.document_versions (
    id, owner_id, document_id, version_number, source_filename, format,
    mime_type, size_bytes, storage_path, content_hash, raw_markdown,
    language, parse_status, change_reason
  ) values (
    p_version_id, current_owner, p_item_id, 1, p_source_filename, p_format,
    p_mime_type, p_size_bytes, p_storage_path, p_content_hash, p_raw_markdown,
    'ko', 'pending', 'upload'
  );

  update public.documents
  set active_version_id = p_version_id
  where item_id = p_item_id and owner_id = current_owner;

  insert into public.item_tags (owner_id, item_id, tag_id)
  select current_owner, p_item_id, tag_id
  from unnest(coalesce(p_tag_ids, '{}'::uuid[])) as tag_id;

  return p_item_id;
end;
$$;

create or replace function public.add_document_version(
  p_document_id uuid,
  p_version_id uuid,
  p_source_filename text,
  p_format public.document_format,
  p_mime_type text,
  p_size_bytes bigint,
  p_storage_path text,
  p_content_hash text,
  p_raw_markdown text
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_owner uuid := auth.uid();
  next_version integer;
begin
  if current_owner is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  perform 1
  from public.documents
  where item_id = p_document_id and owner_id = current_owner
  for update;

  if not found then
    raise exception 'DOCUMENT_NOT_FOUND';
  end if;

  if exists (
    select 1
    from public.document_versions
    where owner_id = current_owner and content_hash = p_content_hash
  ) then
    raise exception 'DUPLICATE_DOCUMENT_HASH';
  end if;

  select coalesce(max(version_number), 0) + 1 into next_version
  from public.document_versions
  where document_id = p_document_id and owner_id = current_owner;

  insert into public.document_versions (
    id, owner_id, document_id, version_number, source_filename, format,
    mime_type, size_bytes, storage_path, content_hash, raw_markdown,
    language, parse_status, change_reason
  ) values (
    p_version_id, current_owner, p_document_id, next_version, p_source_filename, p_format,
    p_mime_type, p_size_bytes, p_storage_path, p_content_hash, p_raw_markdown,
    'ko', 'pending', 'replace'
  );

  update public.documents
  set active_version_id = p_version_id
  where item_id = p_document_id and owner_id = current_owner;

  return next_version;
end;
$$;

revoke all on function public.create_document_upload(
  uuid, uuid, text, text, text, uuid, public.document_kind, public.document_format,
  text, bigint, text, text, text, boolean, uuid[]
) from public, anon;
grant execute on function public.create_document_upload(
  uuid, uuid, text, text, text, uuid, public.document_kind, public.document_format,
  text, bigint, text, text, text, boolean, uuid[]
) to authenticated;

revoke all on function public.add_document_version(
  uuid, uuid, text, public.document_format, text, bigint, text, text, text
) from public, anon;
grant execute on function public.add_document_version(
  uuid, uuid, text, public.document_format, text, bigint, text, text, text
) to authenticated;

notify pgrst, 'reload schema';

commit;

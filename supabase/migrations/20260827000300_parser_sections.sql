begin;

create or replace function public.commit_document_parse(
  p_version_id uuid,
  p_parse_status public.parse_status,
  p_content_text text,
  p_parser_name text,
  p_parser_version text,
  p_error_code text,
  p_error_message text,
  p_sections jsonb
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_owner uuid := auth.uid();
  current_document_id uuid;
  inserted_count integer := 0;
begin
  if current_owner is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  if p_parse_status not in ('parsed', 'partial', 'failed', 'needs_ocr') then
    raise exception 'INVALID_FINAL_PARSE_STATUS';
  end if;

  select document_id into current_document_id
  from public.document_versions
  where id = p_version_id and owner_id = current_owner
  for update;

  if current_document_id is null then
    raise exception 'DOCUMENT_VERSION_NOT_FOUND';
  end if;

  delete from public.document_sections
  where version_id = p_version_id and owner_id = current_owner;

  if jsonb_typeof(coalesce(p_sections, '[]'::jsonb)) <> 'array' then
    raise exception 'INVALID_SECTION_PAYLOAD';
  end if;

  insert into public.document_sections (
    id, owner_id, document_id, version_id, parent_section_id, ordinal,
    canonical_section_key, heading, heading_level, heading_path, content,
    chunk_kind, locator, content_hash, token_estimate
  )
  select
    section_data.id,
    current_owner,
    current_document_id,
    p_version_id,
    section_data.parent_section_id,
    section_data.ordinal,
    null,
    section_data.heading,
    section_data.heading_level,
    coalesce(section_data.heading_path, '{}'::text[]),
    section_data.content,
    section_data.chunk_kind::public.section_chunk_kind,
    coalesce(section_data.locator, '{}'::jsonb),
    section_data.content_hash,
    section_data.token_estimate
  from jsonb_to_recordset(coalesce(p_sections, '[]'::jsonb)) as section_data(
    id uuid,
    parent_section_id uuid,
    ordinal integer,
    heading text,
    heading_level smallint,
    heading_path text[],
    content text,
    chunk_kind text,
    locator jsonb,
    content_hash text,
    token_estimate integer
  )
  order by section_data.ordinal;

  get diagnostics inserted_count = row_count;

  update public.document_versions
  set
    content_text = p_content_text,
    parse_status = p_parse_status,
    parser_name = nullif(btrim(p_parser_name), ''),
    parser_version = nullif(btrim(p_parser_version), ''),
    parse_error_code = nullif(btrim(p_error_code), ''),
    parse_error_message = nullif(btrim(p_error_message), '')
  where id = p_version_id and owner_id = current_owner;

  return inserted_count;
end;
$$;

revoke all on function public.commit_document_parse(
  uuid, public.parse_status, text, text, text, text, text, jsonb
) from public, anon;
grant execute on function public.commit_document_parse(
  uuid, public.parse_status, text, text, text, text, text, jsonb
) to authenticated;

notify pgrst, 'reload schema';

commit;

begin;

create or replace function public.create_import_job(
  p_job_id uuid,
  p_import_type public.import_type,
  p_entries jsonb
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_owner uuid := auth.uid();
  entry_count integer;
begin
  if current_owner is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;
  if jsonb_typeof(coalesce(p_entries, '[]'::jsonb)) <> 'array' then
    raise exception 'INVALID_IMPORT_ENTRIES';
  end if;

  entry_count := jsonb_array_length(coalesce(p_entries, '[]'::jsonb));
  if entry_count = 0 or entry_count > 200 then
    raise exception 'IMPORT_ENTRY_COUNT_OUT_OF_RANGE';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(p_entries) as unsafe_entry(relative_path text)
    where unsafe_entry.relative_path is null
      or unsafe_entry.relative_path ~ '(^|[\\/])\.\.([\\/]|$)'
      or unsafe_entry.relative_path ~ '^[\\/]'
      or unsafe_entry.relative_path ~ '^[A-Za-z]:[\\/]'
  ) then
    raise exception 'UNSAFE_IMPORT_PATH';
  end if;
  if p_import_type in ('zip', 'ref_zip') and (
    select coalesce(sum(size_bytes), 0)
    from jsonb_to_recordset(p_entries) as sized_entry(size_bytes bigint)
  ) > 500 * 1024 * 1024 then
    raise exception 'IMPORT_EXPANSION_LIMIT';
  end if;

  insert into public.import_jobs (
    id, owner_id, import_type, status, total_count, started_at
  ) values (
    p_job_id, current_owner, p_import_type, 'validating', entry_count, now()
  );

  insert into public.import_entries (
    id, owner_id, import_job_id, source_filename, relative_path,
    size_bytes, format, status, error_code, error_message
  )
  select
    entry_data.id,
    current_owner,
    p_job_id,
    entry_data.source_filename,
    entry_data.relative_path,
    entry_data.size_bytes,
    nullif(entry_data.format, '')::public.document_format,
    case when nullif(entry_data.format, '') is null
      then 'skipped'::public.import_entry_status
      else 'queued'::public.import_entry_status
    end,
    case when nullif(entry_data.format, '') is null then 'UNSUPPORTED_FORMAT' else null end,
    case when nullif(entry_data.format, '') is null
      then '지원하지 않는 형식이라 건너뛰었습니다.' else null end
  from jsonb_to_recordset(p_entries) as entry_data(
    id uuid,
    source_filename text,
    relative_path text,
    size_bytes bigint,
    format text
  );

  return entry_count;
end;
$$;

create or replace function public.update_import_entry(
  p_entry_id uuid,
  p_status public.import_entry_status,
  p_content_hash text default null,
  p_document_id uuid default null,
  p_version_id uuid default null,
  p_error_code text default null,
  p_error_message text default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  update public.import_entries
  set
    status = p_status,
    content_hash = coalesce(p_content_hash, content_hash),
    document_id = coalesce(p_document_id, document_id),
    version_id = coalesce(p_version_id, version_id),
    error_code = nullif(btrim(p_error_code), ''),
    error_message = nullif(btrim(p_error_message), '')
  where id = p_entry_id and owner_id = auth.uid();

  if not found then
    raise exception 'IMPORT_ENTRY_NOT_FOUND';
  end if;
end;
$$;

create or replace function public.refresh_import_job(p_job_id uuid)
returns public.import_job_status
language plpgsql
security invoker
set search_path = ''
as $$
declare
  next_status public.import_job_status;
  current_status public.import_job_status;
  next_success integer;
  next_partial integer;
  next_failed integer;
  next_duplicate integer;
  next_pending integer;
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  select status into current_status
  from public.import_jobs
  where id = p_job_id and owner_id = auth.uid()
  for update;

  if current_status is null then
    raise exception 'IMPORT_JOB_NOT_FOUND';
  end if;
  if current_status = 'cancelled' then
    return current_status;
  end if;

  select
    count(*) filter (where status = 'parsed'),
    count(*) filter (where status = 'partial'),
    count(*) filter (where status = 'failed'),
    count(*) filter (where status = 'duplicate'),
    count(*) filter (where status in ('queued', 'validating', 'uploaded'))
  into next_success, next_partial, next_failed, next_duplicate, next_pending
  from public.import_entries
  where import_job_id = p_job_id and owner_id = auth.uid();

  next_status := case
    when next_pending > 0 then 'parsing'::public.import_job_status
    when next_failed > 0 and next_success + next_partial + next_duplicate = 0
      then 'failed'::public.import_job_status
    when next_failed > 0 or next_partial > 0 then 'partial'::public.import_job_status
    else 'completed'::public.import_job_status
  end;

  update public.import_jobs
  set
    status = next_status,
    success_count = next_success,
    partial_count = next_partial,
    failed_count = next_failed,
    duplicate_count = next_duplicate,
    completed_at = case when next_pending = 0 then now() else null end
  where id = p_job_id and owner_id = auth.uid();

  return next_status;
end;
$$;

create or replace function public.cancel_import_job(p_job_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  update public.import_jobs
  set status = 'cancelled', completed_at = now()
  where id = p_job_id
    and owner_id = auth.uid()
    and status not in ('completed', 'partial', 'failed', 'cancelled');

  if not found then
    raise exception 'IMPORT_JOB_NOT_CANCELLABLE';
  end if;
end;
$$;

revoke all on function public.create_import_job(uuid, public.import_type, jsonb) from public, anon;
revoke all on function public.update_import_entry(
  uuid, public.import_entry_status, text, uuid, uuid, text, text
) from public, anon;
revoke all on function public.refresh_import_job(uuid) from public, anon;
revoke all on function public.cancel_import_job(uuid) from public, anon;

grant execute on function public.create_import_job(uuid, public.import_type, jsonb) to authenticated;
grant execute on function public.update_import_entry(
  uuid, public.import_entry_status, text, uuid, uuid, text, text
) to authenticated;
grant execute on function public.refresh_import_job(uuid) to authenticated;
grant execute on function public.cancel_import_job(uuid) to authenticated;

notify pgrst, 'reload schema';

commit;

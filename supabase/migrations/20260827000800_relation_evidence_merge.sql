begin;

create or replace function public.get_knowledge_connections(p_item_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
  with owned_item as (
    select id, owner_id, node_type_id, title
    from public.knowledge_items
    where id = p_item_id and owner_id = auth.uid()
      and deleted_at is null and merged_into_id is null
  ),
  relation_rows as (
    select jsonb_build_object(
      'id', relation.id,
      'source_item_id', relation.source_item_id,
      'target_item_id', relation.target_item_id,
      'relation_type_id', relation.relation_type_id,
      'relation_type_key', relation_type.key,
      'relation_type_label', relation_type.label_ko,
      'status', relation.status,
      'rationale', relation.rationale,
      'counterpart_id', counterpart.id,
      'counterpart_title', counterpart.title,
      'counterpart_type_key', counterpart_type.key,
      'counterpart_type_label', counterpart_type.label_ko,
      'evidence', coalesce(evidence.rows, '[]'::jsonb)
    ) as value
    from public.relations as relation
    join public.relation_types as relation_type on relation_type.id = relation.relation_type_id
    join public.knowledge_items as counterpart
      on counterpart.id = case when relation.source_item_id = p_item_id
        then relation.target_item_id else relation.source_item_id end
    join public.node_types as counterpart_type on counterpart_type.id = counterpart.node_type_id
    left join lateral (
      select jsonb_agg(jsonb_build_object(
        'id', relation_evidence.id,
        'document_id', relation_evidence.document_id,
        'version_id', relation_evidence.version_id,
        'section_id', relation_evidence.section_id,
        'evidence_text', relation_evidence.evidence_text,
        'origin', relation_evidence.origin
      ) order by relation_evidence.created_at) as rows
      from public.relation_evidence
      where relation_id = relation.id and owner_id = auth.uid()
    ) as evidence on true
    where relation.owner_id = auth.uid()
      and relation.deleted_at is null
      and (relation.source_item_id = p_item_id or relation.target_item_id = p_item_id)
      and exists (select 1 from owned_item)
  ),
  item_evidence_rows as (
    select jsonb_build_object(
      'id', evidence.id,
      'document_id', evidence.document_id,
      'version_id', evidence.version_id,
      'section_id', evidence.section_id,
      'evidence_role', evidence.evidence_role,
      'evidence_text', evidence.evidence_text,
      'origin', evidence.origin,
      'heading_path', section.heading_path,
      'locator', section.locator
    ) as value
    from public.item_evidence as evidence
    left join public.document_sections as section on section.id = evidence.section_id
    where evidence.item_id = p_item_id and evidence.owner_id = auth.uid()
  ),
  duplicate_rows as (
    select jsonb_build_object(
      'id', candidate.id,
      'title', candidate.title,
      'summary', candidate.summary,
      'verification_status', candidate.verification_status,
      'similarity', round(extensions.similarity(candidate.normalized_title, owned.title)::numeric, 3)
    ) as value
    from owned_item as owned
    join public.node_types as node_type on node_type.id = owned.node_type_id
    join public.knowledge_items as candidate
      on candidate.owner_id = owned.owner_id
      and candidate.node_type_id = owned.node_type_id
      and candidate.id <> owned.id
    where node_type.key not in ('document', 'project')
      and candidate.deleted_at is null and candidate.merged_into_id is null
      and (
        candidate.normalized_title = public.normalize_lookup_text(owned.title)
        or extensions.similarity(candidate.normalized_title, public.normalize_lookup_text(owned.title)) >= 0.35
      )
    order by extensions.similarity(candidate.normalized_title, public.normalize_lookup_text(owned.title)) desc
    limit 10
  )
  select jsonb_build_object(
    'relations', coalesce((select jsonb_agg(value) from relation_rows), '[]'::jsonb),
    'item_evidence', coalesce((select jsonb_agg(value) from item_evidence_rows), '[]'::jsonb),
    'duplicate_candidates', coalesce((select jsonb_agg(value) from duplicate_rows), '[]'::jsonb)
  );
$function$;

create or replace function public.save_relation(
  p_relation_id uuid,
  p_source_item_id uuid,
  p_target_item_id uuid,
  p_relation_type_id uuid,
  p_status public.relation_status,
  p_rationale text,
  p_item_evidence_ids uuid[] default '{}'::uuid[]
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  current_owner uuid := auth.uid();
  saved_id uuid := coalesce(p_relation_id, extensions.gen_random_uuid());
  evidence_record record;
begin
  if current_owner is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if p_source_item_id = p_target_item_id then raise exception 'RELATION_SELF_LINK'; end if;

  perform 1 from public.knowledge_items
  where id in (p_source_item_id, p_target_item_id) and owner_id = current_owner
    and deleted_at is null and merged_into_id is null;
  if (select count(*) from public.knowledge_items
      where id in (p_source_item_id, p_target_item_id) and owner_id = current_owner
        and deleted_at is null and merged_into_id is null) <> 2 then
    raise exception 'RELATION_ENDPOINT_NOT_OWNED';
  end if;

  if p_relation_id is null then
    insert into public.relations (
      id, owner_id, source_item_id, target_item_id, canonical_source_item_id,
      canonical_target_item_id, relation_type_id, origin, status, rationale, reviewed_at
    ) values (
      saved_id, current_owner, p_source_item_id, p_target_item_id, p_source_item_id,
      p_target_item_id, p_relation_type_id, 'user', p_status,
      nullif(btrim(p_rationale), ''), now()
    );
  else
    update public.relations set
      source_item_id = p_source_item_id,
      target_item_id = p_target_item_id,
      relation_type_id = p_relation_type_id,
      status = p_status,
      rationale = nullif(btrim(p_rationale), ''),
      reviewed_at = now()
    where id = p_relation_id and owner_id = current_owner and deleted_at is null;
    if not found then raise exception 'RELATION_NOT_FOUND'; end if;
  end if;

  for evidence_record in
    select * from public.item_evidence
    where id = any(coalesce(p_item_evidence_ids, '{}'::uuid[])) and owner_id = current_owner
  loop
    if evidence_record.document_id is null or evidence_record.version_id is null then continue; end if;
    if not exists (
      select 1 from public.relation_evidence
      where relation_id = saved_id and owner_id = current_owner
        and version_id = evidence_record.version_id
        and section_id is not distinct from evidence_record.section_id
        and evidence_text = evidence_record.evidence_text
    ) then
      insert into public.relation_evidence (
        owner_id, relation_id, document_id, version_id, section_id, evidence_text, origin
      ) values (
        current_owner, saved_id, evidence_record.document_id, evidence_record.version_id,
        evidence_record.section_id, evidence_record.evidence_text, 'user'
      );
    end if;
  end loop;

  if p_status = 'active' and not exists (
    select 1 from public.relation_evidence where relation_id = saved_id and owner_id = current_owner
  ) then
    update public.relations set status = 'proposed' where id = saved_id;
  end if;
  return saved_id;
exception
  when unique_violation then raise exception 'DUPLICATE_ACTIVE_RELATION';
end;
$function$;

create or replace function public.archive_relation(p_relation_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  update public.relations
  set status = 'archived', deleted_at = now(), reviewed_at = now()
  where id = p_relation_id and owner_id = auth.uid() and deleted_at is null;
  if not found then raise exception 'RELATION_NOT_FOUND'; end if;
end;
$function$;

create or replace function public.merge_knowledge_items(p_primary_id uuid, p_duplicate_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  current_owner uuid := auth.uid();
  primary_type uuid;
  duplicate_type uuid;
  relation_record record;
  existing_relation_id uuid;
  next_source uuid;
  next_target uuid;
  next_canonical_source uuid;
  next_canonical_target uuid;
  symmetric boolean;
  moved_evidence integer := 0;
begin
  if current_owner is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if p_primary_id = p_duplicate_id then raise exception 'MERGE_SAME_ITEM'; end if;

  select node_type_id into primary_type from public.knowledge_items
  where id = p_primary_id and owner_id = current_owner and deleted_at is null and merged_into_id is null for update;
  select node_type_id into duplicate_type from public.knowledge_items
  where id = p_duplicate_id and owner_id = current_owner and deleted_at is null and merged_into_id is null for update;
  if primary_type is null or duplicate_type is null then raise exception 'MERGE_ITEM_NOT_FOUND'; end if;
  if primary_type <> duplicate_type then raise exception 'MERGE_NODE_TYPE_MISMATCH'; end if;
  if exists (select 1 from public.projects where item_id in (p_primary_id, p_duplicate_id))
    or exists (select 1 from public.documents where item_id in (p_primary_id, p_duplicate_id)) then
    raise exception 'MERGE_EXTENSION_ITEM_FORBIDDEN';
  end if;

  update public.item_evidence set item_id = p_primary_id
  where item_id = p_duplicate_id and owner_id = current_owner;
  get diagnostics moved_evidence = row_count;

  insert into public.item_tags(owner_id, item_id, tag_id)
  select current_owner, p_primary_id, tag_id from public.item_tags
  where item_id = p_duplicate_id and owner_id = current_owner on conflict do nothing;
  delete from public.item_tags where item_id = p_duplicate_id and owner_id = current_owner;

  update public.item_aliases set item_id = p_primary_id
  where item_id = p_duplicate_id and owner_id = current_owner;

  insert into public.item_aliases(owner_id, item_id, alias, origin)
  select current_owner, p_primary_id, duplicate.title, 'user'
  from public.knowledge_items as duplicate
  where duplicate.id = p_duplicate_id
    and not exists (
      select 1 from public.item_aliases
      where owner_id = current_owner
        and normalized_alias = public.normalize_lookup_text(duplicate.title)
    );

  for relation_record in
    select relation.*, relation_type.is_symmetric
    from public.relations as relation
    join public.relation_types as relation_type on relation_type.id = relation.relation_type_id
    where relation.owner_id = current_owner and relation.deleted_at is null
      and (relation.source_item_id = p_duplicate_id or relation.target_item_id = p_duplicate_id)
    for update of relation
  loop
    next_source := case when relation_record.source_item_id = p_duplicate_id then p_primary_id else relation_record.source_item_id end;
    next_target := case when relation_record.target_item_id = p_duplicate_id then p_primary_id else relation_record.target_item_id end;
    if next_source = next_target then
      insert into public.item_evidence (
        owner_id, item_id, document_id, version_id, section_id,
        evidence_role, evidence_text, origin
      )
      select
        current_owner, p_primary_id, evidence.document_id, evidence.version_id,
        evidence.section_id, 'support', evidence.evidence_text, evidence.origin
      from public.relation_evidence as evidence
      where evidence.relation_id = relation_record.id and evidence.owner_id = current_owner
        and not exists (
          select 1 from public.item_evidence as existing_evidence
          where existing_evidence.item_id = p_primary_id
            and existing_evidence.version_id = evidence.version_id
            and existing_evidence.section_id is not distinct from evidence.section_id
            and existing_evidence.evidence_text = evidence.evidence_text
        );
      update public.relations set status = 'archived', deleted_at = now()
      where id = relation_record.id;
      continue;
    end if;
    symmetric := relation_record.is_symmetric;
    next_canonical_source := case when symmetric and next_source > next_target then next_target else next_source end;
    next_canonical_target := case when symmetric and next_source > next_target then next_source else next_target end;
    select id into existing_relation_id from public.relations
    where owner_id = current_owner and id <> relation_record.id and deleted_at is null
      and relation_type_id = relation_record.relation_type_id
      and canonical_source_item_id = next_canonical_source
      and canonical_target_item_id = next_canonical_target
    order by case when status = 'active' then 0 else 1 end limit 1;
    if existing_relation_id is not null then
      update public.relation_evidence set relation_id = existing_relation_id
      where relation_id = relation_record.id and owner_id = current_owner;
      if relation_record.status = 'active' then
        update public.relations set status = 'active', reviewed_at = now()
        where id = existing_relation_id and owner_id = current_owner;
      end if;
      delete from public.relations where id = relation_record.id and owner_id = current_owner;
    else
      update public.relations set source_item_id = next_source, target_item_id = next_target
      where id = relation_record.id and owner_id = current_owner;
    end if;
    existing_relation_id := null;
  end loop;

  update public.knowledge_items set
    merged_into_id = p_primary_id, status = 'archived', archived_at = now(), updated_at = now()
  where id = p_duplicate_id and owner_id = current_owner;

  return jsonb_build_object('primary_id', p_primary_id, 'merged_id', p_duplicate_id, 'moved_evidence', moved_evidence);
end;
$function$;

revoke all on function public.get_knowledge_connections(uuid) from public, anon;
revoke all on function public.save_relation(uuid, uuid, uuid, uuid, public.relation_status, text, uuid[]) from public, anon;
revoke all on function public.archive_relation(uuid) from public, anon;
revoke all on function public.merge_knowledge_items(uuid, uuid) from public, anon;
grant execute on function public.get_knowledge_connections(uuid) to authenticated;
grant execute on function public.save_relation(uuid, uuid, uuid, uuid, public.relation_status, text, uuid[]) to authenticated;
grant execute on function public.archive_relation(uuid) to authenticated;
grant execute on function public.merge_knowledge_items(uuid, uuid) to authenticated;

commit;

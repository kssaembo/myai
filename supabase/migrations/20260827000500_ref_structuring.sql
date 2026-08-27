begin;

create or replace function public.mark_ref_profile(
  p_version_id uuid,
  p_profile text,
  p_aliases jsonb
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_owner uuid := auth.uid();
  current_document_id uuid;
  updated_count integer := 0;
begin
  if current_owner is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;
  if p_profile not in ('ref_v1', 'ref_probable', 'not_ref') then
    raise exception 'INVALID_REF_PROFILE';
  end if;
  if jsonb_typeof(coalesce(p_aliases, '[]'::jsonb)) <> 'array' then
    raise exception 'INVALID_REF_ALIASES';
  end if;

  select document_id into current_document_id
  from public.document_versions
  where id = p_version_id and owner_id = current_owner
  for update;

  if current_document_id is null then
    raise exception 'DOCUMENT_VERSION_NOT_FOUND';
  end if;

  update public.document_sections as target
  set canonical_section_key = alias_data.canonical_key
  from jsonb_to_recordset(coalesce(p_aliases, '[]'::jsonb)) as alias_data(
    section_id uuid,
    canonical_key text
  )
  where target.id = alias_data.section_id
    and target.version_id = p_version_id
    and target.owner_id = current_owner
    and alias_data.canonical_key in (
      'overview', 'tech_stack', 'problems', 'change_history',
      'reusable_patterns', 'anti_patterns', 'classroom_lessons', 'final_status'
    );

  get diagnostics updated_count = row_count;

  update public.import_entries
  set detected_ref_profile = p_profile
  where version_id = p_version_id and owner_id = current_owner;

  update public.import_jobs
  set status = 'structuring', completed_at = null
  where owner_id = current_owner
    and p_profile in ('ref_v1', 'ref_probable')
    and id in (
      select import_job_id from public.import_entries
      where version_id = p_version_id and owner_id = current_owner
    );

  if p_profile in ('ref_v1', 'ref_probable') then
    update public.documents
    set document_kind = 'ref'
    where item_id = current_document_id and owner_id = current_owner;
  end if;

  return updated_count;
end;
$$;

create or replace function public.commit_ref_review(
  p_document_id uuid,
  p_version_id uuid,
  p_nodes jsonb,
  p_relations jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_owner uuid := auth.uid();
  node_data record;
  relation_data record;
  actual_node_id uuid;
  actual_source_id uuid;
  actual_target_id uuid;
  current_node_type_id uuid;
  current_relation_type_id uuid;
  current_relation_id uuid;
  node_map jsonb := '{}'::jsonb;
  reviewed_nodes integer := 0;
  reviewed_relations integer := 0;
  stable_dedupe_key text;
begin
  if current_owner is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;
  if jsonb_typeof(coalesce(p_nodes, '[]'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(p_relations, '[]'::jsonb)) <> 'array' then
    raise exception 'INVALID_REF_REVIEW_PAYLOAD';
  end if;

  perform 1
  from public.document_versions
  where id = p_version_id
    and document_id = p_document_id
    and owner_id = current_owner
    and parse_status in ('parsed', 'partial')
  for update;
  if not found then
    raise exception 'PARSED_DOCUMENT_VERSION_NOT_FOUND';
  end if;

  for node_data in
    select * from jsonb_to_recordset(coalesce(p_nodes, '[]'::jsonb)) as proposed_node(
      local_id text,
      node_type_key text,
      title text,
      summary text,
      section_id uuid,
      evidence_text text,
      evidence_role text,
      verification_status text,
      project_kind text,
      lifecycle_status text
    )
  loop
    if nullif(btrim(node_data.title), '') is null
      or nullif(btrim(node_data.evidence_text), '') is null
      or node_data.section_id is null then
      raise exception 'REF_NODE_REQUIRES_EVIDENCE';
    end if;

    select id into current_node_type_id
    from public.node_types
    where key = node_data.node_type_key and owner_id is null and is_active;
    if current_node_type_id is null then
      raise exception 'UNKNOWN_NODE_TYPE: %', node_data.node_type_key;
    end if;

    perform 1 from public.document_sections
    where id = node_data.section_id
      and version_id = p_version_id
      and document_id = p_document_id
      and owner_id = current_owner;
    if not found then
      raise exception 'REF_EVIDENCE_SECTION_NOT_FOUND';
    end if;

    stable_dedupe_key := 'ref:' || p_document_id::text || ':' || node_data.node_type_key || ':' ||
      public.normalize_lookup_text(node_data.title);

    select id into actual_node_id
    from public.knowledge_items
    where owner_id = current_owner
      and dedupe_key = stable_dedupe_key
      and deleted_at is null
      and merged_into_id is null;

    if actual_node_id is null then
      actual_node_id := node_data.local_id::uuid;
      insert into public.knowledge_items (
        id, owner_id, node_type_id, title, summary, status, origin,
        verification_status, importance, dedupe_key, properties
      ) values (
        actual_node_id,
        current_owner,
        current_node_type_id,
        btrim(node_data.title),
        nullif(btrim(node_data.summary), ''),
        'active',
        'rule_import',
        node_data.verification_status::public.verification_status,
        0,
        stable_dedupe_key,
        jsonb_build_object('source_document_id', p_document_id, 'source_version_id', p_version_id)
      );
    else
      update public.knowledge_items
      set
        title = btrim(node_data.title),
        summary = nullif(btrim(node_data.summary), ''),
        verification_status = node_data.verification_status::public.verification_status,
        updated_at = now()
      where id = actual_node_id and owner_id = current_owner;
    end if;

    if node_data.node_type_key = 'project' then
      insert into public.projects (
        item_id, owner_id, project_kind, lifecycle_status
      ) values (
        actual_node_id,
        current_owner,
        coalesce(nullif(node_data.project_kind, ''), 'other')::public.project_kind,
        coalesce(nullif(node_data.lifecycle_status, ''), 'planning')::public.project_lifecycle_status
      )
      on conflict (item_id) do update set
        project_kind = excluded.project_kind,
        lifecycle_status = excluded.lifecycle_status;
    end if;

    if not exists (
      select 1 from public.item_evidence
      where owner_id = current_owner
        and item_id = actual_node_id
        and version_id = p_version_id
        and section_id = node_data.section_id
        and evidence_text = node_data.evidence_text
    ) then
      insert into public.item_evidence (
        owner_id, item_id, document_id, version_id, section_id,
        evidence_role, evidence_text, origin
      ) values (
        current_owner,
        actual_node_id,
        p_document_id,
        p_version_id,
        node_data.section_id,
        node_data.evidence_role::public.evidence_role,
        node_data.evidence_text,
        'rule_import'
      );
    end if;

    node_map := node_map || jsonb_build_object(node_data.local_id, actual_node_id::text);
    reviewed_nodes := reviewed_nodes + 1;
  end loop;

  for relation_data in
    select * from jsonb_to_recordset(coalesce(p_relations, '[]'::jsonb)) as proposed_relation(
      local_id text,
      source_ref text,
      target_ref text,
      relation_type_key text,
      section_id uuid,
      evidence_text text,
      status text
    )
  loop
    actual_source_id := case when relation_data.source_ref = 'document'
      then p_document_id else (node_map ->> relation_data.source_ref)::uuid end;
    actual_target_id := (node_map ->> relation_data.target_ref)::uuid;

    if actual_source_id is null or actual_target_id is null then
      continue;
    end if;
    if nullif(btrim(relation_data.evidence_text), '') is null then
      raise exception 'REF_RELATION_REQUIRES_EVIDENCE';
    end if;

    select id into current_relation_type_id
    from public.relation_types
    where key = relation_data.relation_type_key and owner_id is null and is_active;
    if current_relation_type_id is null then
      raise exception 'UNKNOWN_RELATION_TYPE: %', relation_data.relation_type_key;
    end if;

    select id into current_relation_id
    from public.relations
    where owner_id = current_owner
      and source_item_id = actual_source_id
      and target_item_id = actual_target_id
      and relation_type_id = current_relation_type_id
      and deleted_at is null
    limit 1;

    if current_relation_id is null then
      current_relation_id := relation_data.local_id::uuid;
      insert into public.relations (
        id, owner_id, source_item_id, target_item_id,
        canonical_source_item_id, canonical_target_item_id,
        relation_type_id, origin, status, rationale, reviewed_at
      ) values (
        current_relation_id,
        current_owner,
        actual_source_id,
        actual_target_id,
        actual_source_id,
        actual_target_id,
        current_relation_type_id,
        'rule_import',
        relation_data.status::public.relation_status,
        'REF 규칙 구조화 및 사용자 검토',
        now()
      );
    else
      update public.relations
      set status = relation_data.status::public.relation_status,
          reviewed_at = now()
      where id = current_relation_id and owner_id = current_owner;
    end if;

    if not exists (
      select 1 from public.relation_evidence
      where owner_id = current_owner
        and relation_id = current_relation_id
        and version_id = p_version_id
        and section_id = relation_data.section_id
        and evidence_text = relation_data.evidence_text
    ) then
      insert into public.relation_evidence (
        owner_id, relation_id, document_id, version_id, section_id,
        evidence_text, origin
      ) values (
        current_owner,
        current_relation_id,
        p_document_id,
        p_version_id,
        relation_data.section_id,
        relation_data.evidence_text,
        'rule_import'
      );
    end if;

    reviewed_relations := reviewed_relations + 1;
  end loop;

  update public.import_jobs
  set
    status = case when failed_count > 0 or partial_count > 0
      then 'partial'::public.import_job_status
      else 'completed'::public.import_job_status end,
    completed_at = now()
  where owner_id = current_owner
    and id in (
      select import_job_id from public.import_entries
      where version_id = p_version_id and owner_id = current_owner
    );

  return jsonb_build_object(
    'node_count', reviewed_nodes,
    'relation_count', reviewed_relations
  );
end;
$$;

revoke all on function public.mark_ref_profile(uuid, text, jsonb) from public, anon;
revoke all on function public.commit_ref_review(uuid, uuid, jsonb, jsonb) from public, anon;
grant execute on function public.mark_ref_profile(uuid, text, jsonb) to authenticated;
grant execute on function public.commit_ref_review(uuid, uuid, jsonb, jsonb) to authenticated;

notify pgrst, 'reload schema';

commit;

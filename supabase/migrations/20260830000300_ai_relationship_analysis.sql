begin;

alter table public.ai_runs drop constraint ai_runs_purpose_check;
alter table public.ai_runs add constraint ai_runs_purpose_check
check (purpose in (
  'connectivity_test',
  'chat',
  'summarize',
  'structure',
  'embed',
  'briefing',
  'relationship_analysis'
));

create or replace function public.reserve_ai_request(
  p_provider text,
  p_model text,
  p_purpose text,
  p_estimated_input_tokens integer
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  current_owner uuid := auth.uid();
  settings public.ai_provider_settings%rowtype;
  usage public.ai_usage_daily%rowtype;
  run_id uuid := extensions.gen_random_uuid();
  safe_estimate integer := greatest(coalesce(p_estimated_input_tokens, 0), 0);
begin
  if current_owner is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if safe_estimate > 20000 then raise exception 'AI_INPUT_TOO_LARGE'; end if;
  if p_purpose not in (
    'connectivity_test', 'chat', 'summarize', 'structure', 'embed', 'briefing',
    'relationship_analysis'
  ) then raise exception 'AI_PURPOSE_INVALID'; end if;

  insert into public.ai_provider_settings (owner_id) values (current_owner)
  on conflict (owner_id) do nothing;
  select * into settings from public.ai_provider_settings
  where owner_id = current_owner for update;
  if not settings.is_enabled then raise exception 'AI_DISABLED'; end if;
  if settings.provider <> p_provider
    or (p_purpose = 'embed' and settings.embedding_model <> p_model)
    or (p_purpose <> 'embed' and settings.chat_model <> p_model) then
    raise exception 'AI_PROVIDER_CONFIGURATION_MISMATCH';
  end if;
  if p_purpose = 'briefing' and (
    select count(*) from public.ai_runs
    where owner_id = current_owner and purpose = 'briefing'
      and created_at >= current_date and created_at < current_date + interval '1 day'
  ) >= 2 then raise exception 'AI_DAILY_BRIEFING_LIMIT'; end if;
  if p_purpose = 'relationship_analysis' and (
    select count(*) from public.ai_runs
    where owner_id = current_owner and purpose = 'relationship_analysis'
      and created_at >= current_date and created_at < current_date + interval '1 day'
  ) >= 1 then raise exception 'AI_DAILY_RELATIONSHIP_ANALYSIS_LIMIT'; end if;

  insert into public.ai_usage_daily (owner_id, usage_date) values (current_owner, current_date)
  on conflict (owner_id, usage_date) do nothing;
  select * into usage from public.ai_usage_daily
  where owner_id = current_owner and usage_date = current_date for update;
  if usage.request_count >= settings.daily_request_limit then raise exception 'AI_DAILY_REQUEST_LIMIT'; end if;
  if usage.input_tokens + safe_estimate > settings.daily_input_token_limit then
    raise exception 'AI_DAILY_TOKEN_LIMIT';
  end if;

  insert into public.ai_runs (
    id, owner_id, provider, model, purpose, estimated_input_tokens
  ) values (
    run_id, current_owner, p_provider, p_model, p_purpose, safe_estimate
  );
  update public.ai_usage_daily set
    request_count = request_count + 1,
    input_tokens = input_tokens + safe_estimate,
    updated_at = now()
  where owner_id = current_owner and usage_date = current_date;
  return jsonb_build_object(
    'run_id', run_id,
    'request_count', usage.request_count + 1,
    'request_limit', settings.daily_request_limit,
    'input_tokens', usage.input_tokens + safe_estimate,
    'input_token_limit', settings.daily_input_token_limit
  );
end;
$function$;

create or replace function public.get_relationship_analysis_context(
  p_project_ids uuid[],
  p_evidence_per_project integer default 10
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $function$
declare
  current_owner uuid := auth.uid();
  safe_evidence_limit integer := least(greatest(coalesce(p_evidence_per_project, 10), 3), 12);
  result jsonb;
begin
  if current_owner is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if cardinality(p_project_ids) not between 2 and 4
    or cardinality(p_project_ids) <> cardinality(array(select distinct unnest(p_project_ids))) then
    raise exception 'RELATIONSHIP_ANALYSIS_PROJECT_COUNT_INVALID';
  end if;
  if (
    select count(*) from public.projects as project
    join public.knowledge_items as item on item.id = project.item_id
    where project.owner_id = current_owner
      and project.item_id = any(p_project_ids)
      and item.deleted_at is null and item.merged_into_id is null
  ) <> cardinality(p_project_ids) then
    raise exception 'RELATIONSHIP_ANALYSIS_PROJECT_NOT_FOUND';
  end if;

  with selected_projects as (
    select item.id, item.title, item.summary, item.updated_at
    from public.knowledge_items as item
    join public.projects as project on project.item_id = item.id
    where item.owner_id = current_owner and item.id = any(p_project_ids)
  ),
  related_items as (
    select project.id as project_id, project.id as item_id, 'PROJECT'::text as relation_type_key
    from selected_projects as project
    union
    select
      project.id,
      case when relation.source_item_id = project.id
        then relation.target_item_id else relation.source_item_id end,
      relation_type.key
    from selected_projects as project
    join public.relations as relation
      on relation.source_item_id = project.id or relation.target_item_id = project.id
    join public.relation_types as relation_type on relation_type.id = relation.relation_type_id
    where relation.owner_id = current_owner
      and relation.deleted_at is null
      and relation.status in ('active', 'proposed')
  ),
  ranked_evidence as (
    select
      related.project_id,
      evidence.id as source_id,
      evidence.item_id,
      item.title as item_title,
      node_type.key as item_type,
      related.relation_type_key,
      evidence.document_id,
      evidence.version_id,
      evidence.section_id,
      section.heading_path,
      left(evidence.evidence_text, 1200) as evidence_text,
      row_number() over (
        partition by related.project_id
        order by
          case evidence.evidence_role
            when 'definition' then 0
            when 'implementation_status' then 1
            when 'support' then 2
            else 3
          end,
          item.importance desc,
          evidence.created_at desc
      ) as evidence_rank
    from related_items as related
    join public.knowledge_items as item
      on item.id = related.item_id and item.owner_id = current_owner
    join public.node_types as node_type on node_type.id = item.node_type_id
    join public.item_evidence as evidence
      on evidence.item_id = related.item_id and evidence.owner_id = current_owner
    join public.documents as document
      on document.item_id = evidence.document_id and document.owner_id = current_owner
      and document.ai_allowed
      and document.active_version_id = evidence.version_id
    join public.document_sections as section
      on section.id = evidence.section_id and section.owner_id = current_owner
  ),
  project_rows as (
    select jsonb_build_object(
      'projectId', project.id,
      'title', project.title,
      'summary', project.summary,
      'updatedAt', project.updated_at,
      'sources', coalesce((
        select jsonb_agg(jsonb_build_object(
          'sourceId', evidence.source_id,
          'itemId', evidence.item_id,
          'itemTitle', evidence.item_title,
          'itemType', evidence.item_type,
          'relationType', evidence.relation_type_key,
          'documentId', evidence.document_id,
          'versionId', evidence.version_id,
          'sectionId', evidence.section_id,
          'headingPath', evidence.heading_path,
          'text', evidence.evidence_text
        ) order by evidence.evidence_rank)
        from ranked_evidence as evidence
        where evidence.project_id = project.id
          and evidence.evidence_rank <= safe_evidence_limit
      ), '[]'::jsonb)
    ) as value
    from selected_projects as project
    order by array_position(p_project_ids, project.id)
  )
  select jsonb_build_object(
    'schemaVersion', 'visual-relations-v1',
    'projects', coalesce(jsonb_agg(value), '[]'::jsonb)
  ) into result
  from project_rows;
  return result;
end;
$function$;

create or replace function public.begin_visual_relationship_analysis(
  p_analysis_id uuid,
  p_model text,
  p_input_fingerprint text,
  p_project_ids uuid[],
  p_force boolean default false
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  current_owner uuid := auth.uid();
  existing public.visual_analysis_runs%rowtype;
  project_id uuid;
  project_ordinal integer := 0;
begin
  if current_owner is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if p_analysis_id is null then raise exception 'VISUAL_ANALYSIS_ID_REQUIRED'; end if;
  if cardinality(p_project_ids) not between 2 and 4
    or cardinality(p_project_ids) <> cardinality(array(select distinct unnest(p_project_ids))) then
    raise exception 'RELATIONSHIP_ANALYSIS_PROJECT_COUNT_INVALID';
  end if;
  if p_input_fingerprint !~ '^[0-9a-f]{64}$' then
    raise exception 'VISUAL_ANALYSIS_FINGERPRINT_INVALID';
  end if;
  if (
    select count(*) from public.projects as project
    join public.knowledge_items as item on item.id = project.item_id
    where project.owner_id = current_owner and project.item_id = any(p_project_ids)
      and item.deleted_at is null and item.merged_into_id is null
  ) <> cardinality(p_project_ids) then
    raise exception 'RELATIONSHIP_ANALYSIS_PROJECT_NOT_FOUND';
  end if;

  select * into existing
  from public.visual_analysis_runs
  where owner_id = current_owner
    and analysis_kind = 'relationship'
    and input_fingerprint = p_input_fingerprint
    and status = 'completed'
  order by completed_at desc
  limit 1;
  if found and not p_force then
    return jsonb_build_object('analysisId', existing.id, 'cached', true);
  end if;
  if found and p_force then
    update public.visual_analysis_runs set status = 'superseded'
    where id = existing.id and owner_id = current_owner;
  end if;

  insert into public.visual_analysis_runs (
    id, owner_id, analysis_kind, status, model, schema_version, prompt_version,
    input_fingerprint, source_revision_at, started_at
  ) values (
    p_analysis_id, current_owner, 'relationship', 'processing', left(btrim(p_model), 120),
    'visual-relations-v1', 'relationship-analysis-v1', p_input_fingerprint, now(), now()
  );

  foreach project_id in array p_project_ids loop
    insert into public.visual_analysis_scope (
      owner_id, analysis_id, item_id, scope_role, ordinal
    ) values (
      current_owner, p_analysis_id, project_id, 'comparison', project_ordinal
    );
    project_ordinal := project_ordinal + 1;
  end loop;
  return jsonb_build_object('analysisId', p_analysis_id, 'cached', false);
end;
$function$;

create or replace function public.complete_visual_relationship_analysis(
  p_analysis_id uuid,
  p_insights jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  current_owner uuid := auth.uid();
  analysis public.visual_analysis_runs%rowtype;
  insight_value jsonb;
  project_value text;
  source_value text;
  saved_insight_id uuid;
  source_evidence public.item_evidence%rowtype;
  insight_count integer := 0;
  project_count integer;
  source_count integer;
  project_ordinal integer;
begin
  if current_owner is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if jsonb_typeof(coalesce(p_insights, '[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(p_insights, '[]'::jsonb)) not between 1 and 12 then
    raise exception 'VISUAL_INSIGHTS_PAYLOAD_INVALID';
  end if;
  select * into analysis from public.visual_analysis_runs
  where id = p_analysis_id and owner_id = current_owner
    and analysis_kind = 'relationship' and status = 'processing'
  for update;
  if not found then raise exception 'VISUAL_ANALYSIS_RUN_NOT_PROCESSING'; end if;

  for insight_value in select value from jsonb_array_elements(p_insights) loop
    if nullif(btrim(insight_value->>'title'), '') is null
      or nullif(btrim(insight_value->>'summary'), '') is null
      or coalesce(insight_value->>'dimension', '') !~ '^[a-z][a-z0-9_]*$' then
      raise exception 'VISUAL_INSIGHT_TEXT_INVALID';
    end if;
    if jsonb_typeof(coalesce(insight_value->'projectIds', '[]'::jsonb)) <> 'array'
      or jsonb_typeof(coalesce(insight_value->'sourceIds', '[]'::jsonb)) <> 'array' then
      raise exception 'VISUAL_INSIGHT_REFERENCES_INVALID';
    end if;
    project_count := jsonb_array_length(insight_value->'projectIds');
    source_count := jsonb_array_length(insight_value->'sourceIds');
    if project_count not between 2 and 4 or source_count not between 2 and 8 then
      raise exception 'VISUAL_INSIGHT_REFERENCE_COUNT_INVALID';
    end if;
    if (
      select count(distinct value)
      from jsonb_array_elements_text(insight_value->'projectIds')
    ) <> project_count then raise exception 'VISUAL_INSIGHT_PROJECT_DUPLICATE'; end if;
    if (
      select count(distinct project_ref.value)
      from jsonb_array_elements_text(insight_value->'projectIds') as project_ref(value)
      where exists (
        select 1
        from jsonb_array_elements_text(insight_value->'sourceIds') as source_ref(value)
        join public.item_evidence as candidate_evidence
          on candidate_evidence.id = source_ref.value::uuid
          and candidate_evidence.owner_id = current_owner
        where candidate_evidence.item_id = project_ref.value::uuid
          or exists (
            select 1 from public.relations as candidate_relation
            where candidate_relation.owner_id = current_owner
              and candidate_relation.deleted_at is null
              and candidate_relation.status in ('active', 'proposed')
              and (
                (candidate_relation.source_item_id = project_ref.value::uuid
                  and candidate_relation.target_item_id = candidate_evidence.item_id)
                or
                (candidate_relation.target_item_id = project_ref.value::uuid
                  and candidate_relation.source_item_id = candidate_evidence.item_id)
              )
          )
      )
    ) < 2 then raise exception 'VISUAL_INSIGHT_MULTI_PROJECT_EVIDENCE_REQUIRED'; end if;

    saved_insight_id := extensions.gen_random_uuid();
    insert into public.visual_insights (
      id, owner_id, analysis_id, insight_kind, dimension, title, summary,
      confidence, importance, status, origin, properties
    ) values (
      saved_insight_id,
      current_owner,
      p_analysis_id,
      (insight_value->>'kind')::public.visual_insight_kind,
      insight_value->>'dimension',
      left(btrim(insight_value->>'title'), 160),
      left(btrim(insight_value->>'summary'), 1200),
      (insight_value->>'confidence')::numeric,
      (insight_value->>'importance')::smallint,
      'proposed',
      'ai_proposed',
      jsonb_build_object(
        'keywords', coalesce(insight_value->'keywords', '[]'::jsonb),
        'projectNotes', coalesce(insight_value->'projectNotes', '[]'::jsonb)
      )
    );

    project_ordinal := 0;
    for project_value in select value from jsonb_array_elements_text(insight_value->'projectIds') loop
      if not exists (
        select 1 from public.visual_analysis_scope
        where analysis_id = p_analysis_id and owner_id = current_owner
          and item_id = project_value::uuid
      ) then raise exception 'VISUAL_INSIGHT_PROJECT_OUTSIDE_SCOPE'; end if;
      insert into public.visual_insight_items (
        owner_id, insight_id, item_id, item_role, ordinal, weight
      ) values (
        current_owner,
        saved_insight_id,
        project_value::uuid,
        case when (insight_value->>'kind') = 'difference' and project_ordinal > 0
          then 'contrast'::public.visual_insight_item_role
          else 'subject'::public.visual_insight_item_role end,
        project_ordinal,
        null
      );
      project_ordinal := project_ordinal + 1;
    end loop;

    for source_value in select distinct value
      from jsonb_array_elements_text(insight_value->'sourceIds')
    loop
      select evidence.* into source_evidence
      from public.item_evidence as evidence
      join public.documents as document
        on document.item_id = evidence.document_id and document.owner_id = current_owner
        and document.ai_allowed and document.active_version_id = evidence.version_id
      where evidence.id = source_value::uuid and evidence.owner_id = current_owner
        and (
          evidence.item_id in (
            select item_id from public.visual_analysis_scope
            where analysis_id = p_analysis_id and owner_id = current_owner
          )
          or exists (
            select 1 from public.relations as relation
            join public.visual_analysis_scope as scope
              on scope.analysis_id = p_analysis_id and scope.owner_id = current_owner
              and (relation.source_item_id = scope.item_id or relation.target_item_id = scope.item_id)
            where relation.owner_id = current_owner and relation.deleted_at is null
              and relation.status in ('active', 'proposed')
              and (relation.source_item_id = evidence.item_id or relation.target_item_id = evidence.item_id)
          )
        );
      if not found or source_evidence.section_id is null then
        raise exception 'VISUAL_INSIGHT_EVIDENCE_NOT_ALLOWED';
      end if;
      insert into public.visual_insight_evidence (
        owner_id, insight_id, item_id, document_id, version_id, section_id, evidence_text
      ) values (
        current_owner, saved_insight_id, source_evidence.item_id, source_evidence.document_id,
        source_evidence.version_id, source_evidence.section_id,
        left(source_evidence.evidence_text, 1200)
      );
    end loop;
    insight_count := insight_count + 1;
  end loop;

  update public.visual_analysis_runs set
    status = 'completed', completed_at = now(), error_code = null, error_message = null
  where id = p_analysis_id and owner_id = current_owner;
  return jsonb_build_object('analysisId', p_analysis_id, 'insightCount', insight_count);
end;
$function$;

create or replace function public.fail_visual_relationship_analysis(
  p_analysis_id uuid,
  p_error_code text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  current_owner uuid := auth.uid();
begin
  if current_owner is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  update public.visual_analysis_runs set
    status = 'failed',
    error_code = left(nullif(btrim(p_error_code), ''), 120),
    error_message = null,
    completed_at = now()
  where id = p_analysis_id and owner_id = current_owner and status = 'processing';
end;
$function$;

create or replace function public.review_visual_insight(
  p_insight_id uuid,
  p_status public.visual_insight_status
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  current_owner uuid := auth.uid();
begin
  if current_owner is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if p_status not in ('accepted', 'rejected') then
    raise exception 'VISUAL_INSIGHT_REVIEW_STATUS_INVALID';
  end if;
  update public.visual_insights set
    status = p_status,
    origin = case when p_status = 'accepted'
      then 'ai_accepted'::public.content_origin else origin end,
    reviewed_at = now()
  where id = p_insight_id and owner_id = current_owner and status = 'proposed';
  if not found then raise exception 'VISUAL_INSIGHT_NOT_REVIEWABLE'; end if;
end;
$function$;

revoke all on function public.get_relationship_analysis_context(uuid[], integer) from public, anon;
revoke all on function public.begin_visual_relationship_analysis(uuid, text, text, uuid[], boolean) from public, anon;
revoke all on function public.complete_visual_relationship_analysis(uuid, jsonb) from public, anon;
revoke all on function public.fail_visual_relationship_analysis(uuid, text) from public, anon;
revoke all on function public.review_visual_insight(uuid, public.visual_insight_status) from public, anon;

grant execute on function public.get_relationship_analysis_context(uuid[], integer) to authenticated;
grant execute on function public.begin_visual_relationship_analysis(uuid, text, text, uuid[], boolean) to authenticated;
grant execute on function public.complete_visual_relationship_analysis(uuid, jsonb) to authenticated;
grant execute on function public.fail_visual_relationship_analysis(uuid, text) to authenticated;
grant execute on function public.review_visual_insight(uuid, public.visual_insight_status) to authenticated;

notify pgrst, 'reload schema';

commit;

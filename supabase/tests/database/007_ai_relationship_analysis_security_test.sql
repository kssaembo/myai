begin;

select plan(14);

select ok(
  not has_function_privilege('anon', signature, 'execute'),
  format('anon cannot execute %s', signature)
)
from unnest(array[
  'public.get_relationship_analysis_context(uuid[],integer)',
  'public.begin_visual_relationship_analysis(uuid,text,text,uuid[],boolean)',
  'public.complete_visual_relationship_analysis(uuid,jsonb)',
  'public.fail_visual_relationship_analysis(uuid,text)',
  'public.review_visual_insight(uuid,public.visual_insight_status)'
]) as signature;

select ok(
  has_function_privilege('authenticated', signature, 'execute'),
  format('authenticated can execute %s through owner checks', signature)
)
from unnest(array[
  'public.get_relationship_analysis_context(uuid[],integer)',
  'public.begin_visual_relationship_analysis(uuid,text,text,uuid[],boolean)',
  'public.complete_visual_relationship_analysis(uuid,jsonb)',
  'public.fail_visual_relationship_analysis(uuid,text)',
  'public.review_visual_insight(uuid,public.visual_insight_status)'
]) as signature;

select ok(
  not has_table_privilege('authenticated', 'public.visual_analysis_runs', 'insert'),
  'browser cannot insert visual analysis runs directly'
);

select ok(
  not has_table_privilege('authenticated', 'public.visual_insights', 'insert'),
  'browser cannot insert AI insights directly'
);

select ok(
  not has_table_privilege('authenticated', 'public.visual_insight_evidence', 'insert'),
  'browser cannot insert AI evidence directly'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'ai_runs_purpose_check'
      and pg_get_constraintdef(oid) like '%relationship_analysis%'
  ),
  'AI run purpose allows relationship analysis'
);

select * from finish();
rollback;

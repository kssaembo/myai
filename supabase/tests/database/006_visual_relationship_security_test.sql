begin;

select plan(17);

select ok(
  relation.relrowsecurity,
  format('RLS is enabled on public.%s', table_name)
)
from unnest(array[
  'visual_analysis_runs',
  'visual_analysis_scope',
  'visual_insights',
  'visual_insight_items',
  'visual_insight_evidence'
]) as table_name
join pg_class as relation on relation.oid = format('public.%I', table_name)::regclass;

select ok(
  not has_table_privilege('anon', format('public.%I', table_name), 'select'),
  format('anon cannot select public.%s', table_name)
)
from unnest(array[
  'visual_analysis_runs',
  'visual_analysis_scope',
  'visual_insights',
  'visual_insight_items',
  'visual_insight_evidence'
]) as table_name;

select ok(
  not has_table_privilege('authenticated', format('public.%I', table_name), 'insert'),
  format('browser cannot insert public.%s directly', table_name)
)
from unnest(array[
  'visual_analysis_runs',
  'visual_analysis_scope',
  'visual_insights',
  'visual_insight_items',
  'visual_insight_evidence'
]) as table_name;

select ok(
  not has_function_privilege(
    'anon',
    'public.get_visual_relationship_foundation(uuid[],public.visual_insight_kind[],integer)',
    'execute'
  ),
  'anon cannot read visual relationship foundation'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.get_visual_relationship_foundation(uuid[],public.visual_insight_kind[],integer)',
    'execute'
  ),
  'authenticated users can read their visual relationship foundation'
);

select * from finish();
rollback;

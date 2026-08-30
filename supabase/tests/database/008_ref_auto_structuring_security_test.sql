begin;

select plan(2);

select ok(
  not has_function_privilege(
    'anon',
    'public.prepare_ref_auto_structure(uuid,uuid,jsonb)',
    'execute'
  ),
  'anon cannot prepare REF auto structuring'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.prepare_ref_auto_structure(uuid,uuid,jsonb)',
    'execute'
  ),
  'authenticated can prepare owned REF auto structuring'
);

select * from finish();
rollback;

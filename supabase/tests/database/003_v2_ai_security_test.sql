begin;

select plan(12);

select ok((select relrowsecurity from pg_class where oid = 'public.ai_provider_settings'::regclass), 'AI settings RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.ai_usage_daily'::regclass), 'AI usage RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.ai_runs'::regclass), 'AI run RLS enabled');
select ok(not has_table_privilege('anon', 'public.ai_provider_settings', 'select'), 'anon cannot read AI settings');
select ok(not has_table_privilege('anon', 'public.ai_usage_daily', 'select'), 'anon cannot read AI usage');
select ok(not has_table_privilege('anon', 'public.ai_runs', 'select'), 'anon cannot read AI runs');
select ok(not has_function_privilege('anon', 'public.get_ai_status()', 'execute'), 'anon cannot get AI status');
select ok(not has_function_privilege('anon', 'public.reserve_ai_request(text,text,text,integer)', 'execute'), 'anon cannot reserve AI requests');
select ok(not has_function_privilege('anon', 'public.complete_ai_request(uuid,text,integer,integer,integer,text)', 'execute'), 'anon cannot complete AI requests');
select ok(has_function_privilege('authenticated', 'public.get_ai_status()', 'execute'), 'authenticated can get owner AI status');
select ok(has_function_privilege('authenticated', 'public.reserve_ai_request(text,text,text,integer)', 'execute'), 'authenticated can reserve owner AI requests');
select ok(has_function_privilege('authenticated', 'public.complete_ai_request(uuid,text,integer,integer,integer,text)', 'execute'), 'authenticated can complete owner AI requests');

select * from finish();
rollback;

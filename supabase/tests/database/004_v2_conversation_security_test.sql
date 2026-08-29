begin;

select plan(14);

select ok((select relrowsecurity from pg_class where oid = 'public.ai_conversations'::regclass), 'conversation RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.ai_messages'::regclass), 'message RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.ai_message_sources'::regclass), 'source RLS enabled');
select ok(not has_table_privilege('anon', 'public.ai_conversations', 'select'), 'anon cannot read conversations');
select ok(not has_table_privilege('anon', 'public.ai_messages', 'select'), 'anon cannot read messages');
select ok(not has_table_privilege('anon', 'public.ai_message_sources', 'select'), 'anon cannot read sources');
select ok(has_table_privilege('authenticated', 'public.ai_conversations', 'select'), 'owner client can read conversations');
select ok(has_table_privilege('authenticated', 'public.ai_conversations', 'delete'), 'owner client can delete conversations');
select ok(has_table_privilege('authenticated', 'public.ai_messages', 'select'), 'owner client can read messages');
select ok(not has_table_privilege('authenticated', 'public.ai_messages', 'insert'), 'browser cannot forge messages');
select ok(not has_table_privilege('authenticated', 'public.ai_message_sources', 'insert'), 'browser cannot forge sources');
select ok(not has_function_privilege('anon', 'public.save_ai_exchange(uuid,text,text,text,integer,integer,jsonb)', 'execute'), 'anon cannot save exchanges');
select ok(has_function_privilege('authenticated', 'public.save_ai_exchange(uuid,text,text,text,integer,integer,jsonb)', 'execute'), 'authenticated gateway can save exchanges');
select is((select column_default from information_schema.columns where table_schema = 'public' and table_name = 'ai_provider_settings' and column_name = 'chat_model'), '''gemini-3.7-flash''::text', 'current Gemini model is the default');

select * from finish();
rollback;

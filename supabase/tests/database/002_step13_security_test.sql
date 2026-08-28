begin;

select plan(8);

select ok(not has_function_privilege('anon', 'public.export_knowledge_item(uuid)', 'execute'), 'anon cannot export knowledge');
select ok(not has_function_privilege('anon', 'public.trash_knowledge_item(uuid)', 'execute'), 'anon cannot trash knowledge');
select ok(not has_function_privilege('anon', 'public.restore_knowledge_item(uuid)', 'execute'), 'anon cannot restore knowledge');
select ok(not has_function_privilege('anon', 'public.permanently_delete_knowledge_item(uuid)', 'execute'), 'anon cannot permanently delete knowledge');
select ok(has_function_privilege('authenticated', 'public.export_knowledge_item(uuid)', 'execute'), 'authenticated can export through owner-checked RPC');
select ok(has_function_privilege('authenticated', 'public.trash_knowledge_item(uuid)', 'execute'), 'authenticated can trash through owner-checked RPC');
select ok(has_function_privilege('authenticated', 'public.restore_knowledge_item(uuid)', 'execute'), 'authenticated can restore through owner-checked RPC');
select ok(has_function_privilege('authenticated', 'public.permanently_delete_knowledge_item(uuid)', 'execute'), 'authenticated can permanently delete through owner-checked RPC');

select * from finish();
rollback;

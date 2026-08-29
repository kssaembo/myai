begin;

select plan(12);

select is(
  (select atttypmod from pg_attribute where attrelid = 'public.document_sections'::regclass and attname = 'embedding'),
  768,
  'document section embeddings use 768 dimensions'
);
select ok(
  exists(select 1 from pg_indexes where schemaname = 'public' and indexname = 'document_sections_embedding_hnsw_idx'),
  'embedding HNSW index exists'
);
select ok(not has_function_privilege('anon', 'public.get_embedding_status()', 'execute'), 'anon cannot read embedding status');
select ok(not has_function_privilege('anon', 'public.get_pending_embedding_sections(integer)', 'execute'), 'anon cannot read pending embedding text');
select ok(not has_function_privilege('anon', 'public.save_section_embeddings(text,jsonb)', 'execute'), 'anon cannot save embeddings');
select ok(not has_function_privilege('anon', 'public.match_document_sections(extensions.vector,integer,real)', 'execute'), 'anon cannot run semantic search');
select ok(has_function_privilege('authenticated', 'public.get_embedding_status()', 'execute'), 'authenticated can read owner embedding status');
select ok(has_function_privilege('authenticated', 'public.get_pending_embedding_sections(integer)', 'execute'), 'authenticated can read owner pending text');
select ok(has_function_privilege('authenticated', 'public.save_section_embeddings(text,jsonb)', 'execute'), 'authenticated gateway can save owner embeddings');
select ok(has_function_privilege('authenticated', 'public.match_document_sections(extensions.vector,integer,real)', 'execute'), 'authenticated can run owner semantic search');
select ok(
  position('document.ai_allowed' in pg_get_functiondef('public.get_pending_embedding_sections(integer)'::regprocedure)) > 0,
  'pending queue requires document AI consent'
);
select ok(
  position('section.owner_id = auth.uid()' in pg_get_functiondef('public.match_document_sections(extensions.vector,integer,real)'::regprocedure)) > 0,
  'semantic search is scoped to the signed-in owner'
);

select * from finish();
rollback;

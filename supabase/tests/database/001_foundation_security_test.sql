begin;

select plan(41);

select ok(
  relation.relrowsecurity,
  format('RLS is enabled on public.%s', table_name)
)
from unnest(array[
  'profiles',
  'user_settings',
  'node_types',
  'relation_types',
  'categories',
  'tags',
  'tag_aliases',
  'knowledge_items',
  'item_aliases',
  'item_tags',
  'projects',
  'documents',
  'document_versions',
  'document_sections',
  'item_evidence',
  'relations',
  'relation_evidence',
  'import_jobs',
  'import_entries'
]) as table_name
join pg_class as relation on relation.oid = format('public.%I', table_name)::regclass;

select ok(
  not has_table_privilege('anon', format('public.%I', table_name), 'select'),
  format('anon cannot select public.%s', table_name)
)
from unnest(array[
  'profiles',
  'user_settings',
  'node_types',
  'relation_types',
  'categories',
  'tags',
  'tag_aliases',
  'knowledge_items',
  'item_aliases',
  'item_tags',
  'projects',
  'documents',
  'document_versions',
  'document_sections',
  'item_evidence',
  'relations',
  'relation_evidence',
  'import_jobs',
  'import_entries'
]) as table_name;

select ok(
  not has_table_privilege('authenticated', 'public.document_versions', 'delete'),
  'authenticated users cannot directly delete immutable document versions'
);
select ok(
  (
    select count(*) = 4
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname like 'knowledge_originals_owner_%'
  ),
  'private storage has four owner-only policies'
);
select ok(
  exists (
    select 1
    from storage.buckets
    where id = 'knowledge-originals'
      and not public
      and file_size_limit = 52428800
  ),
  'private storage has the 50 MiB limit'
);

select * from finish();
rollback;

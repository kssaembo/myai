begin;

select plan(25);

select has_table('public', table_name, format('public.%s exists', table_name))
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
  exists (select 1 from pg_extension where extname = 'pgcrypto'),
  'pgcrypto extension exists'
);
select ok(
  exists (select 1 from pg_extension where extname = 'pg_trgm'),
  'pg_trgm extension exists'
);
select ok(
  exists (select 1 from pg_extension where extname = 'vector'),
  'vector extension exists'
);
select ok(
  (select count(*) = 11 from public.node_types where is_system),
  '11 system node types are seeded'
);
select ok(
  (select count(*) = 13 from public.relation_types where is_system),
  '13 system relation types are seeded'
);
select ok(
  exists (
    select 1
    from storage.buckets
    where id = 'knowledge-originals' and not public
  ),
  'knowledge-originals is private'
);

select * from finish();
rollback;

import { supabase, type Tables } from '@/shared/lib/supabase'

export type NodeType = Tables<'node_types'>
export type RelationType = Tables<'relation_types'>
export type Category = Tables<'categories'>
export type Tag = Tables<'tags'>
export type TagAlias = Tables<'tag_aliases'>

export interface TaxonomySnapshot {
  nodeTypes: NodeType[]
  relationTypes: RelationType[]
  categories: Category[]
  tags: Tag[]
  tagAliases: TagAlias[]
}

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

export async function readTaxonomy(): Promise<TaxonomySnapshot> {
  const [nodes, relations, categories, tags, aliases] = await Promise.all([
    supabase.from('node_types').select('*').eq('is_active', true).order('sort_order'),
    supabase.from('relation_types').select('*').eq('is_active', true).order('sort_order'),
    supabase.from('categories').select('*').order('sort_order').order('name'),
    supabase.from('tags').select('*').order('name'),
    supabase.from('tag_aliases').select('*').order('alias'),
  ])

  for (const result of [nodes, relations, categories, tags, aliases]) throwIfError(result.error)

  return {
    nodeTypes: nodes.data ?? [],
    relationTypes: relations.data ?? [],
    categories: categories.data ?? [],
    tags: tags.data ?? [],
    tagAliases: aliases.data ?? [],
  }
}

export async function createCategory(input: {
  ownerId: string
  name: string
  parentId: string | null
  color: string
}) {
  const { error } = await supabase.from('categories').insert({
    owner_id: input.ownerId,
    name: input.name.trim(),
    parent_id: input.parentId,
    color: input.color,
  })
  throwIfError(error)
}

export async function updateCategory(
  id: string,
  input: { name: string; parentId: string | null; color: string },
) {
  const { error } = await supabase
    .from('categories')
    .update({ name: input.name.trim(), parent_id: input.parentId, color: input.color })
    .eq('id', id)
  throwIfError(error)
}

export async function setCategoryArchived(id: string, isArchived: boolean) {
  const { error } = await supabase
    .from('categories')
    .update({ is_archived: isArchived })
    .eq('id', id)
  throwIfError(error)
}

export async function createTag(ownerId: string, name: string, color: string) {
  const { error } = await supabase
    .from('tags')
    .insert({ owner_id: ownerId, name: name.trim(), color })
  throwIfError(error)
}

export async function updateTag(id: string, name: string, color: string) {
  const { error } = await supabase.from('tags').update({ name: name.trim(), color }).eq('id', id)
  throwIfError(error)
}

export async function deleteTag(id: string) {
  const { error } = await supabase.from('tags').delete().eq('id', id)
  throwIfError(error)
}

export async function createTagAlias(ownerId: string, tagId: string, alias: string) {
  const { error } = await supabase
    .from('tag_aliases')
    .insert({ owner_id: ownerId, tag_id: tagId, alias: alias.trim() })
  throwIfError(error)
}

export async function deleteTagAlias(id: string) {
  const { error } = await supabase.from('tag_aliases').delete().eq('id', id)
  throwIfError(error)
}

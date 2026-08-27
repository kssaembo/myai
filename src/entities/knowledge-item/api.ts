import { supabase, type Tables, type TablesInsert, type TablesUpdate } from '@/shared/lib/supabase'

import type { Category, NodeType, Tag } from '@/entities/taxonomy/api'

export type KnowledgeItem = Tables<'knowledge_items'>
export type Project = Tables<'projects'>

export interface KnowledgeRecord extends KnowledgeItem {
  nodeType: NodeType
  category: Category | null
  tags: Tag[]
  project: Project | null
}

export interface KnowledgeInput {
  ownerId: string
  nodeTypeId: string
  title: string
  summary: string
  categoryId: string | null
  status: KnowledgeItem['status']
  verificationStatus: KnowledgeItem['verification_status']
  importance: number
  tagIds: string[]
  project?: Omit<Project, 'item_id' | 'owner_id'>
}

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

async function readRecords(items: KnowledgeItem[]): Promise<KnowledgeRecord[]> {
  if (items.length === 0) return []
  const itemIds = items.map((item) => item.id)
  const nodeTypeIds = [...new Set(items.map((item) => item.node_type_id))]
  const categoryIds = [
    ...new Set(items.flatMap((item) => (item.category_id ? [item.category_id] : []))),
  ]

  const [nodeTypes, categories, itemTags, tags, projects] = await Promise.all([
    supabase.from('node_types').select('*').in('id', nodeTypeIds),
    categoryIds.length
      ? supabase.from('categories').select('*').in('id', categoryIds)
      : Promise.resolve({ data: [] as Category[], error: null }),
    supabase.from('item_tags').select('*').in('item_id', itemIds),
    supabase.from('tags').select('*'),
    supabase.from('projects').select('*').in('item_id', itemIds),
  ])

  for (const result of [nodeTypes, categories, itemTags, tags, projects]) throwIfError(result.error)

  const nodeMap = new Map((nodeTypes.data ?? []).map((row) => [row.id, row]))
  const categoryMap = new Map((categories.data ?? []).map((row) => [row.id, row]))
  const tagMap = new Map((tags.data ?? []).map((row) => [row.id, row]))
  const projectMap = new Map((projects.data ?? []).map((row) => [row.item_id, row]))
  const tagsByItem = new Map<string, Tag[]>()

  for (const link of itemTags.data ?? []) {
    const tag = tagMap.get(link.tag_id)
    if (tag) tagsByItem.set(link.item_id, [...(tagsByItem.get(link.item_id) ?? []), tag])
  }

  return items.flatMap((item) => {
    const nodeType = nodeMap.get(item.node_type_id)
    if (!nodeType) return []
    return [
      {
        ...item,
        nodeType,
        category: item.category_id ? (categoryMap.get(item.category_id) ?? null) : null,
        tags: tagsByItem.get(item.id) ?? [],
        project: projectMap.get(item.id) ?? null,
      },
    ]
  })
}

export async function listKnowledge(
  options: { projectOnly?: boolean; includeArchived?: boolean } = {},
) {
  let query = supabase
    .from('knowledge_items')
    .select('*')
    .is('deleted_at', null)
    .is('merged_into_id', null)
    .order('updated_at', { ascending: false })

  if (!options.includeArchived) query = query.neq('status', 'archived')
  const { data, error } = await query
  throwIfError(error)
  const records = await readRecords(data ?? [])
  return options.projectOnly ? records.filter((item) => item.nodeType.key === 'project') : records
}

export async function getKnowledge(id: string) {
  const { data, error } = await supabase
    .from('knowledge_items')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single()
  throwIfError(error)
  if (!data) throw new Error('지식 항목을 찾을 수 없습니다.')
  const [record] = await readRecords([data])
  if (!record) throw new Error('지식 항목을 찾을 수 없습니다.')
  return record
}

async function replaceTags(ownerId: string, itemId: string, tagIds: string[]) {
  const uniqueTagIds = [...new Set(tagIds)]
  if (uniqueTagIds.length) {
    const { error: upsertError } = await supabase
      .from('item_tags')
      .upsert(uniqueTagIds.map((tagId) => ({ owner_id: ownerId, item_id: itemId, tag_id: tagId })))
    throwIfError(upsertError)
  }

  let deleteQuery = supabase.from('item_tags').delete().eq('item_id', itemId)
  if (uniqueTagIds.length)
    deleteQuery = deleteQuery.not('tag_id', 'in', `(${uniqueTagIds.join(',')})`)
  const { error: deleteError } = await deleteQuery
  throwIfError(deleteError)
}

export async function createKnowledge(input: KnowledgeInput) {
  const payload: TablesInsert<'knowledge_items'> = {
    owner_id: input.ownerId,
    node_type_id: input.nodeTypeId,
    title: input.title.trim(),
    summary: input.summary.trim() || null,
    category_id: input.categoryId,
    status: input.status,
    origin: 'user',
    verification_status: input.verificationStatus,
    importance: input.importance,
  }
  const { data, error } = await supabase
    .from('knowledge_items')
    .insert(payload)
    .select('*')
    .single()
  throwIfError(error)
  if (!data) throw new Error('지식 항목을 생성하지 못했습니다.')

  try {
    await replaceTags(input.ownerId, data.id, input.tagIds)
    if (input.project) {
      const projectPayload: TablesInsert<'projects'> = {
        item_id: data.id,
        owner_id: input.ownerId,
        ...input.project,
      }
      const { error: projectError } = await supabase.from('projects').insert(projectPayload)
      throwIfError(projectError)
    }
    return data.id
  } catch (caught) {
    await supabase.from('knowledge_items').delete().eq('id', data.id)
    throw caught
  }
}

export async function updateKnowledge(id: string, input: KnowledgeInput) {
  const payload: TablesUpdate<'knowledge_items'> = {
    title: input.title.trim(),
    summary: input.summary.trim() || null,
    category_id: input.categoryId,
    status: input.status,
    verification_status: input.verificationStatus,
    importance: input.importance,
    archived_at: input.status === 'archived' ? new Date().toISOString() : null,
  }
  const { error } = await supabase.from('knowledge_items').update(payload).eq('id', id)
  throwIfError(error)
  await replaceTags(input.ownerId, id, input.tagIds)

  if (input.project) {
    const { error: projectError } = await supabase.from('projects').upsert({
      item_id: id,
      owner_id: input.ownerId,
      ...input.project,
    })
    throwIfError(projectError)
  }
}

export async function archiveKnowledge(id: string) {
  const { error } = await supabase
    .from('knowledge_items')
    .update({ status: 'archived', archived_at: new Date().toISOString() })
    .eq('id', id)
  throwIfError(error)
}

export async function restoreKnowledge(id: string) {
  const { error } = await supabase
    .from('knowledge_items')
    .update({ status: 'active', archived_at: null })
    .eq('id', id)
  throwIfError(error)
}

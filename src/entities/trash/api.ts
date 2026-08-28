import { supabase, type Json } from '@/shared/lib/supabase'

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

export async function moveKnowledgeToTrash(itemId: string) {
  const { error } = await supabase.rpc('trash_knowledge_item', { p_item_id: itemId })
  throwIfError(error)
}

export async function restoreKnowledgeFromTrash(itemId: string) {
  const { error } = await supabase.rpc('restore_knowledge_item', { p_item_id: itemId })
  throwIfError(error)
}

export async function permanentlyDeleteKnowledge(itemId: string) {
  const { data, error } = await supabase.rpc('permanently_delete_knowledge_item', {
    p_item_id: itemId,
  })
  throwIfError(error)
  const payload = data as { storage_paths?: Json } | null
  const paths = Array.isArray(payload?.storage_paths)
    ? payload.storage_paths.filter((path): path is string => typeof path === 'string')
    : []
  if (paths.length) {
    const { error: storageError } = await supabase.storage.from('knowledge-originals').remove(paths)
    throwIfError(storageError)
  }
}

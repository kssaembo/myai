import { supabase } from '@/shared/lib/supabase'

export interface RefProjectReadiness {
  projectId: string
  refDocumentIds: string[]
  allowedDocumentIds: string[]
  eligible: boolean
}

export interface RefAIReadiness {
  totalRefDocuments: number
  allowedRefDocuments: number
  projects: RefProjectReadiness[]
}

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

export async function getRefAIReadiness(): Promise<RefAIReadiness> {
  const [documentResult, relationTypeResult, projectResult] = await Promise.all([
    supabase
      .from('documents')
      .select('item_id,active_version_id,ai_allowed')
      .eq('document_kind', 'ref'),
    supabase
      .from('relation_types')
      .select('id')
      .eq('key', 'DOCUMENTS')
      .is('owner_id', null)
      .single(),
    supabase.from('projects').select('item_id'),
  ])
  throwIfError(documentResult.error)
  throwIfError(relationTypeResult.error)
  throwIfError(projectResult.error)
  const documents = documentResult.data ?? []
  const documentIds = documents.map((document) => document.item_id)
  const projectIds = new Set((projectResult.data ?? []).map((project) => project.item_id))
  if (!documents.length || !relationTypeResult.data) {
    return { totalRefDocuments: documents.length, allowedRefDocuments: 0, projects: [] }
  }

  const [relationResult, evidenceResult] = await Promise.all([
    supabase
      .from('relations')
      .select('source_item_id,target_item_id')
      .eq('relation_type_id', relationTypeResult.data.id)
      .in('status', ['active', 'proposed'])
      .is('deleted_at', null),
    supabase
      .from('item_evidence')
      .select('item_id,document_id,version_id')
      .in('document_id', documentIds),
  ])
  throwIfError(relationResult.error)
  throwIfError(evidenceResult.error)

  const documentMap = new Map(documents.map((document) => [document.item_id, document]))
  const projectDocuments = new Map<string, Set<string>>()
  for (const relation of relationResult.data ?? []) {
    const documentId = documentMap.has(relation.source_item_id)
      ? relation.source_item_id
      : documentMap.has(relation.target_item_id)
        ? relation.target_item_id
        : null
    const projectId = projectIds.has(relation.source_item_id)
      ? relation.source_item_id
      : projectIds.has(relation.target_item_id)
        ? relation.target_item_id
        : null
    if (!documentId || !projectId) continue
    projectDocuments.set(
      projectId,
      new Set([...(projectDocuments.get(projectId) ?? []), documentId]),
    )
  }

  const evidenceKeys = new Set(
    (evidenceResult.data ?? []).map(
      (evidence) => `${evidence.item_id}:${evidence.document_id}:${evidence.version_id}`,
    ),
  )
  const projects = [...projectDocuments.entries()].map(([projectId, ids]) => {
    const refDocumentIds = [...ids]
    const allowedDocumentIds = refDocumentIds.filter((documentId) => {
      const document = documentMap.get(documentId)
      return Boolean(
        document?.ai_allowed &&
        document.active_version_id &&
        evidenceKeys.has(`${projectId}:${documentId}:${document.active_version_id}`),
      )
    })
    return {
      projectId,
      refDocumentIds,
      allowedDocumentIds,
      eligible: allowedDocumentIds.length > 0,
    }
  })

  return {
    totalRefDocuments: documents.length,
    allowedRefDocuments: documents.filter((document) => document.ai_allowed).length,
    projects,
  }
}

export async function allowAllRefDocumentsForAI() {
  const { error } = await supabase
    .from('documents')
    .update({ ai_allowed: true })
    .eq('document_kind', 'ref')
  throwIfError(error)
}

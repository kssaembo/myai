import type { Json } from '@/shared/lib/supabase/database.types'

export interface KnowledgeExportSnapshot extends Record<string, Json | undefined> {
  schema_version: number
  exported_at: string
  item: Json
}

export function safeDownloadFilename(title: string, extension: 'md' | 'json') {
  const withoutControls = [...title.normalize('NFKC')]
    .map((character) => (character.charCodeAt(0) < 32 ? '_' : character))
    .join('')
  const base = withoutControls
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\.+$/g, '')
    .trim()
    .slice(0, 100)
  return `${base || 'knowledge-export'}.${extension}`
}

function markdownText(value: unknown) {
  const text =
    value === null || value === undefined
      ? ''
      : typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
        ? String(value)
        : JSON.stringify(value)
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

export function buildKnowledgeMarkdown(snapshot: KnowledgeExportSnapshot) {
  const item = snapshot.item as Record<string, unknown>
  const tags = Array.isArray(snapshot.tags)
    ? snapshot.tags
        .map((tag) =>
          tag && typeof tag === 'object' && !Array.isArray(tag) && typeof tag.name === 'string'
            ? tag.name
            : '',
        )
        .filter((tag): tag is string => Boolean(tag))
        .join(', ')
    : ''
  const evidence = Array.isArray(snapshot.item_evidence) ? snapshot.item_evidence : []
  const relations = Array.isArray(snapshot.relations) ? snapshot.relations : []
  return [
    `# ${markdownText(item.title)}`,
    '',
    markdownText(item.summary ?? '요약 없음'),
    '',
    '## Metadata',
    '',
    `- Status: ${markdownText(item.status)}`,
    `- Verification: ${markdownText(item.verification_status)}`,
    `- Importance: ${markdownText(item.importance)}`,
    `- Tags: ${markdownText(tags || '없음')}`,
    '',
    '## Evidence',
    '',
    ...(evidence.length
      ? evidence.map((entry) => {
          const row = entry as Record<string, unknown>
          return `- ${markdownText(row.evidence_text)}`
        })
      : ['- 없음']),
    '',
    '## Relations',
    '',
    ...(relations.length
      ? relations.map((entry) => {
          const row = entry as Record<string, unknown>
          return `- ${markdownText(row.source_item_id)} → ${markdownText(row.target_item_id)} (${markdownText(row.status)})`
        })
      : ['- 없음']),
    '',
  ].join('\n')
}

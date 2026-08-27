export interface HighlightPart {
  text: string
  highlighted: boolean
}

export function highlightText(value: string, query: string): HighlightPart[] {
  const needle = query.trim()
  if (!needle) return [{ text: value, highlighted: false }]

  const parts: HighlightPart[] = []
  const normalizedValue = value.toLocaleLowerCase('ko-KR')
  const normalizedNeedle = needle.toLocaleLowerCase('ko-KR')
  let cursor = 0

  while (cursor < value.length) {
    const index = normalizedValue.indexOf(normalizedNeedle, cursor)
    if (index < 0) {
      parts.push({ text: value.slice(cursor), highlighted: false })
      break
    }
    if (index > cursor) parts.push({ text: value.slice(cursor, index), highlighted: false })
    parts.push({ text: value.slice(index, index + needle.length), highlighted: true })
    cursor = index + needle.length
  }

  return parts.length ? parts : [{ text: value, highlighted: false }]
}

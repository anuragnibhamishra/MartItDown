import type { Note } from '../types/editor'

export interface TagCount {
  tag: string
  count: number
}

export function normalizeTag(raw: string): string {
  return raw.trim().replace(/^#+/, '').trim().toLowerCase().replace(/\s+/g, '-')
}

function stripIgnoredMarkdown(markdown: string): string {
  const lines = markdown.split('\n')
  const visibleLines: string[] = []
  let fence: { marker: '`' | '~'; length: number } | null = null

  for (const line of lines) {
    const fenceMatch = line.match(/^\s{0,3}(`{3,}|~{3,})/)
    if (fence) {
      if (fenceMatch && fenceMatch[1][0] === fence.marker && fenceMatch[1].length >= fence.length) fence = null
      continue
    }
    if (fenceMatch) {
      fence = { marker: fenceMatch[1][0] as '`' | '~', length: fenceMatch[1].length }
      continue
    }
    if (/^\s{0,3}#{1,6}(?:\s|$)/.test(line)) continue

    visibleLines.push(line
      .replace(/(`+).*?\1/g, '')
      .replace(/(?:https?:\/\/|www\.)[^\s<>()]+/gi, '')
      .replace(/&(?:#\d+|#x[\da-f]+|[a-z][\da-z]+);/gi, ' '))
  }

  return visibleLines.join('\n')
}

export function extractInlineTags(markdown: string): string[] {
  const visibleText = stripIgnoredMarkdown(markdown)
  const tags = new Set<string>()
  const matcher = /(^|[^\p{L}\p{N}_#&])#([\p{L}\p{N}_/-]+)/gu

  for (const match of visibleText.matchAll(matcher)) {
    const raw = match[2]
    if (!raw || /^\d+$/.test(raw)) continue
    const tag = normalizeTag(raw)
    if (tag) tags.add(tag)
  }

  return [...tags].sort((left, right) => left.localeCompare(right))
}

export function getAllTags(note: Pick<Note, 'tags' | 'content'>): string[] {
  return [...new Set([...note.tags.map(normalizeTag).filter(Boolean), ...extractInlineTags(note.content)])]
    .sort((left, right) => left.localeCompare(right))
}

export function buildTagCounts(notes: readonly Pick<Note, 'tags' | 'content'>[]): TagCount[] {
  const counts = new Map<string, number>()
  for (const note of notes) {
    const noteTags = new Set<string>()
    for (const tag of getAllTags(note)) {
      noteTags.add(tag)
      const segments = tag.split('/')
      for (let index = 1; index < segments.length; index += 1) noteTags.add(segments.slice(0, index).join('/'))
    }
    for (const tag of noteTags) counts.set(tag, (counts.get(tag) ?? 0) + 1)
  }
  return [...counts].map(([tag, count]) => ({ tag, count }))
    .sort((left, right) => right.count - left.count || left.tag.localeCompare(right.tag))
}

export function tagMatchesFilter(tag: string, filter: string): boolean {
  const normalizedTag = normalizeTag(tag)
  const normalizedFilter = normalizeTag(filter)
  return normalizedTag === normalizedFilter || normalizedTag.startsWith(`${normalizedFilter}/`)
}

export function filterNotesByTags<T extends Pick<Note, 'tags' | 'content'>>(
  notes: readonly T[],
  activeFilters: readonly string[],
): T[] {
  if (activeFilters.length === 0) return [...notes]
  return notes.filter((note) => {
    const tags = getAllTags(note)
    return activeFilters.every((filter) => tags.some((tag) => tagMatchesFilter(tag, filter)))
  })
}
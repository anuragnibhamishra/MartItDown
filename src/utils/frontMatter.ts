import type { Note } from '../types/editor'

export interface NoteFrontMatter {
  id?: string
  title: string
  tags: string[]
  createdAt: number
  updatedAt: number
}

export function serializeFrontMatter(note: Pick<Note, 'id' | 'title' | 'tags' | 'createdAt' | 'updatedAt' | 'content'>): string {
  const tags = note.tags.map((tag) => `  - ${JSON.stringify(tag)}`).join('\n')
  return [
    '---',
    `id: ${JSON.stringify(note.id)}`,
    `title: ${JSON.stringify(note.title)}`,
    'tags:',
    tags || '  []',
    `createdAt: ${note.createdAt}`,
    `updatedAt: ${note.updatedAt}`,
    '---',
    '',
    note.content,
  ].join('\n')
}

function parseYamlString(value: string): string | null {
  const trimmed = value.trim()
  if (trimmed.startsWith('"')) {
    try {
      const parsed: unknown = JSON.parse(trimmed)
      return typeof parsed === 'string' ? parsed : null
    } catch {
      return null
    }
  }
  if (trimmed.startsWith("'")) return trimmed.slice(1, trimmed.endsWith("'") ? -1 : undefined).replace(/''/g, "'")
  return trimmed || null
}

export function parseFrontMatter(markdown: string, fallbackTitle: string): { metadata: NoteFrontMatter; content: string } {
  const normalized = markdown.replace(/\r\n?/g, '\n')
  const firstLineEnd = normalized.indexOf('\n')
  if (!normalized.startsWith('---\n') || firstLineEnd < 0) {
    return { metadata: { title: fallbackTitle, tags: [], createdAt: Date.now(), updatedAt: Date.now() }, content: normalized }
  }
  const closing = normalized.indexOf('\n---\n', firstLineEnd + 1)
  if (closing < 0) return { metadata: { title: fallbackTitle, tags: [], createdAt: Date.now(), updatedAt: Date.now() }, content: normalized }

  const header = normalized.slice(firstLineEnd + 1, closing).split('\n')
  const titleLine = header.find((line) => line.startsWith('title:'))
  const idLine = header.find((line) => line.startsWith('id:'))
  const createdLine = header.find((line) => line.startsWith('createdAt:'))
  const updatedLine = header.find((line) => line.startsWith('updatedAt:'))
  const tagsStart = header.findIndex((line) => line.trim() === 'tags:')
  const tags = tagsStart < 0 ? [] : header.slice(tagsStart + 1)
    .map((line) => line.match(/^\s+-\s+(.+)$/)?.[1])
    .filter((value): value is string => value !== undefined)
    .map(parseYamlString)
    .filter((value): value is string => value !== null)
  const parsedTitle = titleLine ? parseYamlString(titleLine.slice('title:'.length)) : null
  const createdAt = Number(createdLine?.slice('createdAt:'.length))
  const updatedAt = Number(updatedLine?.slice('updatedAt:'.length))
  const now = Date.now()

  return {
    metadata: {
      title: parsedTitle || fallbackTitle,
      ...(idLine && parseYamlString(idLine.slice('id:'.length)) ? { id: parseYamlString(idLine.slice('id:'.length)) ?? undefined } : {}),
      tags,
      createdAt: Number.isFinite(createdAt) ? createdAt : now,
      updatedAt: Number.isFinite(updatedAt) ? updatedAt : now,
    },
    content: normalized.slice(closing + '\n---\n'.length).replace(/^\n/, ''),
  }
}
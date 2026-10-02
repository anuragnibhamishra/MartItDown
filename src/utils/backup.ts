import type { Note, NotesState } from '../types/editor'

export type ImportConflictChoice = 'skip' | 'duplicate' | 'replace'

export interface ImportConflict {
  incoming: Note
  existing: Note
  reason: 'id' | 'title' | 'id-and-title'
}

export interface ImportSummary {
  newCount: number
  conflicts: ImportConflict[]
}

export interface ImportMergeResult {
  notes: Note[]
  idMap: Record<string, string>
  added: number
  replaced: number
  skipped: number
}

export function safeBackupFilename(title: string): string {
  const base = Array.from(title.trim().replace(/\.md$/i, ''), (character) => {
    const code = character.charCodeAt(0)
    return /[<>:"/\\|?*]/.test(character) || code < 32 || code === 127 ? '-' : character
  }).join('')
    .replace(/[. ]+$/g, '')
    .trim()
  return base || 'untitled'
}

export function createUniqueBackupFilenames(notes: readonly Note[]): Map<string, string> {
  const used = new Set<string>()
  const result = new Map<string, string>()
  for (const note of notes) {
    const base = safeBackupFilename(note.title)
    let candidate = base
    let suffix = 2
    while (used.has(`${candidate.toLocaleLowerCase()}.md`)) {
      candidate = `${base}-${suffix}`
      suffix += 1
    }
    used.add(`${candidate.toLocaleLowerCase()}.md`)
    result.set(note.id, `${candidate}.md`)
  }
  return result
}

function normalizedTitle(title: string): string {
  return title.trim().replace(/\s+/gu, ' ').toLocaleLowerCase()
}

export function analyzeImportConflicts(existing: readonly Note[], incoming: readonly Note[]): ImportSummary {
  const conflicts: ImportConflict[] = []
  let newCount = 0
  for (const note of incoming) {
    const idMatch = existing.find((item) => item.id === note.id)
    const titleMatch = existing.find((item) => normalizedTitle(item.title) === normalizedTitle(note.title))
    const match = idMatch ?? titleMatch
    if (!match) {
      newCount += 1
      continue
    }
    conflicts.push({ incoming: note, existing: match, reason: idMatch && titleMatch ? 'id-and-title' : idMatch ? 'id' : 'title' })
  }
  return { newCount, conflicts }
}

function uniqueDuplicateTitle(title: string, notes: readonly Note[]): string {
  const used = new Set(notes.map((note) => normalizedTitle(note.title)))
  const base = `${title} copy`
  if (!used.has(normalizedTitle(base))) return base
  let suffix = 2
  while (used.has(normalizedTitle(`${base} ${suffix}`))) suffix += 1
  return `${base} ${suffix}`
}

export function mergeImportedNotes(
  existing: readonly Note[],
  incoming: readonly Note[],
  choice: ImportConflictChoice,
  createId: () => string,
): ImportMergeResult {
  const notes = [...existing]
  const idMap: Record<string, string> = {}
  let added = 0
  let replaced = 0
  let skipped = 0

  for (const source of incoming) {
    const idMatch = notes.find((note) => note.id === source.id)
    const titleMatch = notes.find((note) => normalizedTitle(note.title) === normalizedTitle(source.title))
    const conflict = idMatch ?? titleMatch
    if (!conflict) {
      const uniqueId = notes.some((note) => note.id === source.id) ? createId() : source.id
      notes.push({ ...source, id: uniqueId })
      idMap[source.id] = uniqueId
      added += 1
      continue
    }

    if (choice === 'skip') {
      skipped += 1
      continue
    }
    if (choice === 'duplicate') {
      const id = createId()
      const title = uniqueDuplicateTitle(source.title, notes)
      notes.push({ ...source, id, title })
      idMap[source.id] = id
      added += 1
      continue
    }

    const index = notes.findIndex((note) => note.id === conflict.id)
    notes[index] = { ...source, id: conflict.id }
    idMap[source.id] = conflict.id
    replaced += 1
  }
  return { notes, idMap, added, replaced, skipped }
}

export function validateImportedNotes(value: unknown): Note[] | null {
  if (!Array.isArray(value)) return null
  const notes: Note[] = []
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') return null
    const candidate = entry as Partial<Note>
    if (typeof candidate.id !== 'string' || typeof candidate.title !== 'string'
      || typeof candidate.content !== 'string' || !Array.isArray(candidate.tags)
      || !candidate.tags.every((tag) => typeof tag === 'string')
      || typeof candidate.createdAt !== 'number' || typeof candidate.updatedAt !== 'number') return null
    notes.push({
      id: candidate.id,
      title: candidate.title,
      content: candidate.content,
      savedContent: typeof candidate.savedContent === 'string' ? candidate.savedContent : candidate.content,
      tags: candidate.tags,
      createdAt: candidate.createdAt,
      updatedAt: candidate.updatedAt,
    })
  }
  return notes
}

export interface JsonBackupPayload {
  format: 'markitdown-backup'
  version: 1
  appVersion: string
  exportedAt: number
  notes: Pick<NotesState, 'notes' | 'activeId'> & { version: 1 }
  history?: unknown
}
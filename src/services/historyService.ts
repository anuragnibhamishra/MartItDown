import type { Note, NoteVersion, VersionReason } from '../types/editor'

export const historyStorageKey = 'markitdown-history'
const historyVersion = 1
const perNoteLimit = 30
const protectedRecentCount = 10
const totalHistoryLimit = 2 * 1024 * 1024
let historyWarning: string | null = null

export interface HistoryState {
  version: 1
  byNote: Record<string, NoteVersion[]>
}

type Clock = () => number
type IdGenerator = () => string

const emptyHistory = (): HistoryState => ({ version: historyVersion, byNote: {} })

function createVersionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `version-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function isVersion(value: unknown): value is NoteVersion {
  if (!value || typeof value !== 'object') return false
  const version = value as Partial<NoteVersion>
  return typeof version.id === 'string'
    && typeof version.noteId === 'string'
    && typeof version.content === 'string'
    && typeof version.title === 'string'
    && typeof version.createdAt === 'number'
    && (version.reason === 'save' || version.reason === 'idle' || version.reason === 'restore' || version.reason === 'manual')
    && (version.label === undefined || typeof version.label === 'string')
}

function normalizeHistory(value: unknown): HistoryState | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as { version?: unknown; byNote?: unknown }
  if (candidate.version !== historyVersion || !candidate.byNote || typeof candidate.byNote !== 'object' || Array.isArray(candidate.byNote)) return null
  const byNote: Record<string, NoteVersion[]> = {}
  for (const [noteId, versions] of Object.entries(candidate.byNote)) {
    if (!Array.isArray(versions) || !versions.every(isVersion) || versions.some((version) => version.noteId !== noteId)) return null
    byNote[noteId] = [...versions].sort((left, right) => right.createdAt - left.createdAt)
  }
  return { version: historyVersion, byNote }
}

export function loadHistory(): HistoryState {
  try {
    const stored = localStorage.getItem(historyStorageKey)
    if (!stored) return emptyHistory()
    const normalized = normalizeHistory(JSON.parse(stored) as unknown)
    if (!normalized) historyWarning = 'Version history data was invalid and has been reset'
    return normalized ?? emptyHistory()
  } catch {
    historyWarning = 'Version history could not be read from this browser'
    return emptyHistory()
  }
}

export function takeHistoryWarning(): string | null {
  const warning = historyWarning
  historyWarning = null
  return warning
}

export function saveHistory(history: HistoryState): boolean {
  try {
    localStorage.setItem(historyStorageKey, JSON.stringify(history))
    return true
  } catch {
    historyWarning = 'Unable to save version history in this browser'
    return false
  }
}

function serializedSize(history: HistoryState): number {
  return new TextEncoder().encode(JSON.stringify(history)).length
}

export function pruneVersions(history: HistoryState, notes: readonly Note[] = [], sizeLimit = totalHistoryLimit): HistoryState {
  const byNote: Record<string, NoteVersion[]> = {}
  for (const [noteId, versions] of Object.entries(history.byNote)) {
    const sorted = [...versions].sort((left, right) => right.createdAt - left.createdAt)
    const keep = new Set<NoteVersion>(sorted.slice(0, protectedRecentCount))
    for (const version of sorted.filter((item) => item.label?.trim()).slice(0, perNoteLimit - protectedRecentCount)) {
      if (version.label?.trim()) keep.add(version)
    }
    for (const version of sorted) {
      if (keep.size >= perNoteLimit) break
      keep.add(version)
    }
    byNote[noteId] = sorted.filter((version) => keep.has(version))
  }

  const result: HistoryState = { version: historyVersion, byNote }
  if (serializedSize(result) <= sizeLimit) return result

  const noteRecency = new Map(notes.map((note) => [note.id, note.updatedAt]))
  const removable = Object.entries(byNote).flatMap(([noteId, versions]) => versions
    .filter((version, index) => index >= protectedRecentCount && !version.label?.trim())
    .map((version) => ({ noteId, version, recency: noteRecency.get(noteId) ?? 0 })))
    .sort((left, right) => left.recency - right.recency || left.version.createdAt - right.version.createdAt)

  for (const item of removable) {
    if (serializedSize(result) <= sizeLimit) break
    result.byNote[item.noteId] = (result.byNote[item.noteId] ?? []).filter((version) => version.id !== item.version.id)
  }
  return result
}

function addToHistory(history: HistoryState, note: Pick<Note, 'id' | 'title' | 'content'>, reason: VersionReason, label: string | undefined, clock: Clock, idGenerator: IdGenerator): { history: HistoryState; version: NoteVersion | null } {
  const existing = history.byNote[note.id] ?? []
  const latest = [...existing].sort((left, right) => right.createdAt - left.createdAt)[0]
  if (latest?.content === note.content) return { history, version: null }

  const version: NoteVersion = {
    id: idGenerator(),
    noteId: note.id,
    content: note.content,
    title: note.title,
    createdAt: clock(),
    reason,
    ...(label?.trim() ? { label: label.trim() } : {}),
  }
  return {
    history: { version: historyVersion, byNote: { ...history.byNote, [note.id]: [version, ...existing] } },
    version,
  }
}

export function addVersion(
  note: Pick<Note, 'id' | 'title' | 'content'>,
  reason: VersionReason,
  label?: string,
  clock: Clock = Date.now,
  idGenerator: IdGenerator = createVersionId,
): NoteVersion | null {
  const added = addToHistory(loadHistory(), note, reason, label, clock, idGenerator)
  if (!added.version) return null
  const pruned = pruneVersions(added.history)
  return saveHistory(pruned) ? added.version : null
}

export function addVersions(
  notes: readonly Pick<Note, 'id' | 'title' | 'content'>[],
  reason: VersionReason,
  label?: string,
  clock: Clock = Date.now,
): boolean {
  let history = loadHistory()
  for (const note of notes) history = addToHistory(history, note, reason, label, clock, createVersionId).history
  const pruned = pruneVersions(history)
  return saveHistory(pruned)
}

export function mergeImportedHistory(imported: HistoryState, noteIdMap: Readonly<Record<string, string>>, notes: readonly Note[]): boolean {
  const current = loadHistory()
  const byNote = { ...current.byNote }
  for (const [sourceId, versions] of Object.entries(imported.byNote)) {
    const targetId = noteIdMap[sourceId]
    if (!targetId) continue
    const existing = byNote[targetId] ?? []
    const contents = new Set(existing.map((version) => version.content))
    const mapped = versions.filter((version) => !contents.has(version.content)).map((version) => ({
      ...version,
      id: createVersionId(),
      noteId: targetId,
    }))
    if (mapped.length) byNote[targetId] = [...existing, ...mapped].sort((left, right) => right.createdAt - left.createdAt)
  }
  return saveHistory(pruneVersions({ version: historyVersion, byNote }, notes))
}

export function listVersions(noteId: string): NoteVersion[] {
  return [...(loadHistory().byNote[noteId] ?? [])].sort((left, right) => right.createdAt - left.createdAt)
}

export function getVersion(noteId: string, versionId: string): NoteVersion | null {
  return loadHistory().byNote[noteId]?.find((version) => version.id === versionId) ?? null
}

export function deleteVersion(noteId: string, versionId: string): boolean {
  const history = loadHistory()
  const versions = history.byNote[noteId]
  if (!versions?.some((version) => version.id === versionId)) return true
  const remaining = versions.filter((version) => version.id !== versionId)
  const byNote = { ...history.byNote }
  if (remaining.length) byNote[noteId] = remaining
  else delete byNote[noteId]
  return saveHistory({ version: historyVersion, byNote })
}

export function clearHistory(noteId: string): boolean {
  const history = loadHistory()
  if (!history.byNote[noteId]) return true
  const byNote = { ...history.byNote }
  delete byNote[noteId]
  return saveHistory({ version: historyVersion, byNote })
}

export function labelVersion(noteId: string, versionId: string, label: string): boolean {
  const history = loadHistory()
  const versions = history.byNote[noteId]
  if (!versions?.some((version) => version.id === versionId)) return false
  const byNote = {
    ...history.byNote,
    [noteId]: versions.map((version) => version.id === versionId
      ? { ...version, ...(label.trim() ? { label: label.trim() } : { label: undefined }) }
      : version),
  }
  return saveHistory(pruneVersions({ version: historyVersion, byNote }))
}
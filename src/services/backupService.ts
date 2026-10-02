import type { Note, NotesState } from '../types/editor'
import type { HistoryState } from './historyService'
import { serializeFrontMatter, parseFrontMatter } from '../utils/frontMatter'
import { createUniqueBackupFilenames, type JsonBackupPayload, validateImportedNotes } from '../utils/backup'

const backupFormat = 'markitdown-backup'
const backupVersion = 1
const maxCompressedBytes = 100 * 1024 * 1024
const maxExpandedBytes = 50 * 1024 * 1024
const appVersion = '1.0.0'

export interface ImportedBackup {
  notes: Note[]
  activeId: string | null
  history?: HistoryState
  warnings: string[]
}

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `import-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function isHistoryState(value: unknown): value is HistoryState {
  if (!value || typeof value !== 'object') return false
  const candidate = value as { version?: unknown; byNote?: unknown }
  if (candidate.version !== 1 || !candidate.byNote || typeof candidate.byNote !== 'object' || Array.isArray(candidate.byNote)) return false
  return Object.entries(candidate.byNote).every(([noteId, versions]) => Array.isArray(versions)
    && versions.every((version) => Boolean(version) && typeof version === 'object'
      && (version as { noteId?: unknown }).noteId === noteId
      && typeof (version as { id?: unknown }).id === 'string'
      && typeof (version as { content?: unknown }).content === 'string'
      && typeof (version as { title?: unknown }).title === 'string'
      && typeof (version as { createdAt?: unknown }).createdAt === 'number'
      && ['save', 'idle', 'restore', 'manual'].includes(String((version as { reason?: unknown }).reason))))
}

function validateManifest(value: unknown, expectedCount?: number): boolean {
  if (!value || typeof value !== 'object') return false
  const manifest = value as { format?: unknown; version?: unknown; noteCount?: unknown }
  return manifest.format === backupFormat && manifest.version === backupVersion
    && Number.isInteger(manifest.noteCount)
    && (expectedCount === undefined || manifest.noteCount === expectedCount)
}

export async function createZipBackup(notes: readonly Note[], exportedAt = Date.now()): Promise<Uint8Array> {
  const { zipSync, strToU8 } = await import('fflate')
  const filenames = createUniqueBackupFilenames(notes)
  const files: Record<string, Uint8Array> = {}
  for (const note of notes) files[filenames.get(note.id) ?? `${note.id}.md`] = strToU8(serializeFrontMatter(note))
  const manifest = { format: backupFormat, version: backupVersion, appVersion, exportedAt, noteCount: notes.length }
  files['manifest.json'] = strToU8(JSON.stringify(manifest, null, 2))
  return zipSync(files, { level: 6 })
}

export function createJsonBackup(state: NotesState, history?: HistoryState, exportedAt = Date.now()): JsonBackupPayload {
  return {
    format: backupFormat,
    version: backupVersion,
    appVersion,
    exportedAt,
    notes: { version: 1, notes: state.notes, activeId: state.activeId },
    ...(history ? { history } : {}),
  }
}

export function parseJsonBackup(text: string): ImportedBackup {
  const value = JSON.parse(text) as unknown
  if (!value || typeof value !== 'object') throw new Error('This is not a MarkItDown backup.')
  const candidate = value as { format?: unknown; version?: unknown; notes?: unknown; history?: unknown }
  if (candidate.format !== backupFormat || candidate.version !== backupVersion || !candidate.notes || typeof candidate.notes !== 'object') {
    throw new Error('This JSON backup has an unsupported format or version.')
  }
  const payload = candidate.notes as { version?: unknown; notes?: unknown; activeId?: unknown }
  if (payload.version !== 1) throw new Error('The notes payload version is not supported.')
  const notes = validateImportedNotes(payload.notes)
  if (!notes) throw new Error('The backup contains invalid note records.')
  const activeId = typeof payload.activeId === 'string' && notes.some((note) => note.id === payload.activeId)
    ? payload.activeId
    : notes[0]?.id ?? null
  const warnings: string[] = []
  const history = candidate.history === undefined ? undefined : isHistoryState(candidate.history) ? candidate.history : undefined
  if (candidate.history !== undefined && !history) warnings.push('History data was invalid and was skipped.')
  return { notes, activeId, ...(history ? { history } : {}), warnings }
}

function decodeUtf8(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    throw new Error('The backup contains a file that is not valid UTF-8.')
  }
}

function isSafeArchivePath(path: string): boolean {
  if (!path || path.startsWith('/') || path.startsWith('\\') || path.includes('\\') || /^[a-z]:/i.test(path)) return false
  return !path.split('/').some((segment) => segment === '..' || segment === '.')
}

export async function parseZipBackup(bytes: Uint8Array): Promise<ImportedBackup> {
  if (bytes.byteLength > maxCompressedBytes) throw new Error('This ZIP backup exceeds the 100 MB import limit.')
  const { unzipSync } = await import('fflate')
  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(bytes)
  } catch {
    throw new Error('The ZIP backup is damaged or uses an unsupported compression method.')
  }
  let expandedBytes = 0
  for (const [path, data] of Object.entries(files)) {
    if (!isSafeArchivePath(path)) throw new Error('The ZIP contains an unsafe file path.')
    expandedBytes += data.byteLength
    if (expandedBytes > maxExpandedBytes) throw new Error('The expanded backup exceeds the 50 MB import limit.')
  }

  const manifestBytes = files['manifest.json']
  if (!manifestBytes) throw new Error('The ZIP is missing manifest.json.')
  let manifest: unknown
  try { manifest = JSON.parse(decodeUtf8(manifestBytes)) as unknown } catch (error) {
    if (error instanceof Error && error.message.includes('UTF-8')) throw error
    throw new Error('The ZIP manifest is invalid.')
  }
  const markdownEntries = Object.entries(files).filter(([path]) => path.toLocaleLowerCase().endsWith('.md'))
  if (!validateManifest(manifest, markdownEntries.length)) throw new Error('The ZIP manifest does not match the archive contents.')

  const notes = markdownEntries.map(([path, data]) => {
    const markdown = decodeUtf8(data)
    const fallbackTitle = path.split('/').at(-1)?.replace(/\.md$/i, '') || 'Imported note'
    const { metadata, content } = parseFrontMatter(markdown, fallbackTitle)
    return {
      id: metadata.id || newId(),
      title: metadata.title,
      content,
      savedContent: content,
      tags: metadata.tags,
      createdAt: metadata.createdAt,
      updatedAt: metadata.updatedAt,
    }
  })
  return { notes, activeId: notes[0]?.id ?? null, warnings: [] }
}

export async function parseBackupFile(file: File): Promise<ImportedBackup> {
  if (file.size > maxCompressedBytes) throw new Error('This backup exceeds the 100 MB import limit.')
  const bytes = new Uint8Array(await file.arrayBuffer())
  const isZip = file.name.toLocaleLowerCase().endsWith('.zip') || (bytes[0] === 0x50 && bytes[1] === 0x4b)
  if (isZip) return parseZipBackup(bytes)
  if (!file.name.toLocaleLowerCase().endsWith('.json')) throw new Error('Choose a .zip or .json MarkItDown backup.')
  return parseJsonBackup(decodeUtf8(bytes))
}

export function downloadBackup(data: BlobPart, filename: string, mimeType: string): void {
  const url = URL.createObjectURL(new Blob([data], { type: mimeType }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
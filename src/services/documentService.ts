import type { Note, NotePatch, NotesState, Theme } from '../types/editor'
import { starterMarkdown } from '../utils/markdown'
import { normalizeTag } from '../utils/tags'

const documentStorageKey = 'markitdown-document'
export const notesStorageKey = 'markitdown-notes'
const themeStorageKey = 'markitdown-theme'
const sidebarStorageKey = 'markitdown-sidebar'
const notesVersion = 1

type IdGenerator = () => string
type Clock = () => number

export function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `note-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function buildNote(partial: Partial<Pick<Note, 'id' | 'title' | 'content' | 'savedContent' | 'tags' | 'createdAt' | 'updatedAt'>> = {}, idGenerator: IdGenerator = createId, clock: Clock = Date.now): Note {
  const now = clock()
  const content = partial.content ?? ''
  return {
    id: partial.id ?? idGenerator(),
    title: partial.title ?? 'Untitled',
    content,
    savedContent: partial.savedContent ?? content,
    tags: partial.tags ? normalizeManualTags(partial.tags) : [],
    createdAt: partial.createdAt ?? now,
    updatedAt: partial.updatedAt ?? now,
  }
}

export function createInitialNotesState(idGenerator: IdGenerator = createId, clock: Clock = Date.now): NotesState {
  const note = buildNote({ title: 'welcome.md', content: starterMarkdown, savedContent: starterMarkdown }, idGenerator, clock)
  return { notes: [note], activeId: note.id }
}

export function updateNoteInState(state: NotesState, id: string, patch: NotePatch, clock: Clock = Date.now): NotesState {
  if (!state.notes.some((note) => note.id === id)) return state
  return {
    ...state,
    notes: state.notes.map((note) => note.id === id
      ? { ...note, ...patch, tags: patch.tags ? normalizeManualTags(patch.tags) : note.tags, updatedAt: patch.updatedAt ?? clock() }
      : note),
  }
}

function normalizeManualTags(tags: readonly string[]): string[] {
  return [...new Set(tags.map(normalizeTag).filter(Boolean))]
}

export function setTagsInState(state: NotesState, id: string, tags: readonly string[], clock: Clock = Date.now): NotesState {
  const note = state.notes.find((item) => item.id === id)
  if (!note) return state
  const normalizedTags = normalizeManualTags(tags)
  if (note.tags.length === normalizedTags.length && note.tags.every((tag, index) => tag === normalizedTags[index])) return state
  return updateNoteInState(state, id, { tags: normalizedTags }, clock)
}

export function deleteNoteFromState(state: NotesState, id: string, idGenerator: IdGenerator = createId, clock: Clock = Date.now): NotesState {
  const sortedNotes = [...state.notes].sort((a, b) => b.updatedAt - a.updatedAt)
  const index = sortedNotes.findIndex((note) => note.id === id)
  if (index < 0) return state
  const notes = state.notes.filter((note) => note.id !== id)
  if (notes.length === 0) {
    const replacement = buildNote({}, idGenerator, clock)
    return { notes: [replacement], activeId: replacement.id }
  }
  const remainingByRecency = sortedNotes.filter((note) => note.id !== id)
  const activeId = state.activeId === id ? remainingByRecency[Math.min(index, remainingByRecency.length - 1)].id : state.activeId
  return { notes, activeId }
}

export function duplicateNoteInState(state: NotesState, id: string, idGenerator: IdGenerator = createId, clock: Clock = Date.now): NotesState {
  const source = state.notes.find((note) => note.id === id)
  if (!source) return state
  const now = clock()
  const copy = buildNote({
    title: `${source.title} copy`,
    content: source.content,
    savedContent: source.content,
    tags: source.tags,
    createdAt: now,
    updatedAt: now,
  }, idGenerator, clock)
  return { notes: [...state.notes, copy], activeId: copy.id }
}

export function createNote(partial: Partial<Pick<Note, 'title' | 'content' | 'savedContent' | 'tags'>> = {}): Note {
  const state = loadNotes()
  const note = buildNote(partial)
  saveNotes({ notes: [...state.notes, note], activeId: note.id })
  return note
}

export function updateNote(id: string, patch: NotePatch): Note | null {
  const state = loadNotes()
  const updated = updateNoteInState(state, id, patch)
  if (updated === state) return null
  saveNotes(updated)
  return updated.notes.find((note) => note.id === id) ?? null
}

export function deleteNote(id: string): NotesState {
  const state = loadNotes()
  const updated = deleteNoteFromState(state, id)
  saveNotes(updated)
  return updated
}

export function duplicateNote(id: string): Note | null {
  const state = loadNotes()
  const duplicated = duplicateNoteInState(state, id)
  if (duplicated === state) return null
  saveNotes(duplicated)
  return duplicated.notes.find((note) => note.id === duplicated.activeId) ?? null
}

function isNote(value: unknown): value is Note {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<Note>
  return typeof candidate.id === 'string'
    && typeof candidate.title === 'string'
    && typeof candidate.content === 'string'
    && typeof candidate.savedContent === 'string'
    && Array.isArray(candidate.tags)
    && candidate.tags.every((tag) => typeof tag === 'string')
    && typeof candidate.createdAt === 'number'
    && typeof candidate.updatedAt === 'number'
}

function normalizeNotesState(value: unknown): NotesState | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as { version?: unknown; notes?: unknown; activeId?: unknown }
  if (candidate.version !== notesVersion || !Array.isArray(candidate.notes) || !candidate.notes.every(isNote)) return null
  const notes = candidate.notes as Note[]
  if (notes.length === 0) return null
  const activeId = typeof candidate.activeId === 'string' && notes.some((note) => note.id === candidate.activeId)
    ? candidate.activeId
    : notes[0].id
  return { notes, activeId }
}

export function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeStorage(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

export function loadNotes(): NotesState {
  const stored = readStorage(notesStorageKey)
  if (stored !== null) {
    try {
      const state = normalizeNotesState(JSON.parse(stored) as unknown)
      if (state) return state
    } catch {
      // Fall through to a starter note when persisted notes are malformed.
    }
    return createInitialNotesState()
  }

  const legacy = readStorage(documentStorageKey)
  if (legacy !== null) {
    try {
      const document = JSON.parse(legacy) as { name?: unknown; content?: unknown; savedContent?: unknown }
      if (typeof document.name === 'string' && typeof document.content === 'string' && typeof document.savedContent === 'string') {
        const note = buildNote({ title: document.name, content: document.content, savedContent: document.savedContent })
        const state = { notes: [note], activeId: note.id }
        saveNotes(state)
        return state
      }
    } catch {
      // A malformed legacy draft should not prevent a new library from opening.
    }
  }

  const state = createInitialNotesState()
  saveNotes(state)
  return state
}

export function saveNotes(state: NotesState): boolean {
  return writeStorage(notesStorageKey, JSON.stringify({ version: notesVersion, notes: state.notes, activeId: state.activeId }))
}

export function sanitizeMarkdownFilename(title: string): string {
  const withoutExtension = title.trim().replace(/\.md$/i, '')
  const sanitized = Array.from(withoutExtension, (character) => {
    const code = character.charCodeAt(0)
    return /[<>:"/\\|?*]/.test(character) || code < 32 || code === 127 ? '-' : character
  }).join('')
    .replace(/[. ]+$/g, '')
    .trim()
  return `${sanitized || 'untitled'}.md`
}

export function loadTheme(): Theme {
  const stored = readStorage(themeStorageKey)
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system'
}

export function persistTheme(theme: Theme): boolean {
  return writeStorage(themeStorageKey, theme)
}

export function loadSidebarCollapsed(): boolean {
  return readStorage(sidebarStorageKey) === 'collapsed'
}

export function persistSidebarCollapsed(collapsed: boolean): boolean {
  return writeStorage(sidebarStorageKey, collapsed ? 'collapsed' : 'expanded')
}

export function downloadMarkdownFile(fileName: string, data: string) {
  const safeName = sanitizeMarkdownFilename(fileName)
  const url = URL.createObjectURL(new Blob([data], { type: 'text/markdown;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = safeName || 'untitled.md'
  anchor.click()
  URL.revokeObjectURL(url)
}

export function createUniqueUntitledTitle(notes: Note[]): string {
  const usedTitles = new Set(notes.map((note) => note.title.trim().toLocaleLowerCase()))
  if (!usedTitles.has('untitled')) return 'Untitled'
  let suffix = 2
  while (usedTitles.has(`untitled ${suffix}`)) suffix += 1
  return `Untitled ${suffix}`
}

export function setTags(id: string, tags: readonly string[]): Note | null {
  const state = loadNotes()
  const updated = setTagsInState(state, id, tags)
  if (updated === state) return state.notes.find((note) => note.id === id) ?? null
  saveNotes(updated)
  return updated.notes.find((note) => note.id === id) ?? null
}
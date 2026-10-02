import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildNote,
  createNote,
  createUniqueUntitledTitle,
  deleteNote,
  deleteNoteFromState,
  duplicateNote,
  duplicateNoteInState,
  loadNotes,
  notesStorageKey,
  saveNotes,
  sanitizeMarkdownFilename,
  setTags,
  setTagsInState,
  updateNote,
  updateNoteInState,
} from './documentService'
import type { NotesState } from '../types/editor'

class MemoryStorage implements Storage {
  private readonly values: Map<string, string>

  constructor(initialValues: Record<string, string> = {}) {
    this.values = new Map(Object.entries(initialValues))
  }

  get length() {
    return this.values.size
  }

  clear() {
    this.values.clear()
  }

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null
  }

  removeItem(key: string) {
    this.values.delete(key)
  }

  setItem(key: string, value: string) {
    this.values.set(key, String(value))
  }
}

let storage: MemoryStorage

function twoNoteState(activeId = 'second'): NotesState {
  const first = buildNote({ id: 'first', title: 'First', content: 'one', savedContent: 'one', createdAt: 1, updatedAt: 1 })
  const second = buildNote({ id: 'second', title: 'Second', content: 'two', savedContent: 'two', createdAt: 2, updatedAt: 2 })
  return { notes: [first, second], activeId }
}

beforeEach(() => {
  storage = new MemoryStorage()
  vi.stubGlobal('localStorage', storage)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('notes persistence', () => {
  it('migrates the legacy draft and leaves it as a backup', () => {
    const oldDraft = JSON.stringify({ name: 'draft.md', content: 'draft content', savedContent: 'saved content' })
    storage.setItem('markitdown-document', oldDraft)

    const state = loadNotes()

    expect(state.notes).toHaveLength(1)
    expect(state.notes[0]).toMatchObject({ title: 'draft.md', content: 'draft content', savedContent: 'saved content', tags: [] })
    expect(state.activeId).toBe(state.notes[0].id)
    expect(storage.getItem('markitdown-document')).toBe(oldDraft)
    expect(JSON.parse(storage.getItem(notesStorageKey) ?? '{}')).toMatchObject({ version: 1, activeId: state.activeId })
  })

  it('falls back to starter content for corrupt JSON or an invalid shape', () => {
    storage.setItem(notesStorageKey, '{broken')
    expect(loadNotes().notes[0].content).toContain('# Welcome to MarkItDown')

    storage.setItem(notesStorageKey, JSON.stringify({ version: 1, notes: [{ id: 2 }], activeId: 2 }))
    expect(loadNotes().notes[0].content).toContain('# Welcome to MarkItDown')
  })

  it('seeds and saves a versioned library when no previous draft exists', () => {
    const state = loadNotes()
    expect(state.notes).toHaveLength(1)
    expect(state.notes[0].content).toContain('# Welcome to MarkItDown')
    expect(JSON.parse(storage.getItem(notesStorageKey) ?? '{}').version).toBe(1)
  })

  it('handles unavailable or quota-limited storage without throwing', () => {
    const blockedStorage = new MemoryStorage()
    vi.stubGlobal('localStorage', {
      getItem: blockedStorage.getItem.bind(blockedStorage),
      setItem: () => { throw new DOMException('Quota exceeded', 'QuotaExceededError') },
      removeItem: blockedStorage.removeItem.bind(blockedStorage),
      clear: blockedStorage.clear.bind(blockedStorage),
      key: blockedStorage.key.bind(blockedStorage),
      get length() { return blockedStorage.length },
    } satisfies Storage)

    expect(() => loadNotes()).not.toThrow()
    expect(saveNotes(twoNoteState())).toBe(false)
  })
})

describe('note state operations', () => {
  it('creates and updates notes through the storage API', () => {
    saveNotes(twoNoteState())
    const created = createNote({ title: 'Third', content: 'three' })
    expect(loadNotes().activeId).toBe(created.id)

    const updated = updateNote(created.id, { title: 'Renamed', content: 'edited' })
    expect(updated).toMatchObject({ title: 'Renamed', content: 'edited', updatedAt: expect.any(Number) })
    expect(updateNote('missing', { title: 'Nope' })).toBeNull()
  })

  it('duplicates content with a new ID and selects the duplicate', () => {
    saveNotes(twoNoteState())
    const copy = duplicateNote('second')
    expect(copy).toMatchObject({ title: 'Second copy', content: 'two', savedContent: 'two', tags: [] })
    expect(copy?.id).not.toBe('second')
    expect(loadNotes().activeId).toBe(copy?.id)

    const pureCopy = duplicateNoteInState(twoNoteState(), 'first', () => 'copy-id', () => 10)
    expect(pureCopy.activeId).toBe('copy-id')
    expect(pureCopy.notes.at(-1)?.title).toBe('First copy')
  })

  it('deletes the active note and selects the nearest remaining note', () => {
    saveNotes(twoNoteState())
    const state = deleteNote('second')
    expect(state.notes.map((note) => note.id)).toEqual(['first'])
    expect(state.activeId).toBe('first')

    const middleState: NotesState = { ...twoNoteState(), activeId: 'first' }
    const withThird = { ...middleState, notes: [...middleState.notes, buildNote({ id: 'third', title: 'Third' })], activeId: 'second' }
    const afterDelete = deleteNoteFromState(withThird, 'second')
    expect(afterDelete.activeId).toBe('first')
  })

  it('creates a fresh empty note when deleting the last note', () => {
    const onlyNote = buildNote({ id: 'only', title: 'Only', content: 'text' })
    const state = deleteNoteFromState({ notes: [onlyNote], activeId: onlyNote.id }, onlyNote.id, () => 'replacement-id', () => 42)
    expect(state).toMatchObject({ activeId: 'replacement-id', notes: [{ id: 'replacement-id', title: 'Untitled', content: '', savedContent: '', tags: [], createdAt: 42 }] })
  })

  it('updates state immutably and generates unique Untitled names', () => {
    const state = twoNoteState()
    const updated = updateNoteInState(state, 'first', { title: 'Changed' }, () => 5)
    expect(updated.notes[0].title).toBe('Changed')
    expect(state.notes[0].title).toBe('First')
    expect(createUniqueUntitledTitle([])).toBe('Untitled')
    expect(createUniqueUntitledTitle([buildNote({ title: 'Untitled' }), buildNote({ title: 'Untitled 2' })])).toBe('Untitled 3')
  })

  it('normalizes and deduplicates tags, and only updates timestamps for real changes', () => {
    expect(buildNote({ tags: [' Project ', 'project'] }).tags).toEqual(['project'])
    const state = twoNoteState()
    const updated = setTagsInState(state, 'first', [' Project Alpha ', '#PROJECT-alpha', 'project/alpha'], () => 10)
    expect(updated.notes[0].tags).toEqual(['project-alpha', 'project/alpha'])
    expect(updated.notes[0].updatedAt).toBe(10)
    expect(setTagsInState(updated, 'first', ['PROJECT-ALPHA', 'project/alpha'], () => 20)).toBe(updated)
    expect(setTagsInState(updated, 'missing', ['tag'])).toBe(updated)
  })

  it('persists normalized tags through the service API', () => {
    saveNotes(twoNoteState())
    expect(setTags('first', [' Work ', 'work'])).toMatchObject({ tags: ['work'] })
    expect(loadNotes().notes[0].tags).toEqual(['work'])
  })

  it('sanitizes exported filenames and always adds one .md extension', () => {
    expect(sanitizeMarkdownFilename('folder\\bad:name?.md')).toBe('folder-bad-name-.md')
    expect(sanitizeMarkdownFilename('  .md ')).toBe('untitled.md')
    expect(sanitizeMarkdownFilename('report')).toBe('report.md')
  })
})

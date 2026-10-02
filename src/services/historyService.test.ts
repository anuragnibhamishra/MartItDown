import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Note, NoteVersion } from '../types/editor'
import {
  addVersion,
  clearHistory,
  deleteVersion,
  getVersion,
  historyStorageKey,
  listVersions,
  loadHistory,
  mergeImportedHistory,
  pruneVersions,
  saveHistory,
} from './historyService'

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>()
  get length() { return this.values.size }
  clear() { this.values.clear() }
  getItem(key: string) { return this.values.get(key) ?? null }
  key(index: number) { return [...this.values.keys()][index] ?? null }
  removeItem(key: string) { this.values.delete(key) }
  setItem(key: string, value: string) { this.values.set(key, String(value)) }
}

let storage: MemoryStorage
const source = { id: 'note-1', title: 'Notebook', content: 'first draft' }

beforeEach(() => {
  storage = new MemoryStorage()
  vi.stubGlobal('localStorage', storage)
})

afterEach(() => vi.unstubAllGlobals())

function version(id: string, createdAt: number, label?: string, content = `content-${id}`): NoteVersion {
  return { id, noteId: 'note-1', content, title: 'Notebook', createdAt, reason: label ? 'manual' : 'idle', ...(label ? { label } : {}) }
}

describe('history service', () => {
  it('stores versions separately and deduplicates consecutive content', () => {
    const first = addVersion(source, 'save', undefined, () => 10, () => 'v1')
    expect(first).toMatchObject({ id: 'v1', reason: 'save', content: 'first draft' })
    expect(addVersion(source, 'idle', undefined, () => 20, () => 'v2')).toBeNull()
    expect(addVersion({ ...source, content: 'second draft' }, 'idle', undefined, () => 30, () => 'v2')).toMatchObject({ id: 'v2', reason: 'idle' })
    expect(addVersion({ ...source, content: 'third draft' }, 'restore', undefined, () => 40, () => 'v3')).toMatchObject({ reason: 'restore' })
    expect(listVersions(source.id).map(({ id }) => id)).toEqual(['v3', 'v2', 'v1'])
    expect(storage.getItem('markitdown-notes')).toBeNull()
    expect(storage.getItem(historyStorageKey)).toContain('"version":1')
  })

  it('keeps the newest ten and manual labels while enforcing the per-note cap', () => {
    const versions = Array.from({ length: 35 }, (_, index) => version(`v${index}`, 100 - index, index === 14 ? 'Important' : undefined))
    const pruned = pruneVersions({ version: 1, byNote: { 'note-1': versions } })
    expect(pruned.byNote['note-1']).toHaveLength(30)
    expect(pruned.byNote['note-1'].some(({ label }) => label === 'Important')).toBe(true)
    expect(pruned.byNote['note-1'].slice(0, 10).map(({ id }) => id)).toEqual(versions.slice(0, 10).map(({ id }) => id))
  })

  it('prunes oldest unlabeled history to fit the total serialized size', () => {
    const versions = Array.from({ length: 15 }, (_, index) => version(`v${index}`, 100 - index, undefined, 'x'.repeat(55)))
    const pruned = pruneVersions({ version: 1, byNote: { 'note-1': versions } }, [], 1700)
    expect(new TextEncoder().encode(JSON.stringify(pruned)).length).toBeLessThanOrEqual(1700)
    expect(pruned.byNote['note-1']).toHaveLength(11)
    expect(pruned.byNote['note-1'][0]?.id).toBe('v0')
    expect(pruned.byNote['note-1'].some(({ id }) => id === 'v14')).toBe(false)
  })

  it('removes global-cap candidates from the least recently edited note first', () => {
    const oldVersions = Array.from({ length: 12 }, (_, index) => ({ ...version(`old-${index}`, 100 - index, undefined, 'o'.repeat(180)), noteId: 'old-note' }))
    const recentVersions = Array.from({ length: 12 }, (_, index) => ({ ...version(`new-${index}`, 100 - index, undefined, 'n'.repeat(180)), noteId: 'new-note' }))
    const history = { version: 1 as const, byNote: { 'old-note': oldVersions, 'new-note': recentVersions } }
    const fullSize = new TextEncoder().encode(JSON.stringify(history)).length
    const notes: Note[] = [
      { id: 'old-note', title: 'Old', content: '', savedContent: '', tags: [], createdAt: 0, updatedAt: 1 },
      { id: 'new-note', title: 'Recent', content: '', savedContent: '', tags: [], createdAt: 0, updatedAt: 2 },
    ]
    const pruned = pruneVersions(history, [
      ...notes,
    ], fullSize - 180)
    expect(pruned.byNote['old-note']?.length).toBeLessThan(12)
    expect(pruned.byNote['new-note']).toHaveLength(12)
    expect(pruned.byNote['old-note']?.slice(0, 10).map(({ id }) => id)).toEqual(oldVersions.slice(0, 10).map(({ id }) => id))
  })

  it('falls back safely for corrupt JSON and reports storage failures', () => {
    storage.setItem(historyStorageKey, '{broken')
    expect(loadHistory()).toEqual({ version: 1, byNote: {} })
    vi.stubGlobal('localStorage', {
      getItem: storage.getItem.bind(storage),
      setItem: () => { throw new DOMException('Quota exceeded', 'QuotaExceededError') },
      removeItem: storage.removeItem.bind(storage),
      clear: storage.clear.bind(storage),
      key: storage.key.bind(storage),
      get length() { return storage.length },
    } satisfies Storage)
    expect(saveHistory({ version: 1, byNote: {} })).toBe(false)
    expect(addVersion(source, 'save')).toBeNull()
  })

  it('gets, deletes, and clears note history', () => {
    addVersion(source, 'save', undefined, () => 1, () => 'first')
    addVersion({ ...source, content: 'next' }, 'manual', 'Before refactor', () => 2, () => 'second')
    expect(getVersion(source.id, 'second')?.label).toBe('Before refactor')
    expect(deleteVersion(source.id, 'first')).toBe(true)
    expect(listVersions(source.id).map(({ id }) => id)).toEqual(['second'])
    expect(clearHistory(source.id)).toBe(true)
    expect(listVersions(source.id)).toEqual([])
  })

  it('remaps imported history IDs and avoids repeated content snapshots', () => {
    const imported = {
      version: 1 as const,
      byNote: { source: [{ ...version('backup-version', 5), noteId: 'source' }] },
    }
    expect(mergeImportedHistory(imported, { source: 'mapped' }, [
      { id: 'mapped', title: 'Notebook', content: '', savedContent: '', tags: [], createdAt: 1, updatedAt: 2 },
    ])).toBe(true)
    expect(listVersions('mapped')).toMatchObject([{ noteId: 'mapped', content: 'content-backup-version' }])
    mergeImportedHistory(imported, { source: 'mapped' }, [])
    expect(listVersions('mapped')).toHaveLength(1)
  })
})
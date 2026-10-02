import { describe, expect, it } from 'vitest'
import type { Note, NotesState } from '../types/editor'
import { createJsonBackup, createZipBackup, parseBackupFile, parseJsonBackup, parseZipBackup } from './backupService'

function note(id: string, title: string, content: string, tags: string[] = []): Note {
  return { id, title, content, savedContent: content, tags, createdAt: 10, updatedAt: 20 }
}

describe('backup service', () => {
  it('round-trips ZIP notes, titles, IDs, metadata, and Unicode content', async () => {
    const notes = [note('one', 'Résumé', '# Bonjour\n\n$λ$', ['café'])]
    const bytes = await createZipBackup(notes, 100)
    const restored = await parseZipBackup(bytes)
    expect(restored.notes).toEqual(notes)
    expect(restored.activeId).toBe('one')
  })

  it('round-trips a JSON backup including optional version history', () => {
    const notes = [note('one', 'One', 'body')]
    const state: NotesState = { notes, activeId: 'one' }
    const history = { version: 1 as const, byNote: { one: [{ id: 'v1', noteId: 'one', title: 'One', content: 'old', createdAt: 1, reason: 'save' as const }] } }
    const backup = createJsonBackup(state, history, 200)
    const restored = parseJsonBackup(JSON.stringify(backup))
    expect(restored.notes).toEqual(notes)
    expect(restored.history).toEqual(history)
  })

  it('rejects invalid UTF-8 and archives with unsafe paths', async () => {
    await expect(parseBackupFile(new File([Uint8Array.of(0xff)], 'bad.json'))).rejects.toThrow('valid UTF-8')
    const { zipSync, strToU8 } = await import('fflate')
    const unsafe = zipSync({ 'manifest.json': strToU8(JSON.stringify({ format: 'markitdown-backup', version: 1, noteCount: 0 })), '../escape.md': strToU8('bad') })
    await expect(parseZipBackup(unsafe)).rejects.toThrow('unsafe file path')
  })
})
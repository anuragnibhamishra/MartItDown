import { describe, expect, it } from 'vitest'
import type { Note } from '../types/editor'
import { analyzeImportConflicts, createUniqueBackupFilenames, mergeImportedNotes, safeBackupFilename, validateImportedNotes } from './backup'

function note(id: string, title: string, content = title): Note {
  return { id, title, content, savedContent: content, tags: [], createdAt: 1, updatedAt: 2 }
}

describe('backup utilities', () => {
  it('sanitizes unsafe names and deduplicates filenames case-insensitively', () => {
    const notes = [note('one', 'report.md'), note('two', 'REPORT'), note('three', '../bad:name?')]
    const files = createUniqueBackupFilenames(notes)
    expect([...files.values()]).toEqual(['report.md', 'REPORT-2.md', '..-bad-name-.md'])
    expect(safeBackupFilename('...')).toBe('untitled')
  })

  it('summarizes id and normalized-title conflicts', () => {
    const summary = analyzeImportConflicts([note('same-id', 'Existing'), note('other', 'Title Match')], [
      note('same-id', 'Changed name'),
      note('new-id', ' title   match '),
      note('fresh', 'Fresh'),
    ])
    expect(summary.newCount).toBe(1)
    expect(summary.conflicts.map(({ reason }) => reason)).toEqual(['id', 'title'])
  })

  it('supports skip, duplicate, and replace without mutating the source library', () => {
    const existing = [note('original', 'Shared', 'before')]
    const incoming = [note('imported', 'Shared', 'after'), note('new', 'New note')]
    const skipped = mergeImportedNotes(existing, incoming, 'skip', () => 'generated')
    expect(skipped).toMatchObject({ added: 1, skipped: 1, replaced: 0 })
    const duplicated = mergeImportedNotes(existing, incoming, 'duplicate', () => 'generated')
    expect(duplicated.notes.map(({ title }) => title)).toEqual(['Shared', 'Shared copy', 'New note'])
    expect(duplicated.idMap.imported).toBe('generated')
    const replaced = mergeImportedNotes(existing, incoming, 'replace', () => 'generated')
    expect(replaced.notes.find(({ id }) => id === 'original')?.content).toBe('after')
    expect(existing[0].content).toBe('before')
  })

  it('validates JSON note records and fills a missing saved-content field', () => {
    expect(validateImportedNotes([{ ...note('one', 'One'), savedContent: undefined }])?.[0].savedContent).toBe('One')
    expect(validateImportedNotes([{ id: 'broken' }])).toBeNull()
  })
})
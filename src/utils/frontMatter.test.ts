import { describe, expect, it } from 'vitest'
import { parseFrontMatter, serializeFrontMatter } from './frontMatter'

describe('backup front matter', () => {
  it('round-trips Unicode metadata, quoted characters, tags, and Markdown body', () => {
    const note = { id: 'note-1', title: 'Résumé: #1', tags: ['project/alpha', 'café'], createdAt: 12, updatedAt: 34, content: '# Heading\n\n$math$' }
    const serialized = serializeFrontMatter(note)
    expect(serialized.startsWith('---\n')).toBe(true)
    expect(parseFrontMatter(serialized, 'fallback')).toEqual({
      metadata: { id: note.id, title: note.title, tags: note.tags, createdAt: 12, updatedAt: 34 },
      content: note.content,
    })
  })

  it('treats documents without a valid front matter block as plain Markdown', () => {
    expect(parseFrontMatter('# Title', 'file.md').content).toBe('# Title')
    expect(parseFrontMatter('---\ntitle: broken', 'file.md').content).toContain('title: broken')
  })
})
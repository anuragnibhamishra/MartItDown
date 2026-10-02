import { describe, expect, it } from 'vitest'
import type { Note } from '../types/editor'
import { createSearchIndex } from './searchIndex'

function note(id: string, title: string, content: string, tags: string[] = [], updatedAt = Date.now()): Note {
  return { id, title, content, savedContent: content, tags, createdAt: updatedAt, updatedAt }
}

describe('search index', () => {
  it('tokenizes Unicode words, ignores one-character tokens, and supports prefixes', () => {
    const index = createSearchIndex([note('one', 'Café Markdown', 'A markitdown guide')])
    expect(index.search('mark')).toHaveLength(1)
    expect(index.search('café')).toHaveLength(1)
    expect(index.search('a')).toEqual([])
  })

  it('ranks title matches above tags and body matches', () => {
    const index = createSearchIndex([
      note('body', 'Notes', 'The observability handbook.'),
      note('tag', 'Notes', 'Nothing here.', ['observability']),
      note('title', 'Observability notes', 'Nothing here.'),
    ])
    expect(index.search('observability').map((result) => result.noteId)).toEqual(['title', 'tag', 'body'])
  })

  it('requires phrases and all positive terms while applying tag and exclusion filters', () => {
    const index = createSearchIndex([
      note('match', 'Project Alpha', 'Ship the first release.', ['project/alpha']),
      note('other-order', 'Project', 'Alpha is still in planning.', ['project/beta']),
      note('excluded', 'Project Alpha', 'Ship the blocked release.', ['project/alpha']),
    ])
    expect(index.search('"project alpha"').map((result) => result.noteId)).toEqual(['match', 'excluded'])
    expect(index.search('project alpha tag:project/alpha -blocked').map((result) => result.noteId)).toEqual(['match'])
    expect(index.search('project release').map((result) => result.noteId)).toEqual(['match', 'excluded'])
    expect(index.search('project missing')).toEqual([])
  })

  it('strips Markdown while retaining code, link text, and image alt text', () => {
    const index = createSearchIndex([note(
      'markdown',
      'Guide',
      '# Heading\n**bold** [link words](https://example.com) ![diagram alt](image.png)\n```ts\nconst visibleCode = true\n```',
    )])
    expect(index.search('heading')).toHaveLength(1)
    expect(index.search('bold')).toHaveLength(1)
    expect(index.search('link words')).toHaveLength(1)
    expect(index.search('diagram alt')).toHaveLength(1)
    expect(index.search('visiblecode')).toHaveLength(1)
    expect(index.search('https')).toEqual([])
    expect(index.search('const visiblecode')[0]?.snippet).toContain('const visibleCode')
  })

  it('returns compact snippets and body ranges relative to the snippet', () => {
    const prefix = 'Opening context '.repeat(12)
    const index = createSearchIndex([note('body', 'Long note', `${prefix}findableterm ${'surrounding words '.repeat(12)}`)])
    const result = index.search('findable')[0]
    const bodyMatch = result.matches.find((match) => match.field === 'body')
    expect(result.snippet).toHaveLength(120)
    expect(result.snippet).toContain('findableterm')
    expect(bodyMatch?.ranges).toEqual([{
      start: result.snippet.indexOf('findableterm'),
      end: result.snippet.indexOf('findableterm') + 'findableterm'.length,
    }])
  })

  it('handles empty and whitespace queries with recent notes', () => {
    const index = createSearchIndex([note('older', 'Older', '', [], 1), note('newer', 'Newer', '', [], 2)])
    expect(index.search('').map((result) => result.noteId)).toEqual(['newer', 'older'])
    expect(index.search('   ')).toHaveLength(2)
  })

  it('updates and removes one note incrementally', () => {
    const index = createSearchIndex([note('one', 'First', 'oldterm'), note('two', 'Second', 'stable')])
    index.upsert(note('one', 'Renamed', 'newterm'))
    expect(index.search('oldterm')).toEqual([])
    expect(index.search('newterm').map((result) => result.noteId)).toEqual(['one'])
    index.remove('one')
    expect(index.search('newterm')).toEqual([])
    expect(index.search('stable').map((result) => result.noteId)).toEqual(['two'])
  })

  it('searches a 2,000-note library quickly after indexing', () => {
    const body = `${'common words and markdown editor content '.repeat(40)}needleword finish`
    const notes = Array.from({ length: 2000 }, (_, index) => note(`note-${index}`, `Document ${index}`, body))
    const index = createSearchIndex(notes)
    const startedAt = performance.now()
    const results = index.search('needleword finish', { limit: 20 })
    const elapsed = performance.now() - startedAt
    expect(results).toHaveLength(20)
    expect(elapsed).toBeLessThan(200)
  })
})
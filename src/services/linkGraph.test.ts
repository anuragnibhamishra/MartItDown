import { describe, expect, it } from 'vitest'
import type { Note } from '../types/editor'
import { createLinkGraph } from './linkGraph'

function note(id: string, title: string, content: string, updatedAt = 1): Note {
  return { id, title, content, savedContent: content, tags: [], createdAt: 1, updatedAt }
}

describe('link graph', () => {
  it('indexes outgoing links and backlinks and updates one source incrementally', () => {
    const target = note('target', 'Target', '')
    const source = note('source', 'Source', '[[Target]] then [[Target|again]]')
    const graph = createLinkGraph([target, source])
    expect(graph.backlinks('target').map(({ id }) => id)).toEqual(['source'])
    expect(graph.outgoing('source')).toEqual([{ noteId: 'target', title: 'Target', count: 2 }])
    expect(graph.outgoingCount('source')).toBe(2)

    graph.upsert(note('source', 'Source', 'No links now'))
    expect(graph.backlinks('target')).toEqual([])
    expect(graph.outgoing('source')).toEqual([])
  })

  it('refreshes title resolution when a target title changes or the note is removed', () => {
    const graph = createLinkGraph([note('old', 'Old Title', ''), note('source', 'Source', '[[Old Title]]')])
    expect(graph.backlinks('old')).toHaveLength(1)
    graph.upsert(note('old', 'New Title', '', 5))
    expect(graph.backlinks('old')).toEqual([])
    expect(graph.outgoing('source')).toEqual([])

    graph.upsert(note('new', 'Old Title', '', 6))
    expect(graph.backlinks('new').map(({ id }) => id)).toEqual(['source'])
    graph.remove('new')
    expect(graph.backlinks('new')).toEqual([])
  })

  it('resolves duplicate titles by recency and keeps the winner current', () => {
    const graph = createLinkGraph([
      note('older', 'Shared', '', 1),
      note('newer', 'Shared', '', 2),
      note('source', 'Source', '[[Shared]]'),
    ])
    expect(graph.backlinks('newer').map(({ id }) => id)).toEqual(['source'])
    graph.upsert(note('older', 'Shared', '', 3))
    expect(graph.backlinks('newer')).toEqual([])
    expect(graph.backlinks('older').map(({ id }) => id)).toEqual(['source'])
  })

  it('finds unlinked mentions but excludes wiki links and code blocks', () => {
    const target = note('target', 'Target', '')
    const source = note('source', 'Source', 'Target text, [[Target]], `Target`\n```\nTarget\n```')
    const graph = createLinkGraph([target, source])
    expect(graph.unlinkedMentions('target')).toMatchObject([{ noteId: 'source', count: 1, firstMention: { text: 'Target' } }])
  })
})
import { describe, expect, it } from 'vitest'
import type { Note } from '../types/editor'
import { buildTagCounts, extractInlineTags, filterNotesByTags, getAllTags, normalizeTag } from './tags'

function note(id: string, content: string, tags: string[] = []): Note {
  return { id, title: id, content, savedContent: content, tags, createdAt: 1, updatedAt: 1 }
}

describe('tag utilities', () => {
  it('extracts normalized nested and unicode inline tags', () => {
    expect(extractInlineTags('Try #Project/Alpha, #CAFÉ and #hello-world_2; #123 is plain.'))
      .toEqual(['café', 'hello-world_2', 'project/alpha'])
  })

  it('ignores tags in fences, inline code, URLs, headings, and entities', () => {
    const markdown = [
      '# Heading with #heading-tag',
      'Visible #real-tag and `#inline-code`.',
      '```ts',
      'const tag = "#fenced"',
      '```',
      'See https://example.com/path#anchor and www.example.com/#fragment.',
      'Entity: &#35;entity and &num;named.',
    ].join('\n')
    expect(extractInlineTags(markdown)).toEqual(['real-tag'])
  })

  it('normalizes manual tags and combines them with inline tags', () => {
    expect(normalizeTag('  ## Project Alpha  ')).toBe('project-alpha')
    expect(getAllTags(note('one', 'Content #inline', [' Manual ', 'manual', 'Nested/Child'])))
      .toEqual(['inline', 'manual', 'nested/child'])
  })

  it('counts notes once per tag and sorts by count then name', () => {
    const counts = buildTagCounts([
      note('one', '#shared', ['extra']),
      note('two', '#shared #alpha'),
      note('three', '', ['alpha']),
    ])
    expect(counts).toEqual([
      { tag: 'alpha', count: 2 },
      { tag: 'shared', count: 2 },
      { tag: 'extra', count: 1 },
    ])
  })

  it('supports nested filters and combines selected tags with AND logic', () => {
    const notes = [
      note('one', '', ['project/alpha', 'urgent']),
      note('two', '', ['project/beta']),
      note('three', '', ['urgent']),
    ]
    expect(filterNotesByTags(notes, ['project']).map((item) => item.id)).toEqual(['one', 'two'])
    expect(filterNotesByTags(notes, ['project', 'urgent']).map((item) => item.id)).toEqual(['one'])
    expect(buildTagCounts(notes).find(({ tag }) => tag === 'project')).toEqual({ tag: 'project', count: 2 })
  })
})
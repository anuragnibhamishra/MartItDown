import { describe, expect, it } from 'vitest'
import type { Note } from '../types/editor'
import { remarkWikiLinks } from './remarkWikiLinks'

interface TestNode {
  type: string
  value?: string
  url?: string
  data?: { hProperties?: Record<string, unknown> }
  children?: TestNode[]
}

function note(id: string, title: string, updatedAt: number): Note {
  return { id, title, content: '', savedContent: '', tags: [], createdAt: 1, updatedAt }
}

describe('remark wiki-link plugin', () => {
  it('turns prose links into resolved and missing annotated link nodes', () => {
    const tree: TestNode = {
      type: 'root',
      children: [{
        type: 'paragraph',
        children: [
          { type: 'text', value: 'Open [[Target|display]] or [[Missing#Section]].' },
          { type: 'inlineCode', value: '[[Target]]' },
          { type: 'link', url: '/existing', children: [{ type: 'text', value: '[[Missing]]' }] },
        ],
      }],
    }
    const transform = remarkWikiLinks([note('old', 'Target', 1), note('new', 'target', 2)])()
    transform(tree)
    const children = tree.children?.[0].children ?? []
    const wikiNodes = children.filter((node) => node.type === 'link')
    expect(wikiNodes).toHaveLength(3)
    expect(children.filter((node) => node.type === 'text').map((node) => node.value).join('')).toBe('Open  or .')
    expect(wikiNodes[0]).toMatchObject({
      url: '?note=new',
      data: { hProperties: { 'data-note-id': 'new', title: expect.stringContaining('Multiple notes') } },
      children: [{ value: 'display' }],
    })
    expect(wikiNodes[1]).toMatchObject({ url: '?create=Missing', data: { hProperties: { 'data-missing-title': 'Missing', 'data-heading-slug': 'section' } } })
    expect(wikiNodes[2].url).toBe('/existing')
    expect(children.find((node) => node.type === 'inlineCode')?.value).toBe('[[Target]]')
  })
})
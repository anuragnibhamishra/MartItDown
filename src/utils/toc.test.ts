import { describe, expect, it } from 'vitest'
import { extractHeadings, slugifyHeading } from './toc'
import { rehypeHeadingSlugs } from '../plugins/rehypeHeadingSlugs'

describe('table of contents utilities', () => {
  it('extracts ATX and setext headings while ignoring fenced code', () => {
    expect(extractHeadings([
      '# First title',
      '## Second',
      '```md',
      '# hidden',
      '```',
      'Setext title',
      '===',
    ].join('\n'))).toEqual([
      { level: 1, text: 'First title', slug: 'first-title', line: 1 },
      { level: 2, text: 'Second', slug: 'second', line: 2 },
      { level: 1, text: 'Setext title', slug: 'setext-title', line: 6 },
    ])
  })

  it('creates renderer-compatible duplicate and Unicode slugs', () => {
    const headings = extractHeadings('# Café & tea\n# Café & tea\n### 日本語')
    expect(headings.map(({ slug }) => slug)).toEqual(['café-tea', 'café-tea-1', '日本語'])

    const tree: { type: string; children: Array<{ type: string; tagName: string; children: Array<{ type: string; value: string }>; properties?: Record<string, unknown> }> } = {
      type: 'root',
      children: [
        { type: 'element', tagName: 'h1', children: [{ type: 'text', value: 'Café & tea' }] },
        { type: 'element', tagName: 'h1', children: [{ type: 'text', value: 'Café & tea' }] },
        { type: 'element', tagName: 'h3', children: [{ type: 'text', value: '日本語' }] },
      ],
    }
    const transform = rehypeHeadingSlugs()
    transform(tree)
    expect(tree.children.map((heading) => heading.properties?.id)).toEqual(headings.map(({ slug }) => slug))
    expect(slugifyHeading('Quick Start')).toBe('quick-start')
  })
})
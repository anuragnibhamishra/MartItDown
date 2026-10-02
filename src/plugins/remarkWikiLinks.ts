import type { Note } from '../types/editor'
import { parseWikiLinks, resolveLink } from '../utils/wikiLinks'
import { slugifyHeading } from '../utils/toc'

interface RemarkNode {
  type: string
  value?: string
  url?: string
  children?: RemarkNode[]
  data?: { hProperties?: Record<string, unknown> }
}

function createLinkNode(reference: string, displayText: string, notes: readonly Note[]): RemarkNode {
  const parsedLink = parseWikiLinks(`[[${reference}]]`)[0]
  if (!parsedLink) return { type: 'text', value: `[[${reference}]]` }
  const resolution = resolveLink(parsedLink, notes)
  const title = parsedLink.title
  const heading = parsedLink.heading ?? ''
  const slug = heading ? slugifyHeading(heading) : ''
  const href = resolution.note
    ? `?note=${encodeURIComponent(resolution.note.id)}${slug ? `#${encodeURIComponent(slug)}` : ''}`
    : `?create=${encodeURIComponent(title)}`
  const hProperties: Record<string, unknown> = resolution.note
    ? { 'data-note-id': resolution.note.id }
    : { 'data-missing-title': title }
  if (heading) hProperties['data-heading-slug'] = slug
  if (resolution.ambiguous) hProperties.title = `Multiple notes share this title. Opening the most recently updated: ${resolution.note?.title ?? title}`
  return { type: 'link', url: href, data: { hProperties }, children: [{ type: 'text', value: displayText }] }
}

export function remarkWikiLinks(notes: readonly Note[]) {
  return () => (tree: RemarkNode) => {
    const visit = (node: RemarkNode) => {
      if (!node.children || node.type === 'link') return
      const transformed: RemarkNode[] = []
      for (const child of node.children) {
        if (child.type !== 'text' || !child.value) {
          visit(child)
          transformed.push(child)
          continue
        }
        const value = child.value
        let cursor = 0
        for (const link of parseWikiLinks(value)) {
          const start = link.start
          if (start > cursor) transformed.push({ type: 'text', value: value.slice(cursor, start) })
          const reference = value.slice(start + 2, link.end - 2).trim()
          transformed.push(createLinkNode(reference, link.alias ?? link.title, notes))
          cursor = link.end
        }
        if (cursor < value.length) transformed.push({ type: 'text', value: value.slice(cursor) })
      }
      node.children = transformed
    }
    visit(tree)
  }
}
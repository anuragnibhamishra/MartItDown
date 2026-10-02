import { slugifyHeading } from '../utils/toc'

interface HastNode {
  type: string
  tagName?: string
  value?: string
  properties?: Record<string, unknown>
  children?: HastNode[]
}

function textContent(node: HastNode): string {
  if (node.type === 'text') return node.value ?? ''
  return node.children?.map(textContent).join('') ?? ''
}

export function rehypeHeadingSlugs() {
  return (tree: HastNode) => {
    const counts = new Map<string, number>()
    const visit = (node: HastNode) => {
      if (node.type === 'element' && /^h[1-6]$/.test(node.tagName ?? '')) {
        const base = slugifyHeading(textContent(node)) || 'section'
        const count = counts.get(base) ?? 0
        counts.set(base, count + 1)
        node.properties = { ...node.properties, id: count ? `${base}-${count}` : base }
      }
      node.children?.forEach(visit)
    }
    visit(tree)
  }
}
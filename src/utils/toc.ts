export interface Heading {
  level: number
  text: string
  slug: string
  line: number
}

export function headingText(markdownText: string): string {
  return markdownText
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]*>/g, '')
    .replace(/(`+)(.*?)\1/g, '$2')
    .replace(/(?:\*\*|__|~~|\*|_)/g, '')
    .replace(/\\([\\`*_{}[\]()#+.!>-])/g, '$1')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .trim()
}

export function slugifyHeading(text: string): string {
  return headingText(text).toLowerCase()
    .replace(/[^\p{L}\p{N}_\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

export function extractHeadings(markdown: string): Heading[] {
  const headings: Heading[] = []
  const slugCounts = new Map<string, number>()
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n')
  let fence: { marker: '`' | '~'; length: number } | null = null

  const addHeading = (level: number, rawText: string, line: number) => {
    const text = headingText(rawText)
    if (!text) return
    const baseSlug = slugifyHeading(text) || 'section'
    const count = slugCounts.get(baseSlug) ?? 0
    slugCounts.set(baseSlug, count + 1)
    headings.push({ level, text, slug: count ? `${baseSlug}-${count}` : baseSlug, line })
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const fenceMatch = line.match(/^\s{0,3}(`{3,}|~{3,})/)
    if (fence) {
      if (fenceMatch && fenceMatch[1][0] === fence.marker && fenceMatch[1].length >= fence.length) fence = null
      continue
    }
    if (fenceMatch) {
      fence = { marker: fenceMatch[1][0] as '`' | '~', length: fenceMatch[1].length }
      continue
    }

    const atx = line.match(/^\s{0,3}(#{1,6})(?:\s+|$)(.*?)(?:\s+#+\s*)?$/)
    if (atx) {
      addHeading(atx[1].length, atx[2], index + 1)
      continue
    }
    const underline = lines[index + 1]?.match(/^\s{0,3}(=+|-+)\s*$/)
    if (underline && line.trim()) {
      addHeading(underline[1][0] === '=' ? 1 : 2, line.trim(), index + 1)
      index += 1
    }
  }
  return headings
}
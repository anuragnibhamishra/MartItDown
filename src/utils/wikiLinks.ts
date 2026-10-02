import type { Note } from '../types/editor'

export interface WikiLink {
  start: number
  end: number
  raw: string
  reference: string
  title: string
  heading?: string
  alias?: string
}

export interface WikiLinkResolution {
  note: Note | null
  candidates: Note[]
  ambiguous: boolean
}

export interface RenameRewrite {
  noteId: string
  title: string
  originalContent: string
  content: string
}

export interface RenameRewritePlan {
  oldTitle: string
  newTitle: string
  changes: RenameRewrite[]
}

export interface TextMention {
  start: number
  end: number
  text: string
}

interface SourceRange {
  start: number
  end: number
}

function excludedCodeRanges(markdown: string): SourceRange[] {
  const ranges: SourceRange[] = []
  const lines = markdown.split('\n')
  let offset = 0
  let fence: { marker: '`' | '~'; length: number; start: number } | null = null

  for (const line of lines) {
    const fenceMatch = line.match(/^\s{0,3}(`{3,}|~{3,})/)
    if (fence) {
      if (fenceMatch && fenceMatch[1][0] === fence.marker && fenceMatch[1].length >= fence.length) {
        ranges.push({ start: fence.start, end: offset + line.length })
        fence = null
      }
      offset += line.length + 1
      continue
    }
    if (fenceMatch) {
      fence = { marker: fenceMatch[1][0] as '`' | '~', length: fenceMatch[1].length, start: offset }
      offset += line.length + 1
      continue
    }

    let cursor = 0
    while (cursor < line.length) {
      if (line[cursor] !== '`' || isEscaped(line, cursor)) { cursor += 1; continue }
      let markerEnd = cursor + 1
      while (line[markerEnd] === '`') markerEnd += 1
      const marker = line.slice(cursor, markerEnd)
      const closeIndex = findUnescaped(line, marker, markerEnd)
      if (closeIndex < 0) { cursor = markerEnd; continue }
      ranges.push({ start: offset + cursor, end: offset + closeIndex + marker.length })
      cursor = closeIndex + marker.length
    }
    offset += line.length + 1
  }
  if (fence) ranges.push({ start: fence.start, end: markdown.length })
  return ranges
}

function isEscaped(value: string, index: number): boolean {
  let backslashes = 0
  for (let cursor = index - 1; cursor >= 0 && value[cursor] === '\\'; cursor -= 1) backslashes += 1
  return backslashes % 2 === 1
}

function findUnescaped(value: string, needle: string, start: number): number {
  let index = value.indexOf(needle, start)
  while (index >= 0 && isEscaped(value, index)) index = value.indexOf(needle, index + needle.length)
  return index
}

function overlaps(ranges: readonly SourceRange[], start: number, end: number): boolean {
  return ranges.some((range) => start < range.end && end > range.start)
}

function parseReference(reference: string): Pick<WikiLink, 'reference' | 'title' | 'heading' | 'alias'> {
  const pipeIndex = findUnescapedDelimiter(reference, '|')
  const rawTarget = (pipeIndex < 0 ? reference : reference.slice(0, pipeIndex)).trim()
  const alias = pipeIndex < 0 ? undefined : unescapeLinkPart(reference.slice(pipeIndex + 1).trim())
  const hashIndex = findUnescapedDelimiter(rawTarget, '#')
  const title = unescapeLinkPart((hashIndex < 0 ? rawTarget : rawTarget.slice(0, hashIndex)).trim())
  const heading = hashIndex < 0 ? undefined : unescapeLinkPart(rawTarget.slice(hashIndex + 1).trim())
  return { reference, title, ...(heading ? { heading } : {}), ...(alias ? { alias } : {}) }
}

function findUnescapedDelimiter(value: string, delimiter: string): number {
  let index = value.indexOf(delimiter)
  while (index >= 0 && isEscaped(value, index)) index = value.indexOf(delimiter, index + 1)
  return index
}

function unescapeLinkPart(value: string): string {
  return value.replace(/\\([\\|#])/g, '$1')
}

export function escapeWikiLinkTitle(title: string): string {
  return title.replace(/[\\|#]/g, '\\$&')
}

export function parseWikiLinks(markdown: string): WikiLink[] {
  const ignoredRanges = excludedCodeRanges(markdown)
  const links: WikiLink[] = []
  const matcher = /\[\[([^\]\r\n]+)\]\]/g
  for (const match of markdown.matchAll(matcher)) {
    const start = match.index ?? 0
    const end = start + match[0].length
    if (overlaps(ignoredRanges, start, end) || isEscaped(markdown, start)) continue
    const parsed = parseReference(match[1])
    if (!parsed.title) continue
    links.push({ start, end, raw: match[0], ...parsed })
  }
  return links
}

export function normalizeLinkTitle(title: string): string {
  return title.trim().replace(/\s+/gu, ' ').toLocaleLowerCase()
}

export function resolveLink(link: WikiLink | string, notes: readonly Note[]): WikiLinkResolution {
  const parsed = typeof link === 'string' ? parseReference(link.replace(/^\[\[|\]\]$/g, '').trim()) : link
  const normalizedTitle = normalizeLinkTitle(parsed.title)
  const candidates = notes.filter((note) => normalizeLinkTitle(note.title) === normalizedTitle)
    .sort((left, right) => right.updatedAt - left.updatedAt)
  return { note: candidates[0] ?? null, candidates, ambiguous: candidates.length > 1 }
}

export function extractLinkTargets(note: Pick<Note, 'content'>): WikiLink[] {
  return parseWikiLinks(note.content)
}

export function rewriteWikiLinks(markdown: string, oldTitle: string, newTitle: string): string {
  const normalizedOldTitle = normalizeLinkTitle(oldTitle)
  const links = parseWikiLinks(markdown).filter((link) => normalizeLinkTitle(link.title) === normalizedOldTitle)
  let rewritten = markdown
  for (const link of links.reverse()) {
    const target = `${escapeWikiLinkTitle(newTitle.trim())}${link.heading ? `#${link.heading}` : ''}`
    const reference = `${target}${link.alias ? `|${link.alias.replace(/[\\|]/g, '\\$&')}` : ''}`
    rewritten = `${rewritten.slice(0, link.start)}[[${reference}]]${rewritten.slice(link.end)}`
  }
  return rewritten
}

export function createRenameRewritePlan(notes: readonly Note[], noteId: string, newTitle: string): RenameRewritePlan | null {
  const renamedNote = notes.find((note) => note.id === noteId)
  const normalizedNewTitle = newTitle.trim()
  if (!renamedNote || !normalizedNewTitle) return null
  const changes = notes.flatMap((note) => {
    if (note.id === noteId) return []
    const content = rewriteWikiLinks(note.content, renamedNote.title, normalizedNewTitle)
    return content === note.content ? [] : [{ noteId: note.id, title: note.title, originalContent: note.content, content }]
  })
  return { oldTitle: renamedNote.title, newTitle: normalizedNewTitle, changes }
}

export function findUnlinkedMentions(markdown: string, targetTitle: string): TextMention[] {
  const title = targetTitle.trim()
  if (!title) return []
  const markdownLinkRanges = [...markdown.matchAll(/!?\[[^\]]+\]\([^)]*\)/g)].map((match) => {
    const start = match.index ?? 0
    return { start, end: start + match[0].length }
  })
  const ignored = [...excludedCodeRanges(markdown), ...parseWikiLinks(markdown).map(({ start, end }) => ({ start, end })), ...markdownLinkRanges]
  const mentions: TextMention[] = []
  let cursor = 0
  while (cursor <= markdown.length - title.length) {
    const index = markdown.toLocaleLowerCase().indexOf(title.toLocaleLowerCase(), cursor)
    if (index < 0) break
    const end = index + title.length
    const before = index > 0 ? markdown[index - 1] : ''
    const after = end < markdown.length ? markdown[end] : ''
    const boundaryBefore = !before || !/[\p{L}\p{N}]/u.test(before)
    const boundaryAfter = !after || !/[\p{L}\p{N}]/u.test(after)
    if (boundaryBefore && boundaryAfter && !overlaps(ignored, index, end)) mentions.push({ start: index, end, text: markdown.slice(index, end) })
    cursor = end
  }
  return mentions
}

export function linkFirstMention(markdown: string, title: string): string | null {
  const mention = findUnlinkedMentions(markdown, title)[0]
  if (!mention) return null
  return `${markdown.slice(0, mention.start)}[[${escapeWikiLinkTitle(title.trim())}]]${markdown.slice(mention.end)}`
}

export function applyRenameRewritePlan(notes: readonly Note[], plan: RenameRewritePlan, clock: () => number = Date.now): Note[] | null {
  const changes = new Map(plan.changes.map((change) => [change.noteId, change]))
  if (changes.size !== plan.changes.length) return null
  for (const change of plan.changes) {
    const current = notes.find((note) => note.id === change.noteId)
    if (!current || current.content !== change.originalContent) return null
  }
  const updatedAt = clock()
  return notes.map((note) => {
    const change = changes.get(note.id)
    return change ? { ...note, content: change.content, updatedAt } : note
  })
}
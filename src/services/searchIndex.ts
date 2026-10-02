import type { Note } from '../types/editor'
import { getAllTags, tagMatchesFilter } from '../utils/tags'

export type SearchField = 'title' | 'tag' | 'body'

export interface SearchRange {
  start: number
  end: number
}

export interface SearchMatch {
  field: SearchField
  ranges: SearchRange[]
}

export interface SearchResult {
  noteId: string
  score: number
  matches: SearchMatch[]
  snippet: string
}

export interface SearchOptions {
  limit?: number
}

interface TokenOccurrence extends SearchRange {
  token: string
}

interface IndexedField {
  text: string
  tokens: TokenOccurrence[]
}

interface IndexedDocument {
  note: Note
  title: IndexedField
  tag: IndexedField
  body: IndexedField
  tags: string[]
}

interface QueryParts {
  terms: string[]
  phrases: string[][]
  excluded: string[]
  tagFilters: string[]
}

type FieldPostings = Partial<Record<SearchField, TokenOccurrence[]>>

const fieldWeights: Record<SearchField, number> = { title: 5, tag: 3, body: 1 }

function tokenize(text: string): TokenOccurrence[] {
  const tokens: TokenOccurrence[] = []
  const matcher = /[\p{L}\p{N}]+/gu
  for (const match of text.matchAll(matcher)) {
    const token = match[0].toLowerCase()
    if (Array.from(token).length > 1) {
      const start = match.index ?? 0
      tokens.push({ token, start, end: start + match[0].length })
    }
  }
  return tokens
}

function stripMarkdown(markdown: string): string {
  let inFence = false
  let fenceMarker = ''
  let fenceLength = 0
  const output: string[] = []

  for (const line of markdown.split('\n')) {
    const fence = line.match(/^\s{0,3}(`{3,}|~{3,})/)
    if (fence) {
      if (!inFence) {
        inFence = true
        fenceMarker = fence[1][0]
        fenceLength = fence[1].length
      } else if (fence[1][0] === fenceMarker && fence[1].length >= fenceLength) {
        inFence = false
      }
      continue
    }
    const plainLine = inFence
      ? line
      : line
        .replace(/^\s{0,3}(?:#{1,6}\s+|>\s?|[-*+]\s+|\d+\.\s+)/, '')
        .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
        .replace(/<[^>]*>/g, '')
        .replace(/(`+)(.*?)\1/g, '$2')
        .replace(/(?:\*\*|__|~~|\*|_)/g, '')
    output.push(plainLine)
  }

  return output.join('\n')
}

function indexField(text: string): IndexedField {
  return { text, tokens: tokenize(text) }
}

function createDocument(note: Note): IndexedDocument {
  const tags = getAllTags(note)
  return {
    note,
    title: indexField(note.title),
    tag: indexField(tags.join(' ')),
    body: indexField(stripMarkdown(note.content)),
    tags,
  }
}

function parseQuery(query: string): QueryParts {
  const parts: QueryParts = { terms: [], phrases: [], excluded: [], tagFilters: [] }
  const matcher = /"([^"]+)"|(\S+)/g
  for (const match of query.matchAll(matcher)) {
    if (match[1] !== undefined) {
      const phrase = tokenize(match[1]).map(({ token }) => token)
      if (phrase.length) {
        parts.phrases.push(phrase)
        parts.terms.push(...phrase)
      }
      continue
    }
    const value = match[2]
    if (!value) continue
    if (/^tag:/i.test(value)) {
      const tag = value.slice(4).replace(/^#+/, '').toLowerCase()
      if (tag) parts.tagFilters.push(tag)
    } else if (value.startsWith('-') && value.length > 1) {
      parts.excluded.push(...tokenize(value.slice(1)).map(({ token }) => token))
    } else {
      parts.terms.push(...tokenize(value).map(({ token }) => token))
    }
  }
  parts.terms = [...new Set(parts.terms)]
  parts.excluded = [...new Set(parts.excluded)]
  return parts
}

function matchingTokens(index: Map<string, Map<string, FieldPostings>>, term: string): Map<string, FieldPostings> {
  const matches = new Map<string, FieldPostings>()
  for (const [token, documents] of index) {
    if (!token.startsWith(term)) continue
    for (const [id, postings] of documents) {
      let entry = matches.get(id)
      if (!entry) {
        entry = {}
        matches.set(id, entry)
      }
      for (const field of ['title', 'tag', 'body'] as const) {
        const occurrences = postings[field]
        if (occurrences) entry[field] = [...(entry[field] ?? []), ...occurrences]
      }
    }
  }
  return matches
}

function phraseOccurs(field: IndexedField, phrase: string[]): boolean {
  const tokens = field.tokens
  return tokens.some((_, index) => phrase.every((part, offset) => tokens[index + offset]?.token === part))
}

function mergeRanges(ranges: SearchRange[]): SearchRange[] {
  const sorted = [...ranges].sort((left, right) => left.start - right.start)
  const merged: SearchRange[] = []
  for (const range of sorted) {
    const previous = merged.at(-1)
    if (previous && range.start <= previous.end) previous.end = Math.max(previous.end, range.end)
    else merged.push({ ...range })
  }
  return merged
}

function createSnippet(body: IndexedField, ranges: SearchRange[]): { text: string; ranges: SearchRange[] } {
  if (ranges.length === 0) return { text: body.text.slice(0, 120), ranges: [] }
  const firstMatch = ranges[0]
  const start = Math.max(0, Math.min(firstMatch.start - 50, body.text.length - 120))
  const end = Math.min(body.text.length, start + 120)
  return {
    text: body.text.slice(start, end),
    ranges: ranges.filter((range) => range.start < end && range.end > start)
      .map((range) => ({ start: Math.max(0, range.start - start), end: Math.min(end, range.end) - start })),
  }
}

export function createSearchIndex(notes: readonly Note[]) {
  const documents = new Map<string, IndexedDocument>()
  const documentOrder = new Map<string, number>()
  let nextOrder = 0
  const inverted = new Map<string, Map<string, FieldPostings>>()

  const remove = (id: string) => {
    const previous = documents.get(id)
    if (!previous) return
    documentOrder.delete(id)
    for (const field of ['title', 'tag', 'body'] as const) {
      for (const { token } of previous[field].tokens) {
        const postings = inverted.get(token)
        const documentPostings = postings?.get(id)
        if (documentPostings) delete documentPostings[field]
        if (documentPostings && Object.keys(documentPostings).length === 0) postings?.delete(id)
        if (postings?.size === 0) inverted.delete(token)
      }
    }
    documents.delete(id)
  }

  const upsert = (note: Note) => {
    remove(note.id)
    const document = createDocument(note)
    documents.set(note.id, document)
    documentOrder.set(note.id, nextOrder)
    nextOrder += 1
    for (const field of ['title', 'tag', 'body'] as const) {
      for (const occurrence of document[field].tokens) {
        const { token } = occurrence
        let postings = inverted.get(token)
        if (!postings) {
          postings = new Map<string, FieldPostings>()
          inverted.set(token, postings)
        }
        let documentPostings = postings.get(note.id)
        if (!documentPostings) {
          documentPostings = {}
          postings.set(note.id, documentPostings)
        }
        const fieldOccurrences = documentPostings[field] ?? []
        fieldOccurrences.push(occurrence)
        documentPostings[field] = fieldOccurrences
      }
    }
  }

  const search = (query: string, options: SearchOptions = {}): SearchResult[] => {
    const parts = parseQuery(query.trim())
    if (query.trim() && !parts.terms.length && !parts.excluded.length && !parts.tagFilters.length) return []
    let candidateIds = new Set(documents.keys())
    const termMatches = parts.terms.map((term) => matchingTokens(inverted, term))
    const excludedMatches = parts.excluded.map((term) => matchingTokens(inverted, term))

    for (const matches of termMatches) {
      candidateIds = new Set([...candidateIds].filter((id) => matches.has(id)))
      if (candidateIds.size === 0) return []
    }

    const ranked: Array<{ noteId: string; score: number }> = []
    for (const id of candidateIds) {
      const document = documents.get(id)
      if (!document) continue
      if (parts.tagFilters.some((filter) => !document.tags.some((tag) => tagMatchesFilter(tag, filter)))) continue
      const fields = [document.title, document.tag, document.body]
      if (excludedMatches.some((matches) => matches.has(id))) continue
      if (parts.phrases.some((phrase) => !fields.some((field) => phraseOccurs(field, phrase)))) continue

      let score = 0
      for (const matches of termMatches) {
        const postings = matches.get(id)
        if (!postings) continue
        for (const fieldName of ['title', 'tag', 'body'] as const) {
          const occurrences = postings[fieldName] ?? []
          const count = occurrences.length
          if (count) score += fieldWeights[fieldName] * Math.min(count, 3)
        }
      }
      if (parts.phrases.some((phrase) => phraseOccurs(document.title, phrase))) score += 12
      else if (parts.phrases.some((phrase) => phraseOccurs(document.tag, phrase))) score += 8
      else if (parts.phrases.length) score += 5
      if (parts.terms.length) score += 3
      const ageInDays = Math.max(0, (Date.now() - document.note.updatedAt) / 86_400_000)
      score += 0.5 / (1 + ageInDays / 30)
      ranked.push({ noteId: id, score })
    }

    ranked.sort((left, right) => right.score - left.score
      || (documentOrder.get(left.noteId) ?? Number.MAX_SAFE_INTEGER) - (documentOrder.get(right.noteId) ?? Number.MAX_SAFE_INTEGER))
    const selected = ranked.slice(0, options.limit ?? ranked.length)
    return selected.flatMap(({ noteId, score }) => {
      const document = documents.get(noteId)
      if (!document) return []
      const rangesByField: Record<SearchField, SearchRange[]> = { title: [], tag: [], body: [] }
      for (const matches of termMatches) {
        const postings = matches.get(noteId)
        if (!postings) continue
        for (const fieldName of ['title', 'tag', 'body'] as const) {
          for (const occurrence of postings[fieldName] ?? []) rangesByField[fieldName].push({ start: occurrence.start, end: occurrence.end })
        }
      }
      const titleRanges = mergeRanges(rangesByField.title)
      const tagRanges = mergeRanges(rangesByField.tag)
      const bodyRanges = mergeRanges(rangesByField.body)
      const snippet = createSnippet(document.body, bodyRanges)
      const matches: SearchMatch[] = []
      if (titleRanges.length) matches.push({ field: 'title', ranges: titleRanges })
      if (tagRanges.length) matches.push({ field: 'tag', ranges: tagRanges })
      if (snippet.ranges.length) matches.push({ field: 'body', ranges: snippet.ranges })
      return [{ noteId, score, matches, snippet: snippet.text }]
    })
  }

  for (const note of notes) upsert(note)
  return { upsert, remove, search }
}
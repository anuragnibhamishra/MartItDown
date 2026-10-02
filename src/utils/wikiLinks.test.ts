import { describe, expect, it } from 'vitest'
import type { Note } from '../types/editor'
import {
  applyRenameRewritePlan,
  createRenameRewritePlan,
  findUnlinkedMentions,
  linkFirstMention,
  parseWikiLinks,
  resolveLink,
  rewriteWikiLinks,
} from './wikiLinks'

function note(id: string, title: string, content = '', updatedAt = 1): Note {
  return { id, title, content, savedContent: content, tags: [], createdAt: 1, updatedAt }
}

describe('wiki links', () => {
  it('parses titles, aliases, heading anchors, whitespace, and Unicode', () => {
    expect(parseWikiLinks('See [[  Café Notes#Quick Start | open here ]] and [[東京]]')).toMatchObject([
      { title: 'Café Notes', heading: 'Quick Start', alias: 'open here' },
      { title: '東京' },
    ])
  })

  it('supports escaped hash and pipe characters in note titles and aliases', () => {
    expect(parseWikiLinks('[[C++ & C\\#|alias\\|text]]')).toMatchObject([
      { title: 'C++ & C#', alias: 'alias|text' },
    ])
    expect(rewriteWikiLinks('[[C\\#|view]]', 'C#', 'D#')).toBe('[[D\\#|view]]')
  })

  it('ignores fenced code, inline code, and escaped openers', () => {
    const markdown = [
      'Real [[Target]] and `[[inline]]`.',
      '```md',
      '[[fenced]]',
      '```',
      '\\[[escaped]]',
    ].join('\n')
    expect(parseWikiLinks(markdown).map(({ title }) => title)).toEqual(['Target'])
  })

  it('resolves titles without case sensitivity and prefers the most recent duplicate', () => {
    const older = note('old', 'Project Notes', '', 2)
    const newer = note('new', 'project notes', '', 9)
    expect(resolveLink('PROJECT NOTES', [older, newer])).toMatchObject({ note: newer, ambiguous: true, candidates: [newer, older] })
    expect(resolveLink('Missing', [older]).note).toBeNull()
  })

  it('rewrites links while preserving aliases and heading anchors', () => {
    const markdown = '[[Old Title#Overview|read this]] and [[ Old Title ]]. `[[Old Title]]`'
    expect(rewriteWikiLinks(markdown, 'Old Title', 'New Title'))
      .toBe('[[New Title#Overview|read this]] and [[New Title]]. `[[Old Title]]`')
  })

  it('plans all inbound rewrites without mutating notes and fails atomically for missing IDs', () => {
    const notes = [note('target', 'Old'), note('source-a', 'A', '[[Old]]'), note('source-b', 'B', '[[Old#Heading|alias]]')]
    const plan = createRenameRewritePlan(notes, 'target', 'New')
    expect(plan?.changes).toEqual([
      { noteId: 'source-a', title: 'A', originalContent: '[[Old]]', content: '[[New]]' },
      { noteId: 'source-b', title: 'B', originalContent: '[[Old#Heading|alias]]', content: '[[New#Heading|alias]]' },
    ])
    expect(notes[1].content).toBe('[[Old]]')
    expect(createRenameRewritePlan(notes, 'missing', 'New')).toBeNull()
    expect(applyRenameRewritePlan(notes, plan!, () => 30)?.map((item) => item.content)).toEqual(['', '[[New]]', '[[New#Heading|alias]]'])
    const staleNotes = [notes[0], notes[1], { ...notes[2], content: 'changed meanwhile' }]
    expect(applyRenameRewritePlan(staleNotes, plan!)).toBeNull()
    expect(staleNotes[1].content).toBe('[[Old]]')
  })

  it('finds and converts only the first unlinked mention outside code and wiki links', () => {
    const markdown = 'Target, [[Target]], [Target](target.md), `Target`\n```\nTarget\n```\nTarget again'
    expect(findUnlinkedMentions(markdown, 'Target')).toHaveLength(2)
    expect(linkFirstMention(markdown, 'Target')).toBe('[[Target]], [[Target]], [Target](target.md), `Target`\n```\nTarget\n```\nTarget again')
  })
})
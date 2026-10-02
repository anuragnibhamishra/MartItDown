import { describe, expect, it } from 'vitest'
import { getSlashAssistQuery, getWikiAssistQuery, resolveSlashInsertion, slashCommands } from './slashCommands'

describe('editor assistance triggers', () => {
  it('detects slash commands at line start or after whitespace', () => {
    expect(getSlashAssistQuery('text /mer', 9)).toEqual({ query: 'mer', start: 5 })
    expect(getSlashAssistQuery('word/mer', 8)).toBeNull()
    expect(getSlashAssistQuery('/head', 5)).toEqual({ query: 'head', start: 0 })
  })

  it('detects wiki link autocomplete and resolves dynamic date insertion', () => {
    expect(getWikiAssistQuery('See [[Plan', 10)).toEqual({ query: 'Plan', start: 4 })
    expect(resolveSlashInsertion(slashCommands.find(({ id }) => id === 'date')!, new Date('2025-03-04T00:00:00Z'))).toBe('2025-03-04')
    expect(resolveSlashInsertion(slashCommands.find(({ id }) => id === 'mermaid')!)).toContain('flowchart TD')
  })
})
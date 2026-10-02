import { describe, expect, it } from 'vitest'
import { continueListOnEnter, filterSlashCommands, getAutoPairBackspaceEdit, getAutoPairEdit, indentSelectedLines, mapScrollPosition, transformSmartPaste } from './editorTransforms'

describe('textarea editor transforms', () => {
  it('continues unordered, ordered, task, and quote markers and exits empty items', () => {
    expect(continueListOnEnter('- item', 6, 6)?.text).toBe('\n- ')
    expect(continueListOnEnter('  8. item', 9, 9)?.text).toBe('\n  9. ')
    expect(continueListOnEnter('- [x] done', 10, 10)?.text).toBe('\n- [ ] ')
    expect(continueListOnEnter('> quote', 7, 7)?.text).toBe('\n> ')
    expect(continueListOnEnter('- ', 2, 2)).toMatchObject({ start: 0, end: 2, text: '' })
    expect(continueListOnEnter('plain', 5, 5)).toBeNull()
  })

  it('indents and outdents selected lines by two spaces', () => {
    const indented = indentSelectedLines('one\ntwo', 0, 7)
    expect(indented.text).toBe('  one\n  two')
    expect(indented.selectionEnd).toBe(11)
    const outdented = indentSelectedLines('  one\n  two', 0, 11, true)
    expect(outdented.text).toBe('one\ntwo')
  })

  it('pairs safe openers, wraps selections, skips word boundaries, overwrites closers, and deletes empty pairs', () => {
    expect(getAutoPairEdit('x', 1, 1, '(')).toMatchObject({ text: '()' })
    expect(getAutoPairEdit('word', 0, 4, '[', true)).toMatchObject({ text: '[word]' })
    expect(getAutoPairEdit('next', 0, 0, '"', true)).toBeNull()
    expect(getAutoPairEdit('()', 1, 1, ')')).toEqual({ kind: 'move', caret: 2 })
    expect(getAutoPairBackspaceEdit('[]', 1)).toMatchObject({ start: 0, end: 2, text: '' })
  })

  it('turns URL paste over selected text into a Markdown link', () => {
    expect(transformSmartPaste('Open site', 5, 9, 'https://example.com')).toMatchObject({ text: '[site](https://example.com)' })
    expect(transformSmartPaste('', 0, 0, 'plain text').text).toBe('plain text')
  })

  it('filters slash commands and maps proportional scroll positions', () => {
    const commands = [
      { id: 'heading', label: 'Heading 1', description: 'h1 title', insertion: '# ' },
      { id: 'mermaid', label: 'Mermaid diagram', description: 'flowchart', insertion: '```mermaid' },
    ]
    expect(filterSlashCommands(commands, 'flow')).toEqual([commands[1]])
    expect(mapScrollPosition(50, 110, 10, 210, 10)).toBe(100)
    expect(mapScrollPosition(0, 10, 10, 20, 10)).toBe(0)
  })
})
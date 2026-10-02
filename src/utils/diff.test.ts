import { describe, expect, it } from 'vitest'
import { computeLineDiff } from './diff'

describe('line diff', () => {
  it('handles identical input and empty strings', () => {
    expect(computeLineDiff('same\ntext', 'same\ntext').lines.map(({ kind }) => kind)).toEqual(['unchanged', 'unchanged'])
    expect(computeLineDiff('', '').lines).toEqual([])
  })

  it('renders additions, deletions, and replacements with line numbers', () => {
    expect(computeLineDiff('one\nold\nthree', 'one\nnew\nthree').lines).toEqual([
      { kind: 'unchanged', text: 'one', oldLine: 1, newLine: 1 },
      { kind: 'removed', text: 'old', oldLine: 2, newLine: null },
      { kind: 'added', text: 'new', oldLine: null, newLine: 2 },
      { kind: 'unchanged', text: 'three', oldLine: 3, newLine: 3 },
    ])
    expect(computeLineDiff('one\ntwo', 'one').lines.at(-1)).toMatchObject({ kind: 'removed', oldLine: 2 })
    expect(computeLineDiff('one', 'one\ntwo').lines.at(-1)).toMatchObject({ kind: 'added', newLine: 2 })
  })

  it('normalizes CRLF and represents moved blocks as removal and addition', () => {
    expect(computeLineDiff('a\r\nb\r\nc', 'a\nb\nc').lines.every(({ kind }) => kind === 'unchanged')).toBe(true)
    const moved = computeLineDiff('top\nmove\nbottom', 'move\ntop\nbottom').lines
    const movedText = ['top', 'move'].find((text) => moved.some((line) => line.kind === 'removed' && line.text === text)
      && moved.some((line) => line.kind === 'added' && line.text === text))
    expect(movedText).toBeDefined()
  })

  it('collapses long unchanged runs while retaining boundary line numbers', () => {
    const lines = ['start', ...Array.from({ length: 24 }, (_, index) => `line ${index}`), 'end'].join('\n')
    const result = computeLineDiff(lines, lines)
    const collapsed = result.lines.find(({ kind }) => kind === 'collapsed')
    expect(collapsed).toMatchObject({ text: '... 20 unchanged lines', unchangedCount: 20, oldLine: 4, newLine: 4 })
    expect(result.lines[0]).toMatchObject({ kind: 'unchanged', oldLine: 1, newLine: 1 })
  })

  it('falls back to a quick coarse diff for oversized line matrices', () => {
    const before = Array.from({ length: 300 }, (_, index) => `old ${index}`).join('\n')
    const after = Array.from({ length: 300 }, (_, index) => `new ${index}`).join('\n')
    const startedAt = performance.now()
    const result = computeLineDiff(before, after, { maxCells: 100, force: true })
    expect(result.approximate).toBe(true)
    expect(result.lines.some(({ kind }) => kind === 'removed')).toBe(true)
    expect(performance.now() - startedAt).toBeLessThan(100)
  })
})
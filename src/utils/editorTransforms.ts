export interface TextEdit {
  start: number
  end: number
  text: string
  selectionStart: number
  selectionEnd: number
}

export interface PairMove {
  kind: 'move'
  caret: number
}

export interface PairReplace extends TextEdit {
  kind: 'replace'
}

export type PairEdit = PairMove | PairReplace

const listMarker = /^([\t ]*)(-\s+\[[ xX]\]\s+|[-*+]\s+|(\d+)\.\s+|(>\s*))/
const emptyListMarker = /^([\t ]*)(?:-\s+\[[ xX]\]|[-*+]|\d+\.|>)\s*$/
const pairDefinitions = [
  ['(', ')'], ['[', ']'], ['{', '}'], ['"', '"'], ["'", "'"], ['`', '`'], ['*', '*'], ['_', '_'],
] as const

export function continueListOnEnter(value: string, start: number, end: number): TextEdit | null {
  if (start !== end) return null
  const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1
  const lineEndIndex = value.indexOf('\n', start)
  const lineEnd = lineEndIndex < 0 ? value.length : lineEndIndex
  const line = value.slice(lineStart, lineEnd)
  const relativeCursor = start - lineStart
  if (relativeCursor < 0 || relativeCursor > line.length) return null

  const emptyMatch = line.match(emptyListMarker)
  if (emptyMatch && relativeCursor >= emptyMatch[0].length) {
    const indentation = emptyMatch[1]
    return { start: lineStart, end: lineEnd, text: indentation, selectionStart: lineStart + indentation.length, selectionEnd: lineStart + indentation.length }
  }

  const marker = line.slice(0, relativeCursor).match(listMarker)
  if (!marker) return null
  let nextMarker = marker[2]
  if (marker[3]) nextMarker = `${Number(marker[3]) + 1}. `
  else if (marker[2].startsWith('- [') || marker[2].startsWith('* [') || marker[2].startsWith('+ [')) nextMarker = '- [ ] '
  const insertion = `\n${marker[1]}${nextMarker}`
  const caret = start + insertion.length
  return { start, end: start, text: insertion, selectionStart: caret, selectionEnd: caret }
}

export function indentSelectedLines(value: string, selectionStart: number, selectionEnd: number, outdent = false, width = 2): TextEdit {
  const start = value.lastIndexOf('\n', Math.max(0, selectionStart - 1)) + 1
  let end = selectionEnd
  if (end > start && value[end - 1] === '\n') end -= 1
  const endLineBreak = value.indexOf('\n', end)
  const blockEnd = endLineBreak < 0 ? value.length : endLineBreak
  const block = value.slice(start, blockEnd)
  const lines = block.split('\n')
  let firstLineDelta = 0
  let totalDelta = 0
  const indent = ' '.repeat(width)
  const transformed = lines.map((line, index) => {
    if (outdent) {
      const removed = line.startsWith('\t') ? 1 : Math.min(width, line.match(/^ */)?.[0].length ?? 0)
      const next = line.slice(removed)
      totalDelta -= removed
      if (index === 0) firstLineDelta = -removed
      return next
    }
    totalDelta += indent.length
    if (index === 0) firstLineDelta = indent.length
    return `${indent}${line}`
  }).join('\n')
  const nextSelectionStart = Math.max(start, selectionStart + firstLineDelta)
  const nextSelectionEnd = Math.max(nextSelectionStart, selectionEnd + totalDelta)
  return { start, end: blockEnd, text: transformed, selectionStart: nextSelectionStart, selectionEnd: nextSelectionEnd }
}

function isWordCharacter(character: string): boolean {
  return Boolean(character && /[\p{L}\p{N}_]/u.test(character))
}

export function getAutoPairEdit(value: string, start: number, end: number, typed: string, enabled = true): PairEdit | null {
  if (!enabled || typed.length !== 1) return null
  const pair = pairDefinitions.find(([open]) => open === typed)
  const closingPair = pairDefinitions.find(([, close]) => close === typed)
  if (start === end && closingPair && value[start] === typed) return { kind: 'move', caret: start + 1 }
  if (!pair) return null
  const nextCharacter = value[end] ?? ''
  if (start === end && isWordCharacter(nextCharacter)) return null
  const selectedText = value.slice(start, end)
  const insertion = `${pair[0]}${selectedText}${pair[1]}`
  return {
    kind: 'replace',
    start,
    end,
    text: insertion,
    selectionStart: start + 1,
    selectionEnd: start + 1 + selectedText.length,
  }
}

export function getAutoPairBackspaceEdit(value: string, caret: number, enabled = true): TextEdit | null {
  if (!enabled || caret <= 0 || caret >= value.length) return null
  const matchingPair = pairDefinitions.find(([open, close]) => value[caret - 1] === open && value[caret] === close)
  if (!matchingPair) return null
  return { start: caret - 1, end: caret + 1, text: '', selectionStart: caret - 1, selectionEnd: caret - 1 }
}

export function transformSmartPaste(value: string, start: number, end: number, pastedText: string): TextEdit {
  const selected = value.slice(start, end)
  const url = /^https?:\/\/\S+$/i.test(pastedText.trim()) ? pastedText.trim() : null
  const insertion = url && selected ? `[${selected}](${url})` : pastedText
  const caret = start + insertion.length
  return { start, end, text: insertion, selectionStart: caret, selectionEnd: caret }
}

export interface SlashCommand {
  id: string
  label: string
  description: string
  insertion: string
  cursorOffset?: number
}

export function filterSlashCommands<T extends Pick<SlashCommand, 'label' | 'description'>>(
  commands: readonly T[],
  query: string,
): T[] {
  const normalized = query.trim().toLocaleLowerCase()
  if (!normalized) return [...commands]
  return commands.filter((command) => `${command.label} ${command.description}`.toLocaleLowerCase().includes(normalized))
}

export function mapScrollPosition(sourceTop: number, sourceHeight: number, sourceViewport: number, targetHeight: number, targetViewport: number): number {
  const sourceRange = Math.max(0, sourceHeight - sourceViewport)
  const targetRange = Math.max(0, targetHeight - targetViewport)
  if (sourceRange === 0 || targetRange === 0) return 0
  return Math.max(0, Math.min(1, sourceTop / sourceRange)) * targetRange
}
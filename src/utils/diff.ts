export type DiffLineKind = 'added' | 'removed' | 'unchanged' | 'collapsed'

export interface DiffLine {
  kind: DiffLineKind
  text: string
  oldLine: number | null
  newLine: number | null
  unchangedCount?: number
}

export interface DiffOptions {
  maxCells?: number
  force?: boolean
  collapseAfter?: number
}

export interface DiffResult {
  lines: DiffLine[]
  approximate: boolean
}

const defaultMaxCells = 2_000_000
const defaultCollapseAfter = 12

function linesOf(text: string): string[] {
  return text === '' ? [] : text.replace(/\r\n?/g, '\n').split('\n')
}

function coarseDiff(before: string[], after: string[]): DiffLine[] {
  let prefixLength = 0
  while (prefixLength < before.length && prefixLength < after.length && before[prefixLength] === after[prefixLength]) prefixLength += 1
  let suffixLength = 0
  while (suffixLength < before.length - prefixLength && suffixLength < after.length - prefixLength
    && before[before.length - suffixLength - 1] === after[after.length - suffixLength - 1]) suffixLength += 1

  const result: DiffLine[] = []
  for (let index = 0; index < prefixLength; index += 1) result.push({ kind: 'unchanged', text: before[index], oldLine: index + 1, newLine: index + 1 })
  for (let index = prefixLength; index < before.length - suffixLength; index += 1) result.push({ kind: 'removed', text: before[index], oldLine: index + 1, newLine: null })
  for (let index = prefixLength; index < after.length - suffixLength; index += 1) result.push({ kind: 'added', text: after[index], oldLine: null, newLine: index + 1 })
  for (let index = suffixLength; index > 0; index -= 1) {
    const oldIndex = before.length - index
    const newIndex = after.length - index
    result.push({ kind: 'unchanged', text: before[oldIndex], oldLine: oldIndex + 1, newLine: newIndex + 1 })
  }
  return result
}

export function collapseUnchangedRuns(lines: readonly DiffLine[], threshold = defaultCollapseAfter, context = 3): DiffLine[] {
  const output: DiffLine[] = []
  let index = 0
  while (index < lines.length) {
    if (lines[index].kind !== 'unchanged') {
      output.push(lines[index])
      index += 1
      continue
    }
    let end = index + 1
    while (end < lines.length && lines[end].kind === 'unchanged') end += 1
    const run = lines.slice(index, end)
    if (run.length <= threshold) output.push(...run)
    else {
      output.push(...run.slice(0, context))
      const hidden = run.slice(context, run.length - context)
      output.push({
        kind: 'collapsed',
        text: `... ${hidden.length} unchanged lines`,
        oldLine: hidden[0]?.oldLine ?? null,
        newLine: hidden[0]?.newLine ?? null,
        unchangedCount: hidden.length,
      })
      output.push(...run.slice(run.length - context))
    }
    index = end
  }
  return output
}

export function computeLineDiff(beforeText: string, afterText: string, options: DiffOptions = {}): DiffResult {
  const before = linesOf(beforeText)
  const after = linesOf(afterText)
  const cells = (before.length + 1) * (after.length + 1)
  const maxCells = options.maxCells ?? defaultMaxCells
  const approximate = cells > maxCells
  const raw: DiffLine[] = approximate || options.force
    ? coarseDiff(before, after)
    : calculateLcsDiff(before, after)
  return { lines: collapseUnchangedRuns(raw, options.collapseAfter), approximate }
}

function calculateLcsDiff(before: string[], after: string[]): DiffLine[] {
  const columns = after.length + 1
  const table = new Uint32Array((before.length + 1) * columns)
  for (let oldIndex = before.length - 1; oldIndex >= 0; oldIndex -= 1) {
    for (let newIndex = after.length - 1; newIndex >= 0; newIndex -= 1) {
      const cell = oldIndex * columns + newIndex
      table[cell] = before[oldIndex] === after[newIndex]
        ? table[(oldIndex + 1) * columns + newIndex + 1] + 1
        : Math.max(table[(oldIndex + 1) * columns + newIndex], table[oldIndex * columns + newIndex + 1])
    }
  }

  const result: DiffLine[] = []
  let oldIndex = 0
  let newIndex = 0
  while (oldIndex < before.length || newIndex < after.length) {
    if (oldIndex < before.length && newIndex < after.length && before[oldIndex] === after[newIndex]) {
      result.push({ kind: 'unchanged', text: before[oldIndex], oldLine: oldIndex + 1, newLine: newIndex + 1 })
      oldIndex += 1
      newIndex += 1
    } else if (oldIndex < before.length && (newIndex >= after.length
      || table[(oldIndex + 1) * columns + newIndex] >= table[oldIndex * columns + newIndex + 1])) {
      result.push({ kind: 'removed', text: before[oldIndex], oldLine: oldIndex + 1, newLine: null })
      oldIndex += 1
    } else {
      result.push({ kind: 'added', text: after[newIndex], oldLine: null, newLine: newIndex + 1 })
      newIndex += 1
    }
  }
  return result
}
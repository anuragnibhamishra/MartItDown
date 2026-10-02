import type { EditorAssistItem } from './editorAssist'

export interface SlashCommand extends EditorAssistItem {
  insertion: string
  cursorOffset?: number
}

export const slashCommands: readonly SlashCommand[] = [
  { id: 'h1', label: 'Heading 1', description: 'Large section heading', insertion: '# ', cursorOffset: 2 },
  { id: 'h2', label: 'Heading 2', description: 'Section heading', insertion: '## ', cursorOffset: 3 },
  { id: 'h3', label: 'Heading 3', description: 'Small section heading', insertion: '### ', cursorOffset: 4 },
  { id: 'bullet', label: 'Bullet list', description: 'Unordered list item', insertion: '- ', cursorOffset: 2 },
  { id: 'numbered', label: 'Numbered list', description: 'Ordered list item', insertion: '1. ', cursorOffset: 3 },
  { id: 'task', label: 'Task list', description: 'Unchecked task item', insertion: '- [ ] ', cursorOffset: 6 },
  { id: 'quote', label: 'Quote', description: 'Block quote', insertion: '> ', cursorOffset: 2 },
  { id: 'code', label: 'Code block', description: 'Fenced code', insertion: '```\n\n```', cursorOffset: 4 },
  { id: 'table', label: 'Table', description: '3-column starter table', insertion: '| Column 1 | Column 2 | Column 3 |\n| --- | --- | --- |\n|  |  |  |\n|  |  |  |', cursorOffset: 2 },
  { id: 'divider', label: 'Divider', description: 'Horizontal rule', insertion: '---\n' },
  { id: 'math', label: 'Math block', description: 'Display formula', insertion: '$$\n\n$$', cursorOffset: 3 },
  { id: 'mermaid', label: 'Mermaid diagram', description: 'Starter flowchart', insertion: '```mermaid\nflowchart TD\n  A[Start] --> B[End]\n```\n', cursorOffset: 25 },
  { id: 'wiki', label: 'Wiki link', description: 'Link another note', insertion: '[[]]', cursorOffset: 2 },
  { id: 'date', label: 'Date', description: 'Insert today’s date', insertion: '' },
]

export function getWikiAssistQuery(value: string, cursor: number): { query: string; start: number } | null {
  const match = value.slice(0, cursor).match(/\[\[([^\]\n]*)$/u)
  if (!match || match.index === undefined) return null
  return { query: match[1], start: match.index }
}

export function getSlashAssistQuery(value: string, cursor: number): { query: string; start: number } | null {
  const prefix = value.slice(0, cursor)
  const match = prefix.match(/(?:^|\s)\/([^\s/]*)$/u)
  if (!match || match.index === undefined) return null
  const slashOffset = match[0].lastIndexOf('/')
  return { query: match[1], start: match.index + slashOffset }
}

export function resolveSlashInsertion(command: SlashCommand, today = new Date()): string {
  return command.id === 'date' ? today.toISOString().slice(0, 10) : command.insertion
}
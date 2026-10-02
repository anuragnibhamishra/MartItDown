import type { ToolbarAction } from '../types/editor'

export const starterMarkdown = `# Welcome to MarkItDown

Write Markdown on the left and see the result on the right.

## Basic formatting

You can make text **bold**, *italic*, or ~~strikethrough~~.

## Lists

- Markdown
- Is
- Simple

## Links

[Visit GitHub](https://github.com)

## Code

\u007f\`\`\`javascript
const greeting = "Hello Markdown!";
console.log(greeting);
\u007f\`\`\`

> Markdown is designed to be easy to read and write.

## Task list

- [x] Learn headings
- [ ] Learn emphasis
- [ ] Learn tables

| Syntax | Result |
| --- | --- |
| \u007f\`**bold**\u007f\` | **bold** |
| \u007f\`*italic*\u007f\` | *italic* |`

export function countWords(content: string) {
  return content.trim() ? content.trim().split(/\s+/).length : 0
}

export function formatSelection(action: ToolbarAction, selected: string) {
  const wrappers: Partial<Record<ToolbarAction, [string, string, string]>> = {
    bold: ['**', '**', 'bold text'],
    italic: ['*', '*', 'italic text'],
    strike: ['~~', '~~', 'struck text'],
    link: ['[', '](https://example.com)', 'link text'],
    image: ['![', '](https://images.unsplash.com/photo-1497366754035-f200968a6e72)', 'alt text'],
    code: ['`', '`', 'code'],
  }
  const wrapper = wrappers[action]
  if (wrapper) return `${wrapper[0]}${selected || wrapper[2]}${wrapper[1]}`

  if (action === 'h1' || action === 'h2') return `${action === 'h1' ? '# ' : '## '}${selected || 'Heading'}`
  if (action === 'quote') return `> ${selected || 'Quote'}`
  if (action === 'bullet') return (selected || 'List item').split('\n').map((line) => `- ${line}`).join('\n')
  if (action === 'ordered') return (selected || 'List item').split('\n').map((line, index) => `${index + 1}. ${line}`).join('\n')
  if (action === 'task') return (selected || 'Task item').split('\n').map((line) => `- [ ] ${line}`).join('\n')
  return selected
}
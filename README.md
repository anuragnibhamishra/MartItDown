# MarkItDown

Write Markdown. See what it becomes.

MarkItDown is a focused, client-side Markdown playground built for writing, learning, and previewing Markdown without leaving the browser.

## Features

- Live split-pane Markdown preview with GitHub Flavored Markdown support
- Toolbar actions for headings, emphasis, links, images, quotes, code, lists, and tasks
- Syntax-highlighted fenced code blocks with copy controls
- Open local `.md`, `.markdown`, and `.txt` files and download Markdown files
- Editable document names, unsaved-change protection, local draft persistence, and word counts
- Light, dark, and system themes
- Keyboard shortcuts, focus reading mode, print preview, responsive mobile tabs, and accessible controls
- Copy raw Markdown or the rendered HTML representation

## Tech Stack

- React 19 and TypeScript
- Vite
- `react-markdown`, `remark-gfm`, and `rehype-highlight`
- Lucide React
- CSS design tokens (with Tailwind available for future utility work)

## Architecture

The application keeps the editing model in `src/App.tsx`, with pure starter content and small reusable UI helpers for buttons, code blocks, and modals. Styling lives in `src/index.css`, where the light/dark design tokens, responsive layout, Markdown typography, and print rules are defined.

## Getting Started

```bash
npm install
npm run dev
```

Build for production with:

```bash
npm run build
```

## Project Structure

```text
src/
  App.tsx       Application state, editor, preview, file actions, and dialogs
  index.css     Design system, responsive layout, and rendered Markdown styles
  main.tsx      React entry point
```

## Markdown Support

Headings, paragraphs, emphasis, strikethrough, links, images, ordered and unordered lists, nested lists, task lists, blockquotes, inline and fenced code, tables, horizontal rules, and autolinks are supported through GitHub Flavored Markdown. Raw HTML is not enabled, keeping rendered content from executing arbitrary markup.

## Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| `Cmd/Ctrl + B` | Bold |
| `Cmd/Ctrl + I` | Italic |
| `Cmd/Ctrl + K` | Insert link |
| `Cmd/Ctrl + S` | Download/save Markdown |
| `?` | Open shortcut reference |

## Future Improvements

- Resizable desktop divider
- Multiple documents and recent-file history
- Optional sanitized raw HTML mode
- Lazy-loaded preview rendering for very large documents

## License

MIT

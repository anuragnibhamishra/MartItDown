import { useEffect, useRef, useState, type ReactNode } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import {
  Check,
  ChevronDown,
  Clipboard,
  Code2,
  Download,
  FilePlus2,
  FileText,
  FolderOpen,
  HelpCircle,
  Image,
  Italic,
  Keyboard,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Moon,
  MoreHorizontal,
  Quote,
  Save,
  Search,
  Sun,
  Strikethrough,
  Type,
  X,
} from 'lucide-react'
import 'highlight.js/styles/github-dark.css'
import './index.css'

const starterMarkdown = `# Welcome to MarkItDown

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

\`\`\`javascript
const greeting = "Hello Markdown!";
console.log(greeting);
\`\`\`

> Markdown is designed to be easy to read and write.

## Task list

- [x] Learn headings
- [ ] Learn emphasis
- [ ] Learn tables

| Syntax | Result |
| --- | --- |
| \`**bold**\` | **bold** |
| \`*italic*\` | *italic* |`

type Theme = 'light' | 'dark' | 'system'
type View = 'write' | 'preview'
type Toast = { id: number; message: string; tone: 'success' | 'error' | 'info' }
type ToolbarAction = 'h1' | 'h2' | 'bold' | 'italic' | 'strike' | 'link' | 'image' | 'quote' | 'code' | 'bullet' | 'ordered' | 'task'

const storageKey = 'markitdown-document'
const themeKey = 'markitdown-theme'

function getInitialDocument() {
  try {
    const stored = localStorage.getItem(storageKey)
    if (stored) return JSON.parse(stored) as { name: string; content: string; savedContent: string }
  } catch {
    // A corrupted local draft should not block the editor from opening.
  }
  return { name: 'welcome.md', content: starterMarkdown, savedContent: starterMarkdown }
}

function getInitialTheme(): Theme {
  const stored = localStorage.getItem(themeKey)
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system'
}

function countWords(content: string) {
  return content.trim() ? content.trim().split(/\s+/).length : 0
}

function Logo() {
  return <div className="brand"><span className="brand-mark"><FileText size={16} strokeWidth={2.5} /></span><span>MarkItDown</span></div>
}

function IconButton({ label, children, onClick, active = false }: { label: string; children: ReactNode; onClick?: () => void; active?: boolean }) {
  return <button type="button" className={`icon-button ${active ? 'is-active' : ''}`} aria-label={label} title={label} onClick={onClick}>{children}</button>
}

function ToolbarButton({ label, children, onClick }: { label: string; children: ReactNode; onClick: () => void }) {
  return <button type="button" className="toolbar-button" onClick={onClick} title={label} aria-label={label}>{children}</button>
}

function CodeBlock({ className, children }: { className?: string; children?: ReactNode }) {
  const [copied, setCopied] = useState(false)
  const code = String(children).replace(/\n$/, '')
  const language = className?.replace('language-', '')
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch { /* Clipboard access can be unavailable in local files. */ }
  }
  return <div className="code-block"><div className="code-header"><span>{language || 'code'}</span><button type="button" onClick={copy}>{copied ? <Check size={13} /> : <Clipboard size={13} />}{copied ? 'Copied' : 'Copy'}</button></div><pre><code className={className}>{code}</code></pre></div>
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-header"><h2 id="modal-title">{title}</h2><IconButton label="Close dialog" onClick={onClose}><X size={17} /></IconButton></div>{children}</section></div>
}

function App() {
  const initial = getInitialDocument()
  const [name, setName] = useState(initial.name)
  const [content, setContent] = useState(initial.content)
  const [savedContent, setSavedContent] = useState(initial.savedContent)
  const [theme, setTheme] = useState<Theme>(getInitialTheme)
  const [view, setView] = useState<View>('write')
  const [readingMode, setReadingMode] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [newDocumentPrompt, setNewDocumentPrompt] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [isEditingName, setIsEditingName] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const editorRef = useRef<HTMLTextAreaElement>(null)
  const dirty = content !== savedContent

  const notify = (message: string, tone: Toast['tone'] = 'success') => {
    const id = Date.now()
    setToasts((current) => [...current, { id, message, tone }])
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 3000)
  }

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify({ name, content, savedContent }))
  }, [name, content, savedContent])

  useEffect(() => {
    localStorage.setItem(themeKey, theme)
    document.documentElement.dataset.theme = theme
  }, [theme])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const modifier = event.metaKey || event.ctrlKey
      if (modifier && event.key.toLowerCase() === 's') { event.preventDefault(); saveDocument() }
      if (modifier && event.key.toLowerCase() === 'b') { event.preventDefault(); applyAction('bold') }
      if (modifier && event.key.toLowerCase() === 'i') { event.preventDefault(); applyAction('italic') }
      if (modifier && event.key.toLowerCase() === 'k') { event.preventDefault(); applyAction('link') }
      if (event.key === '?' && document.activeElement?.tagName !== 'TEXTAREA') setShowShortcuts(true)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  })

  const saveDocument = () => {
    setSavedContent(content)
    downloadFile(name, content)
    notify('Markdown file downloaded')
  }

  const downloadFile = (fileName: string, data: string) => {
    const safeName = fileName.toLowerCase().endsWith('.md') ? fileName : `${fileName}.md`
    const url = URL.createObjectURL(new Blob([data], { type: 'text/markdown;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = safeName || 'untitled.md'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const newDocument = () => {
    if (dirty) { setNewDocumentPrompt(true); return }
    startNewDocument()
  }

  const startNewDocument = () => {
    setName('untitled.md'); setContent(''); setSavedContent(''); setNewDocumentPrompt(false); setView('write'); notify('New document created', 'info')
  }

  const openFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!/\.(md|markdown|txt)$/i.test(file.name)) { notify('Please choose a Markdown or text file', 'error'); return }
    try { const text = await file.text(); setName(file.name); setContent(text); setSavedContent(text); notify('Markdown file opened') }
    catch { notify('Unable to read file', 'error') }
    event.target.value = ''
  }

  const applyAction = (action: ToolbarAction) => {
    const editor = editorRef.current
    if (!editor) return
    const start = editor.selectionStart
    const end = editor.selectionEnd
    const selected = content.slice(start, end)
    const wrappers: Record<string, [string, string, string]> = {
      bold: ['**', '**', 'bold text'], italic: ['*', '*', 'italic text'], strike: ['~~', '~~', 'struck text'], link: ['[', '](https://example.com)', 'link text'], image: ['![', '](https://images.unsplash.com/photo-1497366754035-f200968a6e72)', 'alt text'], code: ['`', '`', 'code'],
    }
    let replacement = selected
    if (action in wrappers) { const [before, after, fallback] = wrappers[action]; replacement = `${before}${selected || fallback}${after}` }
    if (action === 'h1' || action === 'h2') replacement = `${action === 'h1' ? '# ' : '## '}${selected || 'Heading'}`
    if (action === 'quote') replacement = `> ${selected || 'Quote'}`
    if (action === 'bullet') replacement = (selected || 'List item').split('\n').map((line) => `- ${line}`).join('\n')
    if (action === 'ordered') replacement = (selected || 'List item').split('\n').map((line, index) => `${index + 1}. ${line}`).join('\n')
    if (action === 'task') replacement = (selected || 'Task item').split('\n').map((line) => `- [ ] ${line}`).join('\n')
    const next = content.slice(0, start) + replacement + content.slice(end)
    setContent(next)
    requestAnimationFrame(() => { editor.focus(); editor.setSelectionRange(start, start + replacement.length) })
  }

  const copyMarkdown = async () => {
    try { await navigator.clipboard.writeText(content); notify('Markdown copied') }
    catch { notify('Unable to copy Markdown', 'error') }
    setShowExport(false)
  }

  const copyHtml = async () => {
    const html = document.querySelector('.markdown-body')?.innerHTML || ''
    try { await navigator.clipboard.writeText(html); notify('Rendered HTML copied') }
    catch { notify('Unable to copy rendered HTML', 'error') }
    setShowExport(false)
  }

  const themeIcon = theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />

  return <div className={`app-shell ${readingMode ? 'reading-mode' : ''}`}>
    <header className="topbar">
      <div className="topbar-left"><Logo /><span className="topbar-divider" /><div className="document-name">{isEditingName ? <input autoFocus value={name} onChange={(event) => setName(event.target.value)} onBlur={() => setIsEditingName(false)} onKeyDown={(event) => event.key === 'Enter' && setIsEditingName(false)} aria-label="Document name" /> : <button type="button" className="document-name-button" onClick={() => setIsEditingName(true)}>{name}<ChevronDown size={13} /></button>}</div></div>
      <div className="topbar-actions"><span className={`save-state ${dirty ? 'dirty' : ''}`}><span className="status-dot" />{dirty ? 'Unsaved changes' : 'Saved'}</span><div className="action-divider" /><IconButton label="New document" onClick={newDocument}><FilePlus2 size={16} /></IconButton><IconButton label="Open Markdown file" onClick={() => fileInputRef.current?.click()}><FolderOpen size={16} /></IconButton><IconButton label="Save Markdown file" onClick={saveDocument}><Save size={16} /></IconButton><div className="export-wrap"><button type="button" className="export-button" onClick={() => setShowExport((open) => !open)}>Export <ChevronDown size={13} /></button>{showExport && <div className="export-menu"><button type="button" onClick={saveDocument}><Download size={15} />Download Markdown</button><button type="button" onClick={copyMarkdown}><Clipboard size={15} />Copy Markdown</button><button type="button" onClick={copyHtml}><Code2 size={15} />Copy rendered HTML</button><button type="button" onClick={() => { window.print(); setShowExport(false) }}><FileText size={15} />Print preview</button></div>}</div><IconButton label="Keyboard shortcuts" onClick={() => setShowShortcuts(true)}><Keyboard size={16} /></IconButton><IconButton label={`Theme: ${theme}`} onClick={() => setTheme(theme === 'system' ? 'dark' : theme === 'dark' ? 'light' : 'system')}>{themeIcon}</IconButton></div>
    </header>
    <input ref={fileInputRef} className="visually-hidden" type="file" accept=".md,.markdown,.txt,text/markdown,text/plain" onChange={openFile} />
    <main className="workspace">
      <div className="mobile-tabs"><button className={view === 'write' ? 'active' : ''} onClick={() => setView('write')} type="button"><Type size={15} />Write</button><button className={view === 'preview' ? 'active' : ''} onClick={() => setView('preview')} type="button"><Search size={15} />Preview</button></div>
      <section className={`panel editor-panel ${view === 'write' ? 'mobile-visible' : ''}`}><div className="panel-heading"><div><span className="eyebrow">01</span><h1>Markdown</h1></div><div className="panel-heading-actions"><span className="format-label">CommonMark + GFM</span><IconButton label="More editor options"><MoreHorizontal size={17} /></IconButton></div></div><div className="toolbar"><ToolbarButton label="Heading 1" onClick={() => applyAction('h1')}><span className="toolbar-text">H1</span></ToolbarButton><ToolbarButton label="Heading 2" onClick={() => applyAction('h2')}><span className="toolbar-text">H2</span></ToolbarButton><span className="toolbar-separator" /><ToolbarButton label="Bold" onClick={() => applyAction('bold')}><strong>B</strong></ToolbarButton><ToolbarButton label="Italic" onClick={() => applyAction('italic')}><Italic size={15} /></ToolbarButton><ToolbarButton label="Strikethrough" onClick={() => applyAction('strike')}><Strikethrough size={15} /></ToolbarButton><ToolbarButton label="Insert link" onClick={() => applyAction('link')}><Link2 size={15} /></ToolbarButton><ToolbarButton label="Insert image" onClick={() => applyAction('image')}><Image size={15} /></ToolbarButton><span className="toolbar-separator" /><ToolbarButton label="Quote" onClick={() => applyAction('quote')}><Quote size={15} /></ToolbarButton><ToolbarButton label="Inline code" onClick={() => applyAction('code')}><Code2 size={15} /></ToolbarButton><ToolbarButton label="Bullet list" onClick={() => applyAction('bullet')}><List size={15} /></ToolbarButton><ToolbarButton label="Numbered list" onClick={() => applyAction('ordered')}><ListOrdered size={15} /></ToolbarButton><ToolbarButton label="Task list" onClick={() => applyAction('task')}><ListChecks size={15} /></ToolbarButton></div><div className="editor-wrap"><div className="line-numbers" aria-hidden="true">{content.split('\n').map((_, index) => <span key={index}>{index + 1}</span>)}</div><textarea ref={editorRef} value={content} onChange={(event) => setContent(event.target.value)} spellCheck="false" placeholder="Start writing Markdown..." aria-label="Markdown editor" /></div><div className="editor-footer"><span><span className="keyboard-key">⌘</span><span className="keyboard-key">S</span> to save</span><button type="button" onClick={() => setReadingMode(true)}>Focus mode <span>↗</span></button></div></section>
      <section className={`panel preview-panel ${view === 'preview' ? 'mobile-visible' : ''}`}><div className="panel-heading"><div><span className="eyebrow">02</span><h1>Preview</h1></div><div className="panel-heading-actions"><span className="live-indicator"><span />Live</span><IconButton label="More preview options"><MoreHorizontal size={17} /></IconButton></div></div><div className="preview-scroll">{content.trim() ? <article className="markdown-body"><Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]} components={{ code({ className, children, ...props }) { const isBlock = String(children).includes('\n'); return isBlock ? <CodeBlock className={className}>{children}</CodeBlock> : <code className={className} {...props}>{children}</code> } }}>{content}</Markdown></article> : <div className="empty-preview"><div className="empty-icon"><Type size={18} /></div><p>Nothing to preview yet.</p><span>Your rendered Markdown will appear here.</span></div>}</div></section>
    </main>
    <footer className="statusbar"><div><span className="status-file"><FileText size={14} />{name}</span><span className="status-separator" /><span>Markdown</span></div><div><span>Words: <b>{countWords(content)}</b></span><span>Characters: <b>{content.length}</b></span><span>Lines: <b>{content ? content.split('\n').length : 0}</b></span></div></footer>
    {readingMode && <div className="reading-exit"><span>Focus mode</span><button type="button" onClick={() => setReadingMode(false)}><X size={14} /> Exit</button></div>}
    <div className="toast-stack" aria-live="polite">{toasts.map((toast) => <div className={`toast ${toast.tone}`} key={toast.id}>{toast.tone === 'success' ? <Check size={15} /> : toast.tone === 'error' ? <X size={15} /> : <HelpCircle size={15} />}{toast.message}</div>)}</div>
    {showShortcuts && <Modal title="Keyboard shortcuts" onClose={() => setShowShortcuts(false)}><div className="shortcut-list"><div><span>Bold</span><kbd>⌘ B</kbd></div><div><span>Italic</span><kbd>⌘ I</kbd></div><div><span>Insert link</span><kbd>⌘ K</kbd></div><div><span>Save document</span><kbd>⌘ S</kbd></div><div><span>Show shortcuts</span><kbd>?</kbd></div></div></Modal>}
    {newDocumentPrompt && <Modal title="Start a new document?" onClose={() => setNewDocumentPrompt(false)}><p className="modal-copy">You have unsaved changes. Are you sure you want to start a new document?</p><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setNewDocumentPrompt(false)}>Cancel</button><button type="button" className="primary-button" onClick={startNewDocument}>Start new</button></div></Modal>}
  </div>
}

export default App

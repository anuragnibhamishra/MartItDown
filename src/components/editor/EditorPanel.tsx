import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import type { ClipboardEvent, RefObject } from 'react'
import {
  Code2, Image, Italic, Link2, List, ListChecks, ListOrdered, MoreHorizontal,
  Quote, Strikethrough,
} from 'lucide-react'
import type { ToolbarAction } from '../../types/editor'
import type { Note } from '../../types/editor'
import { IconButton, ToolbarButton } from '../common/Controls'
import { TagBar } from './TagBar'
import { escapeWikiLinkTitle } from '../../utils/wikiLinks'
import { getAutoPairBackspaceEdit, getAutoPairEdit, continueListOnEnter, indentSelectedLines, transformSmartPaste } from '../../utils/editorTransforms'
import { getEditorAssistPosition } from '../../utils/editorAssist'
import { getSlashAssistQuery, getWikiAssistQuery, resolveSlashInsertion, slashCommands } from '../../utils/slashCommands'
import { filterSlashCommands } from '../../utils/editorTransforms'
import { EditorAssistMenu } from './EditorAssistMenu'
import type { EditorAssistItem } from '../../utils/editorAssist'
import { applyTextareaEdit } from '../../utils/textareaEdit'
import { useScrollSync } from '../../hooks/useScrollSync'

interface EditorPanelProps {
  content: string
  notes: Note[]
  note: Note | null
  availableTags: string[]
  onSetTags: (id: string, tags: readonly string[]) => void
  editorRef: RefObject<HTMLTextAreaElement | null>
  previewScrollRef: RefObject<HTMLElement | null>
  menuButtonRef: RefObject<HTMLButtonElement | null>
  menuOpen: boolean
  autoPairEnabled: boolean
  scrollSyncEnabled: boolean
  isVisible: boolean
  onChange: (content: string) => void
  onAction: (action: ToolbarAction) => void
  onMoreOptions: () => void
  onFocusMode: () => void
  onToggleAutoPair: () => void
  onCursorChange: (line: number, column: number) => void
}

export function EditorPanel({ content, note, notes, availableTags, onSetTags, editorRef, previewScrollRef, menuButtonRef, menuOpen, autoPairEnabled, scrollSyncEnabled, isVisible, onChange, onAction, onMoreOptions, onFocusMode, onToggleAutoPair, onCursorChange }: EditorPanelProps) {
  const [assistKind, setAssistKind] = useState<'wiki' | 'slash' | null>(null)
  const [assistQuery, setAssistQuery] = useState('')
  const [activeAssistIndex, setActiveAssistIndex] = useState(0)
  const [assistPosition, setAssistPosition] = useState({ left: 66, top: 150, maxHeight: 220 })
  const [activeLine, setActiveLine] = useState(1)
  const assistListId = useId()
  const isComposingRef = useRef(false)
  useScrollSync(editorRef, previewScrollRef, scrollSyncEnabled)
  const wikiItems: EditorAssistItem[] = assistKind === 'wiki' ? notes
    .filter((item) => item.id !== note?.id && item.title.toLocaleLowerCase().includes(assistQuery.toLocaleLowerCase()))
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, 6).map((item) => ({ id: item.id, label: item.title, description: 'Note' })) : []
  const slashItems = assistKind === 'slash' ? filterSlashCommands(slashCommands, assistQuery) : []
  const assistItems = assistKind === 'wiki' ? wikiItems : slashItems

  useEffect(() => {
    if (!assistKind) return
    const editor = editorRef.current
    if (!editor) return
    const rect = editor.getBoundingClientRect()
    setAssistPosition(getEditorAssistPosition(rect, window.innerWidth, window.innerHeight))
  }, [assistKind, editorRef])

  const notifyCursor = (editor: HTMLTextAreaElement) => {
    const prefix = editor.value.slice(0, editor.selectionStart)
    const line = prefix.split('\n').length
    const column = (prefix.length - prefix.lastIndexOf('\n'))
    setActiveLine(line)
    onCursorChange(line, column)
  }

  const detectAssist = (value: string, cursor: number) => {
    const wiki = getWikiAssistQuery(value, cursor)
    if (wiki) {
      setAssistKind('wiki')
      setAssistQuery(wiki.query)
      setActiveAssistIndex(0)
      return
    }
    const slash = getSlashAssistQuery(value, cursor)
    setAssistKind(slash ? 'slash' : null)
    setAssistQuery(slash?.query ?? '')
    setActiveAssistIndex(0)
  }

  const applyEdit = (editor: HTMLTextAreaElement, start: number, end: number, insertion: string, cursorStart: number, cursorEnd = cursorStart) => {
    applyTextareaEdit(editor, { start, end, text: insertion, selectionStart: cursorStart, selectionEnd: cursorEnd })
    onChange(editor.value)
    requestAnimationFrame(() => {
      editor.focus()
      editor.setSelectionRange(cursorStart, cursorEnd)
      notifyCursor(editor)
    })
  }

  const chooseAssist = (item: EditorAssistItem) => {
    const editor = editorRef.current
    if (!editor || !assistKind) return
    const cursor = editor.selectionStart
    const trigger = assistKind === 'wiki' ? getWikiAssistQuery(editor.value, cursor) : getSlashAssistQuery(editor.value, cursor)
    if (!trigger) { setAssistKind(null); return }
    const command = assistKind === 'slash' ? slashCommands.find((candidate) => candidate.id === item.id) : null
    const insertion = command ? resolveSlashInsertion(command) : `[[${escapeWikiLinkTitle(item.label)}]]`
    const relativeCursor = command?.cursorOffset ?? insertion.length
    const nextCursor = trigger.start + relativeCursor
    applyEdit(editor, trigger.start, cursor, insertion, nextCursor)
    setAssistKind(null)
  }

  const updateContent = (editor: HTMLTextAreaElement) => {
    onChange(editor.value)
    if (isComposingRef.current) setAssistKind(null)
    else detectAssist(editor.value, editor.selectionStart)
    notifyCursor(editor)
  }

  const handleEditorKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing || isComposingRef.current) return
    if (assistKind && assistItems.length) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        const delta = event.key === 'ArrowDown' ? 1 : -1
        setActiveAssistIndex((index) => (index + delta + assistItems.length) % assistItems.length)
        return
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault()
        const item = assistItems[activeAssistIndex]
        if (item) chooseAssist(item)
        return
      }
    }
    if (event.key === 'Escape' && assistKind) { event.preventDefault(); setAssistKind(null); return }

    const editor = event.currentTarget
    if (event.key === 'Enter') {
      const continuation = continueListOnEnter(editor.value, editor.selectionStart, editor.selectionEnd)
      if (continuation) {
        event.preventDefault()
        applyEdit(editor, continuation.start, continuation.end, continuation.text, continuation.selectionStart, continuation.selectionEnd)
        return
      }
    }
    if (event.key === 'Tab') {
      const start = editor.selectionStart
      const end = editor.selectionEnd
      const lineStart = editor.value.lastIndexOf('\n', Math.max(0, start - 1)) + 1
      const currentLineText = editor.value.slice(lineStart, editor.value.indexOf('\n', start) < 0 ? editor.value.length : editor.value.indexOf('\n', start))
      const isList = /^\s*(?:[-*+]|\d+\.|>)\s/.test(currentLineText)
      const isMultilineSelection = start !== end && editor.value.slice(start, end).includes('\n')
      if (isList || isMultilineSelection) {
        event.preventDefault()
        const edit = indentSelectedLines(editor.value, start, end, event.shiftKey)
        applyEdit(editor, edit.start, edit.end, edit.text, edit.selectionStart, edit.selectionEnd)
      }
      return
    }
    if (event.key === 'Backspace') {
      const edit = getAutoPairBackspaceEdit(editor.value, editor.selectionStart, autoPairEnabled)
      if (edit) { event.preventDefault(); applyEdit(editor, edit.start, edit.end, edit.text, edit.selectionStart); return }
    }
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const edit = getAutoPairEdit(editor.value, editor.selectionStart, editor.selectionEnd, event.key, autoPairEnabled)
      if (edit?.kind === 'move') { event.preventDefault(); editor.setSelectionRange(edit.caret, edit.caret); notifyCursor(editor); return }
      if (edit?.kind === 'replace') { event.preventDefault(); applyEdit(editor, edit.start, edit.end, edit.text, edit.selectionStart, edit.selectionEnd) }
    }
  }

  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const editor = event.currentTarget
    const text = event.clipboardData.getData('text/plain')
    if (!text || editor.selectionStart === editor.selectionEnd || !/^https?:\/\/\S+$/i.test(text.trim())) return
    event.preventDefault()
    const edit = transformSmartPaste(editor.value, editor.selectionStart, editor.selectionEnd, text)
    applyEdit(editor, edit.start, edit.end, edit.text, edit.selectionStart, edit.selectionEnd)
  }

  return <section className={`panel editor-panel ${isVisible ? 'mobile-visible' : ''}`}>
    <div className="panel-heading"><div><span className="eyebrow">01</span><h1>Markdown</h1></div><div className="panel-heading-actions"><span className="format-label">CommonMark + GFM</span><button type="button" className="editor-auto-pair-toggle" aria-pressed={autoPairEnabled} onClick={onToggleAutoPair}>Auto-pair {autoPairEnabled ? 'On' : 'Off'}</button><IconButton label="More editor options" ariaExpanded={menuOpen} ariaHasPopup="menu" buttonRef={menuButtonRef} onClick={onMoreOptions}><MoreHorizontal size={17} /></IconButton></div></div>
    <div className="toolbar">
      <ToolbarButton label="Heading 1" onClick={() => onAction('h1')}><span className="toolbar-text">H1</span></ToolbarButton>
      <ToolbarButton label="Heading 2" onClick={() => onAction('h2')}><span className="toolbar-text">H2</span></ToolbarButton>
      <span className="toolbar-separator" />
      <ToolbarButton label="Bold" onClick={() => onAction('bold')}><strong>B</strong></ToolbarButton>
      <ToolbarButton label="Italic" onClick={() => onAction('italic')}><Italic size={15} /></ToolbarButton>
      <ToolbarButton label="Strikethrough" onClick={() => onAction('strike')}><Strikethrough size={15} /></ToolbarButton>
      <ToolbarButton label="Insert link" onClick={() => onAction('link')}><Link2 size={15} /></ToolbarButton>
      <ToolbarButton label="Insert image" onClick={() => onAction('image')}><Image size={15} /></ToolbarButton>
      <span className="toolbar-separator" />
      <ToolbarButton label="Quote" onClick={() => onAction('quote')}><Quote size={15} /></ToolbarButton>
      <ToolbarButton label="Inline code" onClick={() => onAction('code')}><Code2 size={15} /></ToolbarButton>
      <ToolbarButton label="Bullet list" onClick={() => onAction('bullet')}><List size={15} /></ToolbarButton>
      <ToolbarButton label="Numbered list" onClick={() => onAction('ordered')}><ListOrdered size={15} /></ToolbarButton>
      <ToolbarButton label="Task list" onClick={() => onAction('task')}><ListChecks size={15} /></ToolbarButton>
    </div>
    <TagBar note={note} availableTags={availableTags} onSetTags={onSetTags} />
    <div className="editor-wrap"><div className="line-numbers" aria-hidden="true">{content.split('\n').map((_, index) => <span className={index + 1 === activeLine ? 'is-active' : ''} key={index}>{index + 1}</span>)}</div><textarea ref={editorRef} value={content} onChange={(event) => updateContent(event.currentTarget)} onKeyDown={handleEditorKeyDown} onKeyUp={(event) => notifyCursor(event.currentTarget)} onClick={(event) => notifyCursor(event.currentTarget)} onSelect={(event) => notifyCursor(event.currentTarget)} onPaste={handlePaste} onCompositionStart={() => { isComposingRef.current = true }} onCompositionEnd={(event) => { isComposingRef.current = false; updateContent(event.currentTarget) }} spellCheck="false" placeholder="Start writing Markdown..." aria-label="Markdown editor" aria-autocomplete="list" aria-controls={assistKind ? assistListId : undefined} aria-activedescendant={assistKind && assistItems[activeAssistIndex] ? `${assistListId}-option-${activeAssistIndex}` : undefined} />{assistKind && <EditorAssistMenu id={assistListId} label={assistKind === 'wiki' ? 'Note link suggestions' : 'Slash commands'} items={assistItems} activeIndex={activeAssistIndex} style={{ position: 'fixed', left: assistPosition.left, top: assistPosition.top, maxHeight: assistPosition.maxHeight }} onChoose={chooseAssist} onHover={setActiveAssistIndex} />}</div>
    <div className="editor-footer"><span><span className="keyboard-key">⌘</span><span className="keyboard-key">S</span> to save</span><button type="button" onClick={onFocusMode}>Focus mode <span>↗</span></button></div>
  </section>
}
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { ChevronDown, ChevronRight, FilePlus2, Hash, MoreHorizontal, PanelLeftClose, Search, X } from 'lucide-react'
import type { Note } from '../../types/editor'
import type { TagCount } from '../../utils/tags'
import { filterNotesByTags, getAllTags } from '../../utils/tags'
import { IconButton, MenuItem, Modal } from '../common/Controls'
import './sidebar.css'

interface SidebarProps {
  notes: Note[]
  tagCounts: TagCount[]
  activeTagFilters: string[]
  activeId: string | null
  collapsed: boolean
  mobileOpen: boolean
  onCreate: () => void
  onSelect: (id: string) => void
  onRename: (id: string, title: string) => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
  onCloseMobile: () => void
  onToggleTag: (tag: string) => void
  onClearTagFilters: () => void
  onOpenSearch: () => void
}

function relativeTime(timestamp: number) {
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000))
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(timestamp)
}

export function Sidebar(props: SidebarProps) {
  const [menuNoteId, setMenuNoteId] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deleteNote, setDeleteNote] = useState<Note | null>(null)
  const renameHandledRef = useRef(false)
  const renameInputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLElement>(null)
  const [tagsExpanded, setTagsExpanded] = useState(true)
  const sortedNotes = filterNotesByTags(props.notes, props.activeTagFilters).sort((a, b) => b.updatedAt - a.updatedAt)
  const noteTags = new Map(props.notes.map((note) => [note.id, getAllTags(note)]))

  useEffect(() => {
    if (renamingId) {
      renameInputRef.current?.focus()
      renameInputRef.current?.select()
    }
  }, [renamingId])

  const startRename = (note: Note) => {
    renameHandledRef.current = false
    setRenamingId(note.id)
    setRenameValue(note.title)
    setMenuNoteId(null)
  }

  const commitRename = (note: Note) => {
    if (renameHandledRef.current) return
    renameHandledRef.current = true
    props.onRename(note.id, renameValue)
    setRenamingId(null)
  }

  const handleListKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.target instanceof HTMLInputElement) return
    const target = event.target instanceof HTMLElement ? event.target : null
    const row = target?.closest<HTMLElement>('[data-note-id]')
    const currentId = row?.dataset.noteId
    if (!currentId) return

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const index = sortedNotes.findIndex((note) => note.id === currentId)
      const nextIndex = (index + (event.key === 'ArrowDown' ? 1 : -1) + sortedNotes.length) % sortedNotes.length
      const nextNote = sortedNotes[nextIndex]
      if (nextNote) {
        props.onSelect(nextNote.id)
        listRef.current?.querySelector<HTMLButtonElement>(`[data-select-note="${CSS.escape(nextNote.id)}"]`)?.focus()
      }
      return
    }
    if (event.key === 'F2') {
      event.preventDefault()
      const note = props.notes.find((item) => item.id === currentId)
      if (note) startRename(note)
    }
    if (event.key === 'Delete') {
      event.preventDefault()
      setDeleteNote(props.notes.find((item) => item.id === currentId) ?? null)
    }
  }

  return <>
    {props.mobileOpen && <button type="button" className="sidebar-backdrop" aria-label="Close notes sidebar" onClick={props.onCloseMobile} />}
    <aside className={`sidebar ${props.collapsed ? 'is-collapsed' : ''} ${props.mobileOpen ? 'is-open' : ''}`} aria-label="Notes library">
      <div className="sidebar-header"><div><span className="sidebar-eyebrow">LIBRARY</span><h2>Notes</h2></div><div className="sidebar-header-actions"><IconButton label="New note" onClick={props.onCreate}><FilePlus2 size={16} /></IconButton>{props.mobileOpen && <IconButton label="Close sidebar" onClick={props.onCloseMobile}><X size={16} /></IconButton>}</div></div>
      <div className="sidebar-search-wrap"><Search size={15} /><input aria-label="Search notes" type="search" placeholder="Search notes..." readOnly onClick={props.onOpenSearch} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); props.onOpenSearch() } }} /><kbd>Ctrl K</kbd></div>
      {props.activeTagFilters.length > 0 && <div className="sidebar-active-filters"><div className="sidebar-filter-heading"><span>FILTERED BY</span><button type="button" onClick={props.onClearTagFilters}>Clear</button></div><div className="sidebar-filter-chips">{props.activeTagFilters.map((tag) => <button type="button" className="sidebar-filter-chip" key={tag} onClick={() => props.onToggleTag(tag)}><Hash size={11} />{tag}<X size={11} /></button>)}</div></div>}
      <section className="sidebar-tag-section" aria-label="Tag filters">
        <button type="button" className="sidebar-section-toggle" aria-expanded={tagsExpanded} onClick={() => setTagsExpanded((expanded) => !expanded)}>{tagsExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}<span>Tags</span><span className="sidebar-section-count">{props.tagCounts.length}</span></button>
        {tagsExpanded && <div className="sidebar-tag-list">{props.tagCounts.map(({ tag, count }) => <button type="button" className={`sidebar-tag-filter ${props.activeTagFilters.includes(tag) ? 'is-active' : ''}`} aria-pressed={props.activeTagFilters.includes(tag)} key={tag} onClick={() => props.onToggleTag(tag)}><span><Hash size={12} />{tag}</span><span className="sidebar-tag-count">{count}</span></button>)}</div>}
      </section>
      <nav className="sidebar-note-list" aria-label="Your notes" ref={listRef} onKeyDown={handleListKeyDown}>
        {sortedNotes.map((note) => <div className={`sidebar-note ${note.id === props.activeId ? 'is-active' : ''} ${menuNoteId === note.id ? 'has-open-menu' : ''}`} data-note-id={note.id} key={note.id}>
          {renamingId === note.id ? <input ref={renameInputRef} className="sidebar-rename-input" aria-label={`Rename ${note.title}`} value={renameValue} onChange={(event) => setRenameValue(event.target.value)} onBlur={() => commitRename(note)} onKeyDown={(event) => {
            if (event.key === 'Enter') { event.preventDefault(); commitRename(note) }
            if (event.key === 'Escape') { event.preventDefault(); renameHandledRef.current = true; setRenamingId(null) }
            event.stopPropagation()
          }} /> : <button type="button" className="sidebar-note-select" data-select-note={note.id} aria-current={note.id === props.activeId ? 'page' : undefined} onClick={() => { props.onSelect(note.id); props.onCloseMobile() }}>
            <span className="sidebar-note-title-row"><span className="sidebar-note-title">{note.title}</span>{note.content !== note.savedContent && <span className="sidebar-unsaved-dot" aria-label="Unsaved changes" title="Unsaved changes" />}</span>
            <span className="sidebar-note-time">{relativeTime(note.updatedAt)}</span>
            {(noteTags.get(note.id)?.length ?? 0) > 0 && <span className="sidebar-note-tags" aria-label={`Tags: ${(noteTags.get(note.id) ?? []).join(', ')}`}>{(noteTags.get(note.id) ?? []).slice(0, 3).map((tag) => <span className="sidebar-note-tag" key={tag}>{tag}</span>)}{(noteTags.get(note.id)?.length ?? 0) > 3 && <span className="sidebar-note-tag-overflow">+{(noteTags.get(note.id)?.length ?? 0) - 3}</span>}</span>}
          </button>}
          <div className="sidebar-note-actions"><IconButton label={`Options for ${note.title}`} active={menuNoteId === note.id} onClick={() => setMenuNoteId((current) => current === note.id ? null : note.id)}><MoreHorizontal size={16} /></IconButton>{menuNoteId === note.id && <div className="sidebar-note-menu" role="menu">
            <MenuItem label="Rename" role="menuitem" onClick={() => startRename(note)}><span className="sidebar-menu-letter">R</span></MenuItem>
            <MenuItem label="Duplicate" role="menuitem" onClick={() => { props.onDuplicate(note.id); setMenuNoteId(null); props.onCloseMobile() }}><span className="sidebar-menu-letter">D</span></MenuItem>
            <MenuItem label="Delete" role="menuitem" onClick={() => { setDeleteNote(note); setMenuNoteId(null) }}><span className="sidebar-menu-letter">×</span></MenuItem>
          </div>}</div>
        </div>)}
      </nav>
      <div className="sidebar-footer"><PanelLeftClose size={14} /><span>{props.activeTagFilters.length ? `${sortedNotes.length} of ${props.notes.length} notes` : `${props.notes.length} ${props.notes.length === 1 ? 'note' : 'notes'}`}</span></div>
    </aside>
    {deleteNote && <Modal title="Delete note?" onClose={() => setDeleteNote(null)}><p className="modal-copy">“{deleteNote.title}” will be permanently deleted from this browser.</p><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setDeleteNote(null)}>Cancel</button><button type="button" className="primary-button" onClick={() => { props.onDelete(deleteNote.id); setDeleteNote(null); props.onCloseMobile() }}>Delete note</button></div></Modal>}
  </>
}

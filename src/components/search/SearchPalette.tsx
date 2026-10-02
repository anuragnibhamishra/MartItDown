import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, Clock3, FilePlus2, Search, Tag, X } from 'lucide-react'
import type { Note } from '../../types/editor'
import { getAllTags } from '../../utils/tags'
import type { SearchOptions, SearchRange, SearchResult } from '../../services/searchIndex'

interface SearchPaletteProps {
  notes: Note[]
  search: (query: string, options?: SearchOptions) => SearchResult[]
  onClose: () => void
  onOpenNote: (id: string, focusMode: boolean) => void
  onCreateNote: (title: string) => void
}

function highlightRanges(text: string, ranges: SearchRange[]): ReactNode[] {
  const sortedRanges = [...ranges].sort((left, right) => left.start - right.start)
  const nodes: ReactNode[] = []
  let cursor = 0
  for (const [index, range] of sortedRanges.entries()) {
    const start = Math.max(cursor, range.start)
    const end = Math.min(text.length, range.end)
    if (start > cursor) nodes.push(text.slice(cursor, start))
    if (end > start) nodes.push(<mark key={`${start}-${index}`}>{text.slice(start, end)}</mark>)
    cursor = Math.max(cursor, end)
  }
  if (cursor < text.length) nodes.push(text.slice(cursor))
  return nodes
}

function relativeTime(timestamp: number): string {
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000))
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(timestamp)
}

function matchRanges(result: SearchResult, field: 'title' | 'body'): SearchRange[] {
  return result.matches.find((match) => match.field === field)?.ranges ?? []
}

export function SearchPalette({ notes, search, onClose, onOpenNote, onCreateNote }: SearchPaletteProps) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const dialogRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const listId = useId()

  useEffect(() => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    inputRef.current?.focus()
    return () => previousFocusRef.current?.focus()
  }, [])

  const results = search(query, { limit: 50 })
  const notesById = new Map(notes.map((note) => [note.id, note]))
  const visibleResults = results.flatMap((result) => {
    const note = notesById.get(result.noteId)
    return note ? [{ result, note }] : []
  })
  const activeResultId = visibleResults[activeIndex]?.note.id
  const activeDescendant = activeResultId ? `${listId}-result-${encodeURIComponent(activeResultId)}` : undefined

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowDown' && visibleResults.length) {
      event.preventDefault()
      setActiveIndex((index) => (index + 1) % visibleResults.length)
    } else if (event.key === 'ArrowUp' && visibleResults.length) {
      event.preventDefault()
      setActiveIndex((index) => (index - 1 + visibleResults.length) % visibleResults.length)
    } else if (event.key === 'Enter' && visibleResults[activeIndex]) {
      event.preventDefault()
      onOpenNote(visibleResults[activeIndex].note.id, event.ctrlKey || event.metaKey)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    } else if (event.key === 'Tab') {
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('input, button:not([disabled]), [tabindex]:not([tabindex="-1"])')
      if (!focusable?.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
  }

  useEffect(() => {
    const noteId = activeResultId
    if (!noteId) return
    dialogRef.current?.querySelector<HTMLElement>(`[data-result-id="${CSS.escape(noteId)}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [activeResultId])

  const createTitle = query.replace(/(?:^|\s)tag:\S+/gi, '').replace(/(^|\s)-\S+/g, '$1').replace(/"/g, '').trim() || query.trim()

  return <div className="search-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <div className="search-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={`${listId}-title`} onKeyDown={handleKeyDown}>
      <div className="search-dialog-header">
        <Search size={18} aria-hidden="true" />
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-label="Search notes"
          aria-controls={`${listId}-options`}
          aria-expanded={visibleResults.length > 0}
          aria-activedescendant={activeDescendant}
          value={query}
          onChange={(event) => { setQuery(event.target.value); setActiveIndex(0) }}
          placeholder="Search notes, tags, and content..."
        />
        <kbd>ESC</kbd>
        <button type="button" className="search-close" aria-label="Close search" onClick={onClose}><X size={17} /></button>
      </div>
      <div className="search-dialog-body">
        <div className="search-section-label" id={`${listId}-title`}>{query.trim() ? 'RESULTS' : 'RECENT NOTES'}<span>{visibleResults.length}</span></div>
        {visibleResults.length > 0 ? <div className="search-results" id={`${listId}-options`} role="listbox" aria-label="Search results">
          {visibleResults.map(({ result, note }, index) => {
            const tags = getAllTags(note).slice(0, 4)
            return <button
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              className={`search-result ${index === activeIndex ? 'is-active' : ''}`}
              id={`${listId}-result-${encodeURIComponent(note.id)}`}
              data-result-id={note.id}
              key={note.id}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => onOpenNote(note.id, false)}
            >
              <span className="search-result-main">
                <span className="search-result-title">{highlightRanges(note.title, matchRanges(result, 'title'))}</span>
                <span className="search-result-snippet">{highlightRanges(result.snippet || 'No matching text in the note body.', matchRanges(result, 'body'))}</span>
                {tags.length > 0 && <span className="search-result-tags">{tags.map((tag) => <span className="search-result-tag" key={tag}><Tag size={10} />{tag}</span>)}</span>}
              </span>
              <span className="search-result-time"><Clock3 size={12} />{relativeTime(note.updatedAt)}</span>
            </button>
          })}
        </div> : query.trim() ? <div className="search-empty"><p>No notes found.</p><button type="button" className="search-create-button" onClick={() => onCreateNote(createTitle || 'Untitled')}><FilePlus2 size={15} />Create “{createTitle || 'Untitled'}”</button></div> : <div className="search-empty"><p>Your recent notes will appear here.</p></div>}
      </div>
      <div className="search-dialog-footer"><span><kbd><ArrowUp size={10} /></kbd><kbd><ArrowDown size={10} /></kbd> Navigate</span><span><kbd>ENTER</kbd> Open</span><span><kbd>CTRL</kbd><kbd>ENTER</kbd> Focus mode</span></div>
    </div>
  </div>
}
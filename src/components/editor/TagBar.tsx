import { useId, useState, type KeyboardEvent } from 'react'
import { Hash, X } from 'lucide-react'
import type { Note } from '../../types/editor'
import { extractInlineTags, normalizeTag } from '../../utils/tags'

interface TagBarProps {
  note: Note | null
  availableTags: string[]
  onSetTags: (id: string, tags: readonly string[]) => void
}

export function TagBar({ note, availableTags, onSetTags }: TagBarProps) {
  const [value, setValue] = useState('')
  const [activeSuggestion, setActiveSuggestion] = useState(0)
  const listId = useId()
  if (!note) return null

  const manualTags = [...new Set(note.tags.map(normalizeTag).filter(Boolean))]
  const manualTagSet = new Set(manualTags)
  const inlineTags = extractInlineTags(note.content).filter((tag) => !manualTagSet.has(tag))
  const existingTags = new Set([...manualTags, ...inlineTags])
  const query = normalizeTag(value)
  const suggestions = query
    ? availableTags.filter((tag) => tag.startsWith(query) && !existingTags.has(tag)).slice(0, 6)
    : []

  const commitTag = (raw: string) => {
    const tag = normalizeTag(raw)
    if (!tag || existingTags.has(tag)) {
      setValue('')
      return
    }
    onSetTags(note.id, [...manualTags, tag])
    setValue('')
    setActiveSuggestion(0)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' && suggestions.length) {
      event.preventDefault()
      setActiveSuggestion((index) => (index + 1) % suggestions.length)
    } else if (event.key === 'ArrowUp' && suggestions.length) {
      event.preventDefault()
      setActiveSuggestion((index) => (index - 1 + suggestions.length) % suggestions.length)
    } else if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      commitTag(suggestions[activeSuggestion] ?? value)
    } else if (event.key === 'Backspace' && !value && manualTags.length) {
      onSetTags(note.id, manualTags.slice(0, -1))
    } else if (event.key === 'Escape') {
      setValue('')
    }
  }

  return <div className="tag-bar" aria-label="Note tags">
    <div className="tag-bar-label"><Hash size={13} /><span>Tags</span></div>
    <div className="tag-bar-content">
      {manualTags.map((tag) => <span className="tag-chip tag-chip-manual" key={`manual-${tag}`}>
        <span>{tag}</span>
        <button type="button" aria-label={`Remove tag ${tag}`} onClick={() => onSetTags(note.id, manualTags.filter((item) => item !== tag))}><X size={12} /></button>
      </span>)}
      {inlineTags.map((tag) => <span className="tag-chip tag-chip-inline" key={`inline-${tag}`}><Hash size={11} /><span>{tag}</span></span>)}
      <div className="tag-input-wrap">
        <input
          aria-label="Add a tag"
          aria-autocomplete="list"
          aria-controls={suggestions.length ? listId : undefined}
          aria-activedescendant={suggestions.length ? `${listId}-option-${activeSuggestion}` : undefined}
          value={value}
          placeholder={manualTags.length || inlineTags.length ? 'Add tag' : 'Add a tag'}
          onChange={(event) => { setValue(event.target.value); setActiveSuggestion(0) }}
          onKeyDown={handleKeyDown}
          onBlur={() => window.setTimeout(() => setActiveSuggestion(0), 100)}
        />
        {suggestions.length > 0 && <div className="tag-suggestions" id={listId} role="listbox" aria-label="Tag suggestions">
          {suggestions.map((tag, index) => <button
            type="button"
            role="option"
            aria-selected={index === activeSuggestion}
            id={`${listId}-option-${index}`}
            className={index === activeSuggestion ? 'is-active' : ''}
            key={tag}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => commitTag(tag)}
          >{tag}</button>)}
        </div>}
      </div>
    </div>
  </div>
}
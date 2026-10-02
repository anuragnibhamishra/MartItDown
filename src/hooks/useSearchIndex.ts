import { useEffect, useRef, useState } from 'react'
import type { Note } from '../types/editor'
import { createSearchIndex, type SearchOptions, type SearchResult } from '../services/searchIndex'

const indexUpdateDelay = 250

export function useSearchIndex(notes: readonly Note[]) {
  const [index] = useState(() => createSearchIndex(notes))
  const indexedNotesRef = useRef(new Map(notes.map((note) => [note.id, note])))
  const pendingChangesRef = useRef(new Map<string, Note | null>())
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    const currentNotes = new Map(notes.map((note) => [note.id, note]))
    for (const [id, previous] of indexedNotesRef.current) {
      if (!currentNotes.has(id)) pendingChangesRef.current.set(id, null)
      else if (currentNotes.get(id) !== previous) pendingChangesRef.current.set(id, currentNotes.get(id) ?? null)
    }
    for (const [id, note] of currentNotes) {
      if (!indexedNotesRef.current.has(id)) pendingChangesRef.current.set(id, note)
    }
    indexedNotesRef.current = currentNotes

    if (pendingChangesRef.current.size === 0) return
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      for (const [id, note] of pendingChangesRef.current) {
        if (note) index.upsert(note)
        else index.remove(id)
      }
      pendingChangesRef.current.clear()
      timerRef.current = null
      setRevision((value) => value + 1)
    }, indexUpdateDelay)

    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    }
  }, [notes, index])

  useEffect(() => () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
  }, [])

  const search = (query: string, options?: SearchOptions): SearchResult[] => index.search(query, options)
  return { search, revision }
}
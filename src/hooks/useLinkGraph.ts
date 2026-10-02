import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { Note } from '../types/editor'
import { createLinkGraph } from '../services/linkGraph'

export function useLinkGraph(notes: readonly Note[]) {
  const [graph] = useState(() => createLinkGraph(notes))
  const indexedNotesRef = useRef(new Map(notes.map((note) => [note.id, note])))
  const revision = useSyncExternalStore(graph.subscribe, graph.getVersion, graph.getVersion)

  useEffect(() => {
    const currentNotes = new Map(notes.map((note) => [note.id, note]))
    for (const [id, previous] of indexedNotesRef.current) {
      if (!currentNotes.has(id)) {
        graph.remove(id)
      } else if (currentNotes.get(id) !== previous) {
        const current = currentNotes.get(id)
        if (current) graph.upsert(current)
      }
    }
    for (const [id, note] of currentNotes) {
      if (!indexedNotesRef.current.has(id)) {
        graph.upsert(note)
      }
    }
    indexedNotesRef.current = currentNotes
  }, [notes, graph])

  return { graph, revision }
}
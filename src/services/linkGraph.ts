import type { Note } from '../types/editor'
import { extractLinkTargets, findUnlinkedMentions, normalizeLinkTitle } from '../utils/wikiLinks'

export interface OutgoingLink {
  noteId: string
  title: string
  count: number
}

export interface UnlinkedMention {
  noteId: string
  title: string
  count: number
  firstMention: { start: number; end: number; text: string }
}

export function createLinkGraph(initialNotes: readonly Note[]) {
  const notesById = new Map<string, Note>()
  const idsByTitle = new Map<string, Set<string>>()
  const targetsBySource = new Map<string, Map<string, { title: string; count: number }>>()
  const sourcesByTargetTitle = new Map<string, Set<string>>()
  const resolvedTitleBySource = new Map<string, Map<string, string | null>>()
  const targetCountsBySource = new Map<string, Map<string, number>>()
  const backlinksByTarget = new Map<string, Set<string>>()
  const listeners = new Set<() => void>()
  let graphVersion = 0

  const publish = () => {
    graphVersion += 1
    for (const listener of listeners) listener()
  }

  const winnerForTitle = (title: string): Note | null => {
    const ids = idsByTitle.get(title)
    if (!ids) return null
    let winner: Note | null = null
    for (const id of ids) {
      const candidate = notesById.get(id)
      if (candidate && (!winner || candidate.updatedAt > winner.updatedAt)) winner = candidate
    }
    return winner
  }

  const decrementBacklink = (sourceId: string, targetId: string) => {
    const counts = targetCountsBySource.get(sourceId)
    const nextCount = (counts?.get(targetId) ?? 0) - 1
    if (nextCount <= 0) {
      counts?.delete(targetId)
      backlinksByTarget.get(targetId)?.delete(sourceId)
      if (backlinksByTarget.get(targetId)?.size === 0) backlinksByTarget.delete(targetId)
    } else counts?.set(targetId, nextCount)
    if (counts?.size === 0) targetCountsBySource.delete(sourceId)
  }

  const incrementBacklink = (sourceId: string, targetId: string) => {
    const counts = targetCountsBySource.get(sourceId) ?? new Map<string, number>()
    counts.set(targetId, (counts.get(targetId) ?? 0) + 1)
    targetCountsBySource.set(sourceId, counts)
    const sources = backlinksByTarget.get(targetId) ?? new Set<string>()
    sources.add(sourceId)
    backlinksByTarget.set(targetId, sources)
  }

  const refreshTitle = (title: string) => {
    const sources = sourcesByTargetTitle.get(title)
    if (!sources) return
    const resolvedId = winnerForTitle(title)?.id ?? null
    for (const sourceId of sources) {
      const sourceTitles = resolvedTitleBySource.get(sourceId) ?? new Map<string, string | null>()
      const previousId = sourceTitles.get(title) ?? null
      if (previousId === resolvedId) continue
      if (previousId) decrementBacklink(sourceId, previousId)
      if (resolvedId) incrementBacklink(sourceId, resolvedId)
      sourceTitles.set(title, resolvedId)
      resolvedTitleBySource.set(sourceId, sourceTitles)
    }
  }

  const removeOutgoing = (sourceId: string) => {
    const targets = targetsBySource.get(sourceId)
    if (!targets) return
    for (const title of targets.keys()) {
      const sources = sourcesByTargetTitle.get(title)
      sources?.delete(sourceId)
      if (sources?.size === 0) sourcesByTargetTitle.delete(title)
      const targetId = resolvedTitleBySource.get(sourceId)?.get(title)
      if (targetId) decrementBacklink(sourceId, targetId)
    }
    targetsBySource.delete(sourceId)
    resolvedTitleBySource.delete(sourceId)
  }

  const addOutgoing = (note: Note) => {
    const targets = new Map<string, { title: string; count: number }>()
    for (const link of extractLinkTargets(note)) {
      const normalized = normalizeLinkTitle(link.title)
      const entry = targets.get(normalized) ?? { title: link.title, count: 0 }
      entry.count += 1
      targets.set(normalized, entry)
    }
    targetsBySource.set(note.id, targets)
    const sourceTitles = new Map<string, string | null>()
    for (const title of targets.keys()) {
      const sources = sourcesByTargetTitle.get(title) ?? new Set<string>()
      sources.add(note.id)
      sourcesByTargetTitle.set(title, sources)
      sourceTitles.set(title, null)
    }
    resolvedTitleBySource.set(note.id, sourceTitles)
  }

  const upsert = (note: Note) => {
    const previous = notesById.get(note.id)
    const previousTitle = previous ? normalizeLinkTitle(previous.title) : null
    removeOutgoing(note.id)
    if (previousTitle) {
      const ids = idsByTitle.get(previousTitle)
      ids?.delete(note.id)
      if (ids?.size === 0) idsByTitle.delete(previousTitle)
    }
    notesById.set(note.id, note)
    const nextTitle = normalizeLinkTitle(note.title)
    const titleIds = idsByTitle.get(nextTitle) ?? new Set<string>()
    titleIds.add(note.id)
    idsByTitle.set(nextTitle, titleIds)
    addOutgoing(note)

    const targetTitles = [...(targetsBySource.get(note.id)?.keys() ?? [])]
    const affectedTitles = new Set([...(previousTitle ? [previousTitle] : []), nextTitle, ...targetTitles])
    for (const title of affectedTitles) refreshTitle(title)
    publish()
  }

  const remove = (noteId: string) => {
    const previous = notesById.get(noteId)
    if (!previous) return
    const title = normalizeLinkTitle(previous.title)
    removeOutgoing(noteId)
    const ids = idsByTitle.get(title)
    ids?.delete(noteId)
    if (ids?.size === 0) idsByTitle.delete(title)
    notesById.delete(noteId)
    refreshTitle(title)
    publish()
  }

  const backlinks = (noteId: string): Note[] => [...(backlinksByTarget.get(noteId) ?? [])]
    .map((sourceId) => notesById.get(sourceId))
    .filter((note): note is Note => note !== undefined)
    .sort((left, right) => right.updatedAt - left.updatedAt)

  const outgoing = (noteId: string): OutgoingLink[] => [...(targetsBySource.get(noteId) ?? [])]
    .flatMap(([title, entry]) => {
      const targetId = resolvedTitleBySource.get(noteId)?.get(title)
      return targetId ? [{ noteId: targetId, title: entry.title, count: entry.count }] : []
    })

  const outgoingCount = (noteId: string): number => [...(targetsBySource.get(noteId)?.values() ?? [])]
    .reduce((total, target) => total + target.count, 0)

  const unlinkedMentions = (noteId: string): UnlinkedMention[] => {
    const target = notesById.get(noteId)
    if (!target) return []
    return [...notesById.values()].flatMap((source) => {
      if (source.id === noteId) return []
      const mentions = findUnlinkedMentions(source.content, target.title)
      return mentions.length ? [{ noteId: source.id, title: source.title, count: mentions.length, firstMention: mentions[0] }] : []
    }).sort((left, right) => right.count - left.count || left.title.localeCompare(right.title))
  }

  const subscribe = (listener: () => void) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }
  const getVersion = () => graphVersion

  for (const note of initialNotes) upsert(note)
  return { upsert, remove, backlinks, outgoing, outgoingCount, unlinkedMentions, subscribe, getVersion }
}
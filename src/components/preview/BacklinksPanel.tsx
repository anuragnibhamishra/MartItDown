import type { ReactNode } from 'react'
import { ArrowUpRight, Link2, Unlink } from 'lucide-react'
import type { Note } from '../../types/editor'
import type { createLinkGraph } from '../../services/linkGraph'
import { extractLinkTargets, normalizeLinkTitle } from '../../utils/wikiLinks'

type LinkGraph = ReturnType<typeof createLinkGraph>

interface BacklinksPanelProps {
  note: Note | null
  graph: LinkGraph
  onSelectNote: (id: string) => void
  onLinkMention: (sourceId: string) => void
}

function highlightLink(content: string, start: number, end: number): ReactNode[] {
  const from = Math.max(0, start - 55)
  const to = Math.min(content.length, end + 55)
  const parts: ReactNode[] = []
  if (from > 0) parts.push('...')
  parts.push(content.slice(from, start))
  parts.push(<mark key={`${start}-${end}`}>{content.slice(start, end)}</mark>)
  parts.push(content.slice(end, to))
  if (to < content.length) parts.push('...')
  return parts
}

export function BacklinksPanel({ note, graph, onSelectNote, onLinkMention }: BacklinksPanelProps) {
  if (!note) return null
  const backlinks = graph.backlinks(note.id)
  const mentions = graph.unlinkedMentions(note.id)

  return <section className="backlinks-panel" aria-label="Note links">
    <details open>
      <summary><Link2 size={14} />Links <span>{graph.outgoingCount(note.id)} outgoing · {backlinks.length} backlinks</span></summary>
      {backlinks.length ? backlinks.map((source) => {
        const link = extractLinkTargets(source).find((item) => normalizeLinkTitle(item.title) === normalizeLinkTitle(note.title))
        return <button type="button" className="backlink-entry" key={source.id} onClick={() => onSelectNote(source.id)}>
          <strong>{source.title}<ArrowUpRight size={12} /></strong>
          {link ? <span>{highlightLink(source.content, link.start, link.end)}</span> : <span>Links to this note</span>}
        </button>
      }) : <p className="backlink-empty">No notes link here yet.</p>}
    </details>
    <details>
      <summary><Unlink size={14} />Unlinked mentions <span>{mentions.length}</span></summary>
      {mentions.length ? mentions.map((mention) => <div className="backlink-mention" key={mention.noteId}>
        <span>{mention.title} · {mention.count} mention{mention.count === 1 ? '' : 's'}</span>
        <button type="button" aria-label={`Link first mention in ${mention.title}`} onClick={() => onLinkMention(mention.noteId)}>Link it</button>
      </div>) : <p className="backlink-empty">No unlinked mentions.</p>}
    </details>
  </section>
}
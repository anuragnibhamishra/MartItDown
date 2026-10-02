import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Check, ChevronLeft, Clipboard, Clock3, RotateCcw, Save, Trash2, X } from 'lucide-react'
import type { NoteVersion } from '../../types/editor'
import { computeLineDiff, type DiffLine } from '../../utils/diff'
import { Modal } from '../common/Controls'

interface HistoryPanelProps {
  noteId: string
  title: string
  content: string
  versions: NoteVersion[]
  onClose: () => void
  onSaveVersion: (noteId: string, label: string) => boolean
  onUpdateLabel: (noteId: string, versionId: string, label: string) => boolean
  onDeleteVersion: (noteId: string, versionId: string) => boolean
  onRestore: (version: NoteVersion) => boolean
  onRestoreSnapshot: (noteId: string, title: string, content: string) => boolean
  onNotify: (message: string, tone?: 'success' | 'error' | 'info') => void
}

const largeDiffCharacterLimit = 50_000
const expandedDiffCellLimit = 6_000_000

function formatAbsoluteTime(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(timestamp)
}

function relativeTime(timestamp: number): string {
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000))
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604_800) return `${Math.floor(seconds / 86_400)}d ago`
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(timestamp)
}

function sizeDelta(currentLength: number, comparedLength: number): string {
  const delta = currentLength - comparedLength
  return `${delta > 0 ? '+' : ''}${delta} chars`
}

function DiffRows({ lines }: { lines: DiffLine[] }) {
  return <div className="history-diff" role="list" aria-label="Version diff">
    {lines.map((line, index) => <div className={`history-diff-line is-${line.kind}`} role="listitem" key={`${line.kind}-${line.oldLine}-${line.newLine}-${index}`}>
      <span className="history-diff-old-line">{line.oldLine ?? ''}</span>
      <span className="history-diff-new-line">{line.newLine ?? ''}</span>
      <span className="history-diff-marker" aria-hidden="true">{line.kind === 'added' ? '+' : line.kind === 'removed' ? '-' : line.kind === 'collapsed' ? '…' : ' '}</span>
      <code>{line.text || ' '}</code>
    </div>)}
  </div>
}

export function HistoryPanel(props: HistoryPanelProps) {
  const [selectedId, setSelectedId] = useState(props.versions[0]?.id ?? '')
  const [comparePrevious, setComparePrevious] = useState(false)
  const [computeAnyway, setComputeAnyway] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [editingLabel, setEditingLabel] = useState(false)
  const [labelDraft, setLabelDraft] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<NoteVersion | null>(null)
  const [undoSnapshot, setUndoSnapshot] = useState<{ title: string; content: string } | null>(null)
  const panelRef = useRef<HTMLElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    panelRef.current?.querySelector<HTMLElement>('button, input')?.focus()
    return () => previousFocusRef.current?.focus()
  }, [])

  const requestedIndex = props.versions.findIndex((version) => version.id === selectedId)
  const selectedIndex = requestedIndex >= 0 ? requestedIndex : props.versions.length ? 0 : -1
  const selectedVersionId = props.versions[selectedIndex]?.id ?? ''
  const selected = selectedIndex >= 0 ? props.versions[selectedIndex] : null
  const olderVersion = selectedIndex >= 0 ? props.versions[selectedIndex + 1] ?? null : null
  const comparisonContent = comparePrevious && olderVersion ? olderVersion.content : props.content
  const tooLarge = Boolean(selected && !computeAnyway
    && (selected.content.length + comparisonContent.length > largeDiffCharacterLimit))
  const diff = useMemo(() => {
    if (!selected || tooLarge) return null
    return computeLineDiff(selected.content, comparisonContent, { maxCells: computeAnyway ? expandedDiffCellLimit : undefined })
  }, [selected, comparisonContent, tooLarge, computeAnyway])

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      props.onClose()
    }
    if (event.key !== 'Tab') return
    const focusable = panelRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])')
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

  const saveLabel = () => {
    if (!selected || !props.onUpdateLabel(props.noteId, selected.id, labelDraft)) return
    setEditingLabel(false)
    props.onNotify(labelDraft.trim() ? 'Version label updated' : 'Version label removed')
  }

  const saveManualVersion = () => {
    if (!newLabel.trim()) return
    if (props.onSaveVersion(props.noteId, newLabel)) {
      setNewLabel('')
      props.onNotify('Version saved')
    }
  }

  const restore = (version: NoteVersion) => {
    if (!props.onRestore(version)) return
    setUndoSnapshot({ title: props.title, content: props.content })
    props.onNotify('Version restored')
  }

  const copyVersion = async (version: NoteVersion) => {
    try {
      await navigator.clipboard.writeText(version.content)
      props.onNotify('Version copied')
    } catch {
      props.onNotify('Unable to copy version', 'error')
    }
  }

  return <div className="history-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && props.onClose()}>
    <aside className="history-panel" ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="history-title" onKeyDown={handleKeyDown}>
      <header className="history-header">
        <div className="history-header-copy"><span className="history-eyebrow">VERSION HISTORY</span><h2 id="history-title">{props.title}</h2></div>
        <button type="button" className="history-close" aria-label="Close version history" onClick={props.onClose}><X size={18} /></button>
      </header>
      <div className="history-save-row">
        <input aria-label="Version label" value={newLabel} onChange={(event) => setNewLabel(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && saveManualVersion()} placeholder="Label this snapshot" />
        <button type="button" disabled={!newLabel.trim()} onClick={saveManualVersion}><Save size={14} />Save version</button>
      </div>
      <div className="history-layout">
        <nav className="history-version-list" aria-label="Saved versions">
          {props.versions.length ? props.versions.map((version, index) => {
            const previous = props.versions[index + 1]
            return <button type="button" className={`history-version ${selectedVersionId === version.id ? 'is-active' : ''}`} aria-label={`Saved ${version.reason} version`} aria-pressed={selectedVersionId === version.id} key={version.id} onClick={() => { setSelectedId(version.id); setComputeAnyway(false) }}>
              <span className="history-version-top"><span aria-hidden="true"><strong>{version.label || version.reason}</strong></span><span className={`history-reason reason-${version.reason}`}>{version.reason}</span></span>
              <span className="history-version-time"><Clock3 size={12} /><time dateTime={new Date(version.createdAt).toISOString()} title={formatAbsoluteTime(version.createdAt)}>{relativeTime(version.createdAt)}</time></span>
              <span className="history-version-delta">{sizeDelta(version.content.length, previous?.content.length ?? props.content.length)}</span>
            </button>
          }) : <p className="history-empty">No versions yet. Save a labeled snapshot or wait for an idle snapshot.</p>}
        </nav>
        <section className="history-detail" aria-label="Selected version details">
          {selected ? <>
            <div className="history-detail-heading">
              <div><span className="history-detail-date" title={formatAbsoluteTime(selected.createdAt)}>{formatAbsoluteTime(selected.createdAt)}</span>
                {editingLabel ? <div className="history-label-editor"><input aria-label="Edit version label" value={labelDraft} onChange={(event) => setLabelDraft(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && saveLabel()} /><button type="button" aria-label="Save label" onClick={saveLabel}><Check size={14} /></button></div> : <button type="button" className="history-label-button" onClick={() => { setLabelDraft(selected.label ?? ''); setEditingLabel(true) }}>{selected.label || 'Add a label'}</button>}
              </div>
              <div className="history-actions">
                <button type="button" aria-label="Copy version content" title="Copy version" onClick={() => { void copyVersion(selected) }}><Clipboard size={15} /></button>
                <button type="button" aria-label="Delete version" title="Delete version" onClick={() => setDeleteTarget(selected)}><Trash2 size={15} /></button>
                <button type="button" className="history-restore" onClick={() => restore(selected)}><RotateCcw size={14} />Restore</button>
              </div>
            </div>
            {undoSnapshot && <div className="history-undo"><span>Current content was snapshotted before restore.</span><button type="button" onClick={() => { if (props.onRestoreSnapshot(props.noteId, undoSnapshot.title, undoSnapshot.content)) { setUndoSnapshot(null); props.onClose(); props.onNotify('Restore undone') } }}>Undo</button></div>}
            <label className="history-compare-toggle"><input type="checkbox" checked={comparePrevious} disabled={!olderVersion} onChange={(event) => setComparePrevious(event.target.checked)} />Compare against previous version</label>
            <p className="history-diff-caption">{comparePrevious && olderVersion ? `Comparing with ${formatAbsoluteTime(olderVersion.createdAt)}` : `Comparing with current “${props.title}”`}</p>
            {tooLarge ? <div className="history-large-diff"><p>This version is large. The detailed diff is paused to keep editing responsive.</p><button type="button" onClick={() => setComputeAnyway(true)}>Compute anyway</button></div> : diff ? <>
              {diff.approximate && <p className="history-approximate-note">Large line sets are shown as a bounded summary.</p>}
              <DiffRows lines={diff.lines} />
            </> : null}
          </> : <div className="history-empty-detail"><ChevronLeft size={17} /><p>Select a version to compare it.</p></div>}
        </section>
      </div>
    </aside>
    {deleteTarget && <Modal title="Delete this version?" onClose={() => setDeleteTarget(null)}><p className="modal-copy">This snapshot will be permanently removed from this browser.</p><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setDeleteTarget(null)}>Cancel</button><button type="button" className="primary-button" onClick={() => { if (props.onDeleteVersion(props.noteId, deleteTarget.id)) props.onNotify('Version deleted'); setDeleteTarget(null) }}>Delete version</button></div></Modal>}
  </div>
}
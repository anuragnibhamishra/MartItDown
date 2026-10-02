import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { TopBar } from '../components/layout/TopBar'
import { EditorPanel } from '../components/editor/EditorPanel'
import { MobileViewTabs, PreviewPanel } from '../components/preview/PreviewPanel'
import { ReadingModeControl, StatusBar } from '../components/layout/WorkspaceStatus'
import { WorkspaceOverlays } from '../components/layout/WorkspaceOverlays'
import { Sidebar } from '../components/layout/Sidebar'
import { SearchPalette } from '../components/search/SearchPalette'
import { HistoryPanel } from '../components/history/HistoryPanel'
import { Modal } from '../components/common/Controls'
import { useMarkdownWorkspace } from '../hooks/useMarkdownWorkspace'
import { useSearchIndex } from '../hooks/useSearchIndex'
import { useLinkGraph } from '../hooks/useLinkGraph'
import { loadSidebarCollapsed, persistSidebarCollapsed } from '../services/documentService'
import type { View } from '../types/editor'
import { buildTagCounts } from '../utils/tags'
import { createRenameRewritePlan, linkFirstMention, type RenameRewritePlan } from '../utils/wikiLinks'
import { loadAutoPairEnabled, loadScrollSyncEnabled, persistAutoPairEnabled, persistScrollSyncEnabled } from '../services/settingsService'
import { createJsonBackup, createZipBackup, downloadBackup, parseBackupFile, type ImportedBackup } from '../services/backupService'
import { loadHistory } from '../services/historyService'
import { ImportBackupDialog } from '../components/backup/ImportBackupDialog'

function EditorPage() {
  const {
    notes, activeId, activeNote, name, content, setContent, dirty, theme,
    selectNote, createNote, renameNote, deleteNote, duplicateNote, setTags,
    getVersions, saveVersion, updateVersionLabel, removeVersion, restoreVersion, restoreSnapshot, applyRenameRewrites, rewriteNoteContent, importBackup, historyRevision, checkHistoryWarning,
    toasts, isInstalled, fileInputRef, editorRef, notify, saveDocument, openFile,
    applyAction, copyMarkdown, copyHtml, installApp, toggleTheme,
  } = useMarkdownWorkspace()
  const [view, setView] = useState<View>('write')
  const [readingMode, setReadingMode] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const editorMenuButtonRef = useRef<HTMLButtonElement>(null)
  const previewMenuButtonRef = useRef<HTMLButtonElement>(null)
  const [renameRewritePlan, setRenameRewritePlan] = useState<RenameRewritePlan | null>(null)
  const [missingLinkTitle, setMissingLinkTitle] = useState<string | null>(null)
  const [showEditorMenu, setShowEditorMenu] = useState(false)
  const [showPreviewMenu, setShowPreviewMenu] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(loadSidebarCollapsed)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [activeTagFilters, setActiveTagFilters] = useState<string[]>([])
  const [scrollSyncEnabled, setScrollSyncEnabled] = useState(loadScrollSyncEnabled)
  const [autoPairEnabled, setAutoPairEnabled] = useState(loadAutoPairEnabled)
  const [caret, setCaret] = useState({ line: 1, column: 1 })
  const previewScrollRef = useRef<HTMLDivElement>(null)
  const [pendingBackup, setPendingBackup] = useState<{ backup: ImportedBackup; fileName: string; fileSize: number } | null>(null)
  const backupFileInputRef = useRef<HTMLInputElement>(null)
  const { search } = useSearchIndex(notes)
  const { graph } = useLinkGraph(notes)
  const tagCounts = buildTagCounts(notes)
  const historyVersions = useMemo(() => {
    void historyRevision
    return activeNote ? getVersions(activeNote.id) : []
  }, [activeNote, getVersions, historyRevision])

  const openSearch = () => {
    setShowSearch(true)
    setMobileSidebarOpen(false)
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (showSearch || showHistory || renameRewritePlan || missingLinkTitle) return
      if (mobileSidebarOpen && event.key === 'Escape') {
        event.preventDefault()
        setMobileSidebarOpen(false)
        return
      }
      const modifier = event.metaKey || event.ctrlKey
      if (modifier && event.key.toLowerCase() === 's') { event.preventDefault(); saveDocument() }
      if (modifier && event.key.toLowerCase() === 'b') { event.preventDefault(); applyAction('bold') }
      if (modifier && event.key.toLowerCase() === 'i') { event.preventDefault(); applyAction('italic') }
      if (modifier && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        const editor = editorRef.current
        if (event.target === editor && editor && editor.selectionStart !== editor.selectionEnd) applyAction('link')
        else openSearch()
      }
      if (modifier && event.altKey && event.key.toLowerCase() === 'n') { event.preventDefault(); newDocument() }
      if (modifier && event.altKey && event.key.toLowerCase() === 'h') { event.preventDefault(); setShowHistory(true) }
      if (event.key === '?' && document.activeElement?.tagName !== 'TEXTAREA' && document.activeElement?.tagName !== 'INPUT' && !showSearch) setShowShortcuts(true)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [showSearch, showHistory, renameRewritePlan, missingLinkTitle, mobileSidebarOpen, saveDocument, applyAction, editorRef, openSearch, setShowSearch, setShowHistory])

  useEffect(() => {
    checkHistoryWarning()
  }, [checkHistoryWarning, historyRevision, activeNote?.id])

  useEffect(() => {
    if (!persistSidebarCollapsed(sidebarCollapsed)) notify('Unable to save sidebar preference', 'error')
  }, [sidebarCollapsed, notify])

  useEffect(() => {
    if (!persistScrollSyncEnabled(scrollSyncEnabled)) notify('Unable to save scroll-sync preference', 'error')
  }, [scrollSyncEnabled, notify])

  useEffect(() => {
    if (!persistAutoPairEnabled(autoPairEnabled)) notify('Unable to save auto-pair preference', 'error')
  }, [autoPairEnabled, notify])

  function newDocument() {
    createNote()
    setView('write')
    setMobileSidebarOpen(false)
    notify('New note created', 'info')
  }

  const toggleSidebar = () => {
    if (window.matchMedia('(max-width: 760px)').matches) {
      setMobileSidebarOpen((open) => !open)
    } else {
      setSidebarCollapsed((collapsed) => !collapsed)
    }
  }

  const closeEditorMenu = (action: () => void) => {
    action()
    setShowEditorMenu(false)
  }

  const closePreviewMenu = (action: () => void) => {
    action()
    setShowPreviewMenu(false)
  }

  const focusEditor = () => closeEditorMenu(() => editorRef.current?.focus())
  const newDocumentFromMenu = () => closeEditorMenu(newDocument)
  const saveFromEditorMenu = () => closeEditorMenu(saveDocument)
  const copyHtmlFromMenu = () => closePreviewMenu(copyHtml)
  const printFromMenu = () => closePreviewMenu(() => window.print())
  const enterReadingMode = () => closePreviewMenu(() => setReadingMode(true))
  const toggleTagFilter = (tag: string) => setActiveTagFilters((filters) => filters.includes(tag) ? filters.filter((item) => item !== tag) : [...filters, tag])
  const requestRename = (id: string, title: string) => {
    const plan = createRenameRewritePlan(notes, id, title)
    renameNote(id, title)
    if (plan?.changes.length) setRenameRewritePlan(plan)
  }
  const openSearchResult = (id: string, focusMode: boolean) => {
    selectNote(id)
    setView('write')
    setReadingMode(focusMode)
    setShowSearch(false)
    setMobileSidebarOpen(false)
  }
  const createSearchNote = (title: string) => {
    createNote({ title })
    setView('write')
    setReadingMode(false)
    setShowSearch(false)
    notify('New note created', 'info')
  }
  const openPreviewNote = (id: string, heading?: string) => {
    selectNote(id)
    setView('preview')
    setReadingMode(false)
    if (heading) window.setTimeout(() => {
      const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
      document.getElementById(heading)?.scrollIntoView({ behavior, block: 'start' })
    }, 80)
  }
  const confirmMissingLink = () => {
    if (!missingLinkTitle) return
    createNote({ title: missingLinkTitle })
    setMissingLinkTitle(null)
    setView('preview')
    notify(`Created “${missingLinkTitle}”`)
  }
  const linkMentionInNote = (sourceId: string) => {
    const source = notes.find((note) => note.id === sourceId)
    if (!source || !activeNote) return
    const contentWithLink = linkFirstMention(source.content, activeNote.title)
    if (contentWithLink && rewriteNoteContent(source.id, contentWithLink, 'Before linking mention')) notify(`Linked first mention in “${source.title}”`)
  }
  const exportAllZip = async () => {
    try {
      const archive = await createZipBackup(notes)
      const archiveBuffer = new ArrayBuffer(archive.byteLength)
      new Uint8Array(archiveBuffer).set(archive)
      downloadBackup(archiveBuffer, 'markitdown-notes.zip', 'application/zip')
      notify(`Exported ${notes.length} notes`)
    } catch {
      notify('Unable to export notes as ZIP', 'error')
    }
  }
  const exportJsonBackup = () => {
    try {
      const backup = createJsonBackup({ notes, activeId }, loadHistory())
      downloadBackup(JSON.stringify(backup, null, 2), 'markitdown-backup.json', 'application/json;charset=utf-8')
      notify('JSON backup downloaded')
    } catch {
      notify('Unable to create JSON backup', 'error')
    }
  }
  const importBackupFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) return
    try {
      const backup = await parseBackupFile(file)
      setPendingBackup({ backup, fileName: file.name, fileSize: file.size })
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Unable to read backup file', 'error')
    } finally {
      input.value = ''
    }
  }

  return <div className={`app-shell ${readingMode ? 'reading-mode' : ''}`}>
    <TopBar name={name} onNameCommit={(title) => activeId && requestRename(activeId, title)} dirty={dirty} theme={theme} isInstalled={isInstalled} sidebarCollapsed={sidebarCollapsed} mobileSidebarOpen={mobileSidebarOpen} fileInputRef={fileInputRef} onNewDocument={newDocument} onSave={saveDocument} onCopyMarkdown={copyMarkdown} onCopyHtml={copyHtml} onOpenShortcuts={() => setShowShortcuts(true)} onOpenSearch={openSearch} onOpenHistory={() => setShowHistory(true)} onExportAllZip={() => { void exportAllZip() }} onBackupJson={exportJsonBackup} onOpenBackupImport={() => backupFileInputRef.current?.click()} scrollSyncEnabled={scrollSyncEnabled} onToggleScrollSync={() => setScrollSyncEnabled((enabled) => !enabled)} onInstall={installApp} onToggleTheme={toggleTheme} onToggleSidebar={toggleSidebar} />
    <div className="workspace-layout">
      <Sidebar notes={notes} tagCounts={tagCounts} activeTagFilters={activeTagFilters} activeId={activeId} collapsed={sidebarCollapsed} mobileOpen={mobileSidebarOpen} onCreate={newDocument} onSelect={selectNote} onRename={requestRename} onDuplicate={duplicateNote} onDelete={deleteNote} onCloseMobile={() => setMobileSidebarOpen(false)} onToggleTag={toggleTagFilter} onClearTagFilters={() => setActiveTagFilters([])} onOpenSearch={openSearch} />
      <div className="workspace-content">
        <input ref={fileInputRef} className="visually-hidden" type="file" aria-label="Import Markdown file" accept=".md,.markdown,.txt,text/markdown,text/plain" onChange={openFile} />
        <input ref={backupFileInputRef} className="visually-hidden" type="file" aria-label="Import ZIP or JSON backup" accept=".zip,.json,application/zip,application/json" onChange={(event) => { void importBackupFile(event) }} />
        <main className="workspace">
          <MobileViewTabs view={view} onChange={setView} />
          <EditorPanel content={content} note={activeNote} notes={notes} availableTags={tagCounts.map(({ tag }) => tag)} onSetTags={setTags} editorRef={editorRef} previewScrollRef={previewScrollRef} menuButtonRef={editorMenuButtonRef} menuOpen={showEditorMenu} autoPairEnabled={autoPairEnabled} scrollSyncEnabled={scrollSyncEnabled} isVisible={view === 'write'} onChange={setContent} onAction={applyAction} onMoreOptions={() => { setShowEditorMenu((open) => !open); setShowPreviewMenu(false) }} onFocusMode={() => setReadingMode(true)} onToggleAutoPair={() => setAutoPairEnabled((enabled) => !enabled)} onCursorChange={(line, column) => setCaret({ line, column })} />
          <PreviewPanel content={content} isVisible={view === 'preview'} notes={notes} activeNote={activeNote} graph={graph} theme={theme} scrollContainerRef={previewScrollRef} menuButtonRef={previewMenuButtonRef} menuOpen={showPreviewMenu} onMoreOptions={() => { setShowPreviewMenu((open) => !open); setShowEditorMenu(false) }} onOpenNote={openPreviewNote} onRequestCreateNote={setMissingLinkTitle} onLinkMention={linkMentionInNote} />
        </main>
      </div>
    </div>
    <StatusBar name={name} content={content} line={caret.line} column={caret.column} />
    {readingMode && <ReadingModeControl onExit={() => setReadingMode(false)} />}
    <WorkspaceOverlays toasts={toasts} showEditorMenu={showEditorMenu} editorMenuAnchorRef={editorMenuButtonRef} showPreviewMenu={showPreviewMenu} previewMenuAnchorRef={previewMenuButtonRef} showShortcuts={showShortcuts} onCloseEditorMenu={() => setShowEditorMenu(false)} onFocusEditor={focusEditor} onNewDocument={newDocumentFromMenu} onSave={saveFromEditorMenu} onCopyHtml={copyHtmlFromMenu} onPrint={printFromMenu} onReadingMode={enterReadingMode} onClosePreviewMenu={() => setShowPreviewMenu(false)} onCloseShortcuts={() => setShowShortcuts(false)} />
    {showSearch && <SearchPalette notes={notes} search={search} onClose={() => setShowSearch(false)} onOpenNote={openSearchResult} onCreateNote={createSearchNote} />}
    {showHistory && activeNote && <HistoryPanel noteId={activeNote.id} title={activeNote.title} content={activeNote.content} versions={historyVersions} onClose={() => setShowHistory(false)} onSaveVersion={saveVersion} onUpdateLabel={updateVersionLabel} onDeleteVersion={removeVersion} onRestore={restoreVersion} onRestoreSnapshot={restoreSnapshot} onNotify={notify} />}
    {renameRewritePlan && <Modal title="Update links to renamed note?" onClose={() => setRenameRewritePlan(null)}><p className="modal-copy">“{renameRewritePlan.oldTitle}” was renamed to “{renameRewritePlan.newTitle}”. Rewrite matching links in {renameRewritePlan.changes.length} {renameRewritePlan.changes.length === 1 ? 'note' : 'notes'}?</p><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setRenameRewritePlan(null)}>Keep links unchanged</button><button type="button" className="primary-button" onClick={() => { applyRenameRewrites(renameRewritePlan); setRenameRewritePlan(null) }}>Rewrite links</button></div></Modal>}
    {missingLinkTitle && <Modal title="Create linked note?" onClose={() => setMissingLinkTitle(null)}><p className="modal-copy">“{missingLinkTitle}” does not exist yet. Create it and open the new note?</p><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setMissingLinkTitle(null)}>Cancel</button><button type="button" className="primary-button" onClick={confirmMissingLink}>Create note</button></div></Modal>}
    {pendingBackup && <ImportBackupDialog backup={pendingBackup.backup} fileName={pendingBackup.fileName} fileSize={pendingBackup.fileSize} existingNotes={notes} onClose={() => setPendingBackup(null)} onImport={(choice) => importBackup(pendingBackup.backup, choice)} />}
  </div>
}

export default EditorPage
import { startTransition, useCallback, useEffect, useEffectEvent, useReducer, useRef, useState, type ChangeEvent } from 'react'
import {
  buildNote,
  createId as buildNoteId,
  createUniqueUntitledTitle,
  deleteNoteFromState,
  downloadMarkdownFile,
  duplicateNoteInState,
  loadNotes,
  loadTheme,
  persistTheme,
  saveNotes,
  setTagsInState,
  updateNoteInState,
} from '../services/documentService'
import type { BeforeInstallPromptEvent, Note, NotePatch, NotesState, Theme, Toast, ToastTone, ToolbarAction } from '../types/editor'
import { formatSelection } from '../utils/markdown'
import type { NoteVersion } from '../types/editor'
import { addVersion, addVersions, clearHistory, deleteVersion as deleteStoredVersion, labelVersion as labelStoredVersion, listVersions, mergeImportedHistory, takeHistoryWarning } from '../services/historyService'
import { applyRenameRewritePlan, type RenameRewritePlan } from '../utils/wikiLinks'
import { analyzeImportConflicts, mergeImportedNotes, type ImportConflictChoice } from '../utils/backup'
import type { ImportedBackup } from '../services/backupService'

interface PwaState {
  installPrompt: BeforeInstallPromptEvent | null
  isInstalled: boolean
}

type PwaAction =
  | { type: 'prompt'; prompt: BeforeInstallPromptEvent }
  | { type: 'installed' }
  | { type: 'display-mode'; isInstalled: boolean }
  | { type: 'clear-prompt' }

function pwaReducer(state: PwaState, action: PwaAction): PwaState {
  if (action.type === 'prompt') return { ...state, installPrompt: action.prompt }
  if (action.type === 'installed') return { installPrompt: null, isInstalled: true }
  if (action.type === 'display-mode') return { ...state, isInstalled: action.isInstalled }
  return { ...state, installPrompt: null }
}

export function useMarkdownWorkspace() {
  const [notesState, setNotesState] = useState<NotesState>(loadNotes)
  const [theme, setTheme] = useState<Theme>(loadTheme)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [pwaState, dispatchPwa] = useReducer(pwaReducer, {
    installPrompt: null,
    isInstalled: typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches,
  })
  const { installPrompt, isInstalled } = pwaState
  const fileInputRef = useRef<HTMLInputElement>(null)
  const editorRef = useRef<HTMLTextAreaElement>(null)
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestNotesStateRef = useRef(notesState)
  const idleTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const previousContentsRef = useRef(new Map(notesState.notes.map((note) => [note.id, note.content])))
  const knownNoteIdsRef = useRef(new Set(notesState.notes.map((note) => note.id)))
  const [historyRevision, setHistoryRevision] = useState(0)
  const notes = notesState.notes
  const activeNote = notes.find((note) => note.id === notesState.activeId) ?? notes[0] ?? null
  const content = activeNote?.content ?? ''
  const dirty = activeNote ? activeNote.content !== activeNote.savedContent : false

  const notify = useCallback((message: string, tone: ToastTone = 'success') => {
    const id = Date.now() + Math.random()
    setToasts((current) => [...current, { id, message, tone }])
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 3000)
  }, [])

  const surfaceHistoryWarning = useCallback(() => {
    const warning = takeHistoryWarning()
    if (warning) notify(warning, 'error')
  }, [notify])

  useEffect(() => {
    latestNotesStateRef.current = notesState
    if (persistTimerRef.current !== null) window.clearTimeout(persistTimerRef.current)
    persistTimerRef.current = window.setTimeout(() => {
      if (!saveNotes(notesState)) notify('Unable to save notes in this browser', 'error')
      persistTimerRef.current = null
    }, 300)
    return () => {
      if (persistTimerRef.current !== null) window.clearTimeout(persistTimerRef.current)
    }
  }, [notesState, notify])

  useEffect(() => {
    const currentIds = new Set(notes.map((note) => note.id))
    for (const id of knownNoteIdsRef.current) {
      if (currentIds.has(id)) continue
      const timer = idleTimersRef.current.get(id)
      if (timer !== undefined) window.clearTimeout(timer)
      idleTimersRef.current.delete(id)
      if (!clearHistory(id)) notify('Unable to clear deleted note history', 'error')
    }

    for (const note of notes) {
      const previousContent = previousContentsRef.current.get(note.id)
      if (previousContent !== undefined && previousContent !== note.content) {
        const previousTimer = idleTimersRef.current.get(note.id)
        if (previousTimer !== undefined) window.clearTimeout(previousTimer)
        const timer = window.setTimeout(() => {
          const current = latestNotesStateRef.current.notes.find((item) => item.id === note.id)
          if (!current || current.content !== note.content) return
          const latest = listVersions(note.id)[0]
          if (latest?.content === current.content) return
          if (!addVersion(current, 'idle')) notify('Unable to save automatic version history', 'error')
          else setHistoryRevision((revision) => revision + 1)
          surfaceHistoryWarning()
          idleTimersRef.current.delete(note.id)
        }, 60_000)
        idleTimersRef.current.set(note.id, timer)
      }
      previousContentsRef.current.set(note.id, note.content)
    }
    previousContentsRef.current = new Map(notes.map((note) => [note.id, note.content]))
    knownNoteIdsRef.current = currentIds
  }, [notes, notify, surfaceHistoryWarning])

  useEffect(() => () => {
    for (const timer of idleTimersRef.current.values()) window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    const flushNotes = () => {
      if (persistTimerRef.current !== null) window.clearTimeout(persistTimerRef.current)
      persistTimerRef.current = null
      if (!saveNotes(latestNotesStateRef.current)) notify('Unable to save notes in this browser', 'error')
    }
    window.addEventListener('beforeunload', flushNotes)
    return () => {
      window.removeEventListener('beforeunload', flushNotes)
      flushNotes()
    }
  }, [notify])

  useEffect(() => {
    if (!persistTheme(theme)) window.setTimeout(() => notify('Unable to save theme preference', 'error'), 0)
    document.documentElement.dataset.theme = theme
    const preference = window.matchMedia('(prefers-color-scheme: dark)')
    const updateThemeColor = () => {
      const dark = theme === 'dark' || (theme === 'system' && preference.matches)
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#17181c' : '#f5f6f8')
    }
    updateThemeColor()
    preference.addEventListener('change', updateThemeColor)
    return () => preference.removeEventListener('change', updateThemeColor)
  }, [theme, notify])

  const handleBeforeInstallPrompt = useEffectEvent((event: Event) => {
    event.preventDefault()
    startTransition(() => dispatchPwa({ type: 'prompt', prompt: event as BeforeInstallPromptEvent }))
  })
  const handleAppInstalled = useEffectEvent(() => {
    startTransition(() => dispatchPwa({ type: 'installed' }))
    notify('MarkItDown installed')
  })
  const handleDisplayModeChange = useEffectEvent((event: MediaQueryListEvent) => {
    startTransition(() => dispatchPwa({ type: 'display-mode', isInstalled: event.matches }))
  })

  useEffect(() => {
    const displayMode = window.matchMedia('(display-mode: standalone)')
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)
    displayMode.addEventListener('change', handleDisplayModeChange)
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
      displayMode.removeEventListener('change', handleDisplayModeChange)
    }
  }, [])

  const selectNote = (id: string) => {
    setNotesState((state) => state.notes.some((note) => note.id === id) ? { ...state, activeId: id } : state)
  }

  const createNote = (partial: Partial<Pick<Note, 'title' | 'content' | 'savedContent' | 'tags'>> = {}) => {
    const note = buildNote({ ...partial, title: partial.title ?? createUniqueUntitledTitle(notesState.notes) })
    setNotesState((state) => ({ notes: [...state.notes, note], activeId: note.id }))
    return note
  }

  const renameNote = (id: string, title: string) => {
    const normalizedTitle = title.trim()
    if (!normalizedTitle) return
    setNotesState((state) => updateNoteInState(state, id, { title: normalizedTitle }))
  }

  const deleteNote = (id: string) => setNotesState((state) => deleteNoteFromState(state, id))

  const duplicateNote = (id: string) => setNotesState((state) => duplicateNoteInState(state, id))

  const setTags = (id: string, tags: readonly string[]) => setNotesState((state) => setTagsInState(state, id, tags))

  const getVersions = useCallback((id: string) => {
    return listVersions(id)
  }, [])

  const saveVersion = (id: string, label: string) => {
    const note = latestNotesStateRef.current.notes.find((item) => item.id === id)
    if (!note) return false
    const latest = listVersions(id)[0]
    if (latest?.content === note.content) {
      const saved = labelStoredVersion(id, latest.id, label)
      if (!saved) notify('Unable to save version label', 'error')
      else setHistoryRevision((revision) => revision + 1)
      surfaceHistoryWarning()
      return saved
    }
    const created = addVersion(note, 'manual', label)
    if (!created) notify('Unable to save version history', 'error')
    else setHistoryRevision((revision) => revision + 1)
    surfaceHistoryWarning()
    return created !== null
  }

  const updateVersionLabel = (id: string, versionId: string, label: string) => {
    const saved = labelStoredVersion(id, versionId, label)
    if (!saved) notify('Unable to update version label', 'error')
    else setHistoryRevision((revision) => revision + 1)
    surfaceHistoryWarning()
    return saved
  }

  const removeVersion = (id: string, versionId: string) => {
    const removed = deleteStoredVersion(id, versionId)
    if (!removed) notify('Unable to delete version', 'error')
    else setHistoryRevision((revision) => revision + 1)
    surfaceHistoryWarning()
    return removed
  }

  const restoreSnapshot = (id: string, title: string, snapshotContent: string) => {
    const current = latestNotesStateRef.current.notes.find((note) => note.id === id)
    if (!current) return false
    const latest = listVersions(id)[0]
    if (latest?.content !== current.content) {
      if (!addVersion(current, 'restore')) {
        notify('Unable to create the safety snapshot', 'error')
        surfaceHistoryWarning()
        return false
      }
      setHistoryRevision((revision) => revision + 1)
      surfaceHistoryWarning()
    }
    setNotesState((state) => updateNoteInState(state, id, { title, content: snapshotContent, savedContent: snapshotContent }))
    return true
  }

  const restoreVersion = (version: NoteVersion) => restoreSnapshot(version.noteId, version.title, version.content)

  const applyRenameRewrites = (plan: RenameRewritePlan) => {
    if (plan.changes.length === 0) return true
    const currentNotes = latestNotesStateRef.current.notes
    const rewrittenNotes = applyRenameRewritePlan(currentNotes, plan)
    if (!rewrittenNotes) {
      notify('Notes changed before links could be rewritten. Please retry.', 'error')
      return false
    }
    const snapshots = plan.changes.map((change) => currentNotes.find((note) => note.id === change.noteId))
    if (!addVersions(snapshots.filter((note): note is Note => note !== undefined), 'manual', 'Before link rewrite')) {
      notify('Unable to save safety snapshots; no links were changed', 'error')
      surfaceHistoryWarning()
      return false
    }
    surfaceHistoryWarning()
    setHistoryRevision((revision) => revision + 1)
    setNotesState((state) => {
      const current = applyRenameRewritePlan(state.notes, plan)
      return current ? { ...state, notes: current } : state
    })
    notify(`Updated links in ${plan.changes.length} ${plan.changes.length === 1 ? 'note' : 'notes'}`)
    return true
  }

  const rewriteNoteContent = (id: string, nextContent: string, label: string) => {
    const current = latestNotesStateRef.current.notes.find((note) => note.id === id)
    if (!current || current.content === nextContent) return false
    const latest = listVersions(id)[0]
    if (latest?.content !== current.content) {
      if (!addVersion(current, 'manual', label)) {
        notify('Unable to save a safety snapshot; the link was not changed', 'error')
        surfaceHistoryWarning()
        return false
      }
      setHistoryRevision((revision) => revision + 1)
      surfaceHistoryWarning()
    }
    setNotesState((state) => updateNoteInState(state, id, { content: nextContent }))
    return true
  }

  const importBackup = (backup: ImportedBackup, choice: ImportConflictChoice) => {
    const current = latestNotesStateRef.current
    const summary = analyzeImportConflicts(current.notes, backup.notes)
    const merge = mergeImportedNotes(current.notes, backup.notes, choice, buildNoteId)
    if (merge.added === 0 && merge.replaced === 0) {
      notify('No notes were imported', 'info')
      return false
    }
    if (choice === 'replace' && summary.conflicts.length) {
      const snapshots = summary.conflicts.map((conflict) => conflict.existing)
      if (!addVersions(snapshots, 'manual', 'Before backup replacement')) {
        notify('Unable to save replacement snapshots; no notes were imported', 'error')
        surfaceHistoryWarning()
        return false
      }
      setHistoryRevision((revision) => revision + 1)
      surfaceHistoryWarning()
    }

    const mappedActiveId = backup.activeId ? merge.idMap[backup.activeId] : undefined
    const nextState: NotesState = {
      notes: merge.notes,
      activeId: mappedActiveId ?? (merge.notes.some((note) => note.id === current.activeId) ? current.activeId : merge.notes[0]?.id ?? null),
    }
    if (!saveNotes(nextState)) {
      notify('Unable to save imported notes; the library was not changed', 'error')
      return false
    }
    setNotesState(nextState)
    latestNotesStateRef.current = nextState
    if (backup.history && !mergeImportedHistory(backup.history, merge.idMap, merge.notes)) {
      notify('Notes were imported, but backup history could not be saved', 'error')
      surfaceHistoryWarning()
    } else if (backup.history) {
      setHistoryRevision((revision) => revision + 1)
    }
    notify(`Imported ${merge.added} notes${merge.replaced ? ` and replaced ${merge.replaced}` : ''}`)
    return true
  }

  const updateActiveNote = (patch: NotePatch) => {
    setNotesState((state) => state.activeId ? updateNoteInState(state, state.activeId, patch) : state)
  }

  const setContent = (nextContent: string) => updateActiveNote({ content: nextContent })

  const saveDocument = () => {
    if (!activeNote) return
    const latest = listVersions(activeNote.id)[0]
    if (latest?.content !== activeNote.content) {
      if (!addVersion(activeNote, 'save')) notify('Unable to save version history', 'error')
      else setHistoryRevision((revision) => revision + 1)
      surfaceHistoryWarning()
    }
    setNotesState((state) => updateNoteInState(state, activeNote.id, { savedContent: activeNote.content }))
    downloadMarkdownFile(activeNote.title, activeNote.content)
    notify('Markdown file downloaded')
  }

  const openFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) return
    if (!/\.(md|markdown|txt)$/i.test(file.name)) {
      notify('Please choose a Markdown or text file', 'error')
      input.value = ''
      return
    }
    try {
      const text = await file.text()
      const title = file.name.replace(/\.(md|markdown|txt)$/i, '') || 'Untitled'
      createNote({ title, content: text, savedContent: text })
      notify('Markdown file imported as a new note')
    } catch {
      notify('Unable to read file', 'error')
    } finally {
      input.value = ''
    }
  }

  const applyAction = (action: ToolbarAction) => {
    const editor = editorRef.current
    if (!editor) return
    const start = editor.selectionStart
    const end = editor.selectionEnd
    const replacement = formatSelection(action, content.slice(start, end))
    setContent(content.slice(0, start) + replacement + content.slice(end))
    requestAnimationFrame(() => {
      editor.focus()
      editor.setSelectionRange(start, start + replacement.length)
    })
  }

  const copyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(content)
      notify('Markdown copied')
    } catch {
      notify('Unable to copy Markdown', 'error')
    }
  }

  const copyHtml = async () => {
    const html = document.querySelector('.markdown-body')?.innerHTML || ''
    try {
      await navigator.clipboard.writeText(html)
      notify('Rendered HTML copied')
    } catch {
      notify('Unable to copy rendered HTML', 'error')
    }
  }

  const installApp = async () => {
    if (!installPrompt) {
      notify('Use your browser menu to install MarkItDown', 'info')
      return
    }
    await installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === 'accepted') notify('MarkItDown is installing')
    dispatchPwa({ type: 'clear-prompt' })
  }

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark')

  return {
    notes, activeId: notesState.activeId, activeNote, selectNote, createNote, renameNote, deleteNote, duplicateNote, setTags,
    getVersions, saveVersion, updateVersionLabel, removeVersion, restoreVersion, restoreSnapshot, applyRenameRewrites, rewriteNoteContent, historyRevision, checkHistoryWarning: surfaceHistoryWarning,
    importBackup,
    name: activeNote?.title ?? '', setName: (title: string) => activeNote && renameNote(activeNote.id, title),
    content, setContent, savedContent: activeNote?.savedContent ?? '', dirty, theme, setTheme,
    toasts, isInstalled, fileInputRef, editorRef, notify, saveDocument, openFile,
    applyAction, copyMarkdown, copyHtml, installApp, toggleTheme,
  }
}

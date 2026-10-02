import type { RefObject } from 'react'

export type Theme = 'light' | 'dark' | 'system'
export type View = 'write' | 'preview'
export type ToastTone = 'success' | 'error' | 'info'
export type Toast = { id: number; message: string; tone: ToastTone }
export type ToolbarAction = 'h1' | 'h2' | 'bold' | 'italic' | 'strike' | 'link' | 'image' | 'quote' | 'code' | 'bullet' | 'ordered' | 'task'

export interface StoredDocument {
  name: string
  content: string
  savedContent: string
}

export interface Note {
  id: string
  title: string
  content: string
  savedContent: string
  tags: string[]
  createdAt: number
  updatedAt: number
}

export type VersionReason = 'save' | 'idle' | 'restore' | 'manual'

export interface NoteVersion {
  id: string
  noteId: string
  content: string
  title: string
  createdAt: number
  reason: VersionReason
  label?: string
}

export interface NotesState {
  notes: Note[]
  activeId: string | null
}

export type NotePatch = Partial<Pick<Note, 'title' | 'content' | 'savedContent' | 'tags' | 'updatedAt'>>

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export type EditorRef = RefObject<HTMLTextAreaElement | null>
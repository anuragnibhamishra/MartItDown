import { useRef, useState, type RefObject } from 'react'
import {
  ArrowDownUp, ChevronDown, Clipboard, Code2, Download, FilePlus2, FileText, FolderOpen,
  History, Keyboard, Menu, Moon, PanelLeftClose, PanelLeftOpen, Save, Search, Sun, X,
} from 'lucide-react'
import type { Theme } from '../../types/editor'
import { IconButton, Logo, MenuItem } from '../common/Controls'

interface TopBarProps {
  name: string
  onNameCommit: (name: string) => void
  dirty: boolean
  theme: Theme
  isInstalled: boolean
  sidebarCollapsed: boolean
  mobileSidebarOpen: boolean
  fileInputRef: RefObject<HTMLInputElement | null>
  onNewDocument: () => void
  onSave: () => void
  onCopyMarkdown: () => void
  onCopyHtml: () => void
  onOpenShortcuts: () => void
  onOpenSearch: () => void
  onOpenHistory: () => void
  onExportAllZip: () => void
  onBackupJson: () => void
  onOpenBackupImport: () => void
  scrollSyncEnabled: boolean
  onToggleScrollSync: () => void
  onInstall: () => void
  onToggleTheme: () => void
  onToggleSidebar: () => void
}

export function TopBar(props: TopBarProps) {
  const [isEditingName, setIsEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState(props.name)
  const [showExport, setShowExport] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const nameCommitHandledRef = useRef(false)
  const themeIcon = props.theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />
  const openFile = () => props.fileInputRef.current?.click()
  const print = () => window.print()
  const startNameEdit = () => { nameCommitHandledRef.current = false; setNameDraft(props.name); setIsEditingName(true) }
  const commitName = () => { if (nameCommitHandledRef.current) return; nameCommitHandledRef.current = true; props.onNameCommit(nameDraft); setIsEditingName(false) }

  return <header className="topbar">
    <div className="topbar-left"><Logo /><span className="topbar-divider" /><div className="document-name">{isEditingName ? <input autoFocus value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} onBlur={commitName} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); commitName() } if (event.key === 'Escape') { event.preventDefault(); nameCommitHandledRef.current = true; setIsEditingName(false) } }} aria-label="Document name" /> : <button type="button" className="document-name-button" onClick={startNameEdit}>{props.name}<ChevronDown size={13} /></button>}</div></div>
    <div className="topbar-actions">
      <span className={`save-state ${props.dirty ? 'dirty' : ''}`}><span className="status-dot" />{props.dirty ? 'Unsaved changes' : 'Saved'}</span>
      <div className="action-divider" />
      <div className="sidebar-toggle"><IconButton label={props.mobileSidebarOpen ? 'Close notes sidebar' : 'Toggle notes sidebar'} onClick={props.onToggleSidebar}>{props.mobileSidebarOpen ? <X size={16} /> : props.sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}</IconButton></div>
      <div className="desktop-actions">
        <IconButton label="Search notes" onClick={props.onOpenSearch}><Search size={16} /></IconButton>
        <IconButton label="Version history" onClick={props.onOpenHistory}><History size={16} /></IconButton>
        <IconButton label={`Scroll sync ${props.scrollSyncEnabled ? 'on' : 'off'}`} active={props.scrollSyncEnabled} onClick={props.onToggleScrollSync}><ArrowDownUp size={16} /></IconButton>
        <IconButton label="New document" onClick={props.onNewDocument}><FilePlus2 size={16} /></IconButton>
        <IconButton label="Open Markdown file" onClick={openFile}><FolderOpen size={16} /></IconButton>
        <IconButton label="Save Markdown file" onClick={props.onSave}><Save size={16} /></IconButton>
        <div className="export-wrap"><button type="button" className="export-button" onClick={() => setShowExport((open) => !open)}>Export <ChevronDown size={13} /></button>{showExport && <div className="export-menu">
          <button type="button" onClick={() => { props.onSave(); setShowExport(false) }}><Download size={15} />Download Markdown</button>
          <button type="button" onClick={() => { props.onCopyMarkdown(); setShowExport(false) }}><Clipboard size={15} />Copy Markdown</button>
          <button type="button" onClick={() => { props.onCopyHtml(); setShowExport(false) }}><Code2 size={15} />Copy rendered HTML</button>
          <button type="button" onClick={() => { print(); setShowExport(false) }}><FileText size={15} />Print preview</button>
          <button type="button" onClick={() => { props.onExportAllZip(); setShowExport(false) }}><Download size={15} />Export all as ZIP</button>
          <button type="button" onClick={() => { props.onBackupJson(); setShowExport(false) }}><FileText size={15} />Backup JSON</button>
          <button type="button" onClick={() => { props.onOpenBackupImport(); setShowExport(false) }}><FolderOpen size={15} />Import backup</button>
        </div>}</div>
        {!props.isInstalled && <IconButton label="Install MarkItDown" onClick={props.onInstall}><Download size={16} /></IconButton>}
        <IconButton label="Keyboard shortcuts" onClick={props.onOpenShortcuts}><Keyboard size={16} /></IconButton>
        <IconButton label={`Theme: ${props.theme}`} onClick={props.onToggleTheme}>{themeIcon}</IconButton>
      </div>
      <div className="mobile-menu-wrap"><IconButton label="Open app menu" onClick={() => setShowMobileMenu((open) => !open)} active={showMobileMenu}><Menu size={18} /></IconButton>{showMobileMenu && <div className="mobile-menu">
        <MenuItem label="Search notes" onClick={() => { props.onOpenSearch(); setShowMobileMenu(false) }}><Search size={16} /></MenuItem>
        <MenuItem label="Version history" onClick={() => { props.onOpenHistory(); setShowMobileMenu(false) }}><History size={16} /></MenuItem>
        <MenuItem label={`Scroll sync ${props.scrollSyncEnabled ? 'on' : 'off'}`} onClick={() => { props.onToggleScrollSync(); setShowMobileMenu(false) }}><ArrowDownUp size={16} /></MenuItem>
        <MenuItem label="New document" onClick={() => { props.onNewDocument(); setShowMobileMenu(false) }}><FilePlus2 size={16} /></MenuItem>
        <MenuItem label="Open Markdown file" onClick={() => { openFile(); setShowMobileMenu(false) }}><FolderOpen size={16} /></MenuItem>
        <MenuItem label="Save Markdown file" onClick={() => { props.onSave(); setShowMobileMenu(false) }}><Save size={16} /></MenuItem>
        <MenuItem label="Export Markdown" onClick={() => { props.onSave(); setShowMobileMenu(false) }}><Download size={16} /></MenuItem>
        <MenuItem label="Export all as ZIP" onClick={() => { props.onExportAllZip(); setShowMobileMenu(false) }}><Download size={16} /></MenuItem>
        <MenuItem label="Backup JSON" onClick={() => { props.onBackupJson(); setShowMobileMenu(false) }}><FileText size={16} /></MenuItem>
        <MenuItem label="Import backup" onClick={() => { props.onOpenBackupImport(); setShowMobileMenu(false) }}><FolderOpen size={16} /></MenuItem>
        {!props.isInstalled && <MenuItem label="Install MarkItDown" onClick={() => { props.onInstall(); setShowMobileMenu(false) }}><Download size={16} /></MenuItem>}
        <MenuItem label={`Switch to ${props.theme === 'dark' ? 'light' : 'dark'} mode`} onClick={() => { props.onToggleTheme(); setShowMobileMenu(false) }}>{themeIcon}</MenuItem>
      </div>}</div>
    </div>
  </header>
}
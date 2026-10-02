import { Code2, FilePlus2, FileText, Save, Search, Type } from 'lucide-react'
import type { RefObject } from 'react'
import type { Toast } from '../../types/editor'
import { MenuItem, Modal, Popover } from '../common/Controls'
import { ToastStack } from './WorkspaceStatus'

interface WorkspaceOverlaysProps {
  toasts: Toast[]
  showEditorMenu: boolean
  editorMenuAnchorRef: RefObject<HTMLButtonElement | null>
  showPreviewMenu: boolean
  previewMenuAnchorRef: RefObject<HTMLButtonElement | null>
  showShortcuts: boolean
  onCloseEditorMenu: () => void
  onFocusEditor: () => void
  onNewDocument: () => void
  onSave: () => void
  onCopyHtml: () => void
  onPrint: () => void
  onReadingMode: () => void
  onClosePreviewMenu: () => void
  onCloseShortcuts: () => void
}

export function WorkspaceOverlays(props: WorkspaceOverlaysProps) {
  const closeEditorMenu = () => {
    props.onFocusEditor();
    props.onCloseEditorMenu();
  }
  const closePreviewMenu = (action: () => void) => {
    action()
    props.onClosePreviewMenu()
  }

  return <>
    <ToastStack toasts={props.toasts} />
    <Popover open={props.showEditorMenu} anchorRef={props.editorMenuAnchorRef} onClose={props.onCloseEditorMenu} className="section-menu-overlay editor-menu-overlay" role="menu"><MenuItem role="menuitem" label="Focus editor" onClick={() => closeEditorMenu()}><Type size={15} /></MenuItem><MenuItem role="menuitem" label="New document" onClick={() => { props.onNewDocument(); props.onCloseEditorMenu() }}><FilePlus2 size={15} /></MenuItem><MenuItem role="menuitem" label="Save Markdown" onClick={() => { props.onSave(); props.onCloseEditorMenu() }}><Save size={15} /></MenuItem></Popover>
    <Popover open={props.showPreviewMenu} anchorRef={props.previewMenuAnchorRef} onClose={props.onClosePreviewMenu} className="section-menu-overlay preview-menu-overlay" role="menu"><MenuItem role="menuitem" label="Copy rendered HTML" onClick={() => closePreviewMenu(props.onCopyHtml)}><Code2 size={15} /></MenuItem><MenuItem role="menuitem" label="Print preview" onClick={() => closePreviewMenu(props.onPrint)}><FileText size={15} /></MenuItem><MenuItem role="menuitem" label="Focus reading mode" onClick={() => closePreviewMenu(props.onReadingMode)}><Search size={15} /></MenuItem></Popover>
    {props.showShortcuts && <Modal title="Keyboard shortcuts" onClose={props.onCloseShortcuts}><div className="shortcut-list"><div><span>Bold</span><kbd>⌘ B</kbd></div><div><span>Italic</span><kbd>⌘ I</kbd></div><div><span>Insert link with selection / Search</span><kbd>⌘ K</kbd></div><div><span>Version history</span><kbd>Ctrl + Alt + H</kbd></div><div><span>Save the active note</span><kbd>⌘ S</kbd></div><div><span>New note</span><kbd>Ctrl + Alt + N</kbd></div><div><span>Continue a list</span><kbd>Enter</kbd></div><div><span>Indent / outdent selected list lines</span><kbd>Tab / Shift + Tab</kbd></div><div><span>Block commands</span><kbd>/</kbd></div><div><span>Link a note</span><kbd>[[</kbd></div><div><span>Dismiss a suggestion, then move focus</span><kbd>Esc, Tab</kbd></div><div><span>Show shortcuts</span><kbd>?</kbd></div></div></Modal>}
  </>
}
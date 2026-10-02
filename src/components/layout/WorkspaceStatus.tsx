import { Check, FileText, HelpCircle, X } from 'lucide-react'
import type { Toast } from '../../types/editor'
import { countWords } from '../../utils/markdown'

export function StatusBar({ name, content, line = 1, column = 1 }: { name: string; content: string; line?: number; column?: number }) {
  return <footer className="statusbar"><div><span className="status-file"><FileText size={14} />{name}</span><span className="status-separator" /><span>Markdown</span><span className="status-caret">Ln {line}, Col {column}</span></div><div><span>Words: <b>{countWords(content)}</b></span><span>Characters: <b>{content.length}</b></span><span>Lines: <b>{content ? content.split('\n').length : 0}</b></span></div></footer>
}

export function ToastStack({ toasts }: { toasts: Toast[] }) {
  return <div className="toast-stack" aria-live="polite">{toasts.map((toast) => <div className={`toast ${toast.tone}`} key={toast.id}>{toast.tone === 'success' ? <Check size={15} /> : toast.tone === 'error' ? <X size={15} /> : <HelpCircle size={15} />}{toast.message}</div>)}</div>
}

export function ReadingModeControl({ onExit }: { onExit: () => void }) {
  return <div className="reading-exit"><span>Focus mode</span><button type="button" onClick={onExit}><X size={14} /> Exit</button></div>
}
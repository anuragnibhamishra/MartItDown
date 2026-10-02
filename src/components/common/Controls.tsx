import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react'
import { FileText, X } from 'lucide-react'

interface PopoverPositionArgs {
  anchorRect: DOMRect
  menuWidth: number
  menuHeight: number
  offset?: number
  viewportWidth: number
  viewportHeight: number
  align?: 'start' | 'end'
}

export function clampPopoverPosition({ anchorRect, menuWidth, menuHeight, offset = 8, viewportWidth, viewportHeight, align = 'end' }: PopoverPositionArgs) {
  const safeMargin = 8
  const left = align === 'start' ? anchorRect.left : anchorRect.right - menuWidth
  const clampedLeft = Math.min(Math.max(left, safeMargin), Math.max(safeMargin, viewportWidth - menuWidth - safeMargin))
  let top = anchorRect.bottom + offset
  if (top + menuHeight > viewportHeight - safeMargin) {
    top = Math.max(safeMargin, anchorRect.top - menuHeight - offset)
  }
  return { left: clampedLeft, top: Math.min(Math.max(top, safeMargin), Math.max(safeMargin, viewportHeight - menuHeight - safeMargin)) }
}

export function Popover({ open, anchorRef, onClose, className, role = 'menu', children, align = 'end', offset = 8 }: { open: boolean; anchorRef: RefObject<HTMLElement | null>; onClose: () => void; className?: string; role?: 'menu' | 'dialog'; children: ReactNode; align?: 'start' | 'end'; offset?: number }) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ left: 0, top: 0 })

  useEffect(() => {
    if (!open || !anchorRef.current) return

    const updatePosition = () => {
      const rect = anchorRef.current?.getBoundingClientRect()
      if (!rect) return
      const width = menuRef.current?.offsetWidth ?? 176
      const height = menuRef.current?.offsetHeight ?? 200
      setPosition(clampPopoverPosition({ anchorRect: rect, menuWidth: width, menuHeight: height, offset, viewportWidth: window.innerWidth, viewportHeight: window.innerHeight, align }))
    }

    updatePosition()
    const handleResize = () => updatePosition()
    const handleScroll = () => updatePosition()
    const handlePointerDown = (event: MouseEvent) => {
      const menu = menuRef.current
      const anchor = anchorRef.current
      const target = event.target
      if (!(target instanceof Node)) return
      if (menu && menu.contains(target)) return
      if (anchor && anchor.contains(target)) return
      onClose()
    }
    const handleKeyDown = (event: KeyboardEvent | globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onClose()
      anchorRef.current?.focus()
    }

    window.addEventListener('resize', handleResize)
    window.addEventListener('scroll', handleScroll, true)
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('scroll', handleScroll, true)
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [align, anchorRef, offset, onClose, open])

  if (!open) return null

  return <div ref={menuRef} className={className} role={role} style={{ position: 'fixed', left: position.left, top: position.top, zIndex: 60 }}>{children}</div>
}

export function Logo() {
  return <div className="brand"><span className="brand-mark"><FileText size={16} strokeWidth={2.5} /></span><span>MarkItDown</span></div>
}

export function IconButton({ label, children, onClick, active = false, buttonRef, ariaExpanded, ariaHasPopup }: { label: string; children: ReactNode; onClick: () => void; active?: boolean; buttonRef?: RefObject<HTMLButtonElement | null>; ariaExpanded?: boolean; ariaHasPopup?: 'menu' | 'dialog' }) {
  return <button type="button" ref={buttonRef} className={`icon-button ${active ? 'is-active' : ''}`} aria-label={label} title={label} aria-expanded={ariaExpanded} aria-haspopup={ariaHasPopup} onClick={onClick}>{children}</button>
}

export function MenuItem({ label, children, onClick, role }: { label: string; children: ReactNode; onClick: () => void; role?: 'menuitem' }) {
  return <button type="button" className="menu-item" role={role} onClick={onClick}>{children}<span>{label}</span></button>
}

export function ToolbarButton({ label, children, onClick }: { label: string; children: ReactNode; onClick: () => void }) {
  return <button type="button" className="toolbar-button" onClick={onClick} title={label} aria-label={label}>{children}</button>
}

export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const dialogRef = useRef<HTMLElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialogRef.current?.querySelector<HTMLElement>('button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])')?.focus()
    return () => previousFocusRef.current?.focus()
  }, [])

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      onClose()
      return
    }
    if (event.key !== 'Tab') return
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])')
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

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section ref={dialogRef} className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onKeyDown={handleKeyDown}><div className="modal-header"><h2 id="modal-title">{title}</h2><IconButton label="Close dialog" onClick={onClose}><X size={17} /></IconButton></div>{children}</section></div>
}
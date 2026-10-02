export interface EditorBounds {
  left: number
  top: number
  right: number
  bottom: number
}

export interface AssistPosition {
  left: number
  top: number
  maxHeight: number
}

export function getEditorAssistPosition(bounds: EditorBounds, viewportWidth: number, viewportHeight: number): AssistPosition {
  const width = Math.min(280, Math.max(180, viewportWidth - 16))
  const left = Math.max(8, Math.min(bounds.left + 48, viewportWidth - width - 8))
  const maxHeight = Math.min(220, Math.max(120, viewportHeight - 24))
  const top = Math.max(8, Math.min(bounds.top + 48, viewportHeight - maxHeight - 8))
  return { left, top, maxHeight }
}

export interface EditorAssistItem {
  id: string
  label: string
  description: string
}
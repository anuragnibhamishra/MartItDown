import type { TextEdit } from './editorTransforms'

export function applyTextareaEdit(element: HTMLTextAreaElement, edit: TextEdit): void {
  element.focus()
  element.setSelectionRange(edit.start, edit.end)
  let inserted = false
  try {
    inserted = document.execCommand('insertText', false, edit.text)
  } catch {
    inserted = false
  }
  if (!inserted) {
    element.setRangeText(edit.text, edit.start, edit.end, 'end')
    element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: edit.text }))
  }
  requestAnimationFrame(() => {
    element.focus()
    element.setSelectionRange(edit.selectionStart, edit.selectionEnd)
  })
}
import { useEffect, type RefObject } from 'react'
import { mapScrollPosition } from '../utils/editorTransforms'

export function useScrollSync(
  editorRef: RefObject<HTMLTextAreaElement | null>,
  previewRef: RefObject<HTMLElement | null>,
  enabled: boolean,
) {
  useEffect(() => {
    if (!enabled) return
    const editor = editorRef.current
    const preview = previewRef.current
    if (!editor || !preview) return

    let animationFrame = 0
    let syncingTarget: HTMLElement | null = null
    const synchronize = (source: HTMLElement, target: HTMLElement) => {
      if (syncingTarget === source) {
        syncingTarget = null
        return
      }
      cancelAnimationFrame(animationFrame)
      animationFrame = requestAnimationFrame(() => {
        const targetPosition = mapScrollPosition(source.scrollTop, source.scrollHeight, source.clientHeight, target.scrollHeight, target.clientHeight)
        if (Math.abs(target.scrollTop - targetPosition) < 1) return
        syncingTarget = target
        target.scrollTop = targetPosition
        requestAnimationFrame(() => { if (syncingTarget === target) syncingTarget = null })
      })
    }
    const fromEditor = () => synchronize(editor, preview)
    const fromPreview = () => synchronize(preview, editor)
    editor.addEventListener('scroll', fromEditor, { passive: true })
    preview.addEventListener('scroll', fromPreview, { passive: true })
    return () => {
      cancelAnimationFrame(animationFrame)
      editor.removeEventListener('scroll', fromEditor)
      preview.removeEventListener('scroll', fromPreview)
    }
  }, [editorRef, previewRef, enabled])
}
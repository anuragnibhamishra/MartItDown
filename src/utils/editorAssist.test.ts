import { describe, expect, it } from 'vitest'
import { getEditorAssistPosition } from './editorAssist'

describe('editor assist positioning', () => {
  it('keeps the shared popup within small and large viewports', () => {
    expect(getEditorAssistPosition({ left: 0, top: 0, right: 100, bottom: 200 }, 320, 480))
      .toEqual({ left: 32, top: 48, maxHeight: 220 })
    expect(getEditorAssistPosition({ left: 900, top: 800, right: 1000, bottom: 900 }, 1024, 768))
      .toEqual({ left: 736, top: 540, maxHeight: 220 })
  })
})
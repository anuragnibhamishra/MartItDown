import type { CSSProperties } from 'react'
import type { EditorAssistItem } from '../../utils/editorAssist'

interface EditorAssistMenuProps {
  id: string
  label: string
  items: EditorAssistItem[]
  activeIndex: number
  style: CSSProperties
  onChoose: (item: EditorAssistItem) => void
  onHover: (index: number) => void
}

export function EditorAssistMenu({ id, label, items, activeIndex, style, onChoose, onHover }: EditorAssistMenuProps) {
  if (items.length === 0) return null
  return <div className="editor-assist-menu" id={id} role="listbox" aria-label={label} style={style}>
    {items.map((item, index) => <button type="button" id={`${id}-option-${index}`} role="option" aria-selected={activeIndex === index} className={activeIndex === index ? 'is-active' : ''} key={item.id} onMouseEnter={() => onHover(index)} onMouseDown={(event) => event.preventDefault()} onClick={() => onChoose(item)}>
      <span>{item.label}</span><small>{item.description}</small>
    </button>)}
  </div>
}
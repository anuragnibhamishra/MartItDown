import { useEffect, useId, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, ListTree } from 'lucide-react'
import { extractHeadings } from '../../utils/toc'

const preferenceKey = 'markitdown-toc'

function loadCollapsedPreference(): boolean {
  try {
    return localStorage.getItem(preferenceKey) === 'collapsed'
  } catch {
    return false
  }
}

export function TocPanel({ markdown }: { markdown: string }) {
  const headings = useMemo(() => extractHeadings(markdown), [markdown])
  const [collapsed, setCollapsed] = useState(loadCollapsedPreference)
  const [activeSlug, setActiveSlug] = useState(headings[0]?.slug ?? '')
  const contentId = useId()

  useEffect(() => {
    if (headings.length < 2) return
    const root = document.querySelector('.preview-scroll')
    const targets = headings.map(({ slug }) => document.getElementById(slug)).filter((element): element is HTMLElement => element !== null)
    if (!root || targets.length === 0) return
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting)
        .sort((left, right) => left.boundingClientRect.top - right.boundingClientRect.top)[0]
      if (visible) setActiveSlug(visible.target.id)
    }, { root, rootMargin: '-12% 0px -72% 0px', threshold: 0 })
    targets.forEach((target) => observer.observe(target))
    return () => observer.disconnect()
  }, [headings])

  if (headings.length < 2) return null

  const toggle = () => setCollapsed((current) => {
    const next = !current
    try { localStorage.setItem(preferenceKey, next ? 'collapsed' : 'expanded') } catch { /* Storage can be disabled. */ }
    return next
  })

  const jumpTo = (slug: string) => {
    setActiveSlug(slug)
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
    document.getElementById(slug)?.scrollIntoView({ behavior, block: 'start' })
  }

  return <nav className={`toc-panel ${collapsed ? 'is-collapsed' : ''}`} aria-label="Table of contents">
    <button type="button" className="toc-heading" aria-expanded={!collapsed} aria-controls={contentId} onClick={toggle}>
      {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}<ListTree size={14} /><span>On this page</span>
    </button>
    {!collapsed && <ol id={contentId} className="toc-list">{headings.map((heading) => <li key={`${heading.slug}-${heading.line}`}>
      <button type="button" className={activeSlug === heading.slug ? 'is-active' : ''} style={{ '--toc-depth': heading.level - 1 } as React.CSSProperties} onClick={() => jumpTo(heading.slug)}>{heading.text}</button>
    </li>)}</ol>}
  </nav>
}
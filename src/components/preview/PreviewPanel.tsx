import { lazy, Suspense, useEffect, useState, type ComponentProps, type RefObject } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { MoreHorizontal, Search, Type } from 'lucide-react'
import { IconButton } from '../common/Controls'
import { CodeBlock } from '../markdown/CodeBlock'
import type { Note, Theme } from '../../types/editor'
import { TocPanel } from './TocPanel'
import { BacklinksPanel } from './BacklinksPanel'
import type { createLinkGraph } from '../../services/linkGraph'
import { remarkWikiLinks } from '../../plugins/remarkWikiLinks'
import { rehypeHeadingSlugs } from '../../plugins/rehypeHeadingSlugs'
import { containsMath, protectCurrencyPairs } from '../../utils/math'
import type { PluggableList } from 'unified'

const MermaidDiagram = lazy(() => import('../markdown/MermaidDiagram').then((module) => ({ default: module.MermaidDiagram })))

type MathPlugins = {
  remark: typeof import('remark-math').default
  rehype: typeof import('rehype-katex').default
}

type LinkGraph = ReturnType<typeof createLinkGraph>

interface PreviewPanelProps {
  content: string
  isVisible: boolean
  notes: Note[]
  activeNote: Note | null
  graph: LinkGraph
  theme: Theme
  scrollContainerRef: RefObject<HTMLDivElement | null>
  menuButtonRef: RefObject<HTMLButtonElement | null>
  menuOpen: boolean
  onMoreOptions: () => void
  onOpenNote: (id: string, heading?: string) => void
  onRequestCreateNote: (title: string) => void
  onLinkMention: (sourceId: string) => void
}

export function PreviewPanel({ content, isVisible, notes, activeNote, graph, theme, scrollContainerRef, menuButtonRef, menuOpen, onMoreOptions, onOpenNote, onRequestCreateNote, onLinkMention }: PreviewPanelProps) {
  const hasMath = containsMath(content)
  const renderedContent = hasMath ? protectCurrencyPairs(content) : content
  const [mathPlugins, setMathPlugins] = useState<MathPlugins | null>(null)
  const [mathLoadError, setMathLoadError] = useState(false)

  useEffect(() => {
    if (!hasMath || mathPlugins || mathLoadError) return
    let cancelled = false
    void Promise.all([
      import('remark-math'),
      import('rehype-katex'),
      import('katex/dist/katex.min.css'),
    ]).then(([remark, rehype]) => {
      if (!cancelled) setMathPlugins({ remark: remark.default, rehype: rehype.default })
    }).catch(() => {
      if (!cancelled) setMathLoadError(true)
    })
    return () => { cancelled = true }
  }, [hasMath, mathPlugins, mathLoadError])

  const remarkPlugins = [remarkGfm, remarkWikiLinks(notes), ...(hasMath && mathPlugins ? [mathPlugins.remark] : [])]
  const rehypePlugins: PluggableList = [rehypeHighlight, rehypeHeadingSlugs]
  if (hasMath && mathPlugins) rehypePlugins.push([mathPlugins.rehype, { throwOnError: false, errorColor: 'var(--accent)' }])
  const renderLink = ({ href, children, ...props }: ComponentProps<'a'>) => {
    const attributes = props as ComponentProps<'a'> & { 'data-note-id'?: string; 'data-missing-title'?: string; 'data-heading-slug'?: string }
    const noteId = attributes['data-note-id']
    const missingTitle = attributes['data-missing-title']
    const heading = attributes['data-heading-slug']
    const anchorProps = { ...attributes }
    delete anchorProps['data-note-id']
    delete anchorProps['data-missing-title']
    delete anchorProps['data-heading-slug']
    return <a {...anchorProps} href={href} onClick={(event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      if (noteId) { event.preventDefault(); onOpenNote(noteId, heading); return }
      if (missingTitle) { event.preventDefault(); onRequestCreateNote(missingTitle) }
    }} data-note-id={noteId} data-missing-title={missingTitle} data-heading-slug={heading}>{children}</a>
  }

  return <section className={`panel preview-panel ${isVisible ? 'mobile-visible' : ''}`}>
    <div className="panel-heading"><div><span className="eyebrow">02</span><h1>Preview</h1></div><div className="panel-heading-actions"><span className="live-indicator"><span />Live</span><IconButton label="More preview options" ariaExpanded={menuOpen} ariaHasPopup="menu" buttonRef={menuButtonRef} onClick={onMoreOptions}><MoreHorizontal size={17} /></IconButton></div></div>
    <div className="preview-scroll" ref={scrollContainerRef}><TocPanel markdown={content} />{hasMath && !mathPlugins && !mathLoadError && <div className="math-loading" role="status">Loading math renderer...</div>}{mathLoadError && <div className="math-load-error" role="status">Math rendering is unavailable. Formula source remains visible.</div>}{content.trim() ? <article className="markdown-body"><Markdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins} components={{
      code({ className, children, ...props }) {
        const language = className?.match(/language-([^\s]+)/)?.[1]
        if (language === 'mermaid') return <Suspense fallback={<div className="mermaid-skeleton" role="status">Loading diagram renderer...</div>}><MermaidDiagram source={String(children).replace(/\n$/, '')} theme={theme} /></Suspense>
        const isBlock = String(children).includes('\n')
        return isBlock ? <CodeBlock className={className}>{children}</CodeBlock> : <code className={className} {...props}>{children}</code>
      },
      a: renderLink,
    }}>{renderedContent}</Markdown></article> : <div className="empty-preview"><div className="empty-icon"><Type size={18} /></div><p>Nothing to preview yet.</p><span>Your rendered Markdown will appear here.</span></div>}<BacklinksPanel note={activeNote} graph={graph} onSelectNote={(id) => onOpenNote(id)} onLinkMention={onLinkMention} /></div>
  </section>
}

export function MobileViewTabs({ view, onChange }: { view: 'write' | 'preview'; onChange: (view: 'write' | 'preview') => void }) {
  return <div className="mobile-tabs"><button className={view === 'write' ? 'active' : ''} onClick={() => onChange('write')} type="button"><Type size={15} />Write</button><button className={view === 'preview' ? 'active' : ''} onClick={() => onChange('preview')} type="button"><Search size={15} />Preview</button></div>
}
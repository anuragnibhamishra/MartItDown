import { useEffect, useState, useSyncExternalStore } from 'react'
import type { Theme } from '../../types/editor'

interface MermaidDiagramProps {
  source: string
  theme: Theme
}

type DiagramResult = { key: string; svg: string; error: string | null }

const renderedCache = new Map<string, string>()
let diagramSequence = 0

function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function subscribeColorScheme(onChange: () => void): () => void {
  const preference = window.matchMedia('(prefers-color-scheme: dark)')
  preference.addEventListener('change', onChange)
  return () => preference.removeEventListener('change', onChange)
}

function getSystemDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function MermaidDiagram({ source, theme }: MermaidDiagramProps) {
  const [result, setResult] = useState<DiagramResult>({ key: '', svg: '', error: null })
  const [showSource, setShowSource] = useState(false)
  const [actionMessage, setActionMessage] = useState('')
  const systemDark = useSyncExternalStore(subscribeColorScheme, getSystemDark, () => false)
  const dark = theme === 'dark' || (theme === 'system' && systemDark)
  const diagramTheme = dark ? 'dark' : 'default'
  const cacheKey = `${diagramTheme}\u0000${source}`
  const cachedSvg = renderedCache.get(cacheKey)
  const currentResult = result.key === cacheKey ? result : { key: cacheKey, svg: cachedSvg ?? '', error: null }

  useEffect(() => {
    let cancelled = false
    const cached = renderedCache.get(cacheKey)
    if (cached) return () => { cancelled = true }

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const module = await import('mermaid')
          module.default.initialize({ startOnLoad: false, securityLevel: 'strict', theme: diagramTheme, suppressErrorRendering: true })
          diagramSequence += 1
          const { svg } = await module.default.render(`markitdown-mermaid-${diagramSequence}`, source)
          if (cancelled) return
          renderedCache.set(cacheKey, svg)
          if (renderedCache.size > 80) renderedCache.delete(renderedCache.keys().next().value ?? '')
          setResult({ key: cacheKey, svg, error: null })
        } catch (error) {
          if (cancelled) return
          const message = error instanceof Error ? error.message : 'Unable to render this Mermaid diagram.'
          setResult({ key: cacheKey, svg: '', error: message })
        }
      })()
    }, 300)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [cacheKey, diagramTheme, source])

  const copySvg = async () => {
    try {
      await navigator.clipboard.writeText(currentResult.svg)
      setActionMessage('SVG copied')
    } catch {
      setActionMessage('Unable to copy SVG')
    }
  }

  const downloadSvg = () => {
    const url = URL.createObjectURL(new Blob([currentResult.svg], { type: 'image/svg+xml;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'mermaid-diagram.svg'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return <figure className="mermaid-figure" aria-label="Mermaid diagram">
    <div className="mermaid-toolbar">
      <span>Mermaid</span>
      <div>
        <button type="button" onClick={() => setShowSource((visible) => !visible)}>{showSource ? 'View diagram' : 'View source'}</button>
        {currentResult.svg && <>
          <button type="button" aria-label="Copy SVG" onClick={() => { void copySvg() }}>Copy SVG</button>
          <button type="button" aria-label="Download SVG" onClick={downloadSvg}>Download SVG</button>
        </>}
      </div>
    </div>
    <div className="mermaid-content" aria-live="polite">
      {showSource ? <pre><code>{source}</code></pre> : currentResult.error
        ? <div className="mermaid-error" role="status"><strong>Diagram could not be rendered</strong><span>{currentResult.error}</span><pre><code>{source}</code></pre></div>
        : currentResult.svg ? <img className="mermaid-image" src={svgDataUrl(currentResult.svg)} alt="Rendered Mermaid diagram. Choose View source to inspect the diagram text." />
          : <div className="mermaid-skeleton" role="status"><span />Rendering diagram...</div>}
    </div>
    <figcaption className="visually-hidden">Mermaid diagram, rendered as an image from sanitized SVG. Diagram source is available with View source.</figcaption>
    <span className="visually-hidden" aria-live="polite">{actionMessage}</span>
  </figure>
}
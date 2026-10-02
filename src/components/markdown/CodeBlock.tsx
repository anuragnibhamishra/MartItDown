import { useState, type ReactNode } from 'react'
import { Check, Clipboard } from 'lucide-react'

export function CodeBlock({ className, children }: { className?: string; children?: ReactNode }) {
  const [copied, setCopied] = useState(false)
  const code = String(children).replace(/\n$/, '')
  const language = className?.replace('language-', '')

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      // Clipboard access can be unavailable in local files.
    }
  }

  return <div className="code-block"><div className="code-header"><span>{language || 'code'}</span><button type="button" onClick={copy}>{copied ? <Check size={13} /> : <Clipboard size={13} />}{copied ? 'Copied' : 'Copy'}</button></div><pre><code className={className}>{code}</code></pre></div>
}
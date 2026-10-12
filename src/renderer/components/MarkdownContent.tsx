import { Children, isValidElement } from 'react'
import type { ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { stripAnsi } from '../utils'
import { CodeBlock } from './CodeBlock'

interface MarkdownContentProps {
  children: string
  className?: string
}

function nodeText(value: ReactNode): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (Array.isArray(value)) return value.map(nodeText).join('')
  return ''
}

function languageFromClassName(className: string | undefined): string | null {
  const match = /(?:^|\s)(?:language|lang)-([\w+#-]+)/i.exec(className ?? '')
  return match?.[1] ?? null
}

const markdownComponents: Components = {
  pre: ({ children }) => {
    const child = Children.toArray(children).find(isValidElement)
    if (!isValidElement<{ children?: ReactNode; className?: string }>(child)) {
      return <pre>{children}</pre>
    }

    return (
      <CodeBlock
        code={nodeText(child.props.children)}
        language={languageFromClassName(child.props.className)}
      />
    )
  },
  code: ({ className, children }) => <code className={className}>{children}</code>,
  a: ({ children: linkChildren }) => (
    <a
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
      }}
    >
      {linkChildren}
    </a>
  ),
}

export function MarkdownContent({ children, className = '' }: MarkdownContentProps) {
  return (
    <div className={`markdown-content ${className}`.trim()}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {stripAnsi(children)}
      </ReactMarkdown>
    </div>
  )
}

import { Highlight, themes } from 'prism-react-renderer'
import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { cx } from '../utils'
import { formatCode, languageLabel } from '../code-format'
import Prism from '../prism'

interface CodeBlockProps {
  className?: string
  code: string
  expandable?: boolean
  filePath?: string | null
  label?: string | null
  language?: string | null
  maxHeight?: number
}

export function CodeBlock({
  className,
  code,
  expandable = true,
  filePath = null,
  label,
  language,
  maxHeight = 320,
}: CodeBlockProps) {
  const [expanded, setExpanded] = useState(false)
  const formatted = useMemo(
    () => formatCode(code, { filePath, language: language ?? null }),
    [code, filePath, language],
  )
  const canExpand = expandable && formatted.code.length > 900
  const lineCount = formatted.code.length === 0 ? 0 : formatted.code.split('\n').length

  useEffect(() => setExpanded(false), [code, filePath, language])

  return (
    <div className={cx('code-block-shell', className)}>
      <div className="code-block-toolbar">
        <span className="code-language">{languageLabel(formatted.language)}</span>
        {label && <span className="code-context-label">{label}</span>}
        {formatted.formatted && <span className="code-format-badge">已格式化</span>}
        {lineCount > 0 && <span className="code-line-count">{lineCount} 行</span>}
      </div>
      <div
        className={cx('code-block', canExpand && !expanded && 'clamped')}
        style={{ '--clamp-height': `${maxHeight}px` } as CSSProperties}
      >
        <Highlight
          code={formatted.code}
          language={formatted.language}
          prism={Prism}
          theme={themes.vsDark}
        >
          {({ getLineProps, getTokenProps, tokens }) => (
            <pre className="code-highlight">
              <code>
                {tokens.map((line, lineIndex) => {
                  const { style: _lineStyle, ...lineProps } = getLineProps({ line })
                  return (
                    <span
                      {...lineProps}
                      className={cx('code-line', lineProps.className)}
                      key={lineIndex}
                    >
                      <span aria-hidden="true" className="code-line-number">{lineIndex + 1}</span>
                      <span className="code-line-content">
                        {line.length === 0
                          ? '\u200b'
                          : line.map((token, tokenIndex) => {
                              const {
                                children: _children,
                                style: _tokenStyle,
                                ...tokenProps
                              } = getTokenProps({ token })
                              return (
                                <span
                                  {...tokenProps}
                                  className={cx('code-token', tokenProps.className)}
                                  key={tokenIndex}
                                >
                                  {token.content}
                                </span>
                              )
                            })}
                      </span>
                    </span>
                  )
                })}
              </code>
            </pre>
          )}
        </Highlight>
      </div>
      {canExpand && (
        <button
          aria-expanded={expanded}
          className="expand-button"
          onClick={() => setExpanded((value) => !value)}
          type="button"
        >
          <svg
            aria-hidden="true"
            className={cx(expanded && 'rotated')}
            fill="none"
            height="14"
            viewBox="0 0 24 24"
            width="14"
          >
            <path d="m6 9 6 6 6-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </svg>
          {expanded ? '收起代码' : '展开完整代码'}
        </button>
      )}
    </div>
  )
}

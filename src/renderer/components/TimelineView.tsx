import {
  Bot,
  Box,
  Brain,
  CircleAlert,
  Clock3,
  Cpu,
  FileOutput,
  GitCommitHorizontal,
  Image as ImageIcon,
  MessagesSquare,
  Search,
  Sparkles,
  UserRound,
  Wrench,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { SessionDetail, SessionEntry, SessionRole, ToolCallBlock } from '../../shared/types'
import { stringifyCodeValue, toolCallCodeSources, toolResultLanguage } from '../code-format'
import { cx, formatCost, formatFullDateTime, formatNumber, stripAnsi } from '../utils'
import { CodeBlock } from './CodeBlock'
import { MarkdownContent } from './MarkdownContent'

export type TimelineFilter = 'all' | 'conversation' | 'tools' | 'events' | 'errors'

interface TimelineViewProps {
  session: SessionDetail
  query: string
  filter: TimelineFilter
  focusedEntryId: string | null
  onFilterChange: (filter: TimelineFilter) => void
  onQueryChange: (value: string) => void
  onClearQuery: () => void
}

interface RolePresentation {
  label: string
  icon: LucideIcon
  className: string
}

const rolePresentation: Record<SessionRole, RolePresentation> = {
  user: { label: '用户', icon: UserRound, className: 'user' },
  assistant: { label: 'Pi', icon: Sparkles, className: 'assistant' },
  toolResult: { label: '工具结果', icon: Wrench, className: 'tool' },
  system: { label: '系统', icon: Cpu, className: 'system' },
  event: { label: '事件', icon: GitCommitHorizontal, className: 'event' },
}

const filterOptions: Array<{ id: TimelineFilter; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'conversation', label: '对话' },
  { id: 'tools', label: '工具' },
  { id: 'events', label: '事件' },
  { id: 'errors', label: '错误' },
]

const eventLabels: Record<string, string> = {
  session: '会话开始',
  session_info: '会话信息',
  model_change: '模型切换',
  thinking_level_change: '思考级别',
  custom_message: '自定义消息',
  context_edit: '上下文编辑',
  compaction: '上下文压缩',
  custom: '扩展事件',
  unknown: '未知事件',
}

function entryDomId(id: string): string {
  return `timeline-entry-${id}`
}

function hasToolCall(entry: SessionEntry): boolean {
  return entry.blocks.some((block) => block.type === 'toolCall')
}

function matchesFilter(entry: SessionEntry, filter: TimelineFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'conversation') return entry.role === 'user' || entry.role === 'assistant'
  if (filter === 'tools') return entry.role === 'toolResult' || hasToolCall(entry)
  if (filter === 'errors') return entry.isError
  return entry.role === 'event' || entry.role === 'system' || entry.type !== 'message'
}

function entrySearchText(entry: SessionEntry): string {
  return [
    entry.text,
    entry.thinking,
    entry.toolName ?? '',
    entry.model ?? '',
    entry.type,
    ...entry.blocks.flatMap((block) =>
      block.type === 'toolCall' ? [block.name, JSON.stringify(block.arguments)] : [],
    ),
  ]
    .join('\n')
    .toLocaleLowerCase()
}

function ExpandableCode({
  value,
  language,
  label,
  filePath = null,
  maxHeight = 320,
}: {
  value: string
  language?: string | null
  label?: string
  filePath?: string | null
  maxHeight?: number
}) {
  return (
    <div className="expandable-wrap">
      <CodeBlock
        code={value}
        expandable
        filePath={filePath}
        language={language ?? null}
        label={label ?? null}
        maxHeight={maxHeight}
      />
    </div>
  )
}

interface EntryCardProps {
  entry: SessionEntry
  focused: boolean
  resultByCallId: Map<string, SessionEntry>
  toolCallById: Map<string, ToolCallBlock>
  onLocateResult: (entryId: string) => void
}

function EntryCard({ entry, focused, resultByCallId, toolCallById, onLocateResult }: EntryCardProps) {
  const presentation = rolePresentation[entry.role]
  const RoleIcon = presentation.icon
  const toolCalls = entry.blocks.filter((block) => block.type === 'toolCall')
  const images = entry.blocks.filter((block) => block.type === 'image')
  const resultToolCall = entry.toolCallId ? toolCallById.get(entry.toolCallId) : undefined
  const resultLanguage = toolResultLanguage(resultToolCall?.arguments)
  const hasHiddenDetails = entry.role === 'toolResult'
    ? entry.details !== null
    : entry.role === 'event' && entry.details !== null

  return (
    <article
      id={entryDomId(entry.id)}
      data-entry-id={entry.id}
      className={cx(
        'entry-card',
        presentation.className,
        entry.isError && 'has-error',
        focused && 'focused',
        !entry.isDisplay && 'hidden-entry',
      )}
    >
      <div className="timeline-rail">
        <div className="entry-avatar"><RoleIcon size={15} /></div>
        <span className="rail-line" />
      </div>
      <div className="entry-content">
        <header className="entry-header">
          <div className="entry-identity">
            <strong>{presentation.label}</strong>
            {entry.role === 'toolResult' && entry.toolName && <code>{entry.toolName}</code>}
            {entry.role === 'event' && <code>{eventLabels[entry.type] ?? entry.type}</code>}
            {entry.isError && <span className="entry-error"><CircleAlert size={12} /> 错误</span>}
          </div>
          <div className="entry-meta">
            {entry.model && <span>{entry.model}</span>}
            {entry.stopReason && entry.stopReason !== 'stop' && <span>{entry.stopReason}</span>}
            {entry.usage && <span>{formatNumber(entry.usage.totalTokens)} tok</span>}
            {entry.usage?.cost !== null && entry.usage?.cost !== undefined && (
              <span>{formatCost(entry.usage.cost)}</span>
            )}
            <time dateTime={entry.timestamp} title={formatFullDateTime(entry.timestamp)}>
              <Clock3 size={11} /> {formatFullDateTime(entry.timestamp).slice(5)}
            </time>
          </div>
        </header>

        {entry.text && (
          entry.role === 'toolResult' ? (
            <ExpandableCode value={entry.text} language={resultLanguage} label="结果" />
          ) : entry.role === 'system' || entry.role === 'event' ? (
            <div className="plain-event-text">{stripAnsi(entry.text)}</div>
          ) : (
            <MarkdownContent>{entry.text}</MarkdownContent>
          )
        )}

        {entry.thinking && (
          <details className="thinking-block">
            <summary><Brain size={14} /> 思考过程 <span>{formatNumber(entry.thinking.length)} 字符</span></summary>
            <MarkdownContent>{entry.thinking}</MarkdownContent>
          </details>
        )}

        {toolCalls.map((toolCall) => {
          const resultEntry = resultByCallId.get(toolCall.id) ?? null
          return (
            <div className="tool-call-card" key={toolCall.id || `${entry.id}-${toolCall.name}`}>
              <div className="tool-call-heading">
                <span className="tool-call-icon"><Box size={14} /></span>
                <div>
                  <strong>{toolCall.name}</strong>
                  <small>{resultEntry ? '调用完成' : '等待结果'}</small>
                </div>
                {resultEntry && (
                  <button onClick={() => onLocateResult(resultEntry.id)}>
                    <FileOutput size={13} /> 查看结果
                  </button>
                )}
              </div>
              {toolCallCodeSources(toolCall.name, toolCall.arguments).map((source) => (
                <ExpandableCode
                  key={`${toolCall.id || toolCall.name}-${source.label}`}
                  value={source.value}
                  language={source.language}
                  label={source.label}
                  filePath={source.filePath}
                  maxHeight={source.label === '命令' ? 220 : 180}
                />
              ))}
            </div>
          )
        })}

        {images.map((image, index) => (
          <div className="message-image" key={`${entry.id}-image-${index}`}>
            <img src={`data:${image.mimeType};base64,${image.data}`} alt={`消息图片 ${index + 1}`} />
            <span><ImageIcon size={12} /> {image.mimeType}</span>
          </div>
        ))}

        {hasHiddenDetails && (
          <details className="structured-details">
            <summary>结构化详情</summary>
            <ExpandableCode
              value={stringifyCodeValue(entry.details)}
              language="json"
              label="结构化数据"
              maxHeight={260}
            />
          </details>
        )}
      </div>
    </article>
  )
}

export function TimelineView({
  session,
  query,
  filter,
  focusedEntryId,
  onFilterChange,
  onQueryChange,
  onClearQuery,
}: TimelineViewProps) {
  const [visibleLimit, setVisibleLimit] = useState(120)
  const timelineRef = useRef<HTMLElement>(null)
  const normalizedQuery = query.trim().toLocaleLowerCase()

  const toolCallById = useMemo(() => {
    const calls = new Map<string, ToolCallBlock>()
    for (const entry of session.entries) {
      for (const block of entry.blocks) {
        if (block.type === 'toolCall' && block.id) calls.set(block.id, block)
      }
    }
    return calls
  }, [session.entries])

  const resultByCallId = useMemo(() => {
    const results = new Map<string, SessionEntry>()
    for (const entry of session.entries) {
      if (entry.role === 'toolResult' && entry.toolCallId) results.set(entry.toolCallId, entry)
    }
    return results
  }, [session.entries])

  const filteredEntries = useMemo(
    () => session.entries.filter((entry) => {
      if (!matchesFilter(entry, filter)) return false
      return !normalizedQuery || entrySearchText(entry).includes(normalizedQuery)
    }),
    [filter, normalizedQuery, session.entries],
  )

  useEffect(() => {
    timelineRef.current?.parentElement?.scrollTo({ top: 0 })
  }, [session.id])
  useEffect(() => setVisibleLimit(120), [filter, normalizedQuery, session.id])
  useEffect(() => {
    if (!focusedEntryId) return
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(entryDomId(focusedEntryId))?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [focusedEntryId, filteredEntries.length])

  const locateResult = (entryId: string): void => {
    const filteredIndex = filteredEntries.findIndex((entry) => entry.id === entryId)
    if (filteredIndex >= 0) {
      setVisibleLimit((limit) => Math.max(limit, filteredIndex + 50))
    } else {
      const sessionIndex = session.entries.findIndex((entry) => entry.id === entryId)
      onClearQuery()
      onFilterChange('all')
      setVisibleLimit(Math.max(120, sessionIndex + 50))
    }
    window.requestAnimationFrame(() => {
      document.getElementById(entryDomId(entryId))?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }

  const visibleEntries = filteredEntries.slice(0, visibleLimit)
  const remaining = Math.max(0, filteredEntries.length - visibleEntries.length)

  return (
    <section className="timeline-view" ref={timelineRef}>
      <div className="timeline-toolbar">
        <div className="timeline-filters">
          {filterOptions.map((option) => (
            <button
              key={option.id}
              className={cx(filter === option.id && 'active')}
              onClick={() => onFilterChange(option.id)}
            >
              {option.label}
              {option.id === 'errors' && session.errorCount > 0 && <span>{session.errorCount}</span>}
            </button>
          ))}
        </div>
        <div className="timeline-search-group">
          <label className="timeline-search">
            <Search size={14} />
            <input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="在时间线中搜索"
              aria-label="在时间线中搜索"
            />
          </label>
          <div className="timeline-result-count">
            <MessagesSquare size={14} /> {formatNumber(filteredEntries.length)} / {formatNumber(session.entryCount)}
          </div>
        </div>
      </div>

      {normalizedQuery && (
        <div className="active-search-note">
          正在时间线中搜索“<strong>{query}</strong>”
          <button onClick={onClearQuery}>清除</button>
        </div>
      )}

      <div className="timeline-stream">
        {visibleEntries.map((entry) => (
          <EntryCard
            key={entry.id}
            entry={entry}
            focused={entry.id === focusedEntryId}
            resultByCallId={resultByCallId}
            toolCallById={toolCallById}
            onLocateResult={locateResult}
          />
        ))}
        {!filteredEntries.length && (
          <div className="timeline-empty">
            <MessagesSquare size={24} />
            <strong>没有匹配的事件</strong>
            <span>尝试切换筛选条件或清空搜索词。</span>
          </div>
        )}
        {remaining > 0 && (
          <button className="load-more" onClick={() => setVisibleLimit((limit) => limit + 120)}>
            加载更多 <span>{remaining}</span>
          </button>
        )}
      </div>

      <div className="timeline-end">
        <Bot size={15} /> 会话共 {formatNumber(session.entryCount)} 个事件
      </div>
    </section>
  )
}

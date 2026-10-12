import {
  AlertCircle,
  Clock3,
  Database,
  FolderOpen,
  GitFork,
  RefreshCw,
  RotateCcw,
  Search,
  Sparkles,
  X,
} from 'lucide-react'
import type { CSSProperties, RefObject } from 'react'
import type { AppConfig, SessionSummary } from '../../shared/types'
import { cx, formatCompactNumber, formatRelativeTime, sessionColor } from '../utils'

export type SessionFilter = 'all' | 'today' | 'active' | 'errors'

interface SessionSidebarProps {
  sessions: SessionSummary[]
  totalCount: number
  selectedPath: string | null
  query: string
  filter: SessionFilter
  config: AppConfig | null
  error: string | null
  refreshing: boolean
  searchInputRef: RefObject<HTMLInputElement | null>
  onQueryChange: (value: string) => void
  onFilterChange: (filter: SessionFilter) => void
  onSelect: (filePath: string) => void
  onChooseRoot: () => void
  onResetRoot: () => void
  onRefresh: () => void
}

const filters: Array<{ id: SessionFilter; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'today', label: '今天' },
  { id: 'active', label: '活跃' },
  { id: 'errors', label: '异常' },
]

export function SessionSidebar({
  sessions,
  totalCount,
  selectedPath,
  query,
  filter,
  config,
  error,
  refreshing,
  searchInputRef,
  onQueryChange,
  onFilterChange,
  onSelect,
  onChooseRoot,
  onResetRoot,
  onRefresh,
}: SessionSidebarProps) {
  return (
    <aside className="sidebar">
      <div className="brand-row">
        <div className="brand-mark" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="brand-copy">
          <strong>PI SESSIONS</strong>
          <span>Session Visualizer</span>
        </div>
        <button className="icon-button subtle" onClick={onRefresh} title="刷新会话" disabled={refreshing}>
          <RefreshCw className={refreshing ? 'spin' : ''} size={16} />
        </button>
      </div>

      <div className="sidebar-search">
        <Search size={15} />
        <input
          ref={searchInputRef}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="搜索会话、内容或工具"
          aria-label="搜索会话"
        />
        {query && (
          <button className="search-clear" onClick={() => onQueryChange('')} title="清空搜索">
            <X size={13} />
          </button>
        )}
        <kbd>⌘K</kbd>
      </div>

      <div className="filter-row" aria-label="会话筛选">
        {filters.map((item) => (
          <button
            key={item.id}
            className={cx('filter-chip', filter === item.id && 'active')}
            onClick={() => onFilterChange(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="sidebar-error" title={error}>
          <AlertCircle size={14} />
          <span>{error.split('\n')[0]}</span>
        </div>
      )}

      <div className="session-list-heading">
        <span>{query || filter !== 'all' ? '筛选结果' : '最近会话'}</span>
        <span>{sessions.length} / {totalCount}</span>
      </div>

      <div className="session-list">
        {sessions.map((session) => {
          const style = { '--session-color': sessionColor(session.id) } as CSSProperties
          return (
            <button
              type="button"
              key={session.filePath}
              className={cx('session-card', selectedPath === session.filePath && 'selected')}
              style={style}
              onClick={() => onSelect(session.filePath)}
            >
              <span className="session-accent" />
              <span className="session-card-main">
                <span className="session-card-title-row">
                  <strong>{session.title}</strong>
                  {session.isActive && <span className="live-dot" title="最近仍在写入" />}
                </span>
                <span className="session-preview">{session.preview}</span>
                <span className="session-meta-row">
                  <span className="workspace-label">
                    <FolderOpen size={12} /> {session.workspace}
                  </span>
                  <span><Clock3 size={12} /> {formatRelativeTime(session.updatedAt)}</span>
                </span>
                <span className="session-stats">
                  <span><Sparkles size={11} /> {session.assistantMessageCount}</span>
                  <span><GitFork size={11} /> {session.toolCallCount}</span>
                  <span>{formatCompactNumber(session.totalTokens)} tok</span>
                  {session.errorCount > 0 && <span className="error-stat">! {session.errorCount}</span>}
                </span>
              </span>
            </button>
          )
        })}
        {!sessions.length && (
          <div className="sidebar-empty">
            <Search size={18} />
            <span>没有匹配的会话</span>
          </div>
        )}
      </div>

      <div className="sidebar-footer">
        <button className="root-button" onClick={onChooseRoot} title="选择其他会话目录">
          <Database size={14} />
          <span>
            <small>{config?.rootSource === 'custom' ? '自定义目录' : 'Pi 数据目录'}</small>
            <strong>{config?.rootPath ?? '正在定位…'}</strong>
          </span>
          <FolderOpen size={13} />
        </button>
        {config?.rootSource === 'custom' && (
          <button className="icon-button subtle reset-root" onClick={onResetRoot} title="恢复默认目录">
            <RotateCcw size={14} />
          </button>
        )}
      </div>
    </aside>
  )
}

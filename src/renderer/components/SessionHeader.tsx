import {
  BarChart3,
  Check,
  ChevronDown,
  Copy,
  Download,
  FileJson,
  FileText,
  FolderOpen,
  GitBranch,
  ListTree,
  RefreshCw,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { ExportFormat, SessionDetail } from '../../shared/types'
import { cx, formatDateTime, formatFullDateTime } from '../utils'

export type DetailView = 'timeline' | 'graph' | 'insights'

interface SessionHeaderProps {
  session: SessionDetail
  view: DetailView
  refreshing: boolean
  onViewChange: (view: DetailView) => void
  onRefresh: () => void
  onOpenLocation: () => void
  onExport: (format: ExportFormat) => void
}

const tabs: Array<{ id: DetailView; label: string; icon: typeof ListTree }> = [
  { id: 'timeline', label: '时间线', icon: ListTree },
  { id: 'graph', label: '关系图', icon: GitBranch },
  { id: 'insights', label: '洞察', icon: BarChart3 },
]

export function SessionHeader({
  session,
  view,
  refreshing,
  onViewChange,
  onRefresh,
  onOpenLocation,
  onExport,
}: SessionHeaderProps) {
  const [exportOpen, setExportOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const exportRef = useRef<HTMLDivElement>(null)
  const currentModel = session.models[0]?.id

  useEffect(() => {
    if (!exportOpen) return
    const close = (event: MouseEvent): void => {
      if (!exportRef.current?.contains(event.target as Node)) setExportOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [exportOpen])

  const copyPath = async (): Promise<void> => {
    try {
      await window.piDesktop.copyText(session.cwd)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1_500)
    } catch {
      setCopied(false)
    }
  }

  const chooseExport = (format: ExportFormat): void => {
    setExportOpen(false)
    onExport(format)
  }

  return (
    <header className="session-header">
      <div className="session-heading-row">
        <div className="session-heading-copy">
          <div className="session-title-line">
            <h1 title={session.title}>{session.title}</h1>
            {session.isActive && <span className="live-badge"><span /> LIVE</span>}
            {session.parseErrors > 0 && <span className="warning-badge">{session.parseErrors} 行解析失败</span>}
          </div>
          <button className="cwd-button" onClick={() => void copyPath()} title="复制工作目录">
            <span>{session.cwd}</span>
            {copied ? <Check size={12} /> : <Copy size={12} />}
          </button>
          <div className="heading-facts">
            <span title={session.createdAt}>创建于 {formatDateTime(session.createdAt)}</span>
            <span>{session.messageCount} 条消息</span>
            <span>{session.entryCount} 个事件</span>
            {currentModel && <span className="model-fact">{currentModel}</span>}
          </div>
        </div>

        <div className="session-actions">
          <button className="icon-button" onClick={onRefresh} title="重新读取会话" disabled={refreshing}>
            <RefreshCw className={refreshing ? 'spin' : ''} size={16} />
          </button>
          <button className="icon-button" onClick={onOpenLocation} title="在文件管理器中显示">
            <FolderOpen size={16} />
          </button>
          <div className="export-control" ref={exportRef}>
            <button
              className="button secondary export-button"
              onClick={() => setExportOpen((value) => !value)}
              aria-expanded={exportOpen}
            >
              <Download size={15} /> 导出 <ChevronDown size={13} />
            </button>
            {exportOpen && (
              <div className="export-menu">
                <button onClick={() => chooseExport('markdown')}>
                  <FileText size={16} />
                  <span><strong>Markdown</strong><small>适合阅读与分享</small></span>
                </button>
                <button onClick={() => chooseExport('jsonl')}>
                  <FileJson size={16} />
                  <span><strong>JSONL</strong><small>导出原始事件数据</small></span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="view-tabs" role="tablist" aria-label="会话视图">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={view === tab.id}
              className={cx('view-tab', view === tab.id && 'active')}
              onClick={() => onViewChange(tab.id)}
            >
              <Icon size={15} /> {tab.label}
            </button>
          )
        })}
        <span className="header-updated" title={formatFullDateTime(session.updatedAt)}>
          最后更新 {formatDateTime(session.updatedAt)}
        </span>
      </div>
    </header>
  )
}

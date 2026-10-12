import { Database, FolderOpen, LoaderCircle, RotateCw, SearchX } from 'lucide-react'
import type { ReactNode } from 'react'

interface EmptyStateProps {
  loading?: boolean
  error?: string | null
  hasSessions: boolean
  onChooseRoot: () => void
  onRefresh: () => void
  action?: ReactNode
}

export function EmptyState({
  loading = false,
  error = null,
  hasSessions,
  onChooseRoot,
  onRefresh,
  action,
}: EmptyStateProps) {
  if (loading) {
    return (
      <div className="empty-state">
        <LoaderCircle className="spin" size={30} />
        <h2>正在扫描会话</h2>
        <p>读取本地 JSONL 并建立索引…</p>
      </div>
    )
  }

  if (!hasSessions || error) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon"><Database size={28} /></div>
        <h2>{error ? '无法加载会话' : '还没有可显示的会话'}</h2>
        <p>{error ?? '当前目录中没有 .jsonl 会话文件。'}</p>
        <div className="empty-state-actions">
          <button className="button primary" onClick={onChooseRoot}>
            <FolderOpen size={16} /> 选择目录
          </button>
          <button className="button secondary" onClick={onRefresh}>
            <RotateCw size={16} /> 重新扫描
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="empty-state compact">
      <div className="empty-state-icon"><SearchX size={26} /></div>
      <h2>没有匹配的会话</h2>
      <p>调整搜索条件，或从左侧选择其他会话。</p>
      {action}
    </div>
  )
}

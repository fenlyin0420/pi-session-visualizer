import {
  Bot,
  Box,
  CircleUserRound,
  GitBranch,
  LocateFixed,
  Maximize2,
  Minus,
  Plus,
  Sparkles,
  Wrench,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { SessionDetail, SessionEntry } from '../../shared/types'
import { cx, formatFullDateTime, stripAnsi, truncate } from '../utils'

interface GraphViewProps {
  session: SessionDetail
  onOpenTimeline: (entryId: string) => void
}

interface PositionedEntry {
  entry: SessionEntry
  x: number
  y: number
  index: number
  row: number
}

function nodeColor(entry: SessionEntry): string {
  if (entry.isError) return '#fb7185'
  if (entry.role === 'user') return '#60a5fa'
  if (entry.role === 'assistant') return '#a78bfa'
  if (entry.role === 'toolResult' || entry.blocks.some((block) => block.type === 'toolCall')) return '#2dd4bf'
  return '#64748b'
}

function roleLabel(entry: SessionEntry): string {
  if (entry.role === 'toolResult') return entry.toolName ?? '工具结果'
  if (entry.role === 'event') return entry.type
  return entry.role
}

function NodeShape({ entry, x, y, selected }: { entry: SessionEntry; x: number; y: number; selected: boolean }) {
  const color = nodeColor(entry)
  const common = {
    fill: selected ? color : '#10141d',
    stroke: color,
    strokeWidth: selected ? 2.5 : 1.5,
  }
  if (entry.role === 'toolResult' || entry.blocks.some((block) => block.type === 'toolCall')) {
    const points = `${x},${y - 6} ${x + 6},${y} ${x},${y + 6} ${x - 6},${y}`
    return <polygon points={points} {...common} />
  }
  if (entry.role === 'event' || entry.role === 'system') {
    return <rect x={x - 4.5} y={y - 4.5} width={9} height={9} rx={2} {...common} />
  }
  return <circle cx={x} cy={y} r={selected ? 6 : 4.5} {...common} />
}

export function GraphView({ session, onOpenTimeline }: GraphViewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [zoom, setZoom] = useState(0.8)
  const graphRef = useRef<HTMLElement>(null)

  const graph = useMemo(() => {
    const knownIds = new Set(session.entries.map((entry) => entry.id))
    const children = new Map<string, SessionEntry[]>()
    for (const entry of session.entries) {
      if (!entry.parentId || !knownIds.has(entry.parentId)) continue
      const list = children.get(entry.parentId) ?? []
      list.push(entry)
      children.set(entry.parentId, list)
    }

    const rows = new Map<string, number>()
    const positioned: PositionedEntry[] = []
    session.entries.forEach((entry, index) => {
      const parentRow = entry.parentId ? rows.get(entry.parentId) ?? 0 : 0
      const siblings = entry.parentId ? children.get(entry.parentId) ?? [] : []
      const siblingIndex = siblings.findIndex((sibling) => sibling.id === entry.id)
      const row = siblings.length > 1 && siblingIndex > 0 ? parentRow + siblingIndex : parentRow
      rows.set(entry.id, row)
      positioned.push({ entry, x: 0, y: 0, index, row })
    })

    const maxRow = Math.max(0, ...positioned.map((node) => node.row))
    const width = Math.max(980, positioned.length * 18 + 150)
    const height = Math.max(350, (maxRow + 1) * 82 + 110)
    const usableWidth = width - 150
    for (const node of positioned) {
      node.x = 75 + (positioned.length <= 1 ? 0 : (node.index / (positioned.length - 1)) * usableWidth)
      node.y = 64 + node.row * 82
    }

    const byId = new Map(positioned.map((node) => [node.entry.id, node]))
    return { positioned, byId, width, height, maxRow }
  }, [session.entries])

  useEffect(() => {
    graphRef.current?.parentElement?.scrollTo({ top: 0, left: 0 })
  }, [session.id])

  useEffect(() => {
    const last = session.entries.at(-1)
    setSelectedId(last?.id ?? null)
    setZoom(Math.min(1, Math.max(0.42, 980 / graph.width)))
  }, [session.id])

  const selected = selectedId ? graph.byId.get(selectedId) ?? null : null
  const selectedToolCall = selected?.entry.blocks.find((block) => block.type === 'toolCall')

  return (
    <section className="graph-view" ref={graphRef}>
      <div className="graph-toolbar">
        <div>
          <span className="graph-title"><GitBranch size={16} /> 会话关系图</span>
          <span className="graph-subtitle">按父子引用与分支展开；点击节点查看事件</span>
        </div>
        <div className="graph-stats">
          <span>{graph.positioned.length} 节点</span>
          <span>{session.branchCount} 分支点</span>
          <span>{graph.maxRow + 1} 路径</span>
        </div>
        <div className="zoom-control">
          <button onClick={() => setZoom((value) => Math.max(0.25, value - 0.15))} title="缩小">
            <Minus size={14} />
          </button>
          <span>{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom((value) => Math.min(2, value + 0.15))} title="放大">
            <Plus size={14} />
          </button>
          <button onClick={() => setZoom(Math.min(1, Math.max(0.42, 980 / graph.width)))} title="适应宽度">
            <Maximize2 size={14} />
          </button>
        </div>
      </div>

      <div className="graph-layout">
        <div className="graph-canvas">
          <div className="graph-legend">
            <span><i className="user" /> 用户</span>
            <span><i className="assistant" /> Pi</span>
            <span><i className="tool" /> 工具</span>
            <span><i className="event" /> 事件</span>
            <span><i className="error" /> 错误</span>
          </div>
          <div className="graph-scroll">
            <svg
              width={graph.width * zoom}
              height={graph.height * zoom}
              viewBox={`0 0 ${graph.width} ${graph.height}`}
              role="img"
              aria-label="会话事件关系图"
            >
              <defs>
                <linearGradient id="edge-gradient" x1="0" x2="1">
                  <stop offset="0" stopColor="#334155" />
                  <stop offset="1" stopColor="#475569" />
                </linearGradient>
              </defs>
              {Array.from({ length: graph.maxRow + 1 }, (_, row) => (
                <line
                  key={row}
                  x1={24}
                  x2={graph.width - 24}
                  y1={64 + row * 82}
                  y2={64 + row * 82}
                  className="graph-lane"
                />
              ))}
              {graph.positioned.map((node) => {
                const parent = node.entry.parentId ? graph.byId.get(node.entry.parentId) : null
                if (!parent) return null
                const middleX = (parent.x + node.x) / 2
                return (
                  <path
                    key={`edge-${node.entry.id}`}
                    d={`M ${parent.x + 6} ${parent.y} C ${middleX} ${parent.y}, ${middleX} ${node.y}, ${node.x - 6} ${node.y}`}
                    className={cx('graph-edge', nodeColor(node.entry) === '#fb7185' && 'error-edge')}
                  />
                )
              })}
              {graph.positioned.map((node) => (
                <g
                  key={node.entry.id}
                  className={cx('graph-node', selectedId === node.entry.id && 'selected')}
                  onClick={() => setSelectedId(node.entry.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') setSelectedId(node.entry.id)
                  }}
                >
                  <title>{`${roleLabel(node.entry)} · ${formatFullDateTime(node.entry.timestamp)}\n${truncate(stripAnsi(node.entry.text || node.entry.thinking), 180)}`}</title>
                  <circle cx={node.x} cy={node.y} r={10} className="node-hit" />
                  <NodeShape entry={node.entry} x={node.x} y={node.y} selected={selectedId === node.entry.id} />
                </g>
              ))}
            </svg>
          </div>
        </div>

        <aside className={cx('graph-inspector', !selected && 'empty')}>
          {selected ? (
            <>
              <div className="inspector-heading">
                <span className="inspector-icon" style={{ color: nodeColor(selected.entry) }}>
                  {selected.entry.role === 'user' ? <CircleUserRound size={18} /> : selected.entry.role === 'assistant' ? <Sparkles size={18} /> : selectedToolCall ? <Box size={18} /> : selected.entry.role === 'toolResult' ? <Wrench size={18} /> : <Bot size={18} />}
                </span>
                <div>
                  <strong>{roleLabel(selected.entry)}</strong>
                  <span>#{selected.index + 1} · {selected.entry.type}</span>
                </div>
              </div>
              <time>{formatFullDateTime(selected.entry.timestamp)}</time>
              <p className="inspector-preview">
                {truncate(stripAnsi(selected.entry.text || selected.entry.thinking || '此事件没有文本内容'), 320)}
              </p>
              {selected.entry.model && <div className="inspector-fact"><span>模型</span><code>{selected.entry.model}</code></div>}
              {selected.entry.usage && <div className="inspector-fact"><span>Token</span><strong>{selected.entry.usage.totalTokens.toLocaleString('en-US')}</strong></div>}
              {selected.entry.parentId && <div className="inspector-fact"><span>父节点</span><code>{truncate(selected.entry.parentId, 18)}</code></div>}
              <button className="button primary inspector-action" onClick={() => onOpenTimeline(selected.entry.id)}>
                <LocateFixed size={15} /> 在时间线中查看
              </button>
            </>
          ) : (
            <div><GitBranch size={24} /><span>选择一个节点</span></div>
          )}
        </aside>
      </div>
    </section>
  )
}

import {
  AlertTriangle,
  Clock3,
  Coins,
  Cpu,
  Database,
  FileJson,
  Gauge,
  GitCommitHorizontal,
  HardDrive,
  MessagesSquare,
  Sparkles,
  UserRound,
  Wrench,
} from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import type { SessionDetail } from '../../shared/types'
import {
  formatCompactNumber,
  formatCost,
  formatDuration,
  formatFullDateTime,
  formatNumber,
  sessionColor,
} from '../utils'

interface InsightsViewProps {
  session: SessionDetail
}

interface DailyActivity {
  day: string
  messages: number
  toolCalls: number
  tokens: number
}

function buildDailyActivity(session: SessionDetail): DailyActivity[] {
  const byDay = new Map<string, DailyActivity>()
  for (const entry of session.entries) {
    const day = entry.timestamp.slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue
    const item = byDay.get(day) ?? { day, messages: 0, toolCalls: 0, tokens: 0 }
    if (entry.type === 'message') item.messages += 1
    item.toolCalls += entry.blocks.filter((block) => block.type === 'toolCall').length
    item.tokens += entry.usage?.totalTokens ?? 0
    byDay.set(day, item)
  }
  return [...byDay.values()].sort((left, right) => left.day.localeCompare(right.day)).slice(-21)
}

function Donut({ session }: InsightsViewProps) {
  const values = [
    { label: '用户', value: session.userMessageCount, color: '#60a5fa' },
    { label: 'Pi', value: session.assistantMessageCount, color: '#a78bfa' },
    { label: '工具结果', value: session.toolResultCount, color: '#2dd4bf' },
    {
      label: '其他事件',
      value: Math.max(0, session.entryCount - session.userMessageCount - session.assistantMessageCount - session.toolResultCount),
      color: '#475569',
    },
  ]
  const total = values.reduce((sum, item) => sum + item.value, 0)
  const radius = 42
  const circumference = 2 * Math.PI * radius
  let offset = 0

  return (
    <div className="donut-layout">
      <div className="donut-chart">
        <svg viewBox="0 0 110 110" aria-label="消息类型分布">
          <circle cx="55" cy="55" r={radius} className="donut-track" />
          {total > 0 && values.map((item) => {
            const length = (item.value / total) * circumference
            const currentOffset = offset
            offset += length
            return (
              <circle
                key={item.label}
                cx="55"
                cy="55"
                r={radius}
                pathLength={circumference}
                stroke={item.color}
                strokeDasharray={`${length} ${circumference - length}`}
                strokeDashoffset={-currentOffset}
                className="donut-segment"
              />
            )
          })}
        </svg>
        <div className="donut-center"><strong>{formatCompactNumber(total)}</strong><span>事件</span></div>
      </div>
      <div className="donut-legend">
        {values.map((item) => (
          <div key={item.label}>
            <span><i style={{ background: item.color }} />{item.label}</span>
            <strong>{formatNumber(item.value)}</strong>
          </div>
        ))}
      </div>
    </div>
  )
}

export function InsightsView({ session }: InsightsViewProps) {
  const insightsRef = useRef<HTMLElement>(null)
  const activity = useMemo(() => buildDailyActivity(session), [session])
  useEffect(() => {
    insightsRef.current?.parentElement?.scrollTo({ top: 0 })
  }, [session.id])

  const maxActivity = Math.max(1, ...activity.map((day) => Math.max(day.messages, day.toolCalls)))
  const maxModelTokens = Math.max(1, ...session.models.map((model) => model.totalTokens))
  const maxToolCount = Math.max(1, ...session.tools.map((tool) => tool.count))
  const tokenRows = [
    { label: '输入', value: session.inputTokens, color: '#60a5fa' },
    { label: '输出', value: session.outputTokens, color: '#a78bfa' },
    { label: '缓存读取', value: session.cacheReadTokens, color: '#2dd4bf' },
    { label: '缓存写入', value: session.cacheWriteTokens, color: '#f59e0b' },
    { label: '推理', value: session.reasoningTokens, color: '#f472b6' },
  ]
  const maxTokenRow = Math.max(1, ...tokenRows.map((row) => row.value))

  return (
    <section className="insights-view" ref={insightsRef}>
      <div className="metric-grid">
        <article className="metric-card accent-blue">
          <span className="metric-icon"><Gauge size={19} /></span>
          <div><span>总 Token</span><strong>{formatCompactNumber(session.totalTokens)}</strong><small>{formatNumber(session.totalTokens)} tokens</small></div>
        </article>
        <article className="metric-card accent-green">
          <span className="metric-icon"><Coins size={19} /></span>
          <div><span>预估成本</span><strong>{formatCost(session.cost)}</strong><small>基于会话 usage 累计</small></div>
        </article>
        <article className="metric-card accent-purple">
          <span className="metric-icon"><Wrench size={19} /></span>
          <div><span>工具调用</span><strong>{formatNumber(session.toolCallCount)}</strong><small>{session.tools.length} 种工具</small></div>
        </article>
        <article className="metric-card accent-amber">
          <span className="metric-icon"><Clock3 size={19} /></span>
          <div><span>会话跨度</span><strong>{formatDuration(session.durationMs)}</strong><small>{session.messageCount} 条消息</small></div>
        </article>
      </div>

      {session.errorCount > 0 && (
        <div className="insight-alert">
          <AlertTriangle size={18} />
          <div><strong>检测到 {session.errorCount} 个错误事件</strong><span>可在时间线的“错误”筛选中查看具体上下文。</span></div>
        </div>
      )}

      <div className="insight-grid two-thirds">
        <article className="panel activity-panel">
          <header className="panel-header">
            <div><span className="panel-icon"><GitCommitHorizontal size={16} /></span><strong>活动分布</strong></div>
            <span>最近 {activity.length} 个活跃日</span>
          </header>
          {activity.length ? (
            <div className="activity-chart">
              {activity.map((day) => (
                <div className="activity-column" key={day.day} title={`${day.day} · ${day.messages} 条消息 · ${day.tokens} tokens`}>
                  <div className="activity-bars">
                    <span className="message-bar" style={{ height: `${Math.max(3, (day.messages / maxActivity) * 100)}%` }} />
                    <span className="tool-bar" style={{ height: `${Math.max(3, (day.toolCalls / maxActivity) * 100)}%` }} />
                  </div>
                  <small>{day.day.slice(5).replace('-', '/')}</small>
                </div>
              ))}
            </div>
          ) : (
            <div className="panel-empty">时间戳不足，无法生成活动图</div>
          )}
          <div className="chart-legend">
            <span><i className="message" /> 消息</span>
            <span><i className="tool" /> 工具调用</span>
          </div>
        </article>

        <article className="panel mix-panel">
          <header className="panel-header">
            <div><span className="panel-icon"><MessagesSquare size={16} /></span><strong>消息构成</strong></div>
          </header>
          <Donut session={session} />
        </article>
      </div>

      <div className="insight-grid half">
        <article className="panel token-panel">
          <header className="panel-header">
            <div><span className="panel-icon"><Cpu size={16} /></span><strong>Token 分布</strong></div>
            <span>推理 Token 可能包含在输出中</span>
          </header>
          <div className="token-rows">
            {tokenRows.map((row) => (
              <div className="token-row" key={row.label}>
                <div><span>{row.label}</span><strong>{formatCompactNumber(row.value)}</strong></div>
                <div className="bar-track"><span style={{ width: `${(row.value / maxTokenRow) * 100}%`, background: row.color }} /></div>
              </div>
            ))}
          </div>
        </article>

        <article className="panel model-panel">
          <header className="panel-header">
            <div><span className="panel-icon"><Sparkles size={16} /></span><strong>模型使用</strong></div>
            <span>{session.models.length} 个模型</span>
          </header>
          {session.models.length ? (
            <div className="model-list">
              {session.models.map((model) => (
                <div className="model-row" key={model.id}>
                  <i style={{ background: sessionColor(model.id) }} />
                  <div>
                    <span><strong>{model.id}</strong><em>{model.count} 次</em></span>
                    <div className="bar-track"><span style={{ width: `${(model.totalTokens / maxModelTokens) * 100}%`, background: sessionColor(model.id) }} /></div>
                    <small>{formatCompactNumber(model.totalTokens)} tokens · {formatCost(model.cost)}</small>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="panel-empty">没有模型 usage 记录</div>
          )}
        </article>
      </div>

      <div className="insight-grid two-thirds reverse-mobile">
        <article className="panel tool-panel">
          <header className="panel-header">
            <div><span className="panel-icon"><Wrench size={16} /></span><strong>工具使用</strong></div>
            <span>{session.tools.length} 种工具</span>
          </header>
          {session.tools.length ? (
            <div className="tool-table">
              <div className="tool-table-head"><span>工具</span><span>调用</span><span>错误</span><span>占比</span></div>
              {session.tools.slice(0, 14).map((tool) => (
                <div className="tool-table-row" key={tool.name}>
                  <span><Wrench size={13} /><strong>{tool.name}</strong></span>
                  <span>{formatNumber(tool.count)}</span>
                  <span className={tool.errorCount ? 'has-error' : ''}>{tool.errorCount || '—'}</span>
                  <span className="tool-bar-cell"><i><b style={{ width: `${(tool.count / maxToolCount) * 100}%` }} /></i>{Math.round((tool.count / Math.max(1, session.toolCallCount)) * 100)}%</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="panel-empty">这个会话没有工具调用</div>
          )}
        </article>

        <article className="panel metadata-panel">
          <header className="panel-header">
            <div><span className="panel-icon"><Database size={16} /></span><strong>会话元数据</strong></div>
          </header>
          <dl className="metadata-list">
            <div><dt>ID</dt><dd><code>{session.id}</code></dd></div>
            <div><dt>格式版本</dt><dd>{session.version ?? '未知'}</dd></div>
            <div><dt>创建时间</dt><dd>{formatFullDateTime(session.createdAt)}</dd></div>
            <div><dt>更新时间</dt><dd>{formatFullDateTime(session.updatedAt)}</dd></div>
            <div><dt>相对路径</dt><dd><code>{session.relativePath}</code></dd></div>
            <div><dt>文件大小</dt><dd><HardDrive size={12} /> {(session.fileSize / 1024).toFixed(1)} KB</dd></div>
            <div><dt>事件 / 分支</dt><dd><FileJson size={12} /> {session.entryCount} / {session.branchCount}</dd></div>
          </dl>
        </article>
      </div>

      <div className="insights-footnote">
        <UserRound size={13} /> 统计仅来自当前 JSONL 中已持久化的 usage 数据，不会补算缺失记录。
      </div>
    </section>
  )
}

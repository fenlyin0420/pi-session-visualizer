import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type {
  AppConfig,
  BootstrapData,
  ExportFormat,
  SessionDetail,
  SessionListUpdate,
  SessionSummary,
} from '../shared/types'
import { EmptyState } from './components/EmptyState'
import { GraphView } from './components/GraphView'
import { InsightsView } from './components/InsightsView'
import { SessionHeader, type DetailView } from './components/SessionHeader'
import { SessionSidebar, type SessionFilter } from './components/SessionSidebar'
import { TimelineView, type TimelineFilter } from './components/TimelineView'
import { cx } from './utils'

interface ToastState {
  id: number
  type: 'success' | 'error' | 'info'
  message: string
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function isToday(value: string): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Date.parse(value) >= today.getTime()
}

function filterSessions(sessions: SessionSummary[], filter: SessionFilter): SessionSummary[] {
  return sessions.filter((session) => {
    if (filter === 'today' && !isToday(session.updatedAt)) return false
    if (filter === 'active' && !session.isActive) return false
    if (filter === 'errors' && session.errorCount === 0) return false
    return true
  })
}

export default function App() {
  const api = window.piDesktop
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [searchResults, setSearchResults] = useState<SessionSummary[]>([])
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [detail, setDetail] = useState<SessionDetail | null>(null)
  const [booting, setBooting] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [rootChanging, setRootChanging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [sessionQuery, setSessionQuery] = useState('')
  const [timelineQuery, setTimelineQuery] = useState('')
  const [sessionFilter, setSessionFilter] = useState<SessionFilter>('all')
  const [timelineFilter, setTimelineFilter] = useState<TimelineFilter>('all')
  const [view, setView] = useState<DetailView>('timeline')
  const [focusedEntryId, setFocusedEntryId] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const selectedPathRef = useRef<string | null>(null)
  const detailRequestRef = useRef(0)
  const searchRequestRef = useRef(0)
  const toastIdRef = useRef(0)
  const deferredSessionQuery = useDeferredValue(sessionQuery)

  useEffect(() => {
    selectedPathRef.current = selectedPath
  }, [selectedPath])

  const showToast = useCallback((type: ToastState['type'], message: string): void => {
    toastIdRef.current += 1
    setToast({ id: toastIdRef.current, type, message })
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 3_200)
    return () => window.clearTimeout(timer)
  }, [toast])

  const applyBootstrap = useCallback((data: BootstrapData): void => {
    setConfig(data.config)
    setSessions(data.sessions)
    setError(data.error)
    setDetail(null)
    setFocusedEntryId(null)
    setBooting(false)
    setSelectedPath((current) => {
      if (current && data.sessions.some((session) => session.filePath === current)) return current
      return data.sessions[0]?.filePath ?? null
    })
  }, [])

  const loadDetail = useCallback(async (filePath: string, background = false): Promise<void> => {
    const requestId = detailRequestRef.current + 1
    detailRequestRef.current = requestId
    if (!background) {
      setDetail(null)
      setDetailLoading(true)
    }
    setDetailError(null)
    try {
      const nextDetail = await api.getSession(filePath)
      if (detailRequestRef.current === requestId) setDetail(nextDetail)
    } catch (loadError) {
      if (detailRequestRef.current !== requestId) return
      const message = errorMessage(loadError)
      setDetailError(message)
      if (background) showToast('error', message)
    } finally {
      if (detailRequestRef.current === requestId) setDetailLoading(false)
    }
  }, [api, showToast])

  useEffect(() => {
    let active = true
    if (!api) {
      setError('桌面桥接未就绪，请通过 Electron 启动应用')
      setBooting(false)
      return
    }
    void api
      .getBootstrap()
      .then((data) => {
        if (active) applyBootstrap(data)
      })
      .catch((loadError: unknown) => {
        if (!active) return
        setError(errorMessage(loadError))
        setBooting(false)
      })
    return () => {
      active = false
    }
  }, [api, applyBootstrap])

  useEffect(() => {
    if (!api) return
    const query = deferredSessionQuery.trim()
    if (!query) {
      searchRequestRef.current += 1
      setSearchResults(sessions)
      return
    }

    const requestId = searchRequestRef.current + 1
    searchRequestRef.current = requestId
    setSearchResults(sessions)
    const timer = window.setTimeout(() => {
      void api
        .searchSessions(query)
        .then((results) => {
          if (searchRequestRef.current === requestId) setSearchResults(results)
        })
        .catch(() => {
          if (searchRequestRef.current !== requestId) return
          const normalized = query.toLocaleLowerCase()
          setSearchResults(sessions.filter((session) =>
            `${session.title}\n${session.preview}\n${session.cwd}\n${session.tools.map((tool) => tool.name).join(' ')}`
              .toLocaleLowerCase()
              .includes(normalized),
          ))
        })
    }, 90)
    return () => window.clearTimeout(timer)
  }, [api, deferredSessionQuery, sessions])

  useEffect(() => {
    if (!api) return
    return api.onSessionsChanged((update: SessionListUpdate) => {
      setSessions(update.sessions)
      setError(update.error ?? null)
      const currentPath = selectedPathRef.current
      if (currentPath && update.changedPaths.includes(currentPath)) {
        void loadDetail(currentPath, true)
      } else if (currentPath && !update.sessions.some((session) => session.filePath === currentPath)) {
        setDetail(null)
        setSelectedPath(update.sessions[0]?.filePath ?? null)
      }
    })
  }, [api, loadDetail])

  useEffect(() => {
    if (!selectedPath) {
      setDetail(null)
      setDetailLoading(false)
      return
    }
    setFocusedEntryId(null)
    void loadDetail(selectedPath)
  }, [loadDetail, selectedPath])

  const refresh = useCallback(async (): Promise<void> => {
    if (!api || refreshing) return
    setRefreshing(true)
    try {
      const update = await api.refreshSessions()
      setSessions(update.sessions)
      setError(update.error ?? null)
      if (selectedPathRef.current) await loadDetail(selectedPathRef.current, true)
      if (!update.error) showToast('success', '会话已刷新')
    } catch (refreshError) {
      const message = errorMessage(refreshError)
      setError(message)
      showToast('error', message)
    } finally {
      setRefreshing(false)
    }
  }, [api, loadDetail, refreshing, showToast])

  const chooseRoot = useCallback(async (): Promise<void> => {
    if (!api || rootChanging) return
    setRootChanging(true)
    try {
      const data = await api.chooseSessionRoot()
      if (data) {
        applyBootstrap(data)
        setSessionQuery('')
        setTimelineQuery('')
        showToast('success', '会话目录已切换')
      }
    } catch (rootError) {
      const message = errorMessage(rootError)
      showToast('error', message)
    } finally {
      setRootChanging(false)
    }
  }, [api, applyBootstrap, rootChanging, showToast])

  const resetRoot = useCallback(async (): Promise<void> => {
    if (!api || rootChanging) return
    setRootChanging(true)
    try {
      const data = await api.resetSessionRoot()
      applyBootstrap(data)
      showToast('success', '已恢复默认目录')
    } catch (rootError) {
      showToast('error', errorMessage(rootError))
    } finally {
      setRootChanging(false)
    }
  }, [api, applyBootstrap, rootChanging, showToast])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const modifier = event.metaKey || event.ctrlKey
      if (modifier && event.key.toLocaleLowerCase() === 'k') {
        event.preventDefault()
        searchInputRef.current?.focus()
        searchInputRef.current?.select()
      }
      if (modifier && event.key.toLocaleLowerCase() === 'r') {
        event.preventDefault()
        void refresh()
      }
      if (event.key === 'Escape' && document.activeElement === searchInputRef.current) {
        setSessionQuery('')
        searchInputRef.current?.blur()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [refresh])

  const filteredSessions = useMemo(
    () => filterSessions(deferredSessionQuery.trim() ? searchResults : sessions, sessionFilter),
    [deferredSessionQuery, searchResults, sessionFilter, sessions],
  )

  const openFromGraph = (entryId: string): void => {
    setFocusedEntryId(entryId)
    setTimelineFilter('all')
    setTimelineQuery('')
    setView('timeline')
  }

  const openLocation = async (): Promise<void> => {
    if (!api || !detail) return
    try {
      await api.openSessionLocation(detail.filePath)
    } catch (openError) {
      showToast('error', errorMessage(openError))
    }
  }

  const exportSession = async (format: ExportFormat): Promise<void> => {
    if (!api || !detail) return
    try {
      const result = await api.exportSession(detail.filePath, format)
      if (!result.canceled && result.filePath) showToast('success', `已导出到 ${result.filePath}`)
    } catch (exportError) {
      showToast('error', errorMessage(exportError))
    }
  }

  const busy = refreshing || rootChanging
  const apiUnavailable = !api

  return (
    <div className="app-shell">
      <SessionSidebar
        sessions={filteredSessions}
        totalCount={sessions.length}
        selectedPath={selectedPath}
        query={sessionQuery}
        filter={sessionFilter}
        config={config}
        error={error}
        refreshing={busy}
        searchInputRef={searchInputRef}
        onQueryChange={setSessionQuery}
        onFilterChange={setSessionFilter}
        onSelect={(filePath) => {
          setSelectedPath(filePath)
          setTimelineQuery('')
          setTimelineFilter('all')
        }}
        onChooseRoot={() => void chooseRoot()}
        onResetRoot={() => void resetRoot()}
        onRefresh={() => void refresh()}
      />

      <main className="main-pane">
        {detail ? (
          <>
            <SessionHeader
              session={detail}
              view={view}
              refreshing={busy}
              onViewChange={setView}
              onRefresh={() => void refresh()}
              onOpenLocation={() => void openLocation()}
              onExport={(format) => void exportSession(format)}
            />
            <div className="view-container">
              {view === 'timeline' && (
                <TimelineView
                  session={detail}
                  query={timelineQuery}
                  filter={timelineFilter}
                  focusedEntryId={focusedEntryId}
                  onFilterChange={setTimelineFilter}
                  onQueryChange={setTimelineQuery}
                  onClearQuery={() => setTimelineQuery('')}
                />
              )}
              {view === 'graph' && <GraphView session={detail} onOpenTimeline={openFromGraph} />}
              {view === 'insights' && <InsightsView session={detail} />}
            </div>
          </>
        ) : (
          <EmptyState
            loading={booting || detailLoading || rootChanging}
            error={apiUnavailable ? '桌面桥接未就绪' : detailError ?? error}
            hasSessions={sessions.length > 0}
            onChooseRoot={() => void chooseRoot()}
            onRefresh={() => void refresh()}
          />
        )}
      </main>

      {toast && (
        <div className={cx('toast', toast.type)} role="status">
          {toast.type === 'success' ? <CheckCircle2 size={17} /> : toast.type === 'error' ? <AlertCircle size={17} /> : <Info size={17} />}
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} title="关闭"><X size={14} /></button>
        </div>
      )}
    </div>
  )
}

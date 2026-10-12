export type SessionRole = 'system' | 'user' | 'assistant' | 'toolResult' | 'event'

export type SessionEntryType =
  | 'session'
  | 'session_info'
  | 'model_change'
  | 'thinking_level_change'
  | 'message'
  | 'custom_message'
  | 'context_edit'
  | 'compaction'
  | 'custom'
  | 'unknown'

export interface TokenUsage {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  reasoning: number
  totalTokens: number
  cost: number | null
}

export interface TextBlock {
  type: 'text'
  text: string
}

export interface ThinkingBlock {
  type: 'thinking'
  thinking: string
}

export interface ToolCallBlock {
  type: 'toolCall'
  id: string
  name: string
  arguments: unknown
}

export interface ImageBlock {
  type: 'image'
  mimeType: string
  data: string
}

export type ContentBlock = TextBlock | ThinkingBlock | ToolCallBlock | ImageBlock

export interface SessionEntry {
  id: string
  parentId: string | null
  timestamp: string
  type: SessionEntryType
  role: SessionRole
  text: string
  thinking: string
  blocks: ContentBlock[]
  toolName: string | null
  toolCallId: string | null
  model: string | null
  provider: string | null
  usage: TokenUsage | null
  stopReason: string | null
  isError: boolean
  isDisplay: boolean
  details: unknown
}

export interface ModelUsage {
  id: string
  provider: string | null
  count: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  cost: number
}

export interface ToolUsage {
  name: string
  count: number
  errorCount: number
}

export interface SessionSummary {
  id: string
  filePath: string
  relativePath: string
  title: string
  customName: string | null
  cwd: string
  workspace: string
  version: string | null
  createdAt: string
  updatedAt: string
  durationMs: number
  fileSize: number
  entryCount: number
  messageCount: number
  userMessageCount: number
  assistantMessageCount: number
  toolResultCount: number
  toolCallCount: number
  errorCount: number
  branchCount: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  reasoningTokens: number
  totalTokens: number
  cost: number
  preview: string
  models: ModelUsage[]
  tools: ToolUsage[]
  parseErrors: number
  isActive: boolean
}

export interface SessionDetail extends SessionSummary {
  entries: SessionEntry[]
}

export interface AppConfig {
  rootPath: string
  rootSource: 'default' | 'fallback' | 'custom'
  rootExists: boolean
}

export interface BootstrapData {
  config: AppConfig
  sessions: SessionSummary[]
  error: string | null
}

export interface SessionListUpdate {
  sessions: SessionSummary[]
  changedPaths: string[]
  error?: string
}

export type ExportFormat = 'markdown' | 'jsonl'

export interface ExportResult {
  canceled: boolean
  filePath: string | null
}

export interface PiDesktopApi {
  getBootstrap: () => Promise<BootstrapData>
  refreshSessions: () => Promise<SessionListUpdate>
  searchSessions: (query: string) => Promise<SessionSummary[]>
  getSession: (filePath: string) => Promise<SessionDetail>
  chooseSessionRoot: () => Promise<BootstrapData | null>
  resetSessionRoot: () => Promise<BootstrapData>
  openSessionLocation: (filePath: string) => Promise<void>
  copyText: (text: string) => Promise<void>
  exportSession: (filePath: string, format: ExportFormat) => Promise<ExportResult>
  onSessionsChanged: (listener: (update: SessionListUpdate) => void) => () => void
  platform: string
}

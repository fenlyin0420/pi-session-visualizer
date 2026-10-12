import { createReadStream } from 'node:fs'
import { basename, relative } from 'node:path'
import { createInterface } from 'node:readline'
import type {
  ContentBlock,
  ModelUsage,
  SessionEntry,
  SessionEntryType,
  SessionDetail,
  SessionRole,
  TokenUsage,
  ToolUsage,
} from '../shared/types.js'

export interface SessionFileStat {
  size: number
  mtimeMs: number
  birthtimeMs: number
}

export interface ParsedSessionDetail extends SessionDetail {
  searchText: string
}

const ACTIVE_WINDOW_MS = 2 * 60 * 1000
const VALID_ENTRY_TYPES = new Set<SessionEntryType>([
  'session',
  'session_info',
  'model_change',
  'thinking_level_change',
  'message',
  'custom_message',
  'context_edit',
  'compaction',
  'custom',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function finiteNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function stringValue(value: unknown): string {
  if (typeof value === 'string') return value
  if (value === null || value === undefined) return ''
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function compactText(value: string, maxLength = 180): string {
  const compact = value.replace(/\s+/g, ' ').trim()
  if (compact.length <= maxLength) return compact
  return `${compact.slice(0, maxLength - 1).trimEnd()}…`
}

function workspaceName(cwd: string): string {
  const parts = cwd.split(/[\\/]+/).filter(Boolean)
  return parts.at(-1) ?? '根目录'
}

function validIso(value: unknown, fallback: number): string {
  if (typeof value === 'string' && Number.isFinite(Date.parse(value))) return value
  if (typeof value === 'number' && Number.isFinite(value)) {
    const milliseconds = value < 10_000_000_000 ? value * 1000 : value
    const date = new Date(milliseconds)
    if (Number.isFinite(date.getTime())) return date.toISOString()
  }
  return new Date(fallback).toISOString()
}

function normalizeEntryType(value: unknown): SessionEntryType {
  return typeof value === 'string' && VALID_ENTRY_TYPES.has(value as SessionEntryType)
    ? (value as SessionEntryType)
    : 'unknown'
}

function normalizeRole(value: unknown): SessionRole {
  if (value === 'system' || value === 'user' || value === 'assistant' || value === 'toolResult') {
    return value
  }
  return 'event'
}

function costFromUnknown(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (isRecord(value) && typeof value.total === 'number' && Number.isFinite(value.total)) {
    return value.total
  }
  return null
}

function normalizeUsage(value: unknown): TokenUsage | null {
  if (!isRecord(value)) return null
  return {
    input: finiteNumber(value.input),
    output: finiteNumber(value.output),
    cacheRead: finiteNumber(value.cacheRead),
    cacheWrite: finiteNumber(value.cacheWrite),
    reasoning: finiteNumber(value.reasoning),
    totalTokens: finiteNumber(value.totalTokens),
    cost: costFromUnknown(value.cost),
  }
}

function normalizeBlocks(content: unknown): ContentBlock[] {
  if (!Array.isArray(content)) return []

  const blocks: ContentBlock[] = []
  for (const value of content) {
    if (!isRecord(value)) continue
    if (value.type === 'text' && typeof value.text === 'string') {
      blocks.push({ type: 'text', text: value.text })
    } else if (value.type === 'thinking' && typeof value.thinking === 'string') {
      blocks.push({ type: 'thinking', thinking: value.thinking })
    } else if (value.type === 'toolCall' && typeof value.name === 'string') {
      blocks.push({
        type: 'toolCall',
        id: asString(value.id) ?? '',
        name: value.name,
        arguments: value.arguments ?? {},
      })
    } else if (value.type === 'image' && typeof value.data === 'string') {
      blocks.push({
        type: 'image',
        mimeType: asString(value.mimeType) ?? 'image/png',
        data: value.data,
      })
    }
  }
  return blocks
}

function addUsage(target: TokenUsage, usage: TokenUsage): void {
  target.input += usage.input
  target.output += usage.output
  target.cacheRead += usage.cacheRead
  target.cacheWrite += usage.cacheWrite
  target.reasoning += usage.reasoning
  target.totalTokens += usage.totalTokens
  if (usage.cost !== null) target.cost = (target.cost ?? 0) + usage.cost
}

function createEntry(
  rawValue: unknown,
  index: number,
  fileId: string,
  fallbackTimestamp: number,
): SessionEntry {
  const raw = isRecord(rawValue) ? rawValue : {}
  const type = normalizeEntryType(raw.type)
  const message = isRecord(raw.message) ? raw.message : null
  const role = type === 'message' ? normalizeRole(message?.role) : 'event'
  const blocks = normalizeBlocks(message?.content)
  const blockText = blocks
    .filter((block): block is Extract<ContentBlock, { type: 'text' }> => block.type === 'text')
    .map((block) => block.text)
    .join('\n\n')
  const eventText =
    raw.content ??
    raw.summary ??
    raw.replacement ??
    raw.data ??
    raw.name ??
    raw.modelId ??
    raw.thinkingLevel
  const errorMessage = asString(message?.errorMessage)
  const text = message
    ? Array.isArray(message.content)
      ? blockText || errorMessage || ''
      : stringValue(message.content) || (role === 'system' ? stringValue(message.sections) : '') || errorMessage || ''
    : stringValue(eventText)
  const thinking = blocks
    .filter((block): block is Extract<ContentBlock, { type: 'thinking' }> => block.type === 'thinking')
    .map((block) => block.thinking)
    .join('\n\n')
  const usage = normalizeUsage(message?.usage ?? raw.usage)
  const stopReason = asString(message?.stopReason)

  return {
    id: asString(raw.id) ?? `${fileId}:${index}`,
    parentId: asString(raw.parentId),
    timestamp: validIso(raw.timestamp ?? message?.timestamp, fallbackTimestamp),
    type,
    role,
    text,
    thinking,
    blocks,
    toolName: asString(message?.toolName),
    toolCallId: asString(message?.toolCallId),
    model: asString(message?.model ?? message?.responseModel ?? raw.modelId),
    provider: asString(message?.provider ?? raw.provider),
    usage,
    stopReason,
    isError:
      message?.isError === true || stopReason === 'error' || (errorMessage !== null && errorMessage.length > 0),
    isDisplay: type !== 'custom_message' || raw.display !== false,
    details: raw.details ?? raw.data ?? raw.replacement ?? null,
  }
}

function previewFromEntries(entries: SessionEntry[], fallback: string): string {
  const firstUserText = entries.find((entry) => entry.role === 'user')?.text.trim()
  if (firstUserText) return compactText(firstUserText)
  return fallback
}

function buildSearchText(entries: SessionEntry[], cwd: string, name: string | null): string {
  const parts: string[] = [cwd, name ?? '']
  for (const entry of entries) {
    if (entry.role === 'system') continue
    if (entry.text) parts.push(entry.text)
    if (entry.thinking) parts.push(entry.thinking)
    if (entry.toolName) parts.push(entry.toolName)
    for (const block of entry.blocks) {
      if (block.type === 'toolCall') {
        parts.push(block.name, stringValue(block.arguments))
      }
    }
  }
  return parts.join('\n').toLocaleLowerCase()
}

function modelIdFor(entry: SessionEntry): string | null {
  if (!entry.model) return null
  return entry.provider ? `${entry.provider}/${entry.model}` : entry.model
}

function aggregateModels(entries: SessionEntry[]): ModelUsage[] {
  const models = new Map<string, ModelUsage>()
  for (const entry of entries) {
    if (entry.role !== 'assistant') continue
    const id = modelIdFor(entry)
    if (!id) continue
    const current = models.get(id) ?? {
      id,
      provider: entry.provider,
      count: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      cost: 0,
    }
    current.count += 1
    current.inputTokens += entry.usage?.input ?? 0
    current.outputTokens += entry.usage?.output ?? 0
    current.totalTokens += entry.usage?.totalTokens ?? 0
    current.cost += entry.usage?.cost ?? 0
    models.set(id, current)
  }
  return [...models.values()].sort((left, right) => right.totalTokens - left.totalTokens)
}

function aggregateTools(entries: SessionEntry[]): ToolUsage[] {
  const tools = new Map<string, ToolUsage>()
  const ensure = (name: string): ToolUsage => {
    const current = tools.get(name) ?? { name, count: 0, errorCount: 0 }
    tools.set(name, current)
    return current
  }

  for (const entry of entries) {
    for (const block of entry.blocks) {
      if (block.type === 'toolCall') ensure(block.name).count += 1
    }
    if (entry.role === 'toolResult' && entry.toolName) {
      const tool = ensure(entry.toolName)
      if (entry.isError) tool.errorCount += 1
    }
  }

  return [...tools.values()].sort((left, right) => right.count - left.count || left.name.localeCompare(right.name))
}

function countBranches(entries: SessionEntry[]): number {
  const childCounts = new Map<string, number>()
  for (const entry of entries) {
    if (!entry.parentId) continue
    childCounts.set(entry.parentId, (childCounts.get(entry.parentId) ?? 0) + 1)
  }
  return [...childCounts.values()].filter((count) => count > 1).length
}

export async function parseSessionFile(
  filePath: string,
  rootPath: string,
  fileStat: SessionFileStat,
): Promise<ParsedSessionDetail> {
  const entries: SessionEntry[] = []
  const totals: TokenUsage = {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    reasoning: 0,
    totalTokens: 0,
    cost: 0,
  }
  let parseErrors = 0
  let index = 0
  let header: Record<string, unknown> | null = null
  let customName: string | null = null
  let lineNumber = 0

  const stream = createReadStream(filePath, { encoding: 'utf8' })
  const lines = createInterface({ input: stream, crlfDelay: Infinity })

  try {
    for await (let line of lines) {
      lineNumber += 1
      if (lineNumber === 1) line = line.replace(/^\uFEFF/, '')
      if (!line.trim()) continue

      let rawValue: unknown
      try {
        rawValue = JSON.parse(line)
      } catch {
        parseErrors += 1
        continue
      }

      if (header === null && isRecord(rawValue) && rawValue.type === 'session') {
        header = rawValue
      }
      const entry = createEntry(rawValue, index, basename(filePath), fileStat.mtimeMs)
      if (entry.type === 'session_info' && entry.text.trim()) customName = entry.text.trim()
      if (entry.usage) addUsage(totals, entry.usage)
      entries.push(entry)
      index += 1
    }
  } finally {
    lines.close()
    stream.destroy()
  }

  const headerId = asString(header?.id)
  const cwd = asString(header?.cwd) ?? workspaceName(basename(rootPath))
  const createdAt = validIso(header?.timestamp, fileStat.birthtimeMs || fileStat.mtimeMs)
  const updatedAt = entries.at(-1)?.timestamp ?? validIso(undefined, fileStat.mtimeMs)
  const durationMs = Math.max(0, Date.parse(updatedAt) - Date.parse(createdAt))
  const id = headerId ?? basename(filePath)
  const fallbackTitle = customName ?? (entries.some((entry) => entry.role === 'user') ? '未命名会话' : '空会话')
  const title = customName || entries.find((entry) => entry.role === 'user')?.text.trim() || fallbackTitle
  const preview = previewFromEntries(entries, customName ?? '该会话尚无用户消息')
  const relativePath = relative(rootPath, filePath)
  const models = aggregateModels(entries)
  const tools = aggregateTools(entries)

  return {
    id,
    filePath,
    relativePath,
    title: compactText(title, 120),
    customName,
    cwd,
    workspace: workspaceName(cwd),
    version: asString(header?.version),
    createdAt,
    updatedAt,
    durationMs,
    fileSize: fileStat.size,
    entryCount: entries.length,
    messageCount: entries.filter((entry) => entry.type === 'message').length,
    userMessageCount: entries.filter((entry) => entry.role === 'user').length,
    assistantMessageCount: entries.filter((entry) => entry.role === 'assistant').length,
    toolResultCount: entries.filter((entry) => entry.role === 'toolResult').length,
    toolCallCount: entries.reduce(
      (count, entry) => count + entry.blocks.filter((block) => block.type === 'toolCall').length,
      0,
    ),
    errorCount: entries.filter((entry) => entry.isError).length,
    branchCount: countBranches(entries),
    inputTokens: totals.input,
    outputTokens: totals.output,
    cacheReadTokens: totals.cacheRead,
    cacheWriteTokens: totals.cacheWrite,
    reasoningTokens: totals.reasoning,
    totalTokens: totals.totalTokens,
    cost: totals.cost ?? 0,
    preview,
    searchText: buildSearchText(entries, cwd, customName),
    models,
    tools,
    parseErrors,
    isActive: Date.now() - fileStat.mtimeMs < ACTIVE_WINDOW_MS,
    entries,
  }
}

import { readdir, stat } from 'node:fs/promises'
import { extname, isAbsolute, relative, resolve } from 'node:path'
import type { SessionDetail, SessionListUpdate, SessionSummary } from '../shared/types.js'
import { parseSessionFile, type ParsedSessionDetail } from './session-parser.js'

interface DiscoveredFile {
  filePath: string
  size: number
  mtimeMs: number
  birthtimeMs: number
}

async function discoverSessionFiles(rootPath: string): Promise<DiscoveredFile[]> {
  const files: DiscoveredFile[] = []

  async function walk(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true })
    for (const entry of entries) {
      const entryPath = resolve(directory, entry.name)
      if (entry.isDirectory()) {
        await walk(entryPath)
      } else if (entry.isFile() && extname(entry.name) === '.jsonl') {
        const fileStat = await stat(entryPath)
        files.push({
          filePath: entryPath,
          size: fileStat.size,
          mtimeMs: fileStat.mtimeMs,
          birthtimeMs: fileStat.birthtimeMs,
        })
      }
    }
  }

  await walk(rootPath)
  return files
}

function signature(file: DiscoveredFile): string {
  return `${file.size}:${file.mtimeMs}`
}

function toSummary(detail: ParsedSessionDetail): SessionSummary {
  const { entries, searchText, ...summary } = detail
  void entries
  void searchText
  return summary
}

function toDetail(detail: ParsedSessionDetail): SessionDetail {
  const { searchText, ...session } = detail
  void searchText
  return session
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export class SessionRepository {
  private rootPath: string
  private readonly summaries = new Map<string, SessionSummary>()
  private readonly searchTextByPath = new Map<string, string>()
  private readonly signatures = new Map<string, string>()
  private refreshPromise: Promise<SessionListUpdate> | null = null
  private rootGeneration = 0

  constructor(rootPath: string) {
    this.rootPath = resolve(rootPath)
  }

  setRoot(rootPath: string): void {
    const nextRoot = resolve(rootPath)
    if (nextRoot === this.rootPath) return
    this.rootPath = nextRoot
    this.rootGeneration += 1
    this.summaries.clear()
    this.searchTextByPath.clear()
    this.signatures.clear()
  }

  getRoot(): string {
    return this.rootPath
  }

  list(): SessionSummary[] {
    return [...this.summaries.values()].sort(
      (left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt) || left.title.localeCompare(right.title),
    )
  }

  search(query: string): SessionSummary[] {
    const normalized = query.trim().toLocaleLowerCase()
    if (!normalized) return this.list()
    return this.list().filter((summary) => {
      const searchText = this.searchTextByPath.get(summary.filePath) ?? ''
      return searchText.includes(normalized)
    })
  }

  async refresh(force = false): Promise<SessionListUpdate> {
    if (this.refreshPromise) return this.refreshPromise

    this.refreshPromise = this.performRefreshWithRetry(force).finally(() => {
      this.refreshPromise = null
    })
    return this.refreshPromise
  }

  private async performRefreshWithRetry(force: boolean): Promise<SessionListUpdate> {
    while (true) {
      const generation = this.rootGeneration
      const rootPath = this.rootPath
      const update = await this.performRefresh(force, generation, rootPath)
      if (generation === this.rootGeneration) return update
    }
  }

  private async performRefresh(
    force: boolean,
    generation: number,
    rootPath: string,
  ): Promise<SessionListUpdate> {
    const files = await discoverSessionFiles(rootPath)
    if (generation !== this.rootGeneration) return { sessions: [], changedPaths: [] }
    const currentPaths = new Set(files.map((file) => file.filePath))
    const changedPaths: string[] = []
    const errors: string[] = []

    for (const path of this.summaries.keys()) {
      if (!currentPaths.has(path)) {
        this.summaries.delete(path)
        this.searchTextByPath.delete(path)
        this.signatures.delete(path)
        changedPaths.push(path)
      }
    }

    const pending = files.filter((file) => {
      const nextSignature = signature(file)
      const previousSignature = this.signatures.get(file.filePath)
      if (!force && previousSignature === nextSignature) return false
      changedPaths.push(file.filePath)
      return true
    })

    let cursor = 0
    const workers = Array.from({ length: Math.min(6, pending.length) }, async () => {
      while (cursor < pending.length) {
        const file = pending[cursor]
        cursor += 1
        if (!file) return
        try {
          if (generation !== this.rootGeneration) return
          const detail = await parseSessionFile(file.filePath, rootPath, file)
          if (generation !== this.rootGeneration) return
          this.summaries.set(file.filePath, toSummary(detail))
          this.searchTextByPath.set(file.filePath, detail.searchText)
          this.signatures.set(file.filePath, signature(file))
        } catch (error) {
          errors.push(`${relative(rootPath, file.filePath)}: ${errorMessage(error)}`)
        }
      }
    })
    await Promise.all(workers)

    return {
      sessions: this.list(),
      changedPaths: force ? files.map((file) => file.filePath) : [...new Set(changedPaths)],
      ...(errors.length > 0 ? { error: errors.join('\n') } : {}),
    }
  }

  assertSessionPath(filePath: string): string {
    const resolvedPath = resolve(filePath)
    const relativePath = relative(this.rootPath, resolvedPath)
    if (
      !relativePath ||
      relativePath.startsWith('..') ||
      isAbsolute(relativePath) ||
      extname(resolvedPath) !== '.jsonl'
    ) {
      throw new Error('会话文件不在当前数据目录中')
    }
    return resolvedPath
  }

  async getSession(filePath: string): Promise<SessionDetail> {
    const generation = this.rootGeneration
    const rootPath = this.rootPath
    const resolvedPath = this.assertSessionPath(filePath)
    const fileStat = await stat(resolvedPath)
    const detail = await parseSessionFile(resolvedPath, rootPath, {
      size: fileStat.size,
      mtimeMs: fileStat.mtimeMs,
      birthtimeMs: fileStat.birthtimeMs,
    })
    if (generation === this.rootGeneration) {
      this.summaries.set(resolvedPath, toSummary(detail))
      this.searchTextByPath.set(resolvedPath, detail.searchText)
      this.signatures.set(resolvedPath, `${fileStat.size}:${fileStat.mtimeMs}`)
    }
    return toDetail(detail)
  }
}

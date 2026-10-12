import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import type { AppConfig } from '../shared/types.js'

interface StoredConfig {
  customRootPath?: string
}

async function isDirectoryAccessible(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory()
  } catch {
    return false
  }
}

export class ConfigStore {
  private cached: AppConfig | null = null

  constructor(private readonly configPath: string) {}

  async get(): Promise<AppConfig> {
    if (this.cached) return this.cached

    let stored: StoredConfig = {}
    try {
      const value: unknown = JSON.parse(await readFile(this.configPath, 'utf8'))
      if (typeof value === 'object' && value !== null) stored = value as StoredConfig
    } catch {
      // A missing or damaged preferences file should never prevent the app from opening.
    }

    if (typeof stored.customRootPath === 'string' && stored.customRootPath.trim()) {
      const customRootPath = resolve(stored.customRootPath.trim())
      this.cached = {
        rootPath: customRootPath,
        rootSource: 'custom',
        rootExists: await isDirectoryAccessible(customRootPath),
      }
      return this.cached
    }

    const agentRoot = join(homedir(), '.pi', 'agent')
    const pluralRoot = join(agentRoot, 'sessions')
    const singularRoot = join(agentRoot, 'session')
    const pluralExists = await isDirectoryAccessible(pluralRoot)
    const singularExists = await isDirectoryAccessible(singularRoot)

    this.cached = {
      rootPath: pluralExists || !singularExists ? pluralRoot : singularRoot,
      rootSource: pluralExists ? 'default' : singularExists ? 'fallback' : 'default',
      rootExists: pluralExists || singularExists,
    }
    return this.cached
  }

  async setCustomRoot(path: string): Promise<AppConfig> {
    const customRootPath = resolve(path)
    await mkdir(dirname(this.configPath), { recursive: true })
    await writeFile(this.configPath, `${JSON.stringify({ customRootPath }, null, 2)}\n`, 'utf8')
    this.cached = {
      rootPath: customRootPath,
      rootSource: 'custom',
      rootExists: await isDirectoryAccessible(customRootPath),
    }
    return this.cached
  }

  async reset(): Promise<AppConfig> {
    await mkdir(dirname(this.configPath), { recursive: true })
    await writeFile(this.configPath, '{}\n', 'utf8')
    this.cached = null
    return this.get()
  }
}

import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFile, writeFile } from 'node:fs/promises'
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeTheme,
  shell,
  type IpcMainInvokeEvent,
  type OpenDialogOptions,
} from 'electron'
import type {
  BootstrapData,
  ExportFormat,
  ExportResult,
  SessionDetail,
  SessionEntry,
  SessionListUpdate,
} from '../shared/types.js'
import { ConfigStore } from './config-store.js'
import { SessionRepository } from './session-repository.js'

const currentDirectory = fileURLToPath(new URL('.', import.meta.url))
let mainWindow: BrowserWindow | null = null
let configStore: ConfigStore | null = null
let repository: SessionRepository | null = null
let watcher: NodeJS.Timeout | null = null

nativeTheme.themeSource = 'system'

if (process.env.PI_SESSION_DISABLE_GPU === '1') app.disableHardwareAcceleration()

nativeTheme.on('updated', () => {
  if (mainWindow) {
    mainWindow.setBackgroundColor(nativeTheme.shouldUseDarkColors ? '#090b10' : '#f3f6fb')
  }
})

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function safeFileName(value: string): string {
  const cleaned = value
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
  return (cleaned || 'pi-session').slice(0, 100)
}

function formatEntryBody(entry: SessionEntry): string {
  const sections: string[] = []
  if (entry.text) sections.push(entry.text)
  if (entry.thinking) sections.push(`> **思考**\n> ${entry.thinking.replace(/\n/g, '\n> ')}`)
  for (const block of entry.blocks) {
    if (block.type === 'toolCall') {
      const args = JSON.stringify(block.arguments, null, 2)
      sections.push(`**工具调用 · ${block.name}**\n\n\`\`\`json\n${args}\n\`\`\``)
    } else if (block.type === 'image') {
      sections.push(`![消息图片](data:${block.mimeType};base64,${block.data})`)
    }
  }
  if (entry.details !== null && entry.type !== 'message') {
    sections.push(`**详情**\n\n\`\`\`json\n${JSON.stringify(entry.details, null, 2)}\n\`\`\``)
  }
  return sections.join('\n\n')
}

function toMarkdown(session: SessionDetail): string {
  const header = [
    `# ${session.title}`,
    '',
    `- 会话 ID：\`${session.id}\``,
    `- 工作目录：\`${session.cwd}\``,
    `- 创建时间：${session.createdAt}`,
    `- 更新时间：${session.updatedAt}`,
    `- 消息：${session.messageCount}`,
    `- 工具调用：${session.toolCallCount}`,
    `- Token：${session.totalTokens.toLocaleString('en-US')}`,
    `- 成本：$${session.cost.toFixed(4)}`,
    '',
    '---',
    '',
  ]

  const timeline = session.entries.flatMap((entry) => {
    const role = entry.role === 'toolResult' ? `工具 · ${entry.toolName ?? 'result'}` : entry.role
    const body = formatEntryBody(entry)
    return [
      `## ${role} · ${entry.timestamp}`,
      '',
      body || '_无文本内容_',
      '',
    ]
  })

  return `${[...header, ...timeline].join('\n')}\n`
}

async function createBootstrap(force: boolean): Promise<BootstrapData> {
  if (!configStore || !repository) throw new Error('应用尚未初始化')
  const config = await configStore.get()
  repository.setRoot(config.rootPath)
  try {
    const update = await repository.refresh(force)
    return {
      config,
      sessions: update.sessions,
      error: update.error ?? null,
    }
  } catch (error) {
    return {
      config,
      sessions: [],
      error: errorMessage(error),
    }
  }
}

async function refreshAndNotify(force: boolean): Promise<SessionListUpdate> {
  if (!repository) throw new Error('应用尚未初始化')
  const update = await repository.refresh(force)
  if (update.changedPaths.length > 0 || update.error) {
    mainWindow?.webContents.send('sessions:changed', update)
  }
  return update
}

function registerIpcHandlers(): void {
  ipcMain.handle('app:get-bootstrap', () => createBootstrap(true))
  ipcMain.handle('sessions:refresh', () => refreshAndNotify(true))
  ipcMain.handle('sessions:search', (_event, query: string) => {
    if (!repository) throw new Error('应用尚未初始化')
    if (typeof query !== 'string') throw new Error('搜索词格式无效')
    return repository.search(query.slice(0, 500))
  })
  ipcMain.handle('sessions:get', async (_event: IpcMainInvokeEvent, filePath: string) => {
    if (!repository) throw new Error('应用尚未初始化')
    return repository.getSession(filePath)
  })
  ipcMain.handle('sessions:choose-root', async () => {
    if (!configStore || !repository) throw new Error('应用尚未初始化')
    const options: OpenDialogOptions = {
      title: '选择 pi 会话目录',
      defaultPath: repository.getRoot(),
      properties: ['openDirectory', 'createDirectory'],
    }
    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, options)
      : await dialog.showOpenDialog(options)
    if (result.canceled || !result.filePaths[0]) return null
    await configStore.setCustomRoot(result.filePaths[0])
    repository.setRoot(result.filePaths[0])
    return createBootstrap(true)
  })
  ipcMain.handle('sessions:reset-root', async () => {
    if (!configStore || !repository) throw new Error('应用尚未初始化')
    await configStore.reset()
    repository.setRoot((await configStore.get()).rootPath)
    return createBootstrap(true)
  })
  ipcMain.handle('sessions:open-location', async (_event, filePath: string) => {
    if (!repository) throw new Error('应用尚未初始化')
    shell.showItemInFolder(repository.assertSessionPath(filePath))
  })
  ipcMain.handle(
    'sessions:export',
    async (_event, filePath: string, format: ExportFormat): Promise<ExportResult> => {
      if (!repository) throw new Error('应用尚未初始化')
      if (format !== 'markdown' && format !== 'jsonl') throw new Error('不支持的导出格式')
      const sourcePath = repository.assertSessionPath(filePath)
      const session = await repository.getSession(sourcePath)
      const extension = format === 'markdown' ? 'md' : 'jsonl'
      const options = {
        title: '导出会话',
        defaultPath: join(app.getPath('documents'), `${safeFileName(session.title)}.${extension}`),
        filters:
          format === 'markdown'
            ? [{ name: 'Markdown', extensions: ['md'] }]
            : [{ name: 'JSON Lines', extensions: ['jsonl'] }],
      }
      const result = mainWindow
        ? await dialog.showSaveDialog(mainWindow, options)
        : await dialog.showSaveDialog(options)
      if (result.canceled || !result.filePath) return { canceled: true, filePath: null }
      const content = format === 'markdown'
        ? toMarkdown(session)
        : await readFile(sourcePath, 'utf8')
      await writeFile(result.filePath, content, 'utf8')
      return { canceled: false, filePath: result.filePath }
    },
  )
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 920,
    minWidth: 1080,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#090b10' : '#f3f6fb',
    title: 'Pi Session Visualizer',
    webPreferences: {
      preload: join(currentDirectory, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  })

  mainWindow.once('ready-to-show', () => mainWindow?.show())
  mainWindow.on('closed', () => {
    mainWindow = null
  })
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  mainWindow.webContents.on('will-navigate', (event) => event.preventDefault())

  const rendererUrl = process.env.ELECTRON_RENDERER_URL
  if (rendererUrl) {
    void mainWindow.loadURL(rendererUrl)
  } else {
    void mainWindow.loadFile(join(currentDirectory, '../renderer/index.html'))
  }
}

async function start(): Promise<void> {
  app.setName('Pi Session Visualizer')
  app.setAppUserModelId('dev.fenlyin.pi-session-visualizer')
  Menu.setApplicationMenu(null)

  configStore = new ConfigStore(join(app.getPath('userData'), 'preferences.json'))
  const initialConfig = await configStore.get()
  repository = new SessionRepository(initialConfig.rootPath)
  registerIpcHandlers()
  createWindow()

  watcher = setInterval(() => {
    void refreshAndNotify(false).catch((error: unknown) => {
      mainWindow?.webContents.send('sessions:changed', {
        sessions: [],
        changedPaths: [],
        error: errorMessage(error),
      } satisfies SessionListUpdate)
    })
  }, 2_500)
}

app.whenReady().then(start).catch((error: unknown) => {
  dialog.showErrorBox('Pi Session Visualizer 启动失败', errorMessage(error))
  app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  if (watcher) clearInterval(watcher)
  watcher = null
})

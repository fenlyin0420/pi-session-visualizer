import { clipboard, contextBridge, ipcRenderer } from 'electron'
import type {
  BootstrapData,
  ExportFormat,
  ExportResult,
  PiDesktopApi,
  SessionDetail,
  SessionListUpdate,
  SessionSummary,
} from '../shared/types.js'

const api: PiDesktopApi = {
  getBootstrap: () => ipcRenderer.invoke('app:get-bootstrap') as Promise<BootstrapData>,
  refreshSessions: () => ipcRenderer.invoke('sessions:refresh') as Promise<SessionListUpdate>,
  searchSessions: (query) => ipcRenderer.invoke('sessions:search', query) as Promise<SessionSummary[]>,
  getSession: (filePath) => ipcRenderer.invoke('sessions:get', filePath) as Promise<SessionDetail>,
  chooseSessionRoot: () => ipcRenderer.invoke('sessions:choose-root') as Promise<BootstrapData | null>,
  resetSessionRoot: () => ipcRenderer.invoke('sessions:reset-root') as Promise<BootstrapData>,
  openSessionLocation: (filePath) => ipcRenderer.invoke('sessions:open-location', filePath) as Promise<void>,
  copyText: async (text) => clipboard.writeText(text),
  exportSession: (filePath, format: ExportFormat) =>
    ipcRenderer.invoke('sessions:export', filePath, format) as Promise<ExportResult>,
  onSessionsChanged: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, update: SessionListUpdate): void => listener(update)
    ipcRenderer.on('sessions:changed', handler)
    return () => ipcRenderer.removeListener('sessions:changed', handler)
  },
  platform: process.platform,
}

contextBridge.exposeInMainWorld('piDesktop', api)

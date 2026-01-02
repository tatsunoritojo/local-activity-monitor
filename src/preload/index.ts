import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { Project, Settings } from '../shared/types'

// Custom APIs for renderer
const api = {
  // Get all projects with their statuses
  getProjects: (): Promise<Project[]> => ipcRenderer.invoke('get-projects'),

  // Get current settings
  getSettings: (): Promise<Settings> => ipcRenderer.invoke('get-settings'),

  // Add a watch directory
  addWatchDir: (dir: string): Promise<boolean> => ipcRenderer.invoke('add-watch-dir', dir),

  // Remove a watch directory
  removeWatchDir: (dir: string): Promise<boolean> => ipcRenderer.invoke('remove-watch-dir', dir),

  // Open directory picker dialog
  selectDirectory: (): Promise<string | null> => ipcRenderer.invoke('select-directory'),

  // Open a path in the file explorer
  openPath: (path: string): Promise<void> => ipcRenderer.invoke('open-path', path),

  // Run a command in a specific directory
  runCommand: (command: string, cwd: string): Promise<void> => ipcRenderer.invoke('run-command', command, cwd),

  // Get git status for a project
  getGitStatus: (projectPath: string): Promise<{
    isGitRepo: boolean
    branch: string
    staged: number
    unstaged: number
    untracked: number
    ahead: number
    behind: number
  } | null> => ipcRenderer.invoke('get-git-status', projectPath),

  // Auto-start settings
  getAutoStart: (): Promise<boolean> => ipcRenderer.invoke('get-auto-start'),
  setAutoStart: (enabled: boolean): Promise<void> => ipcRenderer.invoke('set-auto-start', enabled),

  // Listen for project updates
  onProjectsUpdated: (callback: () => void): (() => void) => {
    const listener = (): void => callback()
    ipcRenderer.on('projects-updated', listener)
    return () => ipcRenderer.removeListener('projects-updated', listener)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}

import { ElectronAPI } from '@electron-toolkit/preload'
import type { Project, Settings } from '../shared/types'

interface API {
  getProjects: () => Promise<Project[]>
  getSettings: () => Promise<Settings>
  addWatchDir: (dir: string) => Promise<boolean>
  removeWatchDir: (dir: string) => Promise<boolean>
  selectDirectory: () => Promise<string | null>
  openPath: (path: string) => Promise<void>
  runCommand: (command: string, cwd: string) => Promise<void>
  getGitStatus: (projectPath: string) => Promise<{
    isGitRepo: boolean
    branch: string
    staged: number
    unstaged: number
    untracked: number
    ahead: number
    behind: number
  } | null>
  getAutoStart: () => Promise<boolean>
  setAutoStart: (enabled: boolean) => Promise<void>
  onProjectsUpdated: (callback: () => void) => () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: API
  }
}

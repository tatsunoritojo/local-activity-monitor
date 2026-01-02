// Shared Types for Local Activity Monitor

export type ProjectStatus = 'active' | 'idle' | 'stale'
export type SortMode = 'status' | 'name' | 'activity' | 'git-hot' | 'git-changes'

export interface Project {
  path: string
  name: string
  status: ProjectStatus
  lastActivity: number | null
  hotness?: number // Git commit frequency score
}

export interface ActivityRecord {
  projectPath: string
  timestamp: number
}

export interface FilterSettings {
  showActive: boolean
  showIdle: boolean
  showStale: boolean
  gitReposOnly: boolean
  hasChangesOnly: boolean
}

export interface Settings {
  watchDirs: string[]
  filters: FilterSettings
  defaultSort: SortMode
  sortAscending: boolean
}

export const DEFAULT_FILTERS: FilterSettings = {
  showActive: true,
  showIdle: true,
  showStale: true,
  gitReposOnly: false,
  hasChangesOnly: false
}

export const DEFAULT_SETTINGS: Partial<Settings> = {
  filters: DEFAULT_FILTERS,
  defaultSort: 'status',
  sortAscending: true
}

// Status thresholds in milliseconds
export const STATUS_THRESHOLDS = {
  ACTIVE_DAYS: 7,
  IDLE_DAYS: 30
} as const

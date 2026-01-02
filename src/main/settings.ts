import { app } from 'electron'
import { join } from 'path'
import fs from 'fs/promises'
import { existsSync } from 'fs'
import type { Settings, FilterSettings, SortMode } from '../shared/types'
import { DEFAULT_FILTERS } from '../shared/types'

const SETTINGS_FILE_NAME = 'settings.json'

const getSettingsPath = (): string => join(app.getPath('userData'), SETTINGS_FILE_NAME)

const DEFAULT_SETTINGS: Settings = {
  watchDirs: ['C:/Users/tatsu/Github'],
  filters: DEFAULT_FILTERS,
  defaultSort: 'status',
  sortAscending: true
}

/**
 * Load settings from the settings file.
 * Merges with defaults to ensure all fields exist.
 */
export async function loadSettings(): Promise<Settings> {
  const settingsPath = getSettingsPath()

  try {
    if (!existsSync(settingsPath)) {
      await saveSettings(DEFAULT_SETTINGS)
      return DEFAULT_SETTINGS
    }

    const data = await fs.readFile(settingsPath, 'utf-8')
    const saved = JSON.parse(data) as Partial<Settings>

    // Merge with defaults to ensure all fields exist
    const settings: Settings = {
      watchDirs: saved.watchDirs ?? DEFAULT_SETTINGS.watchDirs,
      filters: { ...DEFAULT_SETTINGS.filters, ...saved.filters },
      defaultSort: saved.defaultSort ?? DEFAULT_SETTINGS.defaultSort,
      sortAscending: saved.sortAscending ?? DEFAULT_SETTINGS.sortAscending
    }

    if (!Array.isArray(settings.watchDirs)) {
      settings.watchDirs = DEFAULT_SETTINGS.watchDirs
    }

    return settings
  } catch (error) {
    console.error('Failed to load settings:', error)
    return DEFAULT_SETTINGS
  }
}

/**
 * Save settings to the settings file.
 */
export async function saveSettings(settings: Settings): Promise<void> {
  const settingsPath = getSettingsPath()

  try {
    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2))
    console.log('Settings saved successfully.')
  } catch (error) {
    console.error('Failed to save settings:', error)
    throw error
  }
}

/**
 * Update filter settings.
 */
export async function updateFilters(filters: FilterSettings): Promise<void> {
  const settings = await loadSettings()
  settings.filters = filters
  await saveSettings(settings)
}

/**
 * Update sort settings.
 */
export async function updateSortSettings(sort: SortMode, ascending: boolean): Promise<void> {
  const settings = await loadSettings()
  settings.defaultSort = sort
  settings.sortAscending = ascending
  await saveSettings(settings)
}

/**
 * Add a watch directory to the settings.
 */
export async function addWatchDir(dir: string): Promise<boolean> {
  const settings = await loadSettings()
  const normalizedDir = dir.replace(/\\/g, '/')

  if (settings.watchDirs.includes(normalizedDir)) {
    return false
  }

  settings.watchDirs.push(normalizedDir)
  await saveSettings(settings)
  return true
}

/**
 * Remove a watch directory from the settings.
 */
export async function removeWatchDir(dir: string): Promise<boolean> {
  const settings = await loadSettings()
  const normalizedDir = dir.replace(/\\/g, '/')
  const index = settings.watchDirs.indexOf(normalizedDir)

  if (index === -1) {
    return false
  }

  settings.watchDirs.splice(index, 1)
  await saveSettings(settings)
  return true
}

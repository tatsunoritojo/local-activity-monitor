import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join, sep, basename } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import chokidar, { FSWatcher } from 'chokidar'
import fs from 'fs/promises'
import { existsSync, readdirSync, statSync } from 'fs'
import { loadSettings, saveSettings, addWatchDir, removeWatchDir } from './settings'
import type { ActivityRecord, Project, ProjectStatus, Settings } from '../shared/types'
import { STATUS_THRESHOLDS } from '../shared/types'

// --- Persistent Log Setup ---
const LOG_FILE_NAME = 'activity-log.json'
const getLogPath = (): string => join(app.getPath('userData'), LOG_FILE_NAME)

async function readActivityLog(): Promise<ActivityRecord[]> {
  const logPath = getLogPath()
  try {
    if (!existsSync(logPath)) {
      return []
    }
    const data = await fs.readFile(logPath, 'utf-8')
    return JSON.parse(data) as ActivityRecord[]
  } catch (error) {
    console.error('Failed to read activity log:', error)
    return []
  }
}

async function writeActivityLog(records: ActivityRecord[]): Promise<void> {
  const logPath = getLogPath()
  console.log(`Attempting to write/update log file at: ${logPath}`)
  try {
    const existingRecords = await readActivityLog()
    const updatedRecords = [...existingRecords, ...records]
    await fs.writeFile(logPath, JSON.stringify(updatedRecords, null, 2))
    console.log(`Successfully wrote ${records.length} records to log.`)
  } catch (error) {
    console.error('Failed to write activity log:', error)
  }
}

// --- Project Analysis ---
function calculateStatus(lastActivity: number | null): ProjectStatus {
  if (lastActivity === null) {
    return 'stale'
  }

  const now = Date.now()
  const daysSinceActivity = (now - lastActivity) / (1000 * 60 * 60 * 24)

  if (daysSinceActivity <= STATUS_THRESHOLDS.ACTIVE_DAYS) {
    return 'active'
  } else if (daysSinceActivity <= STATUS_THRESHOLDS.IDLE_DAYS) {
    return 'idle'
  } else {
    return 'stale'
  }
}

async function discoverProjects(watchDirs: string[]): Promise<Project[]> {
  const projects: Project[] = []
  const activityLog = await readActivityLog()
  const { execSync } = await import('child_process')

  // Create a map of projectPath -> latest timestamp
  const latestActivityMap = new Map<string, number>()
  for (const record of activityLog) {
    const normalizedPath = record.projectPath.replace(/\\/g, '/')
    const existing = latestActivityMap.get(normalizedPath)
    if (!existing || record.timestamp > existing) {
      latestActivityMap.set(normalizedPath, record.timestamp)
    }
  }

  for (const watchDir of watchDirs) {
    const normalizedWatchDir = watchDir.replace(/\\/g, sep)

    if (!existsSync(normalizedWatchDir)) {
      console.warn(`Watch directory does not exist: ${watchDir}`)
      continue
    }

    try {
      const entries = readdirSync(normalizedWatchDir, { withFileTypes: true })

      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          const projectPath = join(normalizedWatchDir, entry.name)
          const normalizedProjectPath = projectPath.replace(/\\/g, '/')
          const lastActivity = latestActivityMap.get(normalizedProjectPath) ?? null

          // Calculate Git hotness score
          let hotness = 0
          try {
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

            const commits7d = execSync(`git log --since="${sevenDaysAgo}" --oneline`, {
              cwd: projectPath,
              encoding: 'utf-8',
              stdio: ['pipe', 'pipe', 'pipe']
            }).split('\n').filter(l => l.trim()).length

            const commits30d = execSync(`git log --since="${thirtyDaysAgo}" --oneline`, {
              cwd: projectPath,
              encoding: 'utf-8',
              stdio: ['pipe', 'pipe', 'pipe']
            }).split('\n').filter(l => l.trim()).length

            // Hotness = (7-day commits * 3) + (30-day commits)
            hotness = (commits7d * 3) + commits30d
          } catch {
            // Not a git repo or no commits
            hotness = 0
          }

          projects.push({
            path: normalizedProjectPath,
            name: entry.name,
            status: calculateStatus(lastActivity),
            lastActivity,
            hotness
          })
        }
      }
    } catch (error) {
      console.error(`Failed to read directory ${watchDir}:`, error)
    }
  }

  // Sort by status priority (stale first), then by name
  const statusPriority: Record<ProjectStatus, number> = { stale: 0, idle: 1, active: 2 }
  projects.sort((a, b) => {
    const priorityDiff = statusPriority[a.status] - statusPriority[b.status]
    if (priorityDiff !== 0) return priorityDiff
    return a.name.localeCompare(b.name)
  })

  return projects
}

// --- Window Management ---
let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// --- File Watcher Management ---
let watchers: FSWatcher[] = []
let activityTimer: NodeJS.Timeout
const hotDirectories = new Set<string>()
const ACTIVITY_DEBOUNCE_TIME = 3000

const processActivity = async (): Promise<void> => {
  if (hotDirectories.size === 0) return

  console.log('--- Activity Burst Detected ---')
  const records: ActivityRecord[] = Array.from(hotDirectories).map((dir) => ({
    projectPath: dir,
    timestamp: Date.now()
  }))

  await writeActivityLog(records)
  hotDirectories.clear()

  // Notify renderer about the update
  mainWindow?.webContents.send('projects-updated')
}

function createHandleFileChange(watchDirs: string[]) {
  return (filePath: string): void => {
    // Normalize file path to use forward slashes for comparison
    const normalizedFilePath = filePath.replace(/\\/g, '/')

    for (const watchDir of watchDirs) {
      const normalizedWatchDir = watchDir.replace(/\\/g, '/')

      // Check if file is within this watch directory
      if (!normalizedFilePath.toLowerCase().startsWith(normalizedWatchDir.toLowerCase())) {
        continue
      }

      // Get the relative path from the watch directory
      const relativePath = normalizedFilePath.substring(normalizedWatchDir.length)

      // Remove leading slash and get the first segment (project folder)
      const segments = relativePath.split('/').filter((p) => p)
      const projectFolderName = segments[0]

      if (projectFolderName) {
        const projectPath = `${normalizedWatchDir}/${projectFolderName}`
        console.log(`Detected activity in project: ${projectPath}`)
        hotDirectories.add(projectPath)
        clearTimeout(activityTimer)
        activityTimer = setTimeout(processActivity, ACTIVITY_DEBOUNCE_TIME)
        return // Found the matching watch dir, no need to check others
      }
    }
  }
}

async function startWatchers(settings: Settings): Promise<void> {
  // Close existing watchers
  for (const watcher of watchers) {
    await watcher.close()
  }
  watchers = []

  const handleFileChange = createHandleFileChange(settings.watchDirs)

  for (const watchDir of settings.watchDirs) {
    const normalizedDir = watchDir.replace(/\//g, sep)

    if (!existsSync(normalizedDir)) {
      console.warn(`Watch directory does not exist: ${watchDir}`)
      continue
    }

    const watcher = chokidar.watch(normalizedDir, {
      ignored: [
        /(^|[/\\])\../, // ignore dotfiles
        /node_modules/,
        /dist/,
        /build/,
        /out/,
        /vendor/,
        /\.log$/,
        /package-lock\.json/,
        /yarn\.lock/
      ],
      persistent: true,
      ignoreInitial: true,
      depth: 5
    })

    watcher
      .on('add', handleFileChange)
      .on('change', handleFileChange)
      .on('unlink', handleFileChange)
      .on('error', (error) => console.error(`Watcher error: ${error}`))
      .on('ready', () => console.log(`Watching for changes in: ${watchDir}`))

    watchers.push(watcher)
  }

  console.log(`Started watching ${settings.watchDirs.length} directories`)
}

// --- IPC Handlers ---
function setupIpcHandlers(): void {
  // Get all projects with their statuses
  ipcMain.handle('get-projects', async (): Promise<Project[]> => {
    const settings = await loadSettings()
    return discoverProjects(settings.watchDirs)
  })

  // Get current settings
  ipcMain.handle('get-settings', async (): Promise<Settings> => {
    return loadSettings()
  })

  // Add a watch directory
  ipcMain.handle('add-watch-dir', async (_, dir: string): Promise<boolean> => {
    const result = await addWatchDir(dir)
    if (result) {
      const settings = await loadSettings()
      await startWatchers(settings)
    }
    return result
  })

  // Remove a watch directory
  ipcMain.handle('remove-watch-dir', async (_, dir: string): Promise<boolean> => {
    const result = await removeWatchDir(dir)
    if (result) {
      const settings = await loadSettings()
      await startWatchers(settings)
    }
    return result
  })

  // Open directory picker dialog
  ipcMain.handle('select-directory', async (): Promise<string | null> => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Select a directory to watch'
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    return result.filePaths[0].replace(/\\/g, '/')
  })

  // Open a path in the file explorer
  ipcMain.handle('open-path', async (_, path: string): Promise<void> => {
    const normalizedPath = path.replace(/\//g, sep)
    await shell.openPath(normalizedPath)
  })

  // Run a command in a specific directory
  ipcMain.handle('run-command', async (_, command: string, cwd: string): Promise<void> => {
    const normalizedCwd = cwd.replace(/\//g, sep)
    const { spawn } = await import('child_process')

    // On Windows, use cmd /c start to open in new terminal
    if (process.platform === 'win32') {
      spawn('cmd', ['/c', 'start', 'cmd', '/k', command], {
        cwd: normalizedCwd,
        detached: true,
        shell: true
      })
    } else {
      // On macOS/Linux, use terminal
      spawn(command, {
        cwd: normalizedCwd,
        detached: true,
        shell: true
      })
    }
  })

  // Get git status for a project
  ipcMain.handle('get-git-status', async (_, projectPath: string): Promise<{
    isGitRepo: boolean
    branch: string
    staged: number
    unstaged: number
    untracked: number
    ahead: number
    behind: number
  } | null> => {
    const normalizedPath = projectPath.replace(/\//g, sep)
    const { execSync } = await import('child_process')

    try {
      // Check if it's a git repo
      execSync('git rev-parse --is-inside-work-tree', { cwd: normalizedPath, stdio: 'pipe' })

      // Get branch name
      let branch = 'unknown'
      try {
        branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: normalizedPath, encoding: 'utf-8' }).trim()
      } catch { /* ignore */ }

      // Get status counts
      let staged = 0, unstaged = 0, untracked = 0
      try {
        const status = execSync('git status --porcelain', { cwd: normalizedPath, encoding: 'utf-8' })
        const lines = status.split('\n').filter(l => l.trim())
        for (const line of lines) {
          const x = line[0]
          const y = line[1]
          if (x === '?' && y === '?') untracked++
          else if (x !== ' ' && x !== '?') staged++
          if (y !== ' ' && y !== '?') unstaged++
        }
      } catch { /* ignore */ }

      // Get ahead/behind
      let ahead = 0, behind = 0
      try {
        const result = execSync('git rev-list --left-right --count HEAD...@{upstream}', { cwd: normalizedPath, encoding: 'utf-8' }).trim()
        const [a, b] = result.split('\t').map(Number)
        ahead = a || 0
        behind = b || 0
      } catch { /* ignore */ }

      return { isGitRepo: true, branch, staged, unstaged, untracked, ahead, behind }
    } catch {
      return null
    }
  })
}

// --- App Lifecycle ---
app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  setupIpcHandlers()
  createWindow()

  // Start file watchers
  const settings = await loadSettings()
  await startWatchers(settings)

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

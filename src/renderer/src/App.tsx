import { useState, useEffect, useCallback, useRef } from 'react'
import type { Project, Settings, SortMode, FilterSettings } from '../../shared/types'
import { DEFAULT_FILTERS } from '../../shared/types'

type ViewMode = 'projects' | 'settings'

interface GitStatus {
  isGitRepo: boolean
  branch: string
  staged: number
  unstaged: number
  untracked: number
  ahead: number
  behind: number
}

interface ContextMenu {
  x: number
  y: number
  project: Project
  gitStatus: GitStatus | null
}

const QUICK_ACTIONS = [
  { id: 'explorer', label: 'Open in Explorer', command: null },
  { id: 'terminal', label: 'Open Terminal', command: 'cd .' },
  { id: 'gemini', label: 'Gemini CLI', command: 'gemini' },
  { id: 'claude', label: 'Claude Code', command: 'claude' },
  { id: 'antigravity', label: 'Antigravity', command: 'Antigravity.exe' },
  { id: 'vscode', label: 'VS Code', command: 'code .' },
]

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: 'status', label: 'Status' },
  { value: 'name', label: 'Name' },
  { value: 'activity', label: 'Activity' },
  { value: 'git-hot', label: 'Git Hot' },
]

function App(): React.JSX.Element {
  const [projects, setProjects] = useState<Project[]>([])
  const [settings, setSettings] = useState<Settings>({
    watchDirs: [],
    filters: DEFAULT_FILTERS,
    defaultSort: 'status',
    sortAscending: true
  })
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('projects')
  const [sortMode, setSortMode] = useState<SortMode>('status')
  const [sortAsc, setSortAsc] = useState(true)
  const [filters, setFilters] = useState<FilterSettings>(DEFAULT_FILTERS)
  const [addingDir, setAddingDir] = useState(false)
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null)
  const [selectedProject, setSelectedProject] = useState<{ project: Project; gitStatus: GitStatus | null } | null>(null)
  const [gitStatusCache, setGitStatusCache] = useState<Map<string, GitStatus | null>>(new Map())
  const contextMenuRef = useRef<HTMLDivElement>(null)

  const loadData = useCallback(async () => {
    try {
      const [projectList, currentSettings] = await Promise.all([
        window.api.getProjects(),
        window.api.getSettings()
      ])
      setProjects(projectList)
      setSettings(currentSettings)
      setSortMode(currentSettings.defaultSort || 'status')
      setSortAsc(currentSettings.sortAscending ?? true)
      setFilters(currentSettings.filters || DEFAULT_FILTERS)
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
    const unsubscribe = window.api.onProjectsUpdated(() => loadData())
    return () => unsubscribe()
  }, [loadData])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Prefetch git status for visible projects
  useEffect(() => {
    const fetchGitStatus = async () => {
      for (const project of projects) {
        if (!gitStatusCache.has(project.path)) {
          const status = await window.api.getGitStatus(project.path)
          setGitStatusCache(prev => new Map(prev).set(project.path, status))
        }
      }
    }
    if (projects.length > 0) fetchGitStatus()
  }, [projects])

  const handleAddDirectory = async () => {
    setAddingDir(true)
    try {
      const dir = await window.api.selectDirectory()
      if (dir) {
        const added = await window.api.addWatchDir(dir)
        if (added) await loadData()
      }
    } catch (error) {
      console.error('Failed to add directory:', error)
    } finally {
      setAddingDir(false)
    }
  }

  const handleRemoveDirectory = async (dir: string) => {
    const removed = await window.api.removeWatchDir(dir)
    if (removed) await loadData()
  }

  const handleOpenProject = async (path: string) => {
    await window.api.openPath(path)
  }

  const handleRunCommand = async (command: string, cwd: string) => {
    await window.api.runCommand(command, cwd)
  }

  const handleProjectClick = async (project: Project) => {
    const gitStatus = gitStatusCache.get(project.path) ?? await window.api.getGitStatus(project.path)
    setSelectedProject({ project, gitStatus })
  }

  const handleContextMenu = async (e: React.MouseEvent, project: Project) => {
    e.preventDefault()
    const gitStatus = gitStatusCache.get(project.path) ?? await window.api.getGitStatus(project.path)
    setContextMenu({ x: e.clientX, y: e.clientY, project, gitStatus })
  }

  const handleQuickAction = async (actionId: string) => {
    if (!contextMenu) return
    const action = QUICK_ACTIONS.find(a => a.id === actionId)
    if (!action) return
    if (action.command === null) await handleOpenProject(contextMenu.project.path)
    else await handleRunCommand(action.command, contextMenu.project.path)
    setContextMenu(null)
  }

  const toggleSortDirection = () => {
    setSortAsc(!sortAsc)
  }

  // Calculate max hotness for normalization
  const maxHotness = Math.max(...projects.map(p => p.hotness ?? 0), 1)

  // Get button style based on sort mode
  const getButtonStyle = (project: Project) => {
    if (sortMode === 'git-hot') {
      // Color based on hotness (gradient from cold to hot)
      const hotness = project.hotness ?? 0
      const ratio = hotness / maxHotness

      if (hotness === 0) {
        return 'bg-zinc-800 border border-zinc-700 text-zinc-500 hover:bg-zinc-700'
      } else if (ratio < 0.3) {
        return 'bg-blue-900/50 border border-blue-700 text-blue-300 hover:bg-blue-800/50'
      } else if (ratio < 0.6) {
        return 'bg-amber-900/50 border border-amber-600 text-amber-300 hover:bg-amber-800/50'
      } else {
        return 'bg-orange-600 border border-orange-400 text-white hover:bg-orange-500'
      }
    }

    // Default: color by status
    switch (project.status) {
      case 'active': return 'bg-orange-500 hover:bg-orange-400 text-white'
      case 'idle': return 'bg-emerald-600 hover:bg-emerald-500 text-white'
      case 'stale': return 'bg-transparent border border-zinc-600 hover:border-zinc-500 text-zinc-400 hover:text-white'
    }
  }

  const getStatusDot = (status: Project['status']) => {
    switch (status) {
      case 'active': return 'bg-orange-400'
      case 'idle': return 'bg-emerald-400'
      case 'stale': return 'bg-zinc-500'
    }
  }

  const formatLastActivity = (lastActivity: number | null) => {
    if (lastActivity === null) return '-'
    const now = Date.now()
    const diffMs = now - lastActivity
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    if (diffHours < 1) return 'now'
    if (diffHours < 24) return `${diffHours}h`
    if (diffDays < 30) return `${diffDays}d`
    return `${Math.floor(diffDays / 30)}mo`
  }

  // Get git status summary
  const getGitSummary = (gs: GitStatus | null) => {
    if (!gs) return null
    const parts: string[] = []
    if (gs.staged > 0) parts.push(`+${gs.staged}`)
    if (gs.unstaged > 0) parts.push(`~${gs.unstaged}`)
    if (gs.untracked > 0) parts.push(`?${gs.untracked}`)
    return parts.length > 0 ? parts.join(' ') : null
  }

  // Apply filters
  const filteredProjects = projects.filter(p => {
    if (!filters.showActive && p.status === 'active') return false
    if (!filters.showIdle && p.status === 'idle') return false
    if (!filters.showStale && p.status === 'stale') return false
    if (filters.gitReposOnly) {
      const gs = gitStatusCache.get(p.path)
      if (!gs) return false
    }
    if (filters.hasChangesOnly) {
      const gs = gitStatusCache.get(p.path)
      if (!gs || (gs.staged === 0 && gs.unstaged === 0 && gs.untracked === 0)) return false
    }
    return true
  })

  // Apply sorting
  const sortedProjects = [...filteredProjects].sort((a, b) => {
    let cmp = 0
    if (sortMode === 'status') {
      const statusPriority: Record<Project['status'], number> = { stale: 0, idle: 1, active: 2 }
      cmp = statusPriority[a.status] - statusPriority[b.status]
      if (cmp === 0) cmp = a.name.localeCompare(b.name)
    } else if (sortMode === 'name') {
      cmp = a.name.localeCompare(b.name)
    } else if (sortMode === 'activity') {
      cmp = (b.lastActivity ?? 0) - (a.lastActivity ?? 0)
    } else if (sortMode === 'git-hot') {
      cmp = (b.hotness ?? 0) - (a.hotness ?? 0)
    }
    return sortAsc ? cmp : -cmp
  })

  const statusCounts = {
    active: projects.filter(p => p.status === 'active').length,
    idle: projects.filter(p => p.status === 'idle').length,
    stale: projects.filter(p => p.status === 'stale').length
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-black text-white">
        <div className="text-sm text-zinc-400">Loading...</div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-black text-white font-sans text-sm antialiased">
      {/* Sidebar */}
      <div className="w-52 bg-zinc-950 p-4 border-r border-zinc-800 flex flex-col">
        <h1 className="text-sm font-semibold tracking-tight mb-6">Activity Monitor</h1>

        <nav className="space-y-1 mb-6">
          <button
            onClick={() => setViewMode('projects')}
            className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${viewMode === 'projects' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
              }`}
          >
            Projects
          </button>
          <button
            onClick={() => setViewMode('settings')}
            className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${viewMode === 'settings' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
              }`}
          >
            Settings
          </button>
        </nav>

        {viewMode === 'projects' && (
          <div className="mt-auto space-y-2">
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider px-2 mb-1">Summary</div>
            <div className="flex justify-between items-center px-2 py-1.5 text-xs">
              <span className="flex items-center gap-2 text-zinc-400">
                <span className="w-2 h-2 rounded-full bg-orange-500"></span>Active
              </span>
              <span className="text-white font-medium">{statusCounts.active}</span>
            </div>
            <div className="flex justify-between items-center px-2 py-1.5 text-xs">
              <span className="flex items-center gap-2 text-zinc-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>Idle
              </span>
              <span className="text-white font-medium">{statusCounts.idle}</span>
            </div>
            <div className="flex justify-between items-center px-2 py-1.5 text-xs">
              <span className="flex items-center gap-2 text-zinc-400">
                <span className="w-2 h-2 rounded-full bg-zinc-600"></span>Stale
              </span>
              <span className="text-white font-medium">{statusCounts.stale}</span>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {viewMode === 'projects' ? (
          <>
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">{sortedProjects.length}/{projects.length}</span>
                <select
                  value={sortMode}
                  onChange={(e) => setSortMode(e.target.value as SortMode)}
                  className="bg-zinc-900 border border-zinc-700 rounded-md px-2 py-1 text-xs text-white"
                >
                  {SORT_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <button
                  onClick={toggleSortDirection}
                  className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 rounded text-xs"
                  title={sortAsc ? 'Ascending' : 'Descending'}
                >
                  {sortAsc ? '↑' : '↓'}
                </button>
                {sortMode === 'git-hot' && (
                  <span className="text-[10px] text-orange-400">Colored by commit activity</span>
                )}
              </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4">
                {sortedProjects.length === 0 ? (
                  <div className="text-center text-zinc-500 mt-12">
                    <p className="text-sm">No projects match filters</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {sortedProjects.map((project) => {
                      const gs = gitStatusCache.get(project.path)
                      const gitSummary = getGitSummary(gs)
                      return (
                        <button
                          key={project.path}
                          onClick={() => handleProjectClick(project)}
                          onDoubleClick={() => handleOpenProject(project.path)}
                          onContextMenu={(e) => handleContextMenu(e, project)}
                          className={`px-3 py-2.5 rounded-md text-left transition-all ${getButtonStyle(project)} ${selectedProject?.project.path === project.path ? 'ring-1 ring-white ring-offset-1 ring-offset-black' : ''
                            }`}
                        >
                          <div className="font-medium truncate text-sm">{project.name}</div>
                          <div className="flex justify-between items-center text-xs opacity-70 mt-1">
                            <span>{formatLastActivity(project.lastActivity)}</span>
                            <span className="flex items-center gap-1">
                              {gitSummary && <span className="text-[10px]">{gitSummary}</span>}
                              {(project.hotness ?? 0) > 0 && sortMode === 'git-hot' && (
                                <span className="text-orange-300">{project.hotness}</span>
                              )}
                            </span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Detail Panel */}
              {selectedProject && (
                <div className="w-80 border-l border-zinc-800 bg-zinc-950 p-4 overflow-y-auto">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-base truncate text-white">{selectedProject.project.name}</h3>
                    <button onClick={() => setSelectedProject(null)} className="text-zinc-500 hover:text-white text-lg">×</button>
                  </div>

                  {/* Quick Status Bar */}
                  <div className="flex gap-2 mb-4">
                    <span className={`px-2 py-1 rounded text-[10px] font-medium uppercase ${selectedProject.project.status === 'active' ? 'bg-orange-500 text-white' :
                        selectedProject.project.status === 'idle' ? 'bg-emerald-600 text-white' :
                          'bg-zinc-700 text-zinc-300'
                      }`}>
                      {selectedProject.project.status}
                    </span>
                    {selectedProject.gitStatus && (
                      <span className="px-2 py-1 rounded text-[10px] bg-blue-900 text-blue-300">
                        {selectedProject.gitStatus.branch}
                      </span>
                    )}
                    {(selectedProject.project.hotness ?? 0) > 0 && (
                      <span className="px-2 py-1 rounded text-[10px] bg-orange-900 text-orange-300">
                        {selectedProject.project.hotness} commits
                      </span>
                    )}
                  </div>

                  <div className="space-y-4 text-xs">
                    {/* Activity Section */}
                    <div className="bg-zinc-900 rounded-lg p-3">
                      <div className="text-zinc-500 mb-2 uppercase tracking-wider text-[10px]">Activity</div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <div className="text-zinc-400">Last Update</div>
                          <div className="text-white font-medium">{formatLastActivity(selectedProject.project.lastActivity)}</div>
                        </div>
                        <div>
                          <div className="text-zinc-400">Hotness Score</div>
                          <div className="text-orange-400 font-medium">{selectedProject.project.hotness ?? 0}</div>
                        </div>
                      </div>
                    </div>

                    {/* Git Section */}
                    {selectedProject.gitStatus && (
                      <div className="bg-zinc-900 rounded-lg p-3">
                        <div className="text-zinc-500 mb-2 uppercase tracking-wider text-[10px]">Git Status</div>

                        {/* Working Directory Status */}
                        <div className="grid grid-cols-3 gap-2 mb-3">
                          <div className="text-center p-2 rounded bg-zinc-800">
                            <div className="text-lg font-bold text-emerald-400">{selectedProject.gitStatus.staged}</div>
                            <div className="text-[10px] text-zinc-500">Staged</div>
                          </div>
                          <div className="text-center p-2 rounded bg-zinc-800">
                            <div className="text-lg font-bold text-amber-400">{selectedProject.gitStatus.unstaged}</div>
                            <div className="text-[10px] text-zinc-500">Modified</div>
                          </div>
                          <div className="text-center p-2 rounded bg-zinc-800">
                            <div className="text-lg font-bold text-zinc-400">{selectedProject.gitStatus.untracked}</div>
                            <div className="text-[10px] text-zinc-500">Untracked</div>
                          </div>
                        </div>

                        {/* Sync Status */}
                        {(selectedProject.gitStatus.ahead > 0 || selectedProject.gitStatus.behind > 0) && (
                          <div className="flex gap-2 text-xs">
                            {selectedProject.gitStatus.ahead > 0 && (
                              <span className="px-2 py-1 rounded bg-emerald-900/50 text-emerald-400">
                                ↑ {selectedProject.gitStatus.ahead} to push
                              </span>
                            )}
                            {selectedProject.gitStatus.behind > 0 && (
                              <span className="px-2 py-1 rounded bg-red-900/50 text-red-400">
                                ↓ {selectedProject.gitStatus.behind} to pull
                              </span>
                            )}
                          </div>
                        )}

                        {selectedProject.gitStatus.staged === 0 &&
                          selectedProject.gitStatus.unstaged === 0 &&
                          selectedProject.gitStatus.untracked === 0 &&
                          selectedProject.gitStatus.ahead === 0 &&
                          selectedProject.gitStatus.behind === 0 && (
                            <div className="text-emerald-400 text-center py-2">All synced and clean</div>
                          )}
                      </div>
                    )}

                    {/* Path */}
                    <div>
                      <div className="text-zinc-500 mb-1 uppercase tracking-wider text-[10px]">Path</div>
                      <div className="font-mono text-[11px] text-zinc-400 break-all bg-zinc-900 p-2 rounded">{selectedProject.project.path}</div>
                    </div>

                    {/* Actions */}
                    <div>
                      <div className="text-zinc-500 mb-2 uppercase tracking-wider text-[10px]">Quick Actions</div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {QUICK_ACTIONS.map(action => (
                          <button
                            key={action.id}
                            onClick={() => {
                              if (action.command === null) handleOpenProject(selectedProject.project.path)
                              else handleRunCommand(action.command, selectedProject.project.path)
                            }}
                            className="px-2 py-2 bg-zinc-800 hover:bg-zinc-700 rounded text-[11px] text-left text-white transition-colors"
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 overflow-y-auto p-6">
            <h2 className="font-medium text-base mb-4 text-white">Settings</h2>

            {/* Watch Directories */}
            <div className="bg-zinc-950 rounded-lg p-4 border border-zinc-800 mb-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-white">Watch Directories</h3>
                <button
                  onClick={handleAddDirectory}
                  disabled={addingDir}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-900 rounded-md text-xs text-white"
                >
                  {addingDir ? '...' : '+ Add'}
                </button>
              </div>
              {settings.watchDirs.length === 0 ? (
                <p className="text-zinc-500 text-xs">No directories configured</p>
              ) : (
                <ul className="space-y-1">
                  {settings.watchDirs.map((dir) => (
                    <li key={dir} className="flex items-center justify-between bg-zinc-900 px-3 py-2 rounded-md text-xs">
                      <span className="font-mono text-zinc-300 truncate">{dir}</span>
                      <button onClick={() => handleRemoveDirectory(dir)} className="text-zinc-500 hover:text-red-400 ml-2">×</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Filters */}
            <div className="bg-zinc-950 rounded-lg p-4 border border-zinc-800 mb-4">
              <h3 className="text-sm font-medium mb-3 text-white">Display Filters</h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <label className="flex items-center gap-2 text-zinc-300">
                  <input
                    type="checkbox"
                    checked={filters.showActive}
                    onChange={(e) => setFilters({ ...filters, showActive: e.target.checked })}
                    className="rounded bg-zinc-800 border-zinc-600"
                  />
                  Active
                </label>
                <label className="flex items-center gap-2 text-zinc-300">
                  <input
                    type="checkbox"
                    checked={filters.showIdle}
                    onChange={(e) => setFilters({ ...filters, showIdle: e.target.checked })}
                    className="rounded bg-zinc-800 border-zinc-600"
                  />
                  Idle
                </label>
                <label className="flex items-center gap-2 text-zinc-300">
                  <input
                    type="checkbox"
                    checked={filters.showStale}
                    onChange={(e) => setFilters({ ...filters, showStale: e.target.checked })}
                    className="rounded bg-zinc-800 border-zinc-600"
                  />
                  Stale
                </label>
                <label className="flex items-center gap-2 text-zinc-300">
                  <input
                    type="checkbox"
                    checked={filters.gitReposOnly}
                    onChange={(e) => setFilters({ ...filters, gitReposOnly: e.target.checked })}
                    className="rounded bg-zinc-800 border-zinc-600"
                  />
                  Git only
                </label>
                <label className="flex items-center gap-2 text-zinc-300 col-span-2">
                  <input
                    type="checkbox"
                    checked={filters.hasChangesOnly}
                    onChange={(e) => setFilters({ ...filters, hasChangesOnly: e.target.checked })}
                    className="rounded bg-zinc-800 border-zinc-600"
                  />
                  Has uncommitted changes
                </label>
              </div>
            </div>

            {/* Color Legend */}
            <div className="bg-zinc-950 rounded-lg p-4 border border-zinc-800">
              <h3 className="text-sm font-medium mb-3 text-white">Color Legend</h3>
              <div className="space-y-3 text-xs">
                <div>
                  <div className="text-zinc-500 mb-1">By Status (default)</div>
                  <div className="flex gap-2">
                    <span className="px-3 py-1 bg-orange-500 rounded text-white">Active</span>
                    <span className="px-3 py-1 bg-emerald-600 rounded text-white">Idle</span>
                    <span className="px-3 py-1 border border-zinc-600 rounded text-zinc-400">Stale</span>
                  </div>
                </div>
                <div>
                  <div className="text-zinc-500 mb-1">By Git Hot</div>
                  <div className="flex gap-2">
                    <span className="px-3 py-1 bg-orange-600 rounded text-white">Hot</span>
                    <span className="px-3 py-1 bg-amber-900/50 border border-amber-600 rounded text-amber-300">Warm</span>
                    <span className="px-3 py-1 bg-blue-900/50 border border-blue-700 rounded text-blue-300">Cool</span>
                    <span className="px-3 py-1 bg-zinc-800 border border-zinc-700 rounded text-zinc-500">Cold</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl py-1 z-50 min-w-44"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <div className="px-3 py-2 border-b border-zinc-700">
            <p className="font-medium text-xs text-white">{contextMenu.project.name}</p>
            {contextMenu.gitStatus && (
              <p className="text-[10px] text-blue-400 mt-0.5 font-mono">{contextMenu.gitStatus.branch}</p>
            )}
          </div>
          {QUICK_ACTIONS.map(action => (
            <button
              key={action.id}
              onClick={() => handleQuickAction(action.id)}
              className="w-full text-left px-3 py-1.5 hover:bg-zinc-800 text-xs text-zinc-300 hover:text-white"
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default App

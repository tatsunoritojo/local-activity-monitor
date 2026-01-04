# DESIGN.md - Application Architecture

## Overview

Local Activity Monitor is a desktop application built with Electron that helps developers track project activity across multiple repositories.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Electron App                         │
├─────────────────────┬───────────────────────────────────┤
│   Main Process      │       Renderer Process            │
│                     │                                   │
│  ┌───────────────┐  │  ┌─────────────────────────────┐  │
│  │ File Watcher  │  │  │         React UI            │  │
│  │  (chokidar)   │  │  │                             │  │
│  └───────┬───────┘  │  │  ┌───────┐  ┌───────────┐   │  │
│          │          │  │  │Sidebar│  │Project Grid│  │  │
│  ┌───────▼───────┐  │  │  └───────┘  └───────────┘   │  │
│  │Activity Logger│  │  │                             │  │
│  └───────┬───────┘  │  │  ┌──────────────────────┐   │  │
│          │          │  │  │    Detail Panel      │   │  │
│  ┌───────▼───────┐  │  │  │  - Status            │   │  │
│  │ Git Analyzer  │◄─┼──┤  │  - Git Status        │   │  │
│  └───────┬───────┘  │  │  │  - Quick Actions     │   │  │
│          │          │  │  └──────────────────────┘   │  │
│  ┌───────▼───────┐  │  │                             │  │
│  │Settings Store │  │  │  ┌──────────────────────┐   │  │
│  └───────────────┘  │  │  │   Settings View      │   │  │
│                     │  │  └──────────────────────┘   │  │
└─────────────────────┴──┴─────────────────────────────┴──┘
                     IPC Communication
```

## Main Process (`src/main`)

### Components

| File | Responsibility |
|------|----------------|
| `index.ts` | App lifecycle, IPC handlers, file watching, Git analysis |
| `settings.ts` | Load/save settings, manage watch directories |

### Key Features

1. **File Watching** - Uses Chokidar to monitor configured directories
2. **Activity Logging** - Debounced logging to prevent excessive writes
3. **Git Integration** - Executes git commands to get status and commit history
4. **Hotness Calculation** - `(7d commits × 3) + (30d commits)`

## Renderer Process (`src/renderer`)

### UI Components

- **Sidebar** - Navigation and status summary
- **Project Grid** - 4-column button layout with status colors
- **Detail Panel** - Git status, activity info, quick actions
- **Settings View** - Watch directories, filters, auto-start

### Color Scheme

| Sort Mode | Active | Idle | Stale |
|-----------|--------|------|-------|
| Status | Orange | Green | Outline |
| Git Hot | Hot→Warm→Cool→Cold gradient |

## Data Storage

```
%APPDATA%/local-activity-monitor/
├── settings.json     # Watch dirs, filters, preferences
└── activity-log.json # File activity timestamps
```

### Settings Schema

```typescript
interface Settings {
  watchDirs: string[]
  filters: {
    showActive: boolean
    showIdle: boolean
    showStale: boolean
    gitReposOnly: boolean
    hasChangesOnly: boolean
  }
  defaultSort: 'status' | 'name' | 'activity' | 'git-hot'
  sortAscending: boolean
}
```

## IPC Channels

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `get-projects` | R→M | Fetch project list with status |
| `get-settings` | R→M | Load current settings |
| `get-git-status` | R→M | Get Git info for a project |
| `open-path` | R→M | Open folder in Explorer |
| `run-command` | R→M | Execute command in terminal |
| `projects-updated` | M→R | Notify UI of changes |

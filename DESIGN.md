# DESIGN.md - Application Design & Philosophy

This document outlines the technical design, architecture, and core principles of the Local Activity Monitor.

## 1. Core Philosophy (基本理念)

- **Simplicity over Complexity**: The tool should be simple, lightweight, and serve a single purpose well: to provide an at-a-glance overview of project activity. It should not evolve into a full-fledged project management tool.
- **Local First**: All data is stored locally. There are no cloud services, user accounts, or telemetry.
- **Low Overhead**: The background monitoring process should be efficient and have a minimal impact on system performance.
- **"Good Enough" Accuracy**: The goal is to get a general sense of project activity. We do not need to capture every single event with perfect accuracy. For example, `git` operations are treated the same as any other file modification.

## 2. Architecture (アーキテクチャ)

The application follows the standard Electron two-process model.

### Main Process (`src/main`)

- **Responsibilities**:
  - File System Watching: Runs the `chokidar` watcher in the background.
  - Activity Aggregation: Debounces and aggregates file events into "activity bursts."
  - Persistent Logging: Writes activity data to the local log file.
  - Activity Analysis: Reads the log file on startup and calculates the status (Active, Idle, Stale) for each project.
  - IPC Communication: Provides the processed project list and their statuses to the Renderer process via IPC channels.
- **Key Technologies**:
  - Node.js
  - Electron Main Process APIs
  - `chokidar` for file watching
  - Node.js `fs` for file I/O

### Renderer Process (`src/renderer`)

- **Responsibilities**:
  - User Interface: Displays the list of projects and their statuses.
  - User Interaction: Allows sorting and filtering of the project list.
  - IPC Communication: Receives project data from the Main process.
- **Key Technologies**:
  - React (with TypeScript)
  - Tailwind CSS for styling
  - Electron Renderer Process APIs

## 3. Data Flow (データフロー)

1.  **[Main] Watch**: `chokidar` detects a file change (add, change, unlink) inside the watched root directory.
2.  **[Main] Aggregate**: The directory of the changed file is added to a `Set`. A debounce timer is reset.
3.  **[Main] Persist**: When the timer fires (e.g., after 2 seconds of inactivity), the set of "hot" directories is retrieved. For each directory, a new entry is appended to `activity-log.json` with a timestamp.
    - `e.g., { "projectPath": "C:/Users/tatsu/Github/project-alpha", "timestamp": 1672617600000 }`
4.  **[Main] Analyze (on Startup)**:
    a. The application starts.
    b. The Main process scans the root directory to get a list of all potential projects (subdirectories).
    c. It reads the entire `activity-log.json`.
    d. It creates a map of `projectPath -> latestTimestamp`.
    e. It compares the `latestTimestamp` for each project against the current date to determine its status (Active, Idle, Stale).
5.  **[Main -> Renderer] IPC**: The complete list of projects, including their paths and calculated statuses, is sent to the Renderer process.
6.  **[Renderer] Display**: The Renderer process receives the data and renders the project list in the UI.

## 4. Persistent Data Structure (データ構造)

A simple JSON file named `activity-log.json` will be stored in the Electron application's user data directory. It will be an array of JSON objects.

- **File Location**: `app.getPath('userData')/activity-log.json`
- **Format**: An array of activity records.

```json
[
  {
    "projectPath": "C:\\Users\\tatsu\\Github\\local-activity-monitor",
    "timestamp": 1735743600000
  },
  {
    "projectPath": "C:\\Users\\tatsu\\Github\\ai-portfolio-site",
    "timestamp": 1735747200000
  },
  {
    "projectPath": "C:\\Users\\tatsu\\Github\\local-activity-monitor",
    "timestamp": 1735750800000
  }
]
```

This structure is simple to read, write, and analyze. Each entry represents a detected "activity burst" in a specific project directory.

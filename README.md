# Local Activity Monitor

## 1. Objective (目的)

This application is a desktop tool designed to prevent local development projects from being forgotten.

By monitoring file activity in a specified directory (e.g., a projects folder), it automatically classifies projects based on their recent activity, providing a visual overview of which projects are active and which have become stale. This helps in managing and auditing personal projects, preventing them from becoming "out of sight, out of mind."

(本アプリケーションは、ローカルの開発プロジェクトが忘れ去られるのを防ぐためのデスクトップツールです。

指定したディレクトリ（例：プロジェクトフォルダ）内のファイルアクティビティを監視することで、各プロジェクトをその活動状況に基づいて自動的に分類します。どのプロジェクトが活発で、どれが放置されているかを視覚的に把握することで、個人のプロジェクト管理と棚卸しを支援し、「見えないものは忘れ去られる」のを防ぎます。)

## 2. Core Features (主な機能)

- **Automatic Project Discovery**: Automatically identifies projects (subdirectories) within a designated root folder.
- **Background Activity Monitoring**: A background process watches for file changes (creations, edits, deletions) in the project folders.
- **Activity Status Classification**: Each project is assigned a status based on its last detected activity:
  -  trạng thái **Active**: Updated within the last 7 days. (過去1週間以内に更新)
  - trạng thái **Idle**: Updated within the last 30 days. (過去30日以内に更新)
  - trạng thái **Stale**: No updates for more than 30 days. (30日以上更新なし)
- **Visual Dashboard**: A simple UI that lists all discovered projects, sortable and color-coded by their activity status.

## 3. How It Works (仕組み)

1.  **File Watcher**: A `chokidar`-based file watcher runs in the Electron main process, monitoring the target directory for changes.
2.  **Activity Logging**: When file activity is detected, it's recorded with a timestamp in a local log file (`activity-log.json`). To avoid excessive logging, events are debounced and aggregated.
3.  **Status Analysis**: On application startup, the activity log is analyzed to determine the last update time for each project.
4.  **UI Display**: The project list is displayed in the UI, with visual cues (colors, icons) indicating each project's status (Active, Idle, Stale).

## 4. Project Setup (開発セットアップ)

### Install

```bash
$ npm install
```

### Development

```bash
$ npm run dev
```

### Build

```bash
# For Windows
$ npm run build:win
```

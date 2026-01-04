# Local Activity Monitor

[![GitHub release](https://img.shields.io/github/v/release/tatsunoritojo/local-activity-monitor)](https://github.com/tatsunoritojo/local-activity-monitor/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

ローカル開発プロジェクトの活動状況を一目で把握できるデスクトップアプリケーション

## 📥 ダウンロード

**[最新版をダウンロード](https://github.com/tatsunoritojo/local-activity-monitor/releases/latest)**

| OS | ファイル |
|----|----------|
| Windows | `local-activity-monitor-X.X.X-setup.exe` |

---

## このアプリでできること

### 1. プロジェクト状況の可視化

複数のプロジェクトフォルダを監視し、最終更新日時に基づいて自動的にステータスを分類します。

| ステータス | 条件 | 色 |
|------------|------|-----|
| **Active** | 7日以内に更新 | オレンジ |
| **Idle** | 30日以内に更新 | 緑 |
| **Stale** | 30日以上放置 | 枠線のみ |

### 2. Git連携

各プロジェクトのGit状況を即座に確認できます：

- **ブランチ名** の表示
- **Staged / Modified / Untracked** ファイル数
- **Push/Pull** が必要かどうか
- **ホットネススコア** - 直近のコミット頻度に基づくアクティビティ指標

### 3. クイックアクション

右クリックまたは詳細パネルから、よく使う操作に素早くアクセス：

- ファイルエクスプローラーで開く
- ターミナルを起動
- **Gemini CLI** / **Claude Code** / **Antigravity** を起動
- **VS Code** で開く

### 4. 柔軟な表示設定

- **ソート**: ステータス順 / 名前順 / 更新日順 / Gitホットネス順
- **昇順・降順** の切り替え
- **フィルタ**: Active/Idle/Staleの表示切替、Gitリポジトリのみ表示、未コミット変更ありのみ表示

### 5. 自動起動

Windows起動時にバックグラウンドで自動起動し、常にプロジェクト状況を監視します。

---

## 操作方法

| 操作 | 動作 |
|------|------|
| **クリック** | 詳細パネルを表示 |
| **ダブルクリック** | フォルダを開く |
| **右クリック** | クイックアクションメニュー |

---

## ホットネススコアとは？

Gitコミット履歴から算出されるアクティビティ指標です。

```
スコア = (7日間のコミット数 × 3) + (30日間のコミット数)
```

「Git Hot」でソートすると、**今まさに作業中のプロジェクト**が上位に表示されます。

---

## 開発

```bash
# 依存関係のインストール
npm install

# 開発モードで起動
npm run dev

# Windowsアプリとしてビルド
npm run build:win
```

---

## 技術スタック

- **Electron** - デスクトップアプリフレームワーク
- **React + TypeScript** - UIフレームワーク
- **Tailwind CSS** - スタイリング
- **Chokidar** - ファイルシステム監視

---

## データ保存場所

すべてのデータはローカルに保存されます（クラウド連携なし）

```
%APPDATA%/local-activity-monitor/
├── settings.json     # 設定（監視ディレクトリ、フィルタ等）
└── activity-log.json # ファイル活動履歴
```

# Handover Document (引継ぎ資料)

## To the Next Developer

This document outlines the current status of the "Local Activity Monitor" project, the immediate problem to be solved, and the planned next steps. Please use this as a guide to continue development.

(次の開発者の方へ。このドキュメントは「Local Activity Monitor」プロジェクトの現状、解決すべき喫緊の課題、そして計画されている次のステップをまとめたものです。開発を継続するためのガイドとしてください。)

---

## 1. Project Overview (プロジェクト概要)

-   **Goal**: To create a desktop application that monitors local project directories and helps users identify which projects are active and which have been abandoned.
-   **Core Documents**:
    -   [**README.md**](./README.md): For the high-level project purpose and features.
    -   [**DESIGN.md**](./DESIGN.md): For the detailed architecture, data flow, and design decisions.

---

## 2. Current Implementation Status (現在の実装状況)

### Completed

-   **Project Setup**: Electron, React, TypeScript, and Tailwind CSS are configured.
-   **UI Mockup**: A basic 2-column UI is in place (`src/renderer/src/App.tsx`), currently using mock data.
-   **Core Documentation**: `README.md` and `DESIGN.md` have been created to define the project's goals and architecture.
-   **Persistent Logging Framework**: The `writeActivityLog` function in `src/main/index.ts` is implemented to write activity records to `%appdata%/local-activity-monitor/activity-log.json`.

### In Progress

-   **File Activity Detection**: The logic to detect file changes and trigger the logging process is incomplete.

---

## 3. The Current Bug / Immediate Task (現在のバグ・喫緊の課題)

The immediate task is to fix the file activity detection logic within the `handleFileChange` function in `src/main/index.ts`.

-   **The Problem**: After a recent modification to correctly identify project root paths, the function has stopped detecting file changes altogether. The console no longer shows "Detected activity in project: ..." when files are modified.
-   **Suspected Cause**: The logic for normalizing path separators and calculating the relative path of the changed file is likely flawed. The use of `join(process.cwd(), 'a', 'b').split('a')[1].split('b')[0]` to infer `path.sep` is a workaround and might be the source of the issue. A more direct way to get the path separator (`path.sep`) or a more robust path comparison method is needed.
-   **File to Edit**: `src/main/index.ts`
-   **Function to Fix**: `handleFileChange`

---

## 4. How to Test (テスト方法)

1.  Run the application in development mode: `npm run dev`.
2.  In your file explorer, create, edit, or delete a file within any subdirectory of `C:\Users\tatsu\Github` (the currently watched directory).
3.  Observe the console output in the terminal where you ran `npm run dev`.

-   **Expected Behavior**: The console should log messages like `Detected activity in project: C:\Users\tatsu\Github\some-project-folder`.
-   **Current Behavior**: No log messages are being output when files are changed.

---

## 5. Next Steps (After Bugfix) (バグ修正後のステップ)

Once the `handleFileChange` function is correctly identifying and logging project activity, development should proceed as laid out in `DESIGN.md`:

1.  **Implement Log Analysis**: Create the logic that runs on startup, reads `activity-log.json`, and determines the status (Active, Idle, Stale) for each project.
2.  **Implement IPC Communication**: Create an IPC channel to send the list of projects and their calculated statuses from the Main process to the Renderer process.
3.  **Update the UI**: Replace the mock data in `src/renderer/src/App.tsx` with the real data from the Main process, and implement the visual cues (colors, sorting) to reflect the project statuses.

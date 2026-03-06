# Dash (Windows Fork)

> **Fork of [syv-ai/dash](https://github.com/syv-ai/dash)** — ported to Windows with native platform support, auto-updates, and additional features.

[![Build](https://github.com/mahope/dash-windows/actions/workflows/build.yml/badge.svg)](https://github.com/mahope/dash-windows/actions/workflows/build.yml)
[![Release](https://img.shields.io/github/v/release/mahope/dash-windows)](https://github.com/mahope/dash-windows/releases/latest)

Desktop app for running [Claude Code](https://docs.anthropic.com/en/docs/claude-code) across multiple projects and tasks, each in its own git worktree. **This fork adds full Windows 10/11 support** with native PTY, platform-aware services, and automatic updates.

The main idea: you open a project, create tasks, and each task gets an isolated git worktree with its own branch. Claude Code runs in a real terminal (xterm.js + node-pty) inside each worktree, so you can have multiple tasks going in parallel without branch conflicts.

![Dash screenshot](docs/screenshot.png)

## What it does

- **Project management** — Open any git repo as a project, or clone from a URL. Tasks are nested under projects in the sidebar.
- **Git worktrees** — Each task gets its own worktree and branch. A reserve pool pre-creates worktrees so new tasks start instantly (<100ms).
- **Terminal** — Full PTY terminal per task. Sessions persist when switching between tasks (state is snapshotted and restored). Shift+Enter sends multiline input. File drag-drop pastes paths. 16 terminal themes.
- **Shell drawer** — Separate shell terminal alongside the task terminal. Configurable position (left, right, or replacing main content).
- **Pixel Agents** — Optional animated pixel art characters that visualize your agents' activity in a miniature office. Characters type when busy, wander when idle, and show speech bubbles when waiting. Configurable position (left sidebar, main pane, or right sidebar). Powered by [pixel-agents](https://github.com/pablodelucca/pixel-agents).
- **File changes panel** — Real-time git status with staged/unstaged sections. Stage, unstage, discard per-file. Click to view diffs.
- **Diff viewer** — Full file or configurable context lines. Unified diff with syntax highlighting. Select lines to add inline comments and send them to the terminal.
- **Commit graph** — Visualize branch history with a DAG-style commit graph per project.
- **GitHub issues** — Search and link issues to tasks. Auto-posts branch comments on linked issues.
- **Remote control** — Generate a QR code / URL to control a task's terminal from another device.
- **Activity indicators** — Busy (amber) and idle (green) status per task, with desktop notifications and sound alerts (chime, cash, ping, droplet, marimba).
- **Editor integration** — Open changed files in your editor (Cursor, VS Code, Zed, Vim) with line navigation.
- **Commit attribution** — Configurable co-author line on commits (default, none, or custom text).
- **Task archiving** — Archive inactive tasks to keep the sidebar clean; restore when needed.
- **Customizable keybindings** — Remap any shortcut from Settings.
- **Dark/light theme**

## Windows-specific changes

This fork adds native Windows support on top of the upstream macOS/Linux codebase:

- **Platform detection** — Centralized `isWin`/`isMac`/`isLinux` flags in `src/main/platform.ts` used across all services.
- **PTY spawning** — Direct Claude CLI spawn uses full `process.env` on Windows (critical system variables like `SystemRoot`, `COMSPEC`, `TEMP`, `PATHEXT`). Shell spawn uses `cmd.exe` or PowerShell.
- **Claude CLI discovery** — Searches WinGet links, npm global, and `.local/bin` paths on Windows.
- **Activity monitoring** — Uses `PowerShell Get-CimInstance Win32_Process` instead of deprecated `wmic` (removed in Windows 11 22H2+).
- **Git diff** — Uses `NUL` instead of `/dev/null` for untracked file diffs.
- **Path handling** — Normalizes backslash/forward-slash for git worktree comparisons. Case-insensitive path checks on Windows filesystem.
- **No macOS titlebar** — Skips the draggable titlebar region on Windows.
- **Folder name extraction** — Splits on both `\` and `/` separators.
- **Hook commands** — Uses `type` instead of `cat` for file output in hook settings.
- **Data storage paths** — Uses `%APPDATA%/Dash/` on Windows instead of `~/Library/Application Support/Dash/`.

## Install

Download the latest `.exe` installer or `.zip` from [**Releases**](https://github.com/mahope/dash-windows/releases/latest), or build from source (see below). The app checks for updates automatically and notifies you when a new version is available.

## Prerequisites

- Windows 10/11 (x64)
- Node.js 22+
- [pnpm](https://pnpm.io/)
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) (`npm install -g @anthropic-ai/claude-code`)
- Git
- Visual Studio Build Tools (for native module compilation)

## Setup

```bash
git submodule update --init    # fetch pixel-agents vendor code
pnpm install
pnpm rebuild                   # rebuilds native modules (node-pty, better-sqlite3)
```

> **Note:** On Windows you need the "Desktop development with C++" workload from Visual Studio Build Tools for native module compilation (node-pty, better-sqlite3).

## Development

```bash
pnpm dev
```

This starts Vite on port 3000 and launches Electron pointing at it. Renderer changes hot-reload; main process changes need a restart (`pnpm dev:main` or just kill and re-run `pnpm dev`).

To just rebuild and launch the main process:

```bash
pnpm build:main
npx electron dist/main/main/entry.js --dev
```

## Build

```bash
pnpm build              # compile both main + renderer
pnpm package:win        # build + package as Windows installer
pnpm package:mac        # build + package as macOS .dmg
pnpm package:linux      # build + package as Linux .AppImage
```

Output goes to `release/`.

## Project structure

```
src/
├── main/                   # Electron main process
│   ├── entry.ts            # App name, path aliases, loads main.ts
│   ├── main.ts             # Boot: PATH fix, DB init, IPC, window
│   ├── platform.ts         # Centralized platform detection (isWin, isMac, isLinux)
│   ├── preload.ts          # contextBridge API
│   ├── window.ts           # BrowserWindow creation
│   ├── db/                 # SQLite + Drizzle ORM
│   │   ├── schema.ts       # projects, tasks, conversations tables
│   │   ├── client.ts       # better-sqlite3 singleton
│   │   ├── migrate.ts      # SQL migration runner
│   │   └── path.ts         # DB file location
│   ├── ipc/                # IPC handlers
│   │   ├── appIpc.ts       # Dialogs, CLI detection
│   │   ├── dbIpc.ts        # CRUD for projects/tasks/conversations
│   │   ├── gitIpc.ts       # Git status, diff, stage/unstage
│   │   ├── ptyIpc.ts       # Terminal spawn/kill/resize
│   │   └── worktreeIpc.ts  # Worktree create/remove/claim
│   └── services/
│       ├── DatabaseService.ts
│       ├── GitService.ts
│       ├── FileWatcherService.ts
│       ├── WorktreeService.ts
│       ├── WorktreePoolService.ts
│       ├── ptyManager.ts
│       └── TerminalSnapshotService.ts
├── renderer/               # React UI
│   ├── App.tsx             # Root: state, keyboard shortcuts, layout
│   ├── keybindings.ts      # Keybinding system (defaults, load/save, matching)
│   ├── components/
│   │   ├── LeftSidebar.tsx       # Projects + nested tasks
│   │   ├── MainContent.tsx       # Terminal area
│   │   ├── FileChangesPanel.tsx
│   │   ├── DiffViewer.tsx
│   │   ├── TaskModal.tsx
│   │   ├── SettingsModal.tsx
│   │   ├── PixelAgentPanel.tsx   # Pixel art agent office (Canvas 2D)
│   │   ├── PixelAgentDrawer.tsx  # Resizable wrapper for pixel agents
│   │   └── TerminalPane.tsx
│   └── terminal/
│       ├── TerminalSessionManager.ts  # xterm.js lifecycle
│       └── SessionRegistry.ts         # Session pool (preserves state on task switch)
├── shared/
│   └── types.ts            # Shared types (Project, Task, GitStatus, etc.)
├── types/
│   └── electron-api.d.ts   # window.electronAPI type declarations
└── vendor/
    └── pixel-agents/       # Git submodule: pixel art agent sprites & engine
```

## Default keybindings

| Shortcut       | Action         |
| -------------- | -------------- |
| `Ctrl+N`       | New task       |
| `Ctrl+Shift+K` | Next task      |
| `Ctrl+Shift+J` | Previous task  |
| `Ctrl+Shift+A` | Stage all      |
| `Ctrl+Shift+U` | Unstage all    |
| `Ctrl+,`       | Settings       |
| `Ctrl+O`       | Open folder    |
| `Ctrl+`` ` ``  | Focus terminal |
| `Esc`          | Close overlay  |

All keybindings are customizable in Settings > Keybindings.

## Tech stack

|          |                                       |
| -------- | ------------------------------------- |
| Shell    | Electron 30                           |
| UI       | React 18, TypeScript, Tailwind CSS 3  |
| Build    | Vite 5, pnpm                          |
| Terminal | xterm.js + node-pty                   |
| Database | SQLite (better-sqlite3) + Drizzle ORM |
| Package  | electron-builder                      |

## Data storage

- **Database**: `%APPDATA%/Dash/app.db` (Windows) · `~/Library/Application Support/Dash/app.db` (macOS) · `~/.config/Dash/app.db` (Linux)
- **Terminal snapshots**: `%APPDATA%/Dash/terminal-snapshots/` (Windows) · `~/Library/Application Support/Dash/terminal-snapshots/` (macOS)
- **Worktrees**: `{project}/../worktrees/{task-slug}/`

## Upstream

This is a fork of [**syv-ai/dash**](https://github.com/syv-ai/dash) with Windows-native support and additional features. Upstream changes can be merged in via:

```bash
git remote add upstream https://github.com/syv-ai/dash.git
git fetch upstream
git merge upstream/main
```

Inspired by [emdash](https://github.com/generalaction/emdash).

## License

MIT

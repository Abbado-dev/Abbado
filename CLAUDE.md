# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is Abbado

Abbado is a local dev cockpit for managing AI agent sessions across git repos. Provider-agnostic: supports Claude Code, Codex, and any CLI-based AI agent. Each session runs an agent in a PTY terminal with real-time status tracking via hooks.

**Key concepts:**
- **Project** — a local git repo. Has a `mode`: `direct` (work in repo, single session) or `worktree` (isolated branches, multi-session). Has configurable command buttons (label, icon, command).
- **Session** — tied to a project + an agent + optional reviewer agent. Has PTYs for agent, shell, runner, and optionally reviewer. Can override project commands.
- **Agent** — reusable config: CLI provider (claude-code, codex), model, instructions.

## Stack

- **Backend**: Go, chi (HTTP), gorilla/websocket, creack/pty, SQLite via modernc.org/sqlite (pure Go)
- **Frontend**: React 19, Vite, shadcn/ui (base-ui, uses `render` prop not `asChild`), TanStack Query, Tailwind, xterm.js, Monaco DiffEditor
- **Website**: Astro + Tailwind v4, static landing page + docs
- **Module**: `github.com/raznak/abbado`

## Build & Dev Commands

```bash
make dev          # Run backend (port 7777) + frontend (port 5173)
make test         # Run all backend Go tests
make reset        # Kill server, delete DB + worktrees + hooks (warns if uncommitted changes)
make build        # Build single binary with embedded frontend (build.sh)
```

## CLI

```bash
abbado            # Start server in foreground
abbado start      # Start in background (daemon), PID in ~/.abbado/abbado.pid
abbado stop       # Send SIGTERM, remove PID file
abbado status     # Show running state, PID, URL
abbado logs       # tail -50 -f ~/.abbado/abbado.log
abbado version    # Show version (set at build time via -ldflags)
```

## Architecture

### Backend (`backend/`)

```
cmd/abbado/main.go          # Entry point + CLI commands (start/stop/status/logs/version)
internal/
  model/models.go           # Domain types (Agent, Project, ProjectCommand, Session, Event)
  database/
    db.go                   # SQLite open + WAL + FK
    migrations.go           # CREATE IF NOT EXISTS + safe ALTER statements
  service/
    agent.go                # Agent CRUD
    project.go              # Project CRUD (mode: direct/worktree, commands)
    session.go              # Session lifecycle (reviewer_agent_id, commands override)
    git.go                  # Git operations (diff, commit, push, PR, worktree, branch)
    pty.go                  # PTY spawn (shell, agent CLI with hooks)
    hooks.go                # Generate Claude Code hook settings.json per session
    eventbus.go             # In-memory pub/sub for SSE broadcasting
    event.go                # Event persistence (events table)
    prompt.go               # Prompt history queries
    ai.go                   # AI features via `claude -p` (generate commit/PR, review)
  handler/
    agent.go                # Agent REST endpoints
    project.go              # Project REST + branches endpoint
    session.go              # Session REST + reviewer + commands update
    terminal.go             # WebSocket PTY bridge (shell, agent, reviewer, runner) + exec/stop
    changes.go              # Git diff, file content, commit, push, PR, generate, review
    hooks.go                # Hook callback endpoint + SSE stream + prompt history
    filesystem.go           # Directory listing for path autocomplete
    response.go             # JSON/error helpers
  server/
    server.go               # Chi router wiring + NotFound → embedded frontend
    frontend.go             # go:embed frontend + SPA fallback handler
  integration/api_test.go   # Integration tests
```

### Frontend (`frontend/src/`)

```
App.tsx                     # Router + providers
components/
  layout.tsx                # Sidebar + header + Outlet (h-screen, overflow-hidden)
  app-sidebar.tsx           # Navigation sidebar (logo from favicon.svg)
  project-list.tsx          # Expandable projects with sessions, collapsible, status dots
  create-agent-form.tsx     # Template picker → config (provider, model, instructions)
  create-project-form.tsx   # Path autocomplete + mode selector (direct/worktree)
  create-session-form.tsx   # Agent + optional reviewer + branch config
  terminal-view.tsx         # xterm.js WebSocket terminal (type: shell|agent|reviewer|runner)
  run-tab.tsx               # Command buttons + runner terminal
  icon-picker.tsx           # Dropdown icon grid with search + tooltips (28 icons)
  monaco-diff.tsx           # Monaco DiffEditor wrapper (editable modified side, auto-save)
  changes-view.tsx          # File list + checkboxes + Monaco diff + commit/push/PR/generate/review
  session-card.tsx          # Session card for dashboard
  session-status.tsx        # Live status badge (Working/Idle/Needs attention)
  session-status-dot.tsx    # Colored dot for sidebar (uses DB status, no SSE)
  session-settings.tsx      # Session info + agent details + commands override
  project-settings-form.tsx # Project name, mode, commands (icon picker + label + command)
  prompt-history.tsx        # Searchable prompt history (newest first)
  delete-session-dialog.tsx # Confirmation dialog for session deletion
  provider-usage.tsx        # Dashboard stats per provider
  path-input.tsx            # Terminal-style path autocomplete with $ prefix
  reviewer-tab.tsx          # Reviewer terminal + send review button
hooks/
  use-agents.ts             # TanStack Query hooks for agents
  use-projects.ts           # TanStack Query hooks for projects + branches
  use-sessions.ts           # TanStack Query hooks for sessions + commands update
  use-session-events.ts     # SSE subscription for active session page
  use-notifications.ts      # Global SSE → browser notifications + query invalidation
lib/
  api.ts                    # Typed API client (agents, projects, sessions, changes, runner)
  providers.ts              # Provider configs (Claude Code, Codex) + agent templates
  utils.ts                  # shadcn cn() helper
pages/
  dashboard.tsx             # Provider usage + session cards
  projects.tsx              # Project list + add sheet
  agents.tsx                # Agent list + create sheet with template picker
  settings.tsx              # Global settings (placeholder)
  session.tsx               # Session view: tabs (Agent, Terminal, Run, [Review], Changes, History, Settings)
```

### Website (`website_v2/`)

```
Astro + Tailwind v4 (no framework, no Starlight)
src/
  layouts/Layout.astro      # Landing page layout
  layouts/Docs.astro        # Docs layout with sidebar navigation
  pages/index.astro         # Landing page (hero, features, install, architecture)
  pages/docs/               # 12 doc pages (getting started, concepts, features, reference)
public/
  favicon.svg               # Abbado logo (shared with app)
  install.sh                # Install/update/uninstall script
```

### Key API Endpoints

```
GET/POST           /api/agents
GET/POST           /api/projects
GET                /api/projects/:id/branches
GET/POST/DELETE    /api/sessions
PUT                /api/sessions/:id/reviewer
PUT                /api/sessions/:id/commands
WS                 /api/sessions/:id/terminal/shell
WS                 /api/sessions/:id/terminal/agent
WS                 /api/sessions/:id/terminal/reviewer
WS                 /api/sessions/:id/terminal/runner
POST               /api/sessions/:id/terminal/runner/exec
POST               /api/sessions/:id/terminal/runner/stop
POST               /api/sessions/:id/terminal/reviewer/send
POST               /api/sessions/:id/hook
GET                /api/sessions/:id/events                    # SSE stream
GET                /api/sessions/:id/prompts
GET                /api/sessions/:id/changes
GET                /api/sessions/:id/changes/diff
GET/PUT            /api/sessions/:id/changes/file
POST               /api/sessions/:id/commit
POST               /api/sessions/:id/push
POST               /api/sessions/:id/pr
POST               /api/sessions/:id/generate
POST               /api/sessions/:id/review
GET                /api/filesystem/dirs
GET                /api/health
```

### Real-time Architecture

- **No polling** — all real-time updates via SSE
- `useNotifications` (Layout, single instance) opens 1 SSE per active session → fires browser notifications + `invalidateQueries(['sessions'])` on each event
- `useSessionEvents` (session page only) opens 1 SSE for the viewed session → enriches status with tool name, 5s override then fallback to DB status
- Sidebar and cards read DB status (refreshed via query invalidation from SSE events)
- Claude Code hooks (UserPromptSubmit, Stop, Notification, PreToolUse) read stdin JSON via `jq`, curl the hook endpoint
- Terminal interrupt (Ctrl+C, Escape) detected in WebSocket input → sets status to idle

### PTY Management

- 4 PTY maps per session: `shells`, `agents`, `reviewers`, `runners`
- Each PTY has a single reader goroutine + 256KB scrollback buffer
- WebSocket reconnect replays scrollback (survives tab switch and F5)
- Agent PTY launched with `--settings <hooks_path>` for Claude Code
- Runner PTY is a shell for executing project commands via exec endpoint

### CI/CD

- `.github/workflows/release.yml` — triggered on `v*` tags
- Builds 4 binaries: linux/amd64, linux/arm64, darwin/amd64, darwin/arm64
- Frontend built + embedded into Go binary via `//go:embed`
- Creates GitHub Release with auto-generated notes

## Code Guidelines

- **Lisibilité first** — Code simple et compréhensible. Clarté > cleverness.
- **Gestion d'erreurs exhaustive** — Chaque erreur gérée et documentée. Pas de `_ = err`, pas de silent failures.
- **Architecture en services** — Chaque domaine est un service isolé avec interface claire.
- **No migrations in dev** — `CREATE IF NOT EXISTS` + safe ALTERs. `make reset` to start fresh.

## Frontend Guidelines

- **shadcn/ui** — Uses base-ui under the hood. Components use `render` prop (not `asChild`).
- **Composants réutilisables** — Réutiliser plutôt que refaire.
- **Tabs in session page** — Terminals use `visible`/`invisible` (keep PTY alive). Monaco/others use `hidden` (display:none).
- **No polling** — Query invalidation via SSE events only.

## Website Guidelines

- **Astro** — Static site, Tailwind v4 via Vite plugin, no UI framework.
- **Docs layout** — Sidebar nav defined in `Docs.astro`, prose styles for content.
- **Code blocks in Astro** — Use `<code set:html={``...``} />` inside `<pre>` when content has `{` or `}` (JSX escaping).

## Key Conventions

- All IDs are TEXT (UUIDs)
- Go module: `github.com/raznak/abbado`
- Timestamps: SQLite `strftime('%Y-%m-%dT%H:%M:%f','now')`
- AI features use `claude -p` CLI (not API key) — Haiku model for cost
- Language: code in English, product docs may be in French
- Version injected at build time via `-ldflags -X main.version=...`
- Data directory: `~/.abbado/` (DB, worktrees, hooks, logs, PID file)

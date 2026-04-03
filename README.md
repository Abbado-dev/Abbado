# Abbado

Local dev cockpit for AI coding agents. Multi-session, multi-provider, real-time.

One dashboard to launch, monitor, and manage AI agent sessions across your git repos. Supports Claude Code, Codex, and any CLI-based agent.

## Install

```bash
curl -fsSL https://abbado.dev/install.sh | sh
abbado
# Open http://localhost:7777
```

## Dev

```bash
make dev          # Backend :7777 + Frontend :5173
make test         # Go tests
make build        # Single binary with embedded frontend
make reset        # Nuke DB + worktrees + hooks
```

## CLI

```bash
abbado            # Foreground
abbado start      # Background (daemon)
abbado stop       # Stop daemon
abbado status     # Running state
abbado logs       # Tail logs
abbado version    # Version
```

## Stack

| Layer | Tech |
|-------|------|
| Backend | Go, chi, gorilla/websocket, creack/pty, SQLite |
| Frontend | React 19, Vite, shadcn/ui, TanStack Query, Tailwind, xterm.js |
| Real-time | SSE + CLI hooks (no polling) |
| Git | Worktrees, GitHub PRs via gh CLI |

## Acknowledgments

This project was greatly inspired by [Pilou97](https://github.com/Pilou97).

## License

MIT

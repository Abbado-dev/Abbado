# Abbado Backend

Go HTTP server with WebSocket terminals, SSE events, and SQLite storage.

## Dev

```bash
go run ./cmd/abbado    # http://localhost:7777
go test ./...          # Run tests
```

## Build

```bash
# Standalone (no embedded frontend)
go build -o abbado ./cmd/abbado

# With embedded frontend (via build.sh from root)
make build
```

## Structure

```
cmd/abbado/main.go      # Entry point + CLI (start/stop/status/logs/version)
internal/
  model/                # Domain types
  database/             # SQLite + migrations
  service/              # Business logic (agent, project, session, git, pty, hooks, ai)
  handler/              # HTTP handlers (REST, WebSocket, SSE)
  server/               # Router wiring + embedded frontend serving
```

## Key Patterns

- **Pure Go SQLite** via modernc.org/sqlite — no CGO needed, cross-compiles cleanly.
- **PTY per terminal** — 4 types: shell, agent, reviewer, runner. Each with scrollback buffer.
- **Embedded frontend** — `//go:embed` in `server/frontend.go`, SPA fallback via NotFound handler.
- **No migration versioning** — `CREATE IF NOT EXISTS` + safe `ALTER TABLE` statements.

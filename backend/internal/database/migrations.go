package database

import (
	"database/sql"
	"fmt"
)

// schema contains all CREATE statements. Idempotent — safe to run every startup.
var schema = []string{
	`CREATE TABLE IF NOT EXISTS agents (
		id           TEXT PRIMARY KEY,
		name         TEXT NOT NULL,
		cli_name     TEXT NOT NULL DEFAULT 'claude-code',
		model        TEXT,
		instructions TEXT,
		created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f','now')),
		updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f','now'))
	)`,

	`CREATE TABLE IF NOT EXISTS projects (
		id         TEXT PRIMARY KEY,
		name       TEXT NOT NULL,
		repo_path  TEXT NOT NULL UNIQUE,
		mode       TEXT NOT NULL DEFAULT 'worktree',
		commands   TEXT,
		position   INTEGER NOT NULL DEFAULT 0,
		created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f','now'))
	)`,

	`CREATE TABLE IF NOT EXISTS sessions (
		id            TEXT PRIMARY KEY,
		project_id    TEXT NOT NULL REFERENCES projects(id),
		agent_id      TEXT NOT NULL REFERENCES agents(id),
		reviewer_agent_id TEXT REFERENCES agents(id),
		name          TEXT,
		branch_name   TEXT NOT NULL,
		base_branch   TEXT NOT NULL DEFAULT 'main',
		worktree_path TEXT,
		commands      TEXT,
		position      INTEGER NOT NULL DEFAULT 0,
		status        TEXT NOT NULL DEFAULT 'idle',
		pid           INTEGER,
		tokens_in     INTEGER NOT NULL DEFAULT 0,
		tokens_out    INTEGER NOT NULL DEFAULT 0,
		cost_usd      REAL NOT NULL DEFAULT 0.0,
		notify        INTEGER NOT NULL DEFAULT 1,
		created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f','now')),
		updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f','now'))
	)`,

	`CREATE TABLE IF NOT EXISTS events (
		id         INTEGER PRIMARY KEY AUTOINCREMENT,
		session_id TEXT NOT NULL,
		event_type TEXT NOT NULL,
		payload    TEXT NOT NULL DEFAULT '{}',
		created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f','now'))
	)`,

	`CREATE TABLE IF NOT EXISTS settings (
		key   TEXT PRIMARY KEY,
		value TEXT NOT NULL
	)`,

}

// Safe ALTER statements — these may fail if column already exists, which is fine.
var alterStatements = []string{
	`ALTER TABLE sessions ADD COLUMN commands TEXT`,
}

// Migrate runs all schema statements.
func Migrate(db *sql.DB) error {
	for i, stmt := range schema {
		if _, err := db.Exec(stmt); err != nil {
			return fmt.Errorf("migrate: statement %d failed: %w", i+1, err)
		}
	}
	// Safe ALTERs — ignore "duplicate column" errors.
	for _, stmt := range alterStatements {
		db.Exec(stmt)
	}
	return nil
}

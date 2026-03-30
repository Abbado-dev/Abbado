package model

import "time"

// Agent represents a reusable AI agent configuration.
// Provider-agnostic: supports any CLI-based agent (Claude Code, Codex, etc.).
type Agent struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	CLIName      string    `json:"cli_name"`
	Model        string    `json:"model,omitempty"`
	Instructions string    `json:"instructions,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// Workspace is a logical group of projects (purely organizational).
type Workspace struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Position  int       `json:"position"`
	CreatedAt time.Time `json:"created_at"`
}

// ProjectMode defines how sessions run in a project.
type ProjectMode string

const (
	ProjectModeWorktree ProjectMode = "worktree"
	ProjectModeDirect   ProjectMode = "direct"
)

// ProjectCommand defines a single runnable command button for a project.
type ProjectCommand struct {
	Label   string `json:"label"`
	Icon    string `json:"icon"`
	Command string `json:"command"`
}

// Project represents a local git repository.
type Project struct {
	ID          string           `json:"id"`
	WorkspaceID string           `json:"workspace_id,omitempty"`
	Name        string           `json:"name"`
	RepoPath    string           `json:"repo_path"`
	Mode        ProjectMode      `json:"mode"`
	Commands    []ProjectCommand `json:"commands,omitempty"`
	Position    int              `json:"position"`
	CreatedAt   time.Time        `json:"created_at"`
}

// SessionStatus represents the lifecycle state of a session.
type SessionStatus string

const (
	SessionStatusActive    SessionStatus = "active"
	SessionStatusIdle      SessionStatus = "idle"
	SessionStatusWaiting   SessionStatus = "waiting"
	SessionStatusCompleted SessionStatus = "completed"
	SessionStatusFailed    SessionStatus = "failed"
)

// Session represents a working branch tied to a project and an agent.
// Each session runs in an isolated git worktree.
type Session struct {
	ID              string           `json:"id"`
	ProjectID       string           `json:"project_id"`
	AgentID         string           `json:"agent_id"`
	ReviewerAgentID string           `json:"reviewer_agent_id,omitempty"`
	Name         string           `json:"name,omitempty"`
	BranchName   string           `json:"branch_name"`
	BaseBranch   string           `json:"base_branch"`
	WorktreePath string           `json:"worktree_path,omitempty"`
	Commands     []ProjectCommand `json:"commands,omitempty"`
	Position     int              `json:"position"`
	Status       SessionStatus    `json:"status"`
	PID          int              `json:"pid,omitempty"`
	TokensIn     int64            `json:"tokens_in"`
	TokensOut    int64            `json:"tokens_out"`
	CostUSD      float64          `json:"cost_usd"`
	Notify       bool             `json:"notify"`
	CreatedAt    time.Time        `json:"created_at"`
	UpdatedAt    time.Time        `json:"updated_at"`
}

// Event represents a session event for tracking and replay.
type Event struct {
	ID        int64     `json:"id"`
	SessionID string    `json:"session_id"`
	EventType string    `json:"event_type"`
	Payload   string    `json:"payload"`
	CreatedAt time.Time `json:"created_at"`
}

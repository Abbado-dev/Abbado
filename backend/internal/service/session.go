package service

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/raznak/abbado/internal/model"
)

const sessionColumns = `id, project_id, agent_id, reviewer_agent_id, name, branch_name, base_branch, worktree_path, commands, position, status, pid, tokens_in, tokens_out, cost_usd, notify, created_at, updated_at`

// SessionService handles session lifecycle operations.
type SessionService struct {
	db *sql.DB
}

// NewSessionService creates a new SessionService.
func NewSessionService(db *sql.DB) *SessionService {
	return &SessionService{db: db}
}

// List returns all sessions, optionally filtered by project ID.
func (s *SessionService) List(projectID string) ([]model.Session, error) {
	query := `SELECT ` + sessionColumns + ` FROM sessions`
	var args []interface{}

	if projectID != "" {
		query += ` WHERE project_id = ?`
		args = append(args, projectID)
	}
	query += ` ORDER BY position ASC, created_at DESC`

	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("session.List: query failed: %w", err)
	}
	defer rows.Close()

	var sessions []model.Session
	for rows.Next() {
		sess, err := scanSession(rows)
		if err != nil {
			return nil, fmt.Errorf("session.List: %w", err)
		}
		sessions = append(sessions, *sess)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("session.List: iteration failed: %w", err)
	}

	return sessions, nil
}

// GetByID returns a session by its ID.
func (s *SessionService) GetByID(id string) (*model.Session, error) {
	row := s.db.QueryRow(
		`SELECT `+sessionColumns+` FROM sessions WHERE id = ?`, id,
	)

	sess, err := scanSessionRow(row)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("session.GetByID: session %s not found", id)
	}
	if err != nil {
		return nil, fmt.Errorf("session.GetByID: query failed: %w", err)
	}

	return sess, nil
}

// Create inserts a new session record.
func (s *SessionService) Create(projectID, agentID, reviewerAgentID, name, branchName, baseBranch string) (*model.Session, error) {
	if projectID == "" {
		return nil, fmt.Errorf("session.Create: project_id is required")
	}
	if agentID == "" {
		return nil, fmt.Errorf("session.Create: agent_id is required")
	}
	if branchName == "" {
		return nil, fmt.Errorf("session.Create: branch_name is required")
	}
	if baseBranch == "" {
		baseBranch = "main"
	}

	id := uuid.New().String()
	_, err := s.db.Exec(
		`INSERT INTO sessions (id, project_id, agent_id, reviewer_agent_id, name, branch_name, base_branch) VALUES (?, ?, ?, ?, ?, ?, ?)`,
		id, projectID, agentID, nullString(reviewerAgentID), nullString(name), branchName, baseBranch,
	)
	if err != nil {
		return nil, fmt.Errorf("session.Create: insert failed: %w", err)
	}

	return s.GetByID(id)
}

// UpdateStatus updates the session status.
func (s *SessionService) UpdateStatus(id string, status model.SessionStatus) error {
	result, err := s.db.Exec(
		`UPDATE sessions SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%f','now') WHERE id = ?`,
		string(status), id,
	)
	if err != nil {
		return fmt.Errorf("session.UpdateStatus: update failed: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("session.UpdateStatus: failed to check rows affected: %w", err)
	}
	if rows == 0 {
		return fmt.Errorf("session.UpdateStatus: session %s not found", id)
	}

	return nil
}

// UpdateWorktree sets the worktree path for a session.
func (s *SessionService) UpdateWorktree(id, worktreePath string) error {
	_, err := s.db.Exec(
		`UPDATE sessions SET worktree_path = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%f','now') WHERE id = ?`,
		worktreePath, id,
	)
	if err != nil {
		return fmt.Errorf("session.UpdateWorktree: update failed: %w", err)
	}

	return nil
}

// UpdateReviewerAgent sets or clears the reviewer agent for a session.
func (s *SessionService) UpdateReviewerAgent(id, reviewerAgentID string) error {
	_, err := s.db.Exec(
		`UPDATE sessions SET reviewer_agent_id = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%f','now') WHERE id = ?`,
		nullString(reviewerAgentID), id,
	)
	if err != nil {
		return fmt.Errorf("session.UpdateReviewerAgent: update failed: %w", err)
	}

	return nil
}

// Delete removes a session by ID.
func (s *SessionService) Delete(id string) error {
	result, err := s.db.Exec(`DELETE FROM sessions WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("session.Delete: delete failed: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("session.Delete: failed to check rows affected: %w", err)
	}
	if rows == 0 {
		return fmt.Errorf("session.Delete: session %s not found", id)
	}

	return nil
}

// scanSession scans a session from a sql.Rows iterator.
func scanSession(rows *sql.Rows) (*model.Session, error) {
	var sess model.Session
	var reviewerAgentID, name, worktreePath, commands sql.NullString
	var pid sql.NullInt64
	var notify int
	var createdAt, updatedAt string

	err := rows.Scan(
		&sess.ID, &sess.ProjectID, &sess.AgentID, &reviewerAgentID, &name, &sess.BranchName, &sess.BaseBranch,
		&worktreePath, &commands, &sess.Position, &sess.Status, &pid, &sess.TokensIn, &sess.TokensOut, &sess.CostUSD,
		&notify, &createdAt, &updatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("scan failed: %w", err)
	}

	sess.ReviewerAgentID = reviewerAgentID.String
	sess.Name = name.String
	sess.WorktreePath = worktreePath.String
	sess.Commands = unmarshalSessionCommands(commands)
	sess.PID = int(pid.Int64)
	sess.Notify = notify == 1
	sess.CreatedAt, _ = time.Parse("2006-01-02T15:04:05.000", createdAt)
	sess.UpdatedAt, _ = time.Parse("2006-01-02T15:04:05.000", updatedAt)

	return &sess, nil
}

// ReorderSessions updates the position of multiple sessions.
func (s *SessionService) ReorderSessions(ids []string) error {
	tx, err := s.db.Begin()
	if err != nil {
		return fmt.Errorf("session.Reorder: begin failed: %w", err)
	}

	for i, id := range ids {
		if _, err := tx.Exec(`UPDATE sessions SET position = ? WHERE id = ?`, i, id); err != nil {
			tx.Rollback()
			return fmt.Errorf("session.Reorder: update failed for %s: %w", id, err)
		}
	}

	return tx.Commit()
}

// scanSessionRow scans a session from a single sql.Row.
func scanSessionRow(row *sql.Row) (*model.Session, error) {
	var sess model.Session
	var reviewerAgentID, name, worktreePath, commands sql.NullString
	var pid sql.NullInt64
	var notify int
	var createdAt, updatedAt string

	err := row.Scan(
		&sess.ID, &sess.ProjectID, &sess.AgentID, &reviewerAgentID, &name, &sess.BranchName, &sess.BaseBranch,
		&worktreePath, &commands, &sess.Position, &sess.Status, &pid, &sess.TokensIn, &sess.TokensOut, &sess.CostUSD,
		&notify, &createdAt, &updatedAt,
	)
	if err != nil {
		return nil, err
	}

	sess.ReviewerAgentID = reviewerAgentID.String
	sess.Name = name.String
	sess.WorktreePath = worktreePath.String
	sess.Commands = unmarshalSessionCommands(commands)
	sess.PID = int(pid.Int64)
	sess.Notify = notify == 1
	sess.CreatedAt, _ = time.Parse("2006-01-02T15:04:05.000", createdAt)
	sess.UpdatedAt, _ = time.Parse("2006-01-02T15:04:05.000", updatedAt)

	return &sess, nil
}

// UpdateCommands sets session-level command overrides.
func (s *SessionService) UpdateCommands(id string, commands []model.ProjectCommand) error {
	var commandsJSON sql.NullString
	if len(commands) > 0 {
		data, err := json.Marshal(commands)
		if err != nil {
			return fmt.Errorf("session.UpdateCommands: marshal failed: %w", err)
		}
		commandsJSON = sql.NullString{String: string(data), Valid: true}
	}

	_, err := s.db.Exec(
		`UPDATE sessions SET commands = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%f','now') WHERE id = ?`,
		commandsJSON, id,
	)
	if err != nil {
		return fmt.Errorf("session.UpdateCommands: update failed: %w", err)
	}
	return nil
}

func unmarshalSessionCommands(s sql.NullString) []model.ProjectCommand {
	if !s.Valid || s.String == "" {
		return nil
	}
	var cmds []model.ProjectCommand
	if err := json.Unmarshal([]byte(s.String), &cmds); err != nil {
		return nil
	}
	return cmds
}

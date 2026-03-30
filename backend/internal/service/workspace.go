package service

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/raznak/abbado/internal/model"
)

// WorkspaceService handles workspace CRUD operations.
type WorkspaceService struct {
	db *sql.DB
}

// NewWorkspaceService creates a new WorkspaceService.
func NewWorkspaceService(db *sql.DB) *WorkspaceService {
	return &WorkspaceService{db: db}
}

// List returns all workspaces ordered by position.
func (s *WorkspaceService) List() ([]model.Workspace, error) {
	rows, err := s.db.Query(`SELECT id, name, position, created_at FROM workspaces ORDER BY position ASC, created_at ASC`)
	if err != nil {
		return nil, fmt.Errorf("workspace.List: query failed: %w", err)
	}
	defer rows.Close()

	var workspaces []model.Workspace
	for rows.Next() {
		var w model.Workspace
		var createdAt string
		if err := rows.Scan(&w.ID, &w.Name, &w.Position, &createdAt); err != nil {
			return nil, fmt.Errorf("workspace.List: scan failed: %w", err)
		}
		w.CreatedAt, _ = time.Parse("2006-01-02T15:04:05.000", createdAt)
		workspaces = append(workspaces, w)
	}
	return workspaces, rows.Err()
}

// Create inserts a new workspace.
func (s *WorkspaceService) Create(name string) (*model.Workspace, error) {
	if name == "" {
		return nil, fmt.Errorf("workspace.Create: name is required")
	}

	id := uuid.New().String()
	_, err := s.db.Exec(`INSERT INTO workspaces (id, name) VALUES (?, ?)`, id, name)
	if err != nil {
		return nil, fmt.Errorf("workspace.Create: insert failed: %w", err)
	}

	return s.GetByID(id)
}

// GetByID returns a workspace by ID.
func (s *WorkspaceService) GetByID(id string) (*model.Workspace, error) {
	var w model.Workspace
	var createdAt string

	err := s.db.QueryRow(`SELECT id, name, position, created_at FROM workspaces WHERE id = ?`, id).
		Scan(&w.ID, &w.Name, &w.Position, &createdAt)
	if err != nil {
		return nil, fmt.Errorf("workspace.GetByID: %w", err)
	}

	w.CreatedAt, _ = time.Parse("2006-01-02T15:04:05.000", createdAt)
	return &w, nil
}

// Update modifies a workspace's name.
func (s *WorkspaceService) Update(id, name string) (*model.Workspace, error) {
	if name == "" {
		return nil, fmt.Errorf("workspace.Update: name is required")
	}

	result, err := s.db.Exec(`UPDATE workspaces SET name = ? WHERE id = ?`, name, id)
	if err != nil {
		return nil, fmt.Errorf("workspace.Update: %w", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return nil, fmt.Errorf("workspace.Update: workspace %s not found", id)
	}

	return s.GetByID(id)
}

// Delete removes a workspace. Projects in it become ungrouped (workspace_id = NULL).
func (s *WorkspaceService) Delete(id string) error {
	// Unlink projects first.
	_, err := s.db.Exec(`UPDATE projects SET workspace_id = NULL WHERE workspace_id = ?`, id)
	if err != nil {
		return fmt.Errorf("workspace.Delete: failed to unlink projects: %w", err)
	}

	result, err := s.db.Exec(`DELETE FROM workspaces WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("workspace.Delete: %w", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("workspace.Delete: workspace %s not found", id)
	}

	return nil
}

// Reorder updates positions for multiple workspaces.
func (s *WorkspaceService) Reorder(ids []string) error {
	tx, err := s.db.Begin()
	if err != nil {
		return fmt.Errorf("workspace.Reorder: begin failed: %w", err)
	}

	for i, id := range ids {
		if _, err := tx.Exec(`UPDATE workspaces SET position = ? WHERE id = ?`, i, id); err != nil {
			tx.Rollback()
			return fmt.Errorf("workspace.Reorder: update failed for %s: %w", id, err)
		}
	}

	return tx.Commit()
}

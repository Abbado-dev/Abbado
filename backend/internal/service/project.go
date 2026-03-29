package service

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"time"

	"github.com/google/uuid"
	"github.com/raznak/abbado/internal/model"
)

// ProjectService handles project CRUD operations.
type ProjectService struct {
	db *sql.DB
}

// NewProjectService creates a new ProjectService.
func NewProjectService(db *sql.DB) *ProjectService {
	return &ProjectService{db: db}
}

// List returns all projects ordered by creation date.
func (s *ProjectService) List() ([]model.Project, error) {
	rows, err := s.db.Query(`SELECT id, name, repo_path, mode, commands, position, created_at FROM projects ORDER BY position ASC, created_at DESC`)
	if err != nil {
		return nil, fmt.Errorf("project.List: query failed: %w", err)
	}
	defer rows.Close()

	var projects []model.Project
	for rows.Next() {
		p, err := scanProject(rows)
		if err != nil {
			return nil, fmt.Errorf("project.List: %w", err)
		}
		projects = append(projects, *p)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("project.List: iteration failed: %w", err)
	}

	return projects, nil
}

// GetByID returns a project by its ID.
func (s *ProjectService) GetByID(id string) (*model.Project, error) {
	var p model.Project
	var commands sql.NullString
	var createdAt string

	err := s.db.QueryRow(
		`SELECT id, name, repo_path, mode, commands, position, created_at FROM projects WHERE id = ?`, id,
	).Scan(&p.ID, &p.Name, &p.RepoPath, &p.Mode, &commands, &p.Position, &createdAt)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("project.GetByID: project %s not found", id)
	}
	if err != nil {
		return nil, fmt.Errorf("project.GetByID: query failed: %w", err)
	}

	p.Commands = unmarshalCommands(commands)
	p.CreatedAt, _ = time.Parse("2006-01-02T15:04:05.000", createdAt)

	return &p, nil
}

// Create validates the repo path, inserts a new project, and returns it.
func (s *ProjectService) Create(name, repoPath string, mode model.ProjectMode) (*model.Project, error) {
	if name == "" {
		return nil, fmt.Errorf("project.Create: name is required")
	}
	if repoPath == "" {
		return nil, fmt.Errorf("project.Create: repo_path is required")
	}
	if mode == "" {
		mode = model.ProjectModeWorktree
	}

	// Verify the path exists and contains a .git directory.
	info, err := os.Stat(repoPath)
	if err != nil {
		return nil, fmt.Errorf("project.Create: repo path %s does not exist: %w", repoPath, err)
	}
	if !info.IsDir() {
		return nil, fmt.Errorf("project.Create: repo path %s is not a directory", repoPath)
	}
	if _, err := os.Stat(repoPath + "/.git"); err != nil {
		return nil, fmt.Errorf("project.Create: %s is not a git repository (no .git directory)", repoPath)
	}

	id := uuid.New().String()
	_, err = s.db.Exec(
		`INSERT INTO projects (id, name, repo_path, mode) VALUES (?, ?, ?, ?)`,
		id, name, repoPath, string(mode),
	)
	if err != nil {
		return nil, fmt.Errorf("project.Create: insert failed (repo_path may already exist): %w", err)
	}

	return s.GetByID(id)
}

// Update modifies a project's settings.
func (s *ProjectService) Update(id, name string, mode model.ProjectMode, commands []model.ProjectCommand) (*model.Project, error) {
	if name == "" {
		return nil, fmt.Errorf("project.Update: name is required")
	}

	commandsJSON := marshalCommands(commands)

	result, err := s.db.Exec(
		`UPDATE projects SET name = ?, mode = ?, commands = ? WHERE id = ?`,
		name, string(mode), commandsJSON, id,
	)
	if err != nil {
		return nil, fmt.Errorf("project.Update: update failed: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return nil, fmt.Errorf("project.Update: failed to check rows affected: %w", err)
	}
	if rows == 0 {
		return nil, fmt.Errorf("project.Update: project %s not found", id)
	}

	return s.GetByID(id)
}

// Delete removes a project by ID.
func (s *ProjectService) Delete(id string) error {
	result, err := s.db.Exec(`DELETE FROM projects WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("project.Delete: delete failed: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("project.Delete: failed to check rows affected: %w", err)
	}
	if rows == 0 {
		return fmt.Errorf("project.Delete: project %s not found", id)
	}

	return nil
}

// Reorder updates the position of multiple projects.
func (s *ProjectService) Reorder(ids []string) error {
	tx, err := s.db.Begin()
	if err != nil {
		return fmt.Errorf("project.Reorder: begin failed: %w", err)
	}

	for i, id := range ids {
		if _, err := tx.Exec(`UPDATE projects SET position = ? WHERE id = ?`, i, id); err != nil {
			tx.Rollback()
			return fmt.Errorf("project.Reorder: update failed for %s: %w", id, err)
		}
	}

	return tx.Commit()
}

func scanProject(rows *sql.Rows) (*model.Project, error) {
	var p model.Project
	var commands sql.NullString
	var createdAt string

	if err := rows.Scan(&p.ID, &p.Name, &p.RepoPath, &p.Mode, &commands, &p.Position, &createdAt); err != nil {
		return nil, fmt.Errorf("scan failed: %w", err)
	}

	p.Commands = unmarshalCommands(commands)
	p.CreatedAt, _ = time.Parse("2006-01-02T15:04:05.000", createdAt)

	return &p, nil
}

func unmarshalCommands(s sql.NullString) []model.ProjectCommand {
	if !s.Valid || s.String == "" {
		return nil
	}
	var cmds []model.ProjectCommand
	if err := json.Unmarshal([]byte(s.String), &cmds); err != nil {
		return nil
	}
	return cmds
}

func marshalCommands(cmds []model.ProjectCommand) sql.NullString {
	if len(cmds) == 0 {
		return sql.NullString{}
	}
	data, err := json.Marshal(cmds)
	if err != nil {
		return sql.NullString{}
	}
	return sql.NullString{String: string(data), Valid: true}
}

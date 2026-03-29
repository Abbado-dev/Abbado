package service

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/raznak/abbado/internal/model"
)

// AgentService handles agent CRUD operations.
type AgentService struct {
	db *sql.DB
}

// NewAgentService creates a new AgentService.
func NewAgentService(db *sql.DB) *AgentService {
	return &AgentService{db: db}
}

// List returns all agents ordered by creation date.
func (s *AgentService) List() ([]model.Agent, error) {
	rows, err := s.db.Query(`SELECT id, name, cli_name, model, instructions, created_at, updated_at FROM agents ORDER BY created_at DESC`)
	if err != nil {
		return nil, fmt.Errorf("agent.List: query failed: %w", err)
	}
	defer rows.Close()

	var agents []model.Agent
	for rows.Next() {
		var a model.Agent
		var modelStr, instructions sql.NullString
		var createdAt, updatedAt string

		if err := rows.Scan(&a.ID, &a.Name, &a.CLIName, &modelStr, &instructions, &createdAt, &updatedAt); err != nil {
			return nil, fmt.Errorf("agent.List: scan failed: %w", err)
		}

		a.Model = modelStr.String
		a.Instructions = instructions.String
		a.CreatedAt, _ = time.Parse("2006-01-02T15:04:05.000", createdAt)
		a.UpdatedAt, _ = time.Parse("2006-01-02T15:04:05.000", updatedAt)
		agents = append(agents, a)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("agent.List: iteration failed: %w", err)
	}

	return agents, nil
}

// GetByID returns an agent by its ID.
func (s *AgentService) GetByID(id string) (*model.Agent, error) {
	var a model.Agent
	var modelStr, instructions sql.NullString
	var createdAt, updatedAt string

	err := s.db.QueryRow(
		`SELECT id, name, cli_name, model, instructions, created_at, updated_at FROM agents WHERE id = ?`, id,
	).Scan(&a.ID, &a.Name, &a.CLIName, &modelStr, &instructions, &createdAt, &updatedAt)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("agent.GetByID: agent %s not found", id)
	}
	if err != nil {
		return nil, fmt.Errorf("agent.GetByID: query failed: %w", err)
	}

	a.Model = modelStr.String
	a.Instructions = instructions.String
	a.CreatedAt, _ = time.Parse("2006-01-02T15:04:05.000", createdAt)
	a.UpdatedAt, _ = time.Parse("2006-01-02T15:04:05.000", updatedAt)

	return &a, nil
}

// Create inserts a new agent and returns it.
func (s *AgentService) Create(name, cliName, agentModel, instructions string) (*model.Agent, error) {
	if name == "" {
		return nil, fmt.Errorf("agent.Create: name is required")
	}
	if cliName == "" {
		cliName = "claude-code"
	}

	id := uuid.New().String()
	_, err := s.db.Exec(
		`INSERT INTO agents (id, name, cli_name, model, instructions) VALUES (?, ?, ?, ?, ?)`,
		id, name, cliName, nullString(agentModel), nullString(instructions),
	)
	if err != nil {
		return nil, fmt.Errorf("agent.Create: insert failed: %w", err)
	}

	return s.GetByID(id)
}

// Update modifies an existing agent.
func (s *AgentService) Update(id, name, cliName, agentModel, instructions string) (*model.Agent, error) {
	if name == "" {
		return nil, fmt.Errorf("agent.Update: name is required")
	}

	result, err := s.db.Exec(
		`UPDATE agents SET name = ?, cli_name = ?, model = ?, instructions = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%f','now') WHERE id = ?`,
		name, cliName, nullString(agentModel), nullString(instructions), id,
	)
	if err != nil {
		return nil, fmt.Errorf("agent.Update: update failed: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return nil, fmt.Errorf("agent.Update: failed to check rows affected: %w", err)
	}
	if rows == 0 {
		return nil, fmt.Errorf("agent.Update: agent %s not found", id)
	}

	return s.GetByID(id)
}

// Delete removes an agent by ID.
func (s *AgentService) Delete(id string) error {
	result, err := s.db.Exec(`DELETE FROM agents WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("agent.Delete: delete failed: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("agent.Delete: failed to check rows affected: %w", err)
	}
	if rows == 0 {
		return fmt.Errorf("agent.Delete: agent %s not found", id)
	}

	return nil
}

// nullString returns a sql.NullString: NULL if empty, valid otherwise.
func nullString(s string) sql.NullString {
	if s == "" {
		return sql.NullString{}
	}
	return sql.NullString{String: s, Valid: true}
}

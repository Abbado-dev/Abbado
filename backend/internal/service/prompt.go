package service

import (
	"database/sql"
	"fmt"
	"time"
)

// PromptService provides prompt history.
type PromptService struct {
	db *sql.DB
}

// NewPromptService creates a new PromptService.
func NewPromptService(db *sql.DB) *PromptService {
	return &PromptService{db: db}
}

// PromptEntry represents a prompt in the history.
type PromptEntry struct {
	ID        int64     `json:"id"`
	Prompt    string    `json:"prompt"`
	CreatedAt time.Time `json:"created_at"`
}

// ListForSession returns all prompts for a session.
func (s *PromptService) ListForSession(sessionID string) ([]PromptEntry, error) {
	rows, err := s.db.Query(`
		SELECT id, payload, created_at
		FROM events
		WHERE session_id = ? AND event_type = 'prompt_submit'
		ORDER BY created_at DESC
	`, sessionID)
	if err != nil {
		return nil, fmt.Errorf("prompt.ListForSession: query failed: %w", err)
	}
	defer rows.Close()

	var entries []PromptEntry
	for rows.Next() {
		var entry PromptEntry
		var createdAt string

		if err := rows.Scan(&entry.ID, &entry.Prompt, &createdAt); err != nil {
			return nil, fmt.Errorf("prompt.ListForSession: scan failed: %w", err)
		}

		entry.CreatedAt, _ = time.Parse("2006-01-02T15:04:05.000", createdAt)
		entries = append(entries, entry)
	}

	return entries, nil
}

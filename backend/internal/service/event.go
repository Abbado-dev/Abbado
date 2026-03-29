package service

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/raznak/abbado/internal/model"
)

// EventService handles session event persistence.
type EventService struct {
	db *sql.DB
}

// NewEventService creates a new EventService.
func NewEventService(db *sql.DB) *EventService {
	return &EventService{db: db}
}

// Record stores a session event.
func (s *EventService) Record(sessionID, eventType, payload string) error {
	_, err := s.db.Exec(
		`INSERT INTO events (session_id, event_type, payload) VALUES (?, ?, ?)`,
		sessionID, eventType, payload,
	)
	if err != nil {
		return fmt.Errorf("event.Record: insert failed: %w", err)
	}
	return nil
}

// ListBySession returns all events for a session, ordered by creation date.
func (s *EventService) ListBySession(sessionID string) ([]model.Event, error) {
	rows, err := s.db.Query(
		`SELECT id, session_id, event_type, payload, created_at FROM events WHERE session_id = ? ORDER BY created_at ASC`,
		sessionID,
	)
	if err != nil {
		return nil, fmt.Errorf("event.ListBySession: query failed: %w", err)
	}
	defer rows.Close()

	var events []model.Event
	for rows.Next() {
		var e model.Event
		var createdAt string
		if err := rows.Scan(&e.ID, &e.SessionID, &e.EventType, &e.Payload, &createdAt); err != nil {
			return nil, fmt.Errorf("event.ListBySession: scan failed: %w", err)
		}
		e.CreatedAt, _ = time.Parse("2006-01-02T15:04:05.000", createdAt)
		events = append(events, e)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("event.ListBySession: iteration failed: %w", err)
	}

	return events, nil
}

// ListPrompts returns only prompt_submit events for a session.
func (s *EventService) ListPrompts(sessionID string) ([]model.Event, error) {
	rows, err := s.db.Query(
		`SELECT id, session_id, event_type, payload, created_at FROM events WHERE session_id = ? AND event_type = 'prompt_submit' ORDER BY created_at ASC`,
		sessionID,
	)
	if err != nil {
		return nil, fmt.Errorf("event.ListPrompts: query failed: %w", err)
	}
	defer rows.Close()

	var events []model.Event
	for rows.Next() {
		var e model.Event
		var createdAt string
		if err := rows.Scan(&e.ID, &e.SessionID, &e.EventType, &e.Payload, &createdAt); err != nil {
			return nil, fmt.Errorf("event.ListPrompts: scan failed: %w", err)
		}
		e.CreatedAt, _ = time.Parse("2006-01-02T15:04:05.000", createdAt)
		events = append(events, e)
	}

	return events, nil
}

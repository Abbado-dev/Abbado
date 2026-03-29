package service

import (
	"encoding/json"
	"sync"
	"time"
)

// SessionEvent represents a real-time event for a session.
type SessionEvent struct {
	SessionID string    `json:"session_id"`
	Event     string    `json:"event"`
	Payload   string    `json:"payload,omitempty"`
	Timestamp time.Time `json:"timestamp"`
}

// EventBus broadcasts session events to SSE subscribers.
type EventBus struct {
	mu          sync.RWMutex
	subscribers map[string][]chan SessionEvent // sessionID -> channels
}

// NewEventBus creates a new EventBus.
func NewEventBus() *EventBus {
	return &EventBus{
		subscribers: make(map[string][]chan SessionEvent),
	}
}

// Subscribe creates a channel that receives events for a session.
func (b *EventBus) Subscribe(sessionID string) chan SessionEvent {
	b.mu.Lock()
	defer b.mu.Unlock()

	ch := make(chan SessionEvent, 32)
	b.subscribers[sessionID] = append(b.subscribers[sessionID], ch)
	return ch
}

// Unsubscribe removes a channel from a session's subscribers.
func (b *EventBus) Unsubscribe(sessionID string, ch chan SessionEvent) {
	b.mu.Lock()
	defer b.mu.Unlock()

	subs := b.subscribers[sessionID]
	for i, sub := range subs {
		if sub == ch {
			b.subscribers[sessionID] = append(subs[:i], subs[i+1:]...)
			close(ch)
			return
		}
	}
}

// Publish sends an event to all subscribers of a session.
func (b *EventBus) Publish(event SessionEvent) {
	b.mu.RLock()
	defer b.mu.RUnlock()

	for _, ch := range b.subscribers[event.SessionID] {
		select {
		case ch <- event:
		default:
			// Drop if subscriber is slow.
		}
	}
}

// PublishJSON is a convenience method that marshals the event to JSON bytes.
func (b *EventBus) PublishJSON(event SessionEvent) ([]byte, error) {
	data, err := json.Marshal(event)
	if err != nil {
		return nil, err
	}
	b.Publish(event)
	return data, nil
}

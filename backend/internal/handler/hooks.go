package handler

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/raznak/abbado/internal/model"
	"github.com/raznak/abbado/internal/service"
)

// HooksHandler handles hook callbacks from AI agents and SSE subscriptions.
type HooksHandler struct {
	sessionSvc *service.SessionService
	eventSvc   *service.EventService
	promptSvc  *service.PromptService
	eventBus   *service.EventBus
}

// NewHooksHandler creates a new HooksHandler.
func NewHooksHandler(sessionSvc *service.SessionService, eventSvc *service.EventService, promptSvc *service.PromptService, eventBus *service.EventBus) *HooksHandler {
	return &HooksHandler{sessionSvc: sessionSvc, eventSvc: eventSvc, promptSvc: promptSvc, eventBus: eventBus}
}

// Routes registers hook, SSE, and history routes.
func (h *HooksHandler) Routes(r chi.Router) {
	r.Post("/{id}/hook", h.hook)
	r.Get("/{id}/events", h.sse)
	r.Get("/{id}/prompts", h.prompts)
}

type hookRequest struct {
	Event   string `json:"event"`
	Payload string `json:"payload"`
}

func (h *HooksHandler) hook(w http.ResponseWriter, r *http.Request) {
	sessionID := chi.URLParam(r, "id")

	var req hookRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid JSON body: "+err.Error())
		return
	}

	// Persist event.
	if err := h.eventSvc.Record(sessionID, req.Event, req.Payload); err != nil {
		log.Printf("hooks: failed to record event: %v", err)
	}

	slot := r.URL.Query().Get("slot")

	// Update session status based on event type.
	var newStatus model.SessionStatus
	switch req.Event {
	case "prompt_submit":
		newStatus = model.SessionStatusActive
	case "stop":
		newStatus = model.SessionStatusIdle
	case "notification":
		newStatus = model.SessionStatusWaiting
	case "tool_use":
		newStatus = model.SessionStatusActive
	default:
		log.Printf("hooks: unknown event %q for session %s", req.Event, sessionID)
	}

	if newStatus != "" {
		if slot == "reviewer" {
			if err := h.sessionSvc.UpdateReviewerStatus(sessionID, newStatus); err != nil {
				log.Printf("hooks: failed to update reviewer status: %v", err)
			}
		} else {
			if err := h.sessionSvc.UpdateStatus(sessionID, newStatus); err != nil {
				log.Printf("hooks: failed to update session status: %v", err)
			}
		}
	}

	// Broadcast event.
	event := service.SessionEvent{
		SessionID: sessionID,
		Event:     req.Event,
		Payload:   req.Payload,
		Slot:      slot,
		Timestamp: time.Now(),
	}
	h.eventBus.Publish(event)

	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"ok":true}`))
}

// prompts returns the prompt history with token costs for a session.
func (h *HooksHandler) prompts(w http.ResponseWriter, r *http.Request) {
	sessionID := chi.URLParam(r, "id")

	prompts, err := h.promptSvc.ListForSession(sessionID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to list prompts: "+err.Error())
		return
	}

	writeJSON(w, http.StatusOK, prompts)
}

// sse streams session events to the frontend via Server-Sent Events.
func (h *HooksHandler) sse(w http.ResponseWriter, r *http.Request) {
	sessionID := chi.URLParam(r, "id")

	flusher, ok := w.(http.Flusher)
	if !ok {
		writeError(w, http.StatusInternalServerError, "Streaming not supported")
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	ch := h.eventBus.Subscribe(sessionID)
	defer h.eventBus.Unsubscribe(sessionID, ch)

	// Send initial keepalive.
	fmt.Fprintf(w, ": keepalive\n\n")
	flusher.Flush()

	for {
		select {
		case event, ok := <-ch:
			if !ok {
				return
			}
			data, err := json.Marshal(event)
			if err != nil {
				continue
			}
			fmt.Fprintf(w, "data: %s\n\n", data)
			flusher.Flush()

		case <-r.Context().Done():
			return
		}
	}
}

package handler

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/raznak/abbado/internal/service"
)

// AgentHandler handles HTTP requests for agents.
type AgentHandler struct {
	svc *service.AgentService
}

// NewAgentHandler creates a new AgentHandler.
func NewAgentHandler(svc *service.AgentService) *AgentHandler {
	return &AgentHandler{svc: svc}
}

// Routes registers agent routes on the given router.
func (h *AgentHandler) Routes(r chi.Router) {
	r.Get("/", h.list)
	r.Post("/", h.create)
	r.Put("/{id}", h.update)
	r.Delete("/{id}", h.delete)
}

func (h *AgentHandler) list(w http.ResponseWriter, r *http.Request) {
	agents, err := h.svc.List()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to list agents: "+err.Error())
		return
	}
	writeJSON(w, http.StatusOK, agents)
}

type createAgentRequest struct {
	Name         string `json:"name"`
	CLIName      string `json:"cli_name"`
	Model        string `json:"model"`
	Instructions string `json:"instructions"`
}

func (h *AgentHandler) create(w http.ResponseWriter, r *http.Request) {
	var req createAgentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid JSON body: "+err.Error())
		return
	}

	agent, err := h.svc.Create(req.Name, req.CLIName, req.Model, req.Instructions)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, agent)
}

func (h *AgentHandler) update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	var req createAgentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid JSON body: "+err.Error())
		return
	}

	agent, err := h.svc.Update(id, req.Name, req.CLIName, req.Model, req.Instructions)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, agent)
}

func (h *AgentHandler) delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	if err := h.svc.Delete(id); err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

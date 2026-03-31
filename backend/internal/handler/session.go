package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"

	"github.com/go-chi/chi/v5"
	"github.com/raznak/abbado/internal/model"
	"github.com/raznak/abbado/internal/service"
)

// SessionHandler handles HTTP requests for sessions.
type SessionHandler struct {
	svc        *service.SessionService
	projectSvc *service.ProjectService
	gitSvc     *service.GitService
	providers  *service.ProviderRegistry
}

// NewSessionHandler creates a new SessionHandler.
func NewSessionHandler(svc *service.SessionService, projectSvc *service.ProjectService, gitSvc *service.GitService, providers *service.ProviderRegistry) *SessionHandler {
	return &SessionHandler{svc: svc, projectSvc: projectSvc, gitSvc: gitSvc, providers: providers}
}

// Routes registers session routes on the given router.
func (h *SessionHandler) Routes(r chi.Router) {
	r.Get("/", h.list)
	r.Post("/", h.create)
	r.Delete("/{id}", h.delete)
	r.Put("/{id}/agent", h.updateAgent)
	r.Put("/{id}/reviewer", h.updateReviewer)
	r.Put("/{id}/commands", h.updateCommands)
	r.Post("/reorder", h.reorder)
}

func (h *SessionHandler) list(w http.ResponseWriter, r *http.Request) {
	projectID := r.URL.Query().Get("project_id")

	sessions, err := h.svc.List(projectID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to list sessions: "+err.Error())
		return
	}
	writeJSON(w, http.StatusOK, sessions)
}

type createSessionRequest struct {
	ProjectID       string `json:"project_id"`
	AgentID         string `json:"agent_id"`
	ReviewerAgentID string `json:"reviewer_agent_id"`
	Name            string `json:"name"`
	BranchName      string `json:"branch_name"`
	BaseBranch      string `json:"base_branch"`
}

func (h *SessionHandler) create(w http.ResponseWriter, r *http.Request) {
	var req createSessionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid JSON body: "+err.Error())
		return
	}

	// Resolve project to get repo path and mode.
	project, err := h.projectSvc.GetByID(req.ProjectID)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Project not found: "+err.Error())
		return
	}

	// Direct mode: enforce single session.
	if project.Mode == model.ProjectModeDirect {
		existing, _ := h.svc.List(project.ID)
		if len(existing) > 0 {
			writeError(w, http.StatusConflict, "Direct mode project already has a session")
			return
		}
	}

	// Default branch name for direct mode.
	branchName := req.BranchName
	baseBranch := req.BaseBranch
	if project.Mode == model.ProjectModeDirect {
		if branchName == "" {
			branchName = "main"
		}
		if baseBranch == "" {
			baseBranch = branchName
		}
	}

	// Create session record.
	session, err := h.svc.Create(req.ProjectID, req.AgentID, req.ReviewerAgentID, req.Name, branchName, baseBranch)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	var workDir string

	if project.Mode == model.ProjectModeDirect {
		// Direct mode: work in the repo directory, no worktree.
		workDir = project.RepoPath
	} else {
		// Worktree mode: create a git worktree.
		home, err := os.UserHomeDir()
		if err != nil {
			writeError(w, http.StatusInternalServerError, "Failed to get home directory: "+err.Error())
			return
		}
		workDir = filepath.Join(home, ".abbado", "worktrees", fmt.Sprintf("%s-%s", project.Name, branchName))

		if err := h.gitSvc.CreateWorktree(project.RepoPath, workDir, branchName, session.BaseBranch); err != nil {
			h.svc.Delete(session.ID)
			writeError(w, http.StatusInternalServerError, "Failed to create worktree: "+err.Error())
			return
		}
	}

	// Update session with work directory path.
	if err := h.svc.UpdateWorktree(session.ID, workDir); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to update session worktree: "+err.Error())
		return
	}

	// Re-fetch to return updated session.
	session, err = h.svc.GetByID(session.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to fetch session: "+err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, session)
}

func (h *SessionHandler) delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	// Get session to find worktree path and project.
	session, err := h.svc.GetByID(id)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}

	// Kill PTY process if running.
	if session.PID > 0 {
		// Best-effort kill via syscall.
		proc, procErr := os.FindProcess(session.PID)
		if procErr == nil {
			proc.Kill()
		}
	}

	// Remove worktree and delete branch (only in worktree mode).
	project, projErr := h.projectSvc.GetByID(session.ProjectID)
	if projErr == nil && project.Mode == model.ProjectModeWorktree {
		if session.WorktreePath != "" {
			h.gitSvc.RemoveWorktree(project.RepoPath, session.WorktreePath)
		}
		h.gitSvc.DeleteBranch(project.RepoPath, session.BranchName)
	}

	if err := h.svc.Delete(id); err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}

	// Cleanup all provider artifacts for this session.
	h.providers.CleanupSession(id)

	w.WriteHeader(http.StatusNoContent)
}

func (h *SessionHandler) updateAgent(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	var req struct {
		AgentID string `json:"agent_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid JSON body: "+err.Error())
		return
	}
	if req.AgentID == "" {
		writeError(w, http.StatusBadRequest, "agent_id is required")
		return
	}

	if err := h.svc.UpdateAgent(id, req.AgentID); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	session, err := h.svc.GetByID(id)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, session)
}

type updateReviewerRequest struct {
	ReviewerAgentID string `json:"reviewer_agent_id"`
}

func (h *SessionHandler) updateReviewer(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	var req updateReviewerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid JSON body: "+err.Error())
		return
	}

	if err := h.svc.UpdateReviewerAgent(id, req.ReviewerAgentID); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	session, err := h.svc.GetByID(id)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, session)
}

func (h *SessionHandler) updateCommands(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	var req struct {
		Commands []model.ProjectCommand `json:"commands"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid JSON body: "+err.Error())
		return
	}

	if err := h.svc.UpdateCommands(id, req.Commands); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	session, err := h.svc.GetByID(id)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, session)
}

func (h *SessionHandler) reorder(w http.ResponseWriter, r *http.Request) {
	var req struct {
		IDs []string `json:"ids"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid JSON body: "+err.Error())
		return
	}

	if err := h.svc.ReorderSessions(req.IDs); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

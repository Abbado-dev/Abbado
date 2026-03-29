package handler

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/raznak/abbado/internal/model"
	"github.com/raznak/abbado/internal/service"
)

// ProjectHandler handles HTTP requests for projects.
type ProjectHandler struct {
	svc    *service.ProjectService
	gitSvc *service.GitService
}

// NewProjectHandler creates a new ProjectHandler.
func NewProjectHandler(svc *service.ProjectService, gitSvc *service.GitService) *ProjectHandler {
	return &ProjectHandler{svc: svc, gitSvc: gitSvc}
}

// Routes registers project routes on the given router.
func (h *ProjectHandler) Routes(r chi.Router) {
	r.Get("/", h.list)
	r.Post("/", h.create)
	r.Put("/{id}", h.update)
	r.Delete("/{id}", h.delete)
	r.Get("/{id}/branches", h.branches)
	r.Post("/reorder", h.reorder)
}

func (h *ProjectHandler) list(w http.ResponseWriter, r *http.Request) {
	projects, err := h.svc.List()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to list projects: "+err.Error())
		return
	}
	writeJSON(w, http.StatusOK, projects)
}

type createProjectRequest struct {
	Name     string `json:"name"`
	RepoPath string `json:"repo_path"`
	Mode     string `json:"mode"`
}

func (h *ProjectHandler) create(w http.ResponseWriter, r *http.Request) {
	var req createProjectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid JSON body: "+err.Error())
		return
	}

	project, err := h.svc.Create(req.Name, req.RepoPath, model.ProjectMode(req.Mode))
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, project)
}

type updateProjectRequest struct {
	Name     string                  `json:"name"`
	Mode     string                  `json:"mode"`
	Commands []model.ProjectCommand  `json:"commands"`
}

func (h *ProjectHandler) update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	var req updateProjectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid JSON body: "+err.Error())
		return
	}

	project, err := h.svc.Update(id, req.Name, model.ProjectMode(req.Mode), req.Commands)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, project)
}

func (h *ProjectHandler) delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	if err := h.svc.Delete(id); err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *ProjectHandler) branches(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	project, err := h.svc.GetByID(id)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}

	branches, err := h.gitSvc.ListBranches(project.RepoPath)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to list branches: "+err.Error())
		return
	}

	writeJSON(w, http.StatusOK, branches)
}

type reorderRequest struct {
	IDs []string `json:"ids"`
}

func (h *ProjectHandler) reorder(w http.ResponseWriter, r *http.Request) {
	var req reorderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid JSON body: "+err.Error())
		return
	}

	if err := h.svc.Reorder(req.IDs); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

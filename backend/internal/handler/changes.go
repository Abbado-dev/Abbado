package handler

import (
	"encoding/json"
	"net/http"
	"os"

	"github.com/go-chi/chi/v5"
	"github.com/raznak/abbado/internal/model"
	"github.com/raznak/abbado/internal/service"
)

// ChangesHandler handles git diff, commit, push, and PR endpoints.
type ChangesHandler struct {
	sessionSvc *service.SessionService
	projectSvc *service.ProjectService
	gitSvc     *service.GitService
	aiSvc      *service.AIService
}

// NewChangesHandler creates a new ChangesHandler.
func NewChangesHandler(sessionSvc *service.SessionService, projectSvc *service.ProjectService, gitSvc *service.GitService, aiSvc *service.AIService) *ChangesHandler {
	return &ChangesHandler{sessionSvc: sessionSvc, projectSvc: projectSvc, gitSvc: gitSvc, aiSvc: aiSvc}
}

// Routes registers changes routes.
func (h *ChangesHandler) Routes(r chi.Router) {
	r.Get("/{id}/changes", h.files)
	r.Get("/{id}/changes/diff", h.diff)
	r.Get("/{id}/changes/file", h.fileContent)
	r.Put("/{id}/changes/file", h.saveFile)
	r.Post("/{id}/commit", h.commit)
	r.Post("/{id}/push", h.push)
	r.Post("/{id}/pr", h.createPR)
	r.Post("/{id}/generate", h.generate)
	r.Post("/{id}/review", h.review)
}

// resolveSession returns the session, project, and work directory.
func (h *ChangesHandler) resolveSession(w http.ResponseWriter, sessionID string) (*model.Session, *model.Project, bool) {
	session, err := h.sessionSvc.GetByID(sessionID)
	if err != nil {
		writeError(w, http.StatusNotFound, "Session not found: "+err.Error())
		return nil, nil, false
	}

	project, err := h.projectSvc.GetByID(session.ProjectID)
	if err != nil {
		writeError(w, http.StatusNotFound, "Project not found: "+err.Error())
		return nil, nil, false
	}

	return session, project, true
}

func (h *ChangesHandler) files(w http.ResponseWriter, r *http.Request) {
	session, _, ok := h.resolveSession(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}

	workDir := session.WorktreePath
	if workDir == "" {
		writeError(w, http.StatusBadRequest, "Session has no work directory")
		return
	}

	files, err := h.gitSvc.DiffFiles(workDir, session.BaseBranch)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to get changes: "+err.Error())
		return
	}

	writeJSON(w, http.StatusOK, files)
}

func (h *ChangesHandler) diff(w http.ResponseWriter, r *http.Request) {
	session, _, ok := h.resolveSession(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}

	workDir := session.WorktreePath
	if workDir == "" {
		writeError(w, http.StatusBadRequest, "Session has no work directory")
		return
	}

	filePath := r.URL.Query().Get("file")

	var diffOutput string
	var err error
	if filePath != "" {
		diffOutput, err = h.gitSvc.FileDiff(workDir, session.BaseBranch, filePath)
	} else {
		diffOutput, err = h.gitSvc.Diff(workDir, session.BaseBranch)
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to get diff: "+err.Error())
		return
	}

	w.Header().Set("Content-Type", "text/plain")
	w.Write([]byte(diffOutput))
}

// fileContent returns the old (base) and new (working tree) content of a file.
func (h *ChangesHandler) fileContent(w http.ResponseWriter, r *http.Request) {
	session, _, ok := h.resolveSession(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}

	workDir := session.WorktreePath
	if workDir == "" {
		writeError(w, http.StatusBadRequest, "Session has no work directory")
		return
	}

	filePath := r.URL.Query().Get("path")
	if filePath == "" {
		writeError(w, http.StatusBadRequest, "path parameter is required")
		return
	}

	oldContent, _ := h.gitSvc.FileContentAtRef(workDir, session.BaseBranch, filePath)
	newContent, _ := h.gitSvc.FileContentWorkdir(workDir, filePath)

	writeJSON(w, http.StatusOK, map[string]string{
		"old": oldContent,
		"new": newContent,
	})
}

type saveFileRequest struct {
	Path    string `json:"path"`
	Content string `json:"content"`
}

// saveFile writes content to a file in the working directory.
func (h *ChangesHandler) saveFile(w http.ResponseWriter, r *http.Request) {
	session, _, ok := h.resolveSession(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}

	workDir := session.WorktreePath
	if workDir == "" {
		writeError(w, http.StatusBadRequest, "Session has no work directory")
		return
	}

	var req saveFileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid JSON body: "+err.Error())
		return
	}
	if req.Path == "" {
		writeError(w, http.StatusBadRequest, "path is required")
		return
	}

	fullPath := workDir + "/" + req.Path
	if err := os.WriteFile(fullPath, []byte(req.Content), 0o644); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to write file: "+err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "saved"})
}

type commitRequest struct {
	Message string   `json:"message"`
	Files   []string `json:"files"`
}

func (h *ChangesHandler) commit(w http.ResponseWriter, r *http.Request) {
	session, _, ok := h.resolveSession(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}

	var req commitRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid JSON body: "+err.Error())
		return
	}
	if req.Message == "" {
		writeError(w, http.StatusBadRequest, "Commit message is required")
		return
	}

	workDir := session.WorktreePath
	if workDir == "" {
		writeError(w, http.StatusBadRequest, "Session has no work directory")
		return
	}

	if err := h.gitSvc.Commit(workDir, req.Message, req.Files); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "committed"})
}

func (h *ChangesHandler) push(w http.ResponseWriter, r *http.Request) {
	session, _, ok := h.resolveSession(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}

	workDir := session.WorktreePath
	if workDir == "" {
		writeError(w, http.StatusBadRequest, "Session has no work directory")
		return
	}

	if err := h.gitSvc.Push(workDir); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "pushed"})
}

type prRequest struct {
	Title string `json:"title"`
	Body  string `json:"body"`
}

func (h *ChangesHandler) createPR(w http.ResponseWriter, r *http.Request) {
	session, _, ok := h.resolveSession(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}

	var req prRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid JSON body: "+err.Error())
		return
	}
	if req.Title == "" {
		writeError(w, http.StatusBadRequest, "PR title is required")
		return
	}

	workDir := session.WorktreePath
	if workDir == "" {
		writeError(w, http.StatusBadRequest, "Session has no work directory")
		return
	}

	prURL, err := h.gitSvc.CreatePR(workDir, req.Title, req.Body)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"url": prURL})
}

// generate uses AI to generate commit message, PR title, and body from the diff.
func (h *ChangesHandler) generate(w http.ResponseWriter, r *http.Request) {
	session, _, ok := h.resolveSession(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}

	workDir := session.WorktreePath
	if workDir == "" {
		writeError(w, http.StatusBadRequest, "Session has no work directory")
		return
	}

	diff, err := h.gitSvc.Diff(workDir, session.BaseBranch)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to get diff: "+err.Error())
		return
	}

	if diff == "" {
		writeError(w, http.StatusBadRequest, "No changes to generate from")
		return
	}

	result, err := h.aiSvc.GenerateCommitAndPR(r.Context(), "", "", workDir, diff)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "AI generation failed: "+err.Error())
		return
	}

	writeJSON(w, http.StatusOK, result)
}

// review uses AI to review the diff.
func (h *ChangesHandler) review(w http.ResponseWriter, r *http.Request) {
	session, _, ok := h.resolveSession(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}

	workDir := session.WorktreePath
	if workDir == "" {
		writeError(w, http.StatusBadRequest, "Session has no work directory")
		return
	}

	diff, err := h.gitSvc.Diff(workDir, session.BaseBranch)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to get diff: "+err.Error())
		return
	}

	if diff == "" {
		writeError(w, http.StatusBadRequest, "No changes to review")
		return
	}

	review, err := h.aiSvc.ReviewDiff(r.Context(), "", "", workDir, diff)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "AI review failed: "+err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"review": review})
}

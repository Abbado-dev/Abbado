package handler

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"sync"
	"syscall"

	"github.com/go-chi/chi/v5"
	"github.com/gorilla/websocket"
	"github.com/raznak/abbado/internal/model"
	"github.com/raznak/abbado/internal/service"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

// managedPTY wraps a PTY session with a scrollback buffer and broadcast.
type managedPTY struct {
	pty        *service.PTYSession
	mu         sync.Mutex
	scrollback []byte
	conn       *websocket.Conn // current active connection
}

const maxScrollback = 256 * 1024 // 256KB of scrollback

// TerminalHandler manages WebSocket connections to PTY sessions.
type TerminalHandler struct {
	sessionSvc  *service.SessionService
	agentSvc    *service.AgentService
	projectSvc  *service.ProjectService
	ptySvc      *service.PTYService
	providers   *service.ProviderRegistry
	gitSvc      *service.GitService
	callbackURL string
	mu          sync.Mutex
	shells      map[string]*managedPTY // sessionID -> shell
	agents      map[string]*managedPTY // sessionID -> agent
	reviewers   map[string]*managedPTY // sessionID -> reviewer agent
	runners     map[string]*managedPTY // sessionID -> runner (project commands)
}

// NewTerminalHandler creates a new TerminalHandler.
func NewTerminalHandler(sessionSvc *service.SessionService, agentSvc *service.AgentService, projectSvc *service.ProjectService, ptySvc *service.PTYService, providers *service.ProviderRegistry, gitSvc *service.GitService, callbackURL string) *TerminalHandler {
	return &TerminalHandler{
		sessionSvc:  sessionSvc,
		agentSvc:    agentSvc,
		projectSvc:  projectSvc,
		ptySvc:      ptySvc,
		providers:   providers,
		gitSvc:      gitSvc,
		callbackURL: callbackURL,
		shells:      make(map[string]*managedPTY),
		agents:      make(map[string]*managedPTY),
		reviewers:   make(map[string]*managedPTY),
		runners:     make(map[string]*managedPTY),
	}
}

// Routes registers terminal WebSocket routes.
func (h *TerminalHandler) Routes(r chi.Router) {
	r.Get("/{id}/terminal/shell", h.shell)
	r.Get("/{id}/terminal/agent", h.agent)
	r.Get("/{id}/terminal/reviewer", h.reviewer)
	r.Post("/{id}/terminal/reviewer/send", h.sendReviewPrompt)
	r.Get("/{id}/terminal/runner", h.runner)
	r.Post("/{id}/terminal/runner/exec", h.runnerExec)
	r.Post("/{id}/terminal/runner/stop", h.runnerStop)
}

// resizeMessage is sent from the frontend to resize the PTY.
type resizeMessage struct {
	Type string `json:"type"`
	Rows uint16 `json:"rows"`
	Cols uint16 `json:"cols"`
}

func (h *TerminalHandler) shell(w http.ResponseWriter, r *http.Request) {
	sessionID := chi.URLParam(r, "id")

	session, err := h.sessionSvc.GetByID(sessionID)
	if err != nil {
		writeError(w, http.StatusNotFound, "Session not found: "+err.Error())
		return
	}
	if session.WorktreePath == "" {
		writeError(w, http.StatusBadRequest, "Session has no worktree")
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("terminal.shell: WebSocket upgrade failed: %v", err)
		return
	}

	mpty, err := h.getOrCreateShell(sessionID, session.WorktreePath)
	if err != nil {
		log.Printf("terminal.shell: failed to spawn shell: %v", err)
		conn.WriteMessage(websocket.TextMessage, []byte("Error: "+err.Error()))
		conn.Close()
		return
	}

	h.attachConnection(conn, mpty)
}

func (h *TerminalHandler) agent(w http.ResponseWriter, r *http.Request) {
	sessionID := chi.URLParam(r, "id")

	session, err := h.sessionSvc.GetByID(sessionID)
	if err != nil {
		writeError(w, http.StatusNotFound, "Session not found: "+err.Error())
		return
	}
	if session.WorktreePath == "" {
		writeError(w, http.StatusBadRequest, "Session has no worktree")
		return
	}

	agent, err := h.agentSvc.GetByID(session.AgentID)
	if err != nil {
		writeError(w, http.StatusNotFound, "Agent not found: "+err.Error())
		return
	}

	// Build instructions with project commands.
	instructions := h.buildInstructions(session, agent.Instructions)

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("terminal.agent: WebSocket upgrade failed: %v", err)
		return
	}

	mpty, err := h.getOrCreateAgent(sessionID, session.WorktreePath, agent.CLIName, agent.Model, instructions)
	if err != nil {
		log.Printf("terminal.agent: failed to spawn agent: %v", err)
		conn.WriteMessage(websocket.TextMessage, []byte("Error: "+err.Error()))
		conn.Close()
		return
	}

	h.attachConnection(conn, mpty, sessionID)
}

func (h *TerminalHandler) reviewer(w http.ResponseWriter, r *http.Request) {
	sessionID := chi.URLParam(r, "id")

	session, err := h.sessionSvc.GetByID(sessionID)
	if err != nil {
		writeError(w, http.StatusNotFound, "Session not found: "+err.Error())
		return
	}
	if session.ReviewerAgentID == "" {
		writeError(w, http.StatusBadRequest, "No reviewer agent configured for this session")
		return
	}
	if session.WorktreePath == "" {
		writeError(w, http.StatusBadRequest, "Session has no worktree")
		return
	}

	agent, err := h.agentSvc.GetByID(session.ReviewerAgentID)
	if err != nil {
		writeError(w, http.StatusNotFound, "Reviewer agent not found: "+err.Error())
		return
	}

	instructions := h.buildInstructions(session, agent.Instructions)

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("terminal.reviewer: WebSocket upgrade failed: %v", err)
		return
	}

	mpty, err := h.getOrCreateReviewer(sessionID, session.WorktreePath, agent.CLIName, agent.Model, instructions)
	if err != nil {
		log.Printf("terminal.reviewer: failed to spawn reviewer: %v", err)
		conn.WriteMessage(websocket.TextMessage, []byte("Error: "+err.Error()))
		conn.Close()
		return
	}

	h.attachConnection(conn, mpty, sessionID)
}

func (h *TerminalHandler) sendReviewPrompt(w http.ResponseWriter, r *http.Request) {
	sessionID := chi.URLParam(r, "id")

	session, err := h.sessionSvc.GetByID(sessionID)
	if err != nil {
		writeError(w, http.StatusNotFound, "Session not found: "+err.Error())
		return
	}
	if session.ReviewerAgentID == "" {
		writeError(w, http.StatusBadRequest, "No reviewer agent configured")
		return
	}
	if session.WorktreePath == "" {
		writeError(w, http.StatusBadRequest, "Session has no worktree")
		return
	}

	agent, err := h.agentSvc.GetByID(session.ReviewerAgentID)
	if err != nil {
		writeError(w, http.StatusNotFound, "Reviewer agent not found: "+err.Error())
		return
	}

	// Get the diff.
	diff, err := h.gitSvc.Diff(session.WorktreePath, session.BaseBranch)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to get diff: "+err.Error())
		return
	}
	if diff == "" {
		writeError(w, http.StatusBadRequest, "No changes to review")
		return
	}

	// Reuse the same instruction builder as the interactive reviewer terminal.
	instructions := h.buildInstructions(session, agent.Instructions)

	// Get or create the reviewer PTY.
	mpty, err := h.getOrCreateReviewer(sessionID, session.WorktreePath, agent.CLIName, agent.Model, instructions)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to spawn reviewer: "+err.Error())
		return
	}

	// Truncate diff for the prompt.
	truncated := diff
	if len(truncated) > 30000 {
		truncated = truncated[:30000] + "\n... (truncated)"
	}

	prompt := fmt.Sprintf("Review the following changes. Flag bugs, security issues, and suggest improvements.\n\n```diff\n%s\n```\n", truncated)

	// Write the prompt to the reviewer PTY stdin.
	mpty.mu.Lock()
	_, writeErr := mpty.pty.PTY.Write([]byte(prompt + "\n"))
	mpty.mu.Unlock()

	if writeErr != nil {
		writeError(w, http.StatusInternalServerError, "Failed to send review prompt: "+writeErr.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "sent"})
}

// buildInstructions combines session context, project commands, and agent instructions.
func (h *TerminalHandler) buildInstructions(session *model.Session, agentInstructions string) string {
	var parts []string

	// Session context — branch info so the agent knows how to diff.
	parts = append(parts, "## Session Context")
	parts = append(parts, fmt.Sprintf("- Branch: `%s`", session.BranchName))
	parts = append(parts, fmt.Sprintf("- Base branch: `%s`", session.BaseBranch))
	parts = append(parts, fmt.Sprintf("- To see changes: `git diff %s`", session.BaseBranch))

	// Project commands.
	commands := session.Commands
	if len(commands) == 0 {
		project, err := h.projectSvc.GetByID(session.ProjectID)
		if err == nil {
			commands = project.Commands
		}
	}
	if len(commands) > 0 {
		parts = append(parts, "\n## Project Commands")
		for _, cmd := range commands {
			parts = append(parts, fmt.Sprintf("- %s: `%s`", cmd.Label, cmd.Command))
		}
		parts = append(parts, "\nUse these commands when working with this project.")
	}

	contextPrompt := ""
	for _, p := range parts {
		contextPrompt += p + "\n"
	}

	if agentInstructions != "" {
		return contextPrompt + "\n" + agentInstructions
	}
	return contextPrompt
}

func (h *TerminalHandler) runner(w http.ResponseWriter, r *http.Request) {
	sessionID := chi.URLParam(r, "id")

	session, err := h.sessionSvc.GetByID(sessionID)
	if err != nil {
		writeError(w, http.StatusNotFound, "Session not found: "+err.Error())
		return
	}
	if session.WorktreePath == "" {
		writeError(w, http.StatusBadRequest, "Session has no worktree")
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("terminal.runner: WebSocket upgrade failed: %v", err)
		return
	}

	mpty, err := h.getOrCreateRunner(sessionID, session.WorktreePath)
	if err != nil {
		log.Printf("terminal.runner: failed to spawn runner: %v", err)
		conn.WriteMessage(websocket.TextMessage, []byte("Error: "+err.Error()))
		conn.Close()
		return
	}

	h.attachConnection(conn, mpty)
}

func (h *TerminalHandler) runnerExec(w http.ResponseWriter, r *http.Request) {
	sessionID := chi.URLParam(r, "id")

	session, err := h.sessionSvc.GetByID(sessionID)
	if err != nil {
		writeError(w, http.StatusNotFound, "Session not found: "+err.Error())
		return
	}
	if session.WorktreePath == "" {
		writeError(w, http.StatusBadRequest, "Session has no worktree")
		return
	}

	var req struct {
		Command string `json:"command"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Command == "" {
		writeError(w, http.StatusBadRequest, "Missing command")
		return
	}

	mpty, err := h.getOrCreateRunner(sessionID, session.WorktreePath)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to get runner: "+err.Error())
		return
	}

	mpty.mu.Lock()
	_, writeErr := mpty.pty.PTY.Write([]byte(req.Command + "\n"))
	mpty.mu.Unlock()

	if writeErr != nil {
		writeError(w, http.StatusInternalServerError, "Failed to send command: "+writeErr.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "sent"})
}

func (h *TerminalHandler) runnerStop(w http.ResponseWriter, r *http.Request) {
	sessionID := chi.URLParam(r, "id")

	h.mu.Lock()
	mpty, ok := h.runners[sessionID]
	h.mu.Unlock()

	if !ok {
		writeError(w, http.StatusNotFound, "No runner process for this session")
		return
	}

	// Send SIGINT to the process group to stop the running command.
	if mpty.pty.CMD != nil && mpty.pty.CMD.Process != nil {
		// Send to process group so child processes also get the signal.
		pgid, err := syscall.Getpgid(mpty.pty.CMD.Process.Pid)
		if err == nil {
			syscall.Kill(-pgid, syscall.SIGINT)
		} else {
			mpty.pty.CMD.Process.Signal(syscall.SIGINT)
		}
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "stopped"})
}

func (h *TerminalHandler) getOrCreateRunner(sessionID, workDir string) (*managedPTY, error) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if existing, ok := h.runners[sessionID]; ok {
		return existing, nil
	}

	ptySess, err := h.ptySvc.SpawnShell(workDir)
	if err != nil {
		return nil, err
	}

	mpty := &managedPTY{pty: ptySess}
	h.runners[sessionID] = mpty

	go h.readLoop(mpty, h.runners, sessionID)

	return mpty, nil
}

func (h *TerminalHandler) getOrCreateShell(sessionID, workDir string) (*managedPTY, error) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if existing, ok := h.shells[sessionID]; ok {
		return existing, nil
	}

	ptySess, err := h.ptySvc.SpawnShell(workDir)
	if err != nil {
		return nil, err
	}

	mpty := &managedPTY{pty: ptySess}
	h.shells[sessionID] = mpty

	// Start the single reader goroutine for this PTY.
	go h.readLoop(mpty, h.shells, sessionID)

	return mpty, nil
}

func (h *TerminalHandler) getOrCreateAgent(sessionID, workDir, cliName, model, instructions string) (*managedPTY, error) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if existing, ok := h.agents[sessionID]; ok {
		return existing, nil
	}

	provider := h.providers.Get(cliName)

	artifacts, err := provider.SetupHooks(sessionID, "agent", workDir, h.callbackURL, instructions, true)
	if err != nil {
		log.Printf("terminal: failed to setup hooks for %s: %v", cliName, err)
		artifacts = &service.LaunchArtifacts{}
	}

	cfg := service.LaunchConfig{
		Model:        model,
		Instructions: instructions,
		Artifacts:    artifacts,
	}

	ptySess, err := h.ptySvc.SpawnAgent(workDir, provider, cfg)
	if err != nil {
		return nil, err
	}

	mpty := &managedPTY{pty: ptySess}
	h.agents[sessionID] = mpty

	go h.readLoop(mpty, h.agents, sessionID)

	return mpty, nil
}

func (h *TerminalHandler) getOrCreateReviewer(sessionID, workDir, cliName, model, instructions string) (*managedPTY, error) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if existing, ok := h.reviewers[sessionID]; ok {
		return existing, nil
	}

	provider := h.providers.Get(cliName)

	// Reviewer PTYs: enable hooks with slot=reviewer so status goes to reviewer_status.
	artifacts, err := provider.SetupHooks(sessionID, "reviewer", workDir, h.callbackURL, instructions, true)
	if err != nil {
		log.Printf("terminal: failed to setup reviewer hooks for %s: %v", cliName, err)
		artifacts = &service.LaunchArtifacts{}
	}

	cfg := service.LaunchConfig{
		Model:        model,
		Instructions: instructions,
		Artifacts:    artifacts,
	}

	ptySess, err := h.ptySvc.SpawnAgent(workDir, provider, cfg)
	if err != nil {
		return nil, err
	}

	mpty := &managedPTY{pty: ptySess}
	h.reviewers[sessionID] = mpty

	go h.readLoop(mpty, h.reviewers, sessionID)

	return mpty, nil
}

// readLoop is the single goroutine that reads from PTY and writes to the active WebSocket.
func (h *TerminalHandler) readLoop(mpty *managedPTY, registry map[string]*managedPTY, sessionID string) {
	buf := make([]byte, 4096)
	for {
		n, err := mpty.pty.PTY.Read(buf)
		if err != nil {
			if err != io.EOF {
				log.Printf("terminal: PTY read error for session %s: %v", sessionID, err)
			}

			// PTY closed — notify active connection and clean up.
			mpty.mu.Lock()
			if mpty.conn != nil {
				mpty.conn.WriteMessage(websocket.TextMessage, []byte("\r\n\x1b[90m--- Process exited ---\x1b[0m\r\n"))
			}
			mpty.mu.Unlock()

			h.mu.Lock()
			delete(registry, sessionID)
			h.mu.Unlock()
			return
		}

		data := buf[:n]

		// Append to scrollback.
		mpty.mu.Lock()
		mpty.scrollback = append(mpty.scrollback, data...)
		if len(mpty.scrollback) > maxScrollback {
			mpty.scrollback = mpty.scrollback[len(mpty.scrollback)-maxScrollback:]
		}

		// Write to active connection.
		if mpty.conn != nil {
			if err := mpty.conn.WriteMessage(websocket.BinaryMessage, data); err != nil {
				// Connection broken, clear it.
				mpty.conn = nil
			}
		}
		mpty.mu.Unlock()
	}
}

// attachConnection replaces the active WebSocket connection on a managed PTY.
// Sends the scrollback buffer to the new connection and starts reading input from it.
// sessionID is used to update status on interrupt signals (Ctrl+C, double Escape).
func (h *TerminalHandler) attachConnection(conn *websocket.Conn, mpty *managedPTY, sessionID ...string) {
	// Close previous connection if any.
	mpty.mu.Lock()
	if mpty.conn != nil {
		mpty.conn.Close()
	}

	// Send scrollback to the new connection.
	if len(mpty.scrollback) > 0 {
		conn.WriteMessage(websocket.BinaryMessage, mpty.scrollback)
	}

	mpty.conn = conn
	mpty.mu.Unlock()

	// Read input from WebSocket -> PTY. This blocks until the connection closes.
	defer func() {
		mpty.mu.Lock()
		if mpty.conn == conn {
			mpty.conn = nil
		}
		mpty.mu.Unlock()
		conn.Close()
	}()

	for {
		msgType, msg, err := conn.ReadMessage()
		if err != nil {
			return
		}

		// Check for resize messages.
		if msgType == websocket.TextMessage {
			var resize resizeMessage
			if json.Unmarshal(msg, &resize) == nil && resize.Type == "resize" {
				h.ptySvc.Resize(mpty.pty, resize.Rows, resize.Cols)
				continue
			}
		}

		// Detect interrupt signals → set session to idle.
		if len(sessionID) > 0 && sessionID[0] != "" {
			isInterrupt := false
			// Ctrl+C
			if len(msg) == 1 && msg[0] == 0x03 {
				isInterrupt = true
			}
			// Double Escape (sent rapidly)
			if len(msg) >= 1 && msg[0] == 0x1b {
				isInterrupt = true
			}
			if isInterrupt {
				go h.sessionSvc.UpdateStatus(sessionID[0], model.SessionStatusIdle)
			}
		}

		if _, err := mpty.pty.PTY.Write(msg); err != nil {
			return
		}
	}
}

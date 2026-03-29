package server

import (
	"database/sql"
	"fmt"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/raznak/abbado/internal/handler"
	"github.com/raznak/abbado/internal/service"
)

// New creates and configures the HTTP server with all routes.
func New(db *sql.DB, port string) http.Handler {
	r := chi.NewRouter()

	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(corsMiddleware)

	callbackURL := fmt.Sprintf("http://localhost:%s", port)

	// Provider registry — add new providers here.
	providers := service.NewProviderRegistry()

	// Services
	agentSvc := service.NewAgentService(db)
	projectSvc := service.NewProjectService(db)
	sessionSvc := service.NewSessionService(db)
	gitSvc := service.NewGitService()
	ptySvc := service.NewPTYService()
	aiSvc := service.NewAIService(providers)
	eventSvc := service.NewEventService(db)
	promptSvc := service.NewPromptService(db)
	eventBus := service.NewEventBus()

	// Handlers
	agentHandler := handler.NewAgentHandler(agentSvc)
	projectHandler := handler.NewProjectHandler(projectSvc, gitSvc)
	sessionHandler := handler.NewSessionHandler(sessionSvc, projectSvc, gitSvc, providers)
	terminalHandler := handler.NewTerminalHandler(sessionSvc, agentSvc, projectSvc, ptySvc, providers, gitSvc, callbackURL)
	changesHandler := handler.NewChangesHandler(sessionSvc, projectSvc, gitSvc, aiSvc)
	hooksHandler := handler.NewHooksHandler(sessionSvc, eventSvc, promptSvc, eventBus)
	fsHandler := handler.NewFilesystemHandler()

	// Routes
	r.Get("/api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok"}`))
	})

	r.Route("/api/agents", agentHandler.Routes)
	r.Route("/api/projects", projectHandler.Routes)
	r.Route("/api/sessions", func(sr chi.Router) {
		sessionHandler.Routes(sr)
		terminalHandler.Routes(sr)
		changesHandler.Routes(sr)
		hooksHandler.Routes(sr)
	})
	r.Get("/api/filesystem/dirs", fsHandler.ListDirs)

	// Serve embedded frontend for non-API routes (production build).
	r.NotFound(frontendHandler().ServeHTTP)

	return r
}

// corsMiddleware allows the Vite dev server to call the API.
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

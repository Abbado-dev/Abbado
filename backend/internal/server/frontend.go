package server

import (
	"embed"
	"io/fs"
	"net/http"
	"strings"
)

//go:embed all:frontend
var frontendFS embed.FS

// frontendHandler serves the embedded frontend, falling back to index.html for SPA routes.
func frontendHandler() http.Handler {
	dist, err := fs.Sub(frontendFS, "frontend")
	if err != nil {
		panic("failed to open embedded frontend: " + err.Error())
	}

	fileServer := http.FileServer(http.FS(dist))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Try to serve the file directly.
		path := strings.TrimPrefix(r.URL.Path, "/")
		if path == "" {
			path = "index.html"
		}

		if _, err := fs.Stat(dist, path); err == nil {
			fileServer.ServeHTTP(w, r)
			return
		}

		// SPA fallback: serve index.html for non-file routes.
		r.URL.Path = "/"
		fileServer.ServeHTTP(w, r)
	})
}

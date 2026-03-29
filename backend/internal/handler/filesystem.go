package handler

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

// FilesystemHandler handles filesystem browsing for path autocomplete.
type FilesystemHandler struct{}

// NewFilesystemHandler creates a new FilesystemHandler.
func NewFilesystemHandler() *FilesystemHandler {
	return &FilesystemHandler{}
}

type dirEntry struct {
	Name  string `json:"name"`
	Path  string `json:"path"`
	IsGit bool   `json:"is_git"`
}

// ListDirs returns directories matching a partial path prefix.
// GET /api/filesystem/dirs?path=/Users/foo/co
func (h *FilesystemHandler) ListDirs(w http.ResponseWriter, r *http.Request) {
	input := r.URL.Query().Get("path")
	if input == "" {
		home, err := os.UserHomeDir()
		if err != nil {
			writeError(w, http.StatusInternalServerError, "Failed to get home directory: "+err.Error())
			return
		}
		input = home
	}

	// Expand ~ to home directory.
	if strings.HasPrefix(input, "~") {
		home, err := os.UserHomeDir()
		if err != nil {
			writeError(w, http.StatusInternalServerError, "Failed to expand home directory: "+err.Error())
			return
		}
		input = filepath.Join(home, input[1:])
	}

	// Determine the directory to list and the prefix to filter by.
	dir := input
	prefix := ""

	info, err := os.Stat(input)
	if err != nil || !info.IsDir() {
		// Input is a partial path — list parent and filter.
		dir = filepath.Dir(input)
		prefix = filepath.Base(input)
	}

	entries, err := os.ReadDir(dir)
	if err != nil {
		writeJSON(w, http.StatusOK, []dirEntry{})
		return
	}

	var results []dirEntry
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		// Skip hidden directories unless user is typing one.
		if strings.HasPrefix(entry.Name(), ".") && !strings.HasPrefix(prefix, ".") {
			continue
		}
		if prefix != "" && !strings.HasPrefix(strings.ToLower(entry.Name()), strings.ToLower(prefix)) {
			continue
		}

		fullPath := filepath.Join(dir, entry.Name())
		_, gitErr := os.Stat(filepath.Join(fullPath, ".git"))
		results = append(results, dirEntry{
			Name:  entry.Name(),
			Path:  fullPath,
			IsGit: gitErr == nil,
		})

		if len(results) >= 20 {
			break
		}
	}

	writeJSON(w, http.StatusOK, results)
}

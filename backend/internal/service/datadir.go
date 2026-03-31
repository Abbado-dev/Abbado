package service

import (
	"os"
	"path/filepath"
)

// dataDir is set by the server at startup.
var dataDir string

// SetDataDir configures the data directory for services.
func SetDataDir(dir string) {
	dataDir = dir
}

// DataDir returns the data directory. Falls back to ~/.abbado if not set.
func DataDir() string {
	if dataDir != "" {
		return dataDir
	}
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".abbado")
}

package service

import (
	"fmt"
	"os"
	"os/exec"

	"github.com/creack/pty"
)

// PTYService manages pseudo-terminal sessions.
type PTYService struct{}

// NewPTYService creates a new PTYService.
func NewPTYService() *PTYService {
	return &PTYService{}
}

// PTYSession represents a running PTY process.
type PTYSession struct {
	PTY *os.File
	CMD *exec.Cmd
}

// SpawnShell starts an interactive shell in the given directory.
func (s *PTYService) SpawnShell(workDir string) (*PTYSession, error) {
	shell := os.Getenv("SHELL")
	if shell == "" {
		shell = "/bin/zsh"
	}

	cmd := exec.Command(shell, "-l")
	cmd.Dir = workDir
	cmd.Env = buildBaseEnv(nil)

	ptmx, err := pty.Start(cmd)
	if err != nil {
		return nil, fmt.Errorf("pty.SpawnShell: failed to start shell in %s: %w", workDir, err)
	}

	return &PTYSession{PTY: ptmx, CMD: cmd}, nil
}

// SpawnAgent starts an AI agent CLI in the given directory using the provider.
func (s *PTYService) SpawnAgent(workDir string, provider Provider, cfg LaunchConfig) (*PTYSession, error) {
	cmd := provider.BuildCommand(workDir, cfg)

	ptmx, err := pty.Start(cmd)
	if err != nil {
		return nil, fmt.Errorf("pty.SpawnAgent: failed to start %s in %s: %w", provider.ID(), workDir, err)
	}

	return &PTYSession{PTY: ptmx, CMD: cmd}, nil
}

// Resize changes the PTY window size.
func (s *PTYService) Resize(session *PTYSession, rows, cols uint16) error {
	return pty.Setsize(session.PTY, &pty.Winsize{Rows: rows, Cols: cols})
}

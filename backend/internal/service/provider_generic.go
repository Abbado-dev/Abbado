package service

import (
	"context"
	"fmt"
	"os/exec"
)

// GenericProvider is a fallback for unknown CLI agents.
// It launches the CLI by name with no hooks or special setup.
type GenericProvider struct {
	CLIName string
}

func (p *GenericProvider) ID() string { return p.CLIName }

func (p *GenericProvider) BuildCommand(workDir string, cfg LaunchConfig) *exec.Cmd {
	args := []string{p.CLIName}
	if cfg.Model != "" {
		args = append(args, "--model", cfg.Model)
	}

	cmd := exec.Command(args[0], args[1:]...)
	cmd.Dir = workDir
	cmd.Env = buildBaseEnv(nil)
	return cmd
}

func (p *GenericProvider) SetupHooks(sessionID, slot, workDir, callbackURL, instructions string, enableCallbacks bool) (*LaunchArtifacts, error) {
	return &LaunchArtifacts{}, nil
}

func (p *GenericProvider) Cleanup(sessionID string) {}

func (p *GenericProvider) OneShot(ctx context.Context, workDir, model, prompt string) (string, error) {
	return "", fmt.Errorf("oneshot not supported for provider %s", p.CLIName)
}

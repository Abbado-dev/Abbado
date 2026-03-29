package service

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
)

// ClaudeCodeProvider implements Provider for Anthropic's Claude Code CLI.
type ClaudeCodeProvider struct{}

func (p *ClaudeCodeProvider) ID() string { return "claude-code" }

func (p *ClaudeCodeProvider) BuildCommand(workDir string, cfg LaunchConfig) *exec.Cmd {
	args := []string{"claude"}
	if cfg.Artifacts != nil && cfg.Artifacts.HooksSettingsPath != "" {
		args = append(args, "--settings", cfg.Artifacts.HooksSettingsPath)
	}
	if cfg.Model != "" {
		args = append(args, "--model", cfg.Model)
	}
	if cfg.Instructions != "" {
		args = append(args, "--append-system-prompt", cfg.Instructions)
	}

	cmd := exec.Command(args[0], args[1:]...)
	cmd.Dir = workDir
	cmd.Env = buildBaseEnv(nil)
	return cmd
}

func (p *ClaudeCodeProvider) SetupHooks(sessionID, slot, workDir, callbackURL, instructions string, enableCallbacks bool) (*LaunchArtifacts, error) {
	if !enableCallbacks {
		return &LaunchArtifacts{}, nil
	}

	home, err := os.UserHomeDir()
	if err != nil {
		return nil, fmt.Errorf("claude: failed to get home dir: %w", err)
	}

	dir := filepath.Join(home, ".abbado", "hooks", sessionID, slot)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, fmt.Errorf("claude: failed to create hooks dir: %w", err)
	}

	settingsPath := filepath.Join(dir, "settings.json")
	hookURL := fmt.Sprintf("%s/api/sessions/%s/hook", callbackURL, sessionID)

	mkCmd := func(jqExpr string) string {
		return fmt.Sprintf(`INPUT=$(cat); PAYLOAD=$(echo "$INPUT" | jq -c '%s'); curl -s -X POST %s -H "Content-Type: application/json" -d "$PAYLOAD"`, jqExpr, hookURL)
	}

	settings := hooksSettings{
		Hooks: map[string][]hookMatcher{
			"UserPromptSubmit": {{Hooks: []hookEntry{{
				Type: "command", Command: mkCmd(`{event: "prompt_submit", payload: (.prompt // "" | .[0:2000])}`), Timeout: 5000,
			}}}},
			"Stop": {{Hooks: []hookEntry{{
				Type: "command", Command: mkCmd(`{event: "stop", payload: (.stop_reason // "")}`), Timeout: 5000,
			}}}},
			"Notification": {{Hooks: []hookEntry{{
				Type: "command", Command: mkCmd(`{event: "notification", payload: (.notification_type // "")}`), Timeout: 5000,
			}}}},
			"PreToolUse": {{Hooks: []hookEntry{{
				Type: "command", Command: mkCmd(`{event: "tool_use", payload: (.tool_name // "")}`), Timeout: 5000,
			}}}},
		},
	}

	data, err := json.MarshalIndent(settings, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("claude: failed to marshal settings: %w", err)
	}
	if err := os.WriteFile(settingsPath, data, 0o644); err != nil {
		return nil, fmt.Errorf("claude: failed to write settings: %w", err)
	}

	return &LaunchArtifacts{HooksSettingsPath: settingsPath}, nil
}

func (p *ClaudeCodeProvider) Cleanup(sessionID string) {
	home, _ := os.UserHomeDir()
	if home != "" {
		os.RemoveAll(filepath.Join(home, ".abbado", "hooks", sessionID))
	}
}

func (p *ClaudeCodeProvider) OneShot(ctx context.Context, model, prompt string) (string, error) {
	args := []string{"claude", "-p", "--output-format", "text"}
	if model != "" {
		args = append(args, "--model", model)
	}
	return runOneShot(ctx, args, prompt)
}

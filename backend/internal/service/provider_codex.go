package service

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
)

// CodexProvider implements Provider for OpenAI's Codex CLI.
type CodexProvider struct{}

func (p *CodexProvider) ID() string { return "codex" }

func (p *CodexProvider) BuildCommand(workDir string, cfg LaunchConfig) *exec.Cmd {
	args := []string{"codex"}
	if cfg.Model != "" {
		args = append(args, "--model", cfg.Model)
	}
	if cfg.Artifacts != nil && cfg.Artifacts.ModelInstructionsFile != "" {
		args = append(args, "-c", fmt.Sprintf("model_instructions_file=%q", cfg.Artifacts.ModelInstructionsFile))
	}

	cmd := exec.Command(args[0], args[1:]...)
	cmd.Dir = workDir

	extra := make(map[string]string)
	if cfg.Artifacts != nil && cfg.Artifacts.CodexHome != "" {
		extra["CODEX_HOME"] = cfg.Artifacts.CodexHome
	}
	cmd.Env = buildBaseEnv(extra)
	return cmd
}

func (p *CodexProvider) SetupHooks(sessionID, slot, workDir, callbackURL, instructions string, enableCallbacks bool) (*LaunchArtifacts, error) {
	if sessionID == "" || slot == "" {
		return nil, fmt.Errorf("codex: sessionID and slot are required")
	}

	home, _ := os.UserHomeDir()

	slotDir := filepath.Join(DataDir(), "hooks", sessionID, slot)
	if err := os.MkdirAll(slotDir, 0o755); err != nil {
		return nil, fmt.Errorf("codex: failed to create slot dir: %w", err)
	}

	codexHome := filepath.Join(slotDir, "codex-home")
	if err := os.MkdirAll(codexHome, 0o755); err != nil {
		return nil, fmt.Errorf("codex: failed to create codex home: %w", err)
	}

	if err := p.seedCodexHome(home, codexHome, workDir); err != nil {
		return nil, err
	}

	var instructionsPath string
	if instructions != "" {
		instructionsPath = filepath.Join(slotDir, "model-instructions.md")
		if err := os.WriteFile(instructionsPath, []byte(instructions), 0o644); err != nil {
			return nil, fmt.Errorf("codex: failed to write instructions: %w", err)
		}
	}

	if enableCallbacks {
		hookURL := fmt.Sprintf("%s/api/sessions/%s/hook", callbackURL, sessionID)
		hookScriptPath := filepath.Join(slotDir, "codex-hook.sh")
		if err := os.WriteFile(hookScriptPath, []byte(codexHookScriptContent), 0o755); err != nil {
			return nil, fmt.Errorf("codex: failed to write hook script: %w", err)
		}

		settings := hooksSettings{
			Hooks: map[string][]hookMatcher{
				"UserPromptSubmit": {{Hooks: []hookEntry{{Type: "command", Command: p.hookCmd(hookScriptPath, "prompt_submit", hookURL)}}}},
				"Stop":             {{Hooks: []hookEntry{{Type: "command", Command: p.hookCmd(hookScriptPath, "stop", hookURL)}}}},
				"PreToolUse":       {{Hooks: []hookEntry{{Type: "command", Command: p.hookCmd(hookScriptPath, "tool_use", hookURL)}}}},
			},
		}

		data, err := json.MarshalIndent(settings, "", "  ")
		if err != nil {
			return nil, fmt.Errorf("codex: failed to marshal hooks: %w", err)
		}
		if err := os.WriteFile(filepath.Join(codexHome, "hooks.json"), data, 0o644); err != nil {
			return nil, fmt.Errorf("codex: failed to write hooks: %w", err)
		}
	}

	return &LaunchArtifacts{
		CodexHome:             codexHome,
		ModelInstructionsFile: instructionsPath,
	}, nil
}

func (p *CodexProvider) Cleanup(sessionID string) {
	os.RemoveAll(filepath.Join(DataDir(), "hooks", sessionID))
}

func (p *CodexProvider) OneShot(ctx context.Context, workDir, model, prompt string) (string, error) {
	args := []string{"codex", "-q"}
	if model != "" {
		args = append(args, "--model", model)
	}
	return runOneShot(ctx, workDir, args, prompt)
}

func (p *CodexProvider) hookCmd(scriptPath, event, hookURL string) string {
	q := func(s string) string { return "'" + strings.ReplaceAll(s, "'", "'\"'\"'") + "'" }
	return fmt.Sprintf("%s %s %s", q(scriptPath), q(event), q(hookURL))
}

func (p *CodexProvider) seedCodexHome(userHome, codexHome, workDir string) error {
	sourceDir := filepath.Join(userHome, ".codex")
	for _, name := range []string{"auth.json", "config.toml", "models_cache.json", "version.json"} {
		src := filepath.Join(sourceDir, name)
		dst := filepath.Join(codexHome, name)
		data, err := os.ReadFile(src)
		if err != nil {
			if os.IsNotExist(err) {
				continue
			}
			return fmt.Errorf("codex: failed to read %s: %w", name, err)
		}
		if err := os.WriteFile(dst, data, 0o644); err != nil {
			return fmt.Errorf("codex: failed to write %s: %w", name, err)
		}
	}

	configPath := filepath.Join(codexHome, "config.toml")
	var data []byte
	if existing, err := os.ReadFile(configPath); err == nil {
		data = existing
	}
	projectSection := fmt.Sprintf("[projects.%s]", strconv.Quote(workDir))
	if !strings.Contains(string(data), projectSection) {
		if len(data) > 0 && !strings.HasSuffix(string(data), "\n") {
			data = append(data, '\n')
		}
		data = append(data, []byte("\n"+projectSection+"\ntrust_level = \"trusted\"\n")...)
		if err := os.WriteFile(configPath, data, 0o644); err != nil {
			return fmt.Errorf("codex: failed to update config: %w", err)
		}
	}

	return nil
}

const codexHookScriptContent = `#!/bin/sh
set -eu
event="$1"
url="$2"
input="$(cat)"
case "$event" in
  prompt_submit) payload="$(printf '%s' "$input" | jq -c '{event: "prompt_submit", payload: (.prompt // "" | .[0:2000])}')" ;;
  stop) payload="$(printf '%s' "$input" | jq -c '{event: "stop", payload: (.last_assistant_message // "" | .[0:2000])}')" ;;
  tool_use) payload="$(printf '%s' "$input" | jq -c '{event: "tool_use", payload: (.tool_input.command // .tool_name // "" | .[0:2000])}')" ;;
  *) exit 0 ;;
esac
curl -s -X POST "$url" -H "Content-Type: application/json" -d "$payload" >/dev/null
`

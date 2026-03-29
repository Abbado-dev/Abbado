package service

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestCodexProviderSetupHooks(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)

	codexDir := filepath.Join(home, ".codex")
	if err := os.MkdirAll(codexDir, 0o755); err != nil {
		t.Fatalf("MkdirAll(.codex) failed: %v", err)
	}

	seedFiles := map[string]string{
		"auth.json":         `{"provider":"chatgpt"}`,
		"config.toml":       "personality = \"pragmatic\"\n",
		"models_cache.json": `{"models":[]}`,
		"version.json":      `{"latest_version":"0.117.0"}`,
	}
	for name, contents := range seedFiles {
		if err := os.WriteFile(filepath.Join(codexDir, name), []byte(contents), 0o644); err != nil {
			t.Fatalf("WriteFile(%s) failed: %v", name, err)
		}
	}

	provider := &CodexProvider{}
	workDir := "/tmp/project-worktree"
	artifacts, err := provider.SetupHooks("session-123", "agent", workDir, "http://localhost:7777", "Follow project rules.", true)
	if err != nil {
		t.Fatalf("SetupHooks() failed: %v", err)
	}

	if artifacts.CodexHome == "" {
		t.Fatal("CodexHome should not be empty")
	}
	if artifacts.ModelInstructionsFile == "" {
		t.Fatal("ModelInstructionsFile should not be empty")
	}

	instructions, err := os.ReadFile(artifacts.ModelInstructionsFile)
	if err != nil {
		t.Fatalf("ReadFile(instructions) failed: %v", err)
	}
	if string(instructions) != "Follow project rules." {
		t.Errorf("instructions = %q, want %q", string(instructions), "Follow project rules.")
	}

	for _, name := range []string{"auth.json", "config.toml", "models_cache.json", "version.json"} {
		if _, err := os.Stat(filepath.Join(artifacts.CodexHome, name)); err != nil {
			t.Fatalf("expected seeded file %s: %v", name, err)
		}
	}

	configToml, err := os.ReadFile(filepath.Join(artifacts.CodexHome, "config.toml"))
	if err != nil {
		t.Fatalf("ReadFile(config.toml) failed: %v", err)
	}
	if !strings.Contains(string(configToml), `[projects."/tmp/project-worktree"]`) {
		t.Errorf("config.toml missing trusted project entry: %s", string(configToml))
	}

	hooksData, err := os.ReadFile(filepath.Join(artifacts.CodexHome, "hooks.json"))
	if err != nil {
		t.Fatalf("ReadFile(hooks.json) failed: %v", err)
	}

	var parsed struct {
		Hooks map[string][]struct {
			Hooks []struct {
				Type    string `json:"type"`
				Command string `json:"command"`
			} `json:"hooks"`
		} `json:"hooks"`
	}
	if err := json.Unmarshal(hooksData, &parsed); err != nil {
		t.Fatalf("json.Unmarshal(hooks.json) failed: %v", err)
	}

	for _, event := range []string{"UserPromptSubmit", "PreToolUse", "Stop"} {
		entries := parsed.Hooks[event]
		if len(entries) != 1 || len(entries[0].Hooks) != 1 {
			t.Fatalf("hooks[%s] malformed: %+v", event, entries)
		}
		if entries[0].Hooks[0].Type != "command" {
			t.Errorf("hooks[%s][0].type = %q, want command", event, entries[0].Hooks[0].Type)
		}
	}
}

func TestClaudeProviderSetupHooks(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)

	provider := &ClaudeCodeProvider{}
	artifacts, err := provider.SetupHooks("session-456", "agent", "/tmp/workdir", "http://localhost:7777", "", true)
	if err != nil {
		t.Fatalf("SetupHooks() failed: %v", err)
	}

	if artifacts.HooksSettingsPath == "" {
		t.Fatal("HooksSettingsPath should not be empty")
	}

	data, err := os.ReadFile(artifacts.HooksSettingsPath)
	if err != nil {
		t.Fatalf("ReadFile(settings) failed: %v", err)
	}
	if !strings.Contains(string(data), "prompt_submit") {
		t.Error("settings.json missing prompt_submit hook")
	}
}

func TestClaudeProviderSetupHooksDisabled(t *testing.T) {
	provider := &ClaudeCodeProvider{}
	artifacts, err := provider.SetupHooks("session-789", "reviewer", "/tmp/workdir", "http://localhost:7777", "", false)
	if err != nil {
		t.Fatalf("SetupHooks() failed: %v", err)
	}

	if artifacts.HooksSettingsPath != "" {
		t.Error("HooksSettingsPath should be empty when callbacks disabled")
	}
}

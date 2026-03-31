package service

import (
	"strings"
	"testing"
)

func TestClaudeProviderBuildCommand(t *testing.T) {
	provider := &ClaudeCodeProvider{}

	cmd := provider.BuildCommand("/tmp/workdir", LaunchConfig{
		Model:        "claude-sonnet-4-6",
		Instructions: "Be precise",
		Artifacts: &LaunchArtifacts{
			Args: []string{"--settings", "/tmp/claude-settings.json"},
		},
	})

	wantArgs := []string{
		"claude",
		"--settings", "/tmp/claude-settings.json",
		"--model", "claude-sonnet-4-6",
		"--append-system-prompt", "Be precise",
	}

	if len(cmd.Args) != len(wantArgs) {
		t.Fatalf("Args length = %d, want %d (%v)", len(cmd.Args), len(wantArgs), cmd.Args)
	}
	for i, want := range wantArgs {
		if cmd.Args[i] != want {
			t.Errorf("Args[%d] = %q, want %q", i, cmd.Args[i], want)
		}
	}
	if cmd.Dir != "/tmp/workdir" {
		t.Errorf("Dir = %q, want %q", cmd.Dir, "/tmp/workdir")
	}
	if envContainsPrefix(cmd.Env, "CODEX_HOME=") {
		t.Errorf("Claude env should not contain CODEX_HOME")
	}
}

func TestCodexProviderBuildCommand(t *testing.T) {
	provider := &CodexProvider{}

	cmd := provider.BuildCommand("/tmp/workdir", LaunchConfig{
		Model: "gpt-5.4",
		Artifacts: &LaunchArtifacts{
			Args: []string{"-c", `model_instructions_file="/tmp/instructions.md"`},
			Env:  map[string]string{"CODEX_HOME": "/tmp/codex-home"},
		},
	})

	wantArgs := []string{
		"codex",
		"--model", "gpt-5.4",
		"-c", `model_instructions_file="/tmp/instructions.md"`,
	}

	if len(cmd.Args) != len(wantArgs) {
		t.Fatalf("Args length = %d, want %d (%v)", len(cmd.Args), len(wantArgs), cmd.Args)
	}
	for i, want := range wantArgs {
		if cmd.Args[i] != want {
			t.Errorf("Args[%d] = %q, want %q", i, cmd.Args[i], want)
		}
	}
	if !envContains(cmd.Env, "CODEX_HOME=/tmp/codex-home") {
		t.Errorf("Env missing CODEX_HOME")
	}
}

func TestGenericProviderBuildCommand(t *testing.T) {
	provider := &GenericProvider{CLIName: "mistral"}

	cmd := provider.BuildCommand("/tmp/workdir", LaunchConfig{
		Model: "mistral-large",
	})

	if cmd.Args[0] != "mistral" {
		t.Errorf("Args[0] = %q, want %q", cmd.Args[0], "mistral")
	}
	if cmd.Dir != "/tmp/workdir" {
		t.Errorf("Dir = %q, want %q", cmd.Dir, "/tmp/workdir")
	}
}

func TestProviderRegistry(t *testing.T) {
	registry := NewProviderRegistry()

	claude := registry.Get("claude-code")
	if claude.ID() != "claude-code" {
		t.Errorf("Get(claude-code).ID() = %q", claude.ID())
	}

	codex := registry.Get("codex")
	if codex.ID() != "codex" {
		t.Errorf("Get(codex).ID() = %q", codex.ID())
	}

	// Unknown provider falls back to generic.
	unknown := registry.Get("mistral")
	if unknown.ID() != "mistral" {
		t.Errorf("Get(mistral).ID() = %q", unknown.ID())
	}
}

func envContains(env []string, expected string) bool {
	for _, entry := range env {
		if entry == expected {
			return true
		}
	}
	return false
}

func envContainsPrefix(env []string, prefix string) bool {
	for _, entry := range env {
		if strings.HasPrefix(entry, prefix) {
			return true
		}
	}
	return false
}

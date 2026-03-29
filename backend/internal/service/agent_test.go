package service

import (
	"path/filepath"
	"testing"

	"github.com/raznak/abbado/internal/database"
)

func setupTestDB(t *testing.T) *database.TestDB {
	t.Helper()
	dir := t.TempDir()
	dbPath := filepath.Join(dir, "test.db")
	db, err := database.Open(dbPath)
	if err != nil {
		t.Fatalf("Failed to open test DB: %v", err)
	}
	t.Cleanup(func() { db.Close() })
	return &database.TestDB{DB: db}
}

func TestAgentCRUD(t *testing.T) {
	tdb := setupTestDB(t)
	svc := NewAgentService(tdb.DB)

	// Create
	agent, err := svc.Create("Test Agent", "claude-code", "claude-sonnet-4-6", "Be helpful")
	if err != nil {
		t.Fatalf("Create() failed: %v", err)
	}
	if agent.Name != "Test Agent" {
		t.Errorf("Name = %q, want %q", agent.Name, "Test Agent")
	}
	if agent.CLIName != "claude-code" {
		t.Errorf("CLIName = %q, want %q", agent.CLIName, "claude-code")
	}
	if agent.Model != "claude-sonnet-4-6" {
		t.Errorf("Model = %q, want %q", agent.Model, "claude-sonnet-4-6")
	}

	// List
	agents, err := svc.List()
	if err != nil {
		t.Fatalf("List() failed: %v", err)
	}
	if len(agents) != 1 {
		t.Fatalf("List() returned %d agents, want 1", len(agents))
	}

	// GetByID
	fetched, err := svc.GetByID(agent.ID)
	if err != nil {
		t.Fatalf("GetByID() failed: %v", err)
	}
	if fetched.ID != agent.ID {
		t.Errorf("ID mismatch: got %s, want %s", fetched.ID, agent.ID)
	}

	// Update
	updated, err := svc.Update(agent.ID, "Updated Agent", "codex", "gpt-5.4", "New instructions")
	if err != nil {
		t.Fatalf("Update() failed: %v", err)
	}
	if updated.Name != "Updated Agent" {
		t.Errorf("Updated Name = %q, want %q", updated.Name, "Updated Agent")
	}
	if updated.CLIName != "codex" {
		t.Errorf("Updated CLIName = %q, want %q", updated.CLIName, "codex")
	}

	// Delete
	if err := svc.Delete(agent.ID); err != nil {
		t.Fatalf("Delete() failed: %v", err)
	}
	agents, _ = svc.List()
	if len(agents) != 0 {
		t.Errorf("List() after Delete returned %d agents, want 0", len(agents))
	}
}

func TestAgentCreateValidation(t *testing.T) {
	tdb := setupTestDB(t)
	svc := NewAgentService(tdb.DB)

	// Empty name should fail.
	_, err := svc.Create("", "claude-code", "", "")
	if err == nil {
		t.Error("Create() with empty name should fail")
	}
}

func TestAgentDeleteNotFound(t *testing.T) {
	tdb := setupTestDB(t)
	svc := NewAgentService(tdb.DB)

	err := svc.Delete("nonexistent-id")
	if err == nil {
		t.Error("Delete() with nonexistent ID should fail")
	}
}

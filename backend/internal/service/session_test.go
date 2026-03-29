package service

import (
	"testing"
)

func TestSessionCRUD(t *testing.T) {
	tdb := setupTestDB(t)
	agentSvc := NewAgentService(tdb.DB)
	projectSvc := NewProjectService(tdb.DB)
	sessionSvc := NewSessionService(tdb.DB)

	// Create dependencies.
	agent, err := agentSvc.Create("Test Agent", "claude-code", "", "")
	if err != nil {
		t.Fatalf("Create agent failed: %v", err)
	}

	repoPath := createTestRepo(t)
	project, err := projectSvc.Create("Test Project", repoPath, "")
	if err != nil {
		t.Fatalf("Create project failed: %v", err)
	}

	// Create session
	session, err := sessionSvc.Create(project.ID, agent.ID, "", "My Session", "feature/test", "main")
	if err != nil {
		t.Fatalf("Create() failed: %v", err)
	}
	if session.BranchName != "feature/test" {
		t.Errorf("BranchName = %q, want %q", session.BranchName, "feature/test")
	}
	if session.BaseBranch != "main" {
		t.Errorf("BaseBranch = %q, want %q", session.BaseBranch, "main")
	}
	if session.Status != "idle" {
		t.Errorf("Status = %q, want %q", session.Status, "idle")
	}

	// List all
	sessions, err := sessionSvc.List("")
	if err != nil {
		t.Fatalf("List() failed: %v", err)
	}
	if len(sessions) != 1 {
		t.Fatalf("List() returned %d, want 1", len(sessions))
	}

	// List by project
	sessions, err = sessionSvc.List(project.ID)
	if err != nil {
		t.Fatalf("List(projectID) failed: %v", err)
	}
	if len(sessions) != 1 {
		t.Fatalf("List(projectID) returned %d, want 1", len(sessions))
	}

	// Update status
	if err := sessionSvc.UpdateStatus(session.ID, "idle"); err != nil {
		t.Fatalf("UpdateStatus() failed: %v", err)
	}
	updated, _ := sessionSvc.GetByID(session.ID)
	if updated.Status != "idle" {
		t.Errorf("Status after update = %q, want %q", updated.Status, "idle")
	}

	// Update worktree
	if err := sessionSvc.UpdateWorktree(session.ID, "/tmp/worktree"); err != nil {
		t.Fatalf("UpdateWorktree() failed: %v", err)
	}
	updated, _ = sessionSvc.GetByID(session.ID)
	if updated.WorktreePath != "/tmp/worktree" {
		t.Errorf("WorktreePath = %q, want %q", updated.WorktreePath, "/tmp/worktree")
	}

	// Delete
	if err := sessionSvc.Delete(session.ID); err != nil {
		t.Fatalf("Delete() failed: %v", err)
	}
	sessions, _ = sessionSvc.List("")
	if len(sessions) != 0 {
		t.Errorf("List() after Delete returned %d, want 0", len(sessions))
	}
}

func TestSessionCreateValidation(t *testing.T) {
	tdb := setupTestDB(t)
	sessionSvc := NewSessionService(tdb.DB)

	// Missing project_id
	_, err := sessionSvc.Create("", "agent-id", "", "", "branch", "main")
	if err == nil {
		t.Error("Create() with empty project_id should fail")
	}

	// Missing agent_id
	_, err = sessionSvc.Create("project-id", "", "", "", "branch", "main")
	if err == nil {
		t.Error("Create() with empty agent_id should fail")
	}

	// Missing branch_name
	_, err = sessionSvc.Create("project-id", "agent-id", "", "", "", "main")
	if err == nil {
		t.Error("Create() with empty branch_name should fail")
	}
}

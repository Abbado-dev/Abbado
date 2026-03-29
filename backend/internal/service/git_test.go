package service

import (
	"os/exec"
	"testing"
)

func TestListBranches(t *testing.T) {
	repoPath := createTestRepo(t)
	svc := NewGitService()

	branches, err := svc.ListBranches(repoPath)
	if err != nil {
		t.Fatalf("ListBranches() failed: %v", err)
	}
	if len(branches) == 0 {
		t.Fatal("ListBranches() returned 0 branches")
	}

	// Should have at least "main" or "master".
	found := false
	for _, b := range branches {
		if b == "main" || b == "master" {
			found = true
			break
		}
	}
	if !found {
		t.Errorf("Expected main or master branch, got %v", branches)
	}
}

func TestCurrentBranch(t *testing.T) {
	repoPath := createTestRepo(t)
	svc := NewGitService()

	branch, err := svc.CurrentBranch(repoPath)
	if err != nil {
		t.Fatalf("CurrentBranch() failed: %v", err)
	}
	if branch == "" {
		t.Error("CurrentBranch() returned empty string")
	}
}

func TestCreateAndRemoveWorktree(t *testing.T) {
	repoPath := createTestRepo(t)
	svc := NewGitService()

	worktreePath := t.TempDir() + "/wt"

	if err := svc.CreateWorktree(repoPath, worktreePath, "test-branch", "HEAD"); err != nil {
		t.Fatalf("CreateWorktree() failed: %v", err)
	}

	// Verify branch was created.
	branches, _ := svc.ListBranches(repoPath)
	found := false
	for _, b := range branches {
		if b == "test-branch" {
			found = true
		}
	}
	if !found {
		t.Error("test-branch not found after CreateWorktree")
	}

	// Remove.
	if err := svc.RemoveWorktree(repoPath, worktreePath); err != nil {
		t.Fatalf("RemoveWorktree() failed: %v", err)
	}
}

func TestDiff(t *testing.T) {
	repoPath := createTestRepo(t)
	svc := NewGitService()

	// Create a branch with a change.
	cmds := [][]string{
		{"git", "checkout", "-b", "feature"},
		{"git", "commit", "--allow-empty", "-m", "feature commit"},
	}
	for _, args := range cmds {
		cmd := exec.Command(args[0], args[1:]...)
		cmd.Dir = repoPath
		if out, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("git %v failed: %s: %v", args, out, err)
		}
	}

	// Diff should not error (may be empty since we use --allow-empty).
	_, err := svc.Diff(repoPath, "master")
	if err != nil {
		_, err = svc.Diff(repoPath, "main")
		if err != nil {
			t.Fatalf("Diff() failed: %v", err)
		}
	}
}

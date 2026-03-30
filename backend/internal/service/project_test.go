package service

import (
	"os"
	"os/exec"
	"path/filepath"
	"testing"
)

func createTestRepo(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	repoPath := filepath.Join(dir, "repo")
	os.MkdirAll(repoPath, 0o755)

	cmds := [][]string{
		{"git", "init"},
		{"git", "config", "user.email", "test@test.com"},
		{"git", "config", "user.name", "Test"},
		{"git", "commit", "--allow-empty", "-m", "init"},
	}
	for _, args := range cmds {
		cmd := exec.Command(args[0], args[1:]...)
		cmd.Dir = repoPath
		if out, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("git command %v failed: %s: %v", args, out, err)
		}
	}

	return repoPath
}

func TestProjectCRUD(t *testing.T) {
	tdb := setupTestDB(t)
	svc := NewProjectService(tdb.DB)
	repoPath := createTestRepo(t)

	// Create
	project, err := svc.Create("Test Project", repoPath, "", "")
	if err != nil {
		t.Fatalf("Create() failed: %v", err)
	}
	if project.Name != "Test Project" {
		t.Errorf("Name = %q, want %q", project.Name, "Test Project")
	}
	if project.RepoPath != repoPath {
		t.Errorf("RepoPath = %q, want %q", project.RepoPath, repoPath)
	}

	// List
	projects, err := svc.List()
	if err != nil {
		t.Fatalf("List() failed: %v", err)
	}
	if len(projects) != 1 {
		t.Fatalf("List() returned %d projects, want 1", len(projects))
	}

	// GetByID
	fetched, err := svc.GetByID(project.ID)
	if err != nil {
		t.Fatalf("GetByID() failed: %v", err)
	}
	if fetched.ID != project.ID {
		t.Errorf("ID mismatch")
	}

	// Duplicate repo path should fail.
	_, err = svc.Create("Duplicate", repoPath, "", "")
	if err == nil {
		t.Error("Create() with duplicate repo_path should fail")
	}

	// Delete
	if err := svc.Delete(project.ID); err != nil {
		t.Fatalf("Delete() failed: %v", err)
	}
	projects, _ = svc.List()
	if len(projects) != 0 {
		t.Errorf("List() after Delete returned %d, want 0", len(projects))
	}
}

func TestProjectCreateValidation(t *testing.T) {
	tdb := setupTestDB(t)
	svc := NewProjectService(tdb.DB)

	// Empty name
	_, err := svc.Create("", "/tmp", "", "")
	if err == nil {
		t.Error("Create() with empty name should fail")
	}

	// Non-existent path
	_, err = svc.Create("Test", "/nonexistent/path/xyz", "", "")
	if err == nil {
		t.Error("Create() with nonexistent path should fail")
	}

	// Path without .git
	dir := t.TempDir()
	_, err = svc.Create("Test", dir, "", "")
	if err == nil {
		t.Error("Create() with non-git directory should fail")
	}
}

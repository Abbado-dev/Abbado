package service

import (
	"fmt"
	"os"
	"os/exec"
	"strings"
)

// GitService handles git operations on a repository.
type GitService struct{}

// NewGitService creates a new GitService.
func NewGitService() *GitService {
	return &GitService{}
}

// ListBranches returns all local branches for a repository.
func (s *GitService) ListBranches(repoPath string) ([]string, error) {
	cmd := exec.Command("git", "-C", repoPath, "branch", "--format=%(refname:short)")
	out, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("git.ListBranches: failed to list branches in %s: %w", repoPath, err)
	}

	lines := strings.Split(strings.TrimSpace(string(out)), "\n")
	var branches []string
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line != "" {
			branches = append(branches, line)
		}
	}

	return branches, nil
}

// CurrentBranch returns the current branch name.
func (s *GitService) CurrentBranch(repoPath string) (string, error) {
	cmd := exec.Command("git", "-C", repoPath, "rev-parse", "--abbrev-ref", "HEAD")
	out, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("git.CurrentBranch: failed to get current branch in %s: %w", repoPath, err)
	}

	return strings.TrimSpace(string(out)), nil
}

// CreateWorktree creates a git worktree for the given branch.
// If the branch doesn't exist, it creates it from baseBranch.
func (s *GitService) CreateWorktree(repoPath, worktreePath, branchName, baseBranch string) error {
	// Check if branch exists.
	checkCmd := exec.Command("git", "-C", repoPath, "rev-parse", "--verify", branchName)
	if err := checkCmd.Run(); err != nil {
		// Branch doesn't exist — create worktree with new branch.
		cmd := exec.Command("git", "-C", repoPath, "worktree", "add", "-b", branchName, worktreePath, baseBranch)
		if out, err := cmd.CombinedOutput(); err != nil {
			return fmt.Errorf("git.CreateWorktree: failed to create worktree with new branch %s: %s: %w", branchName, string(out), err)
		}
		return nil
	}

	// Branch exists — create worktree on existing branch.
	cmd := exec.Command("git", "-C", repoPath, "worktree", "add", worktreePath, branchName)
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("git.CreateWorktree: failed to create worktree for branch %s: %s: %w", branchName, string(out), err)
	}

	return nil
}

// Diff returns the diff of the working tree against a base branch.
// workDir is the worktree (or repo) directory where changes are.
func (s *GitService) Diff(workDir, baseBranch string) (string, error) {
	// Show committed + uncommitted changes vs base branch.
	cmd := exec.Command("git", "-C", workDir, "diff", baseBranch)
	out, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("git.Diff: failed to diff against %s: %w", baseBranch, err)
	}
	return string(out), nil
}

// DiffFiles returns the list of changed files in the working tree vs a base branch.
func (s *GitService) DiffFiles(workDir, baseBranch string) ([]DiffFile, error) {
	// Tracked changes (modified/deleted).
	cmd := exec.Command("git", "-C", workDir, "diff", "--numstat", baseBranch)
	out, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("git.DiffFiles: failed to get diff stats: %w", err)
	}

	var files []DiffFile
	for _, line := range strings.Split(strings.TrimSpace(string(out)), "\n") {
		if line == "" {
			continue
		}
		parts := strings.Fields(line)
		if len(parts) >= 3 {
			files = append(files, DiffFile{
				Added:   parts[0],
				Deleted: parts[1],
				File:    parts[2],
			})
		}
	}

	// Untracked files.
	untrackedCmd := exec.Command("git", "-C", workDir, "ls-files", "--others", "--exclude-standard")
	untrackedOut, err := untrackedCmd.Output()
	if err == nil {
		for _, line := range strings.Split(strings.TrimSpace(string(untrackedOut)), "\n") {
			if line == "" {
				continue
			}
			files = append(files, DiffFile{
				Added:   "new",
				Deleted: "0",
				File:    line,
			})
		}
	}

	return files, nil
}

// DiffFile represents a changed file with stats.
type DiffFile struct {
	Added   string `json:"added"`
	Deleted string `json:"deleted"`
	File    string `json:"file"`
}

// FileDiff returns the diff for a specific file in the working tree vs base.
func (s *GitService) FileDiff(workDir, baseBranch, filePath string) (string, error) {
	cmd := exec.Command("git", "-C", workDir, "diff", baseBranch, "--", filePath)
	out, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("git.FileDiff: failed to diff file %s: %w", filePath, err)
	}
	return string(out), nil
}

// FileContentAtRef returns the content of a file at a given ref (branch/commit).
func (s *GitService) FileContentAtRef(workDir, ref, filePath string) (string, error) {
	cmd := exec.Command("git", "-C", workDir, "show", ref+":"+filePath)
	out, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("git.FileContentAtRef: failed to get %s at %s: %w", filePath, ref, err)
	}
	return string(out), nil
}

// FileContentWorkdir returns the current content of a file in the working directory.
func (s *GitService) FileContentWorkdir(workDir, filePath string) (string, error) {
	fullPath := workDir + "/" + filePath
	data, err := os.ReadFile(fullPath)
	if err != nil {
		return "", fmt.Errorf("git.FileContentWorkdir: failed to read %s: %w", fullPath, err)
	}
	return string(data), nil
}

// Commit stages the given files (or all if empty) and commits.
func (s *GitService) Commit(workDir, message string, files []string) error {
	if len(files) == 0 {
		addCmd := exec.Command("git", "-C", workDir, "add", "-A")
		if out, err := addCmd.CombinedOutput(); err != nil {
			return fmt.Errorf("git.Commit: git add -A failed: %s: %w", string(out), err)
		}
	} else {
		args := append([]string{"-C", workDir, "add", "--"}, files...)
		addCmd := exec.Command("git", args...)
		if out, err := addCmd.CombinedOutput(); err != nil {
			return fmt.Errorf("git.Commit: git add failed: %s: %w", string(out), err)
		}
	}

	commitCmd := exec.Command("git", "-C", workDir, "commit", "-m", message)
	if out, err := commitCmd.CombinedOutput(); err != nil {
		return fmt.Errorf("git.Commit: git commit failed: %s: %w", string(out), err)
	}

	return nil
}

// Push pushes the current branch to origin.
func (s *GitService) Push(workDir string) error {
	cmd := exec.Command("git", "-C", workDir, "push", "-u", "origin", "HEAD")
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("git.Push: failed: %s: %w", string(out), err)
	}

	return nil
}

// CreatePR creates a pull request using the gh CLI.
func (s *GitService) CreatePR(workDir, title, body string) (string, error) {
	cmd := exec.Command("gh", "pr", "create", "--title", title, "--body", body)
	cmd.Dir = workDir
	out, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("git.CreatePR: gh pr create failed: %s: %w", string(out), err)
	}

	return strings.TrimSpace(string(out)), nil
}

// RemoveWorktree removes a git worktree.
func (s *GitService) RemoveWorktree(repoPath, worktreePath string) error {
	cmd := exec.Command("git", "-C", repoPath, "worktree", "remove", "--force", worktreePath)
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("git.RemoveWorktree: failed to remove worktree %s: %s: %w", worktreePath, string(out), err)
	}

	return nil
}

// DeleteBranch deletes a local branch.
func (s *GitService) DeleteBranch(repoPath, branchName string) error {
	cmd := exec.Command("git", "-C", repoPath, "branch", "-D", branchName)
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("git.DeleteBranch: failed to delete branch %s: %s: %w", branchName, string(out), err)
	}

	return nil
}

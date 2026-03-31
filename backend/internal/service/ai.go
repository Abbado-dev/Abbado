package service

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
)

const (
	DefaultProviderID = "claude-code"
	DefaultAIModel    = "claude-haiku-4-5-20251001"
)

// AIService generates commit messages, PR descriptions, and reviews using providers.
type AIService struct {
	registry *ProviderRegistry
}

// NewAIService creates a new AIService.
func NewAIService(registry *ProviderRegistry) *AIService {
	return &AIService{registry: registry}
}

// CommitAndPR holds generated commit message, PR title, and PR body.
type CommitAndPR struct {
	CommitMessage string `json:"commit_message"`
	PRTitle       string `json:"pr_title"`
	PRBody        string `json:"pr_body"`
}

// GenerateCommitAndPR generates a commit message, PR title, and PR body from a diff.
// Uses the specified provider and model, falling back to claude-code/haiku.
func (s *AIService) GenerateCommitAndPR(ctx context.Context, providerID, model, workDir, diff string) (*CommitAndPR, error) {
	if providerID == "" {
		providerID = DefaultProviderID
	}
	if model == "" {
		model = DefaultAIModel
	}

	truncated := diff
	if len(truncated) > 30000 {
		truncated = truncated[:30000] + "\n... (truncated)"
	}

	prompt := fmt.Sprintf(`Analyze the following git diff and generate:
1. A concise commit message (conventional commits format, one line, max 72 chars)
2. A PR title (concise, max 60 chars)
3. A PR body (markdown, with a ## Summary section with 2-4 bullet points describing the changes)

Respond ONLY with valid JSON, no markdown fences:
{"commit_message": "...", "pr_title": "...", "pr_body": "..."}

Diff:
%s`, truncated)

	provider := s.registry.Get(providerID)
	out, err := provider.OneShot(ctx, workDir, model, prompt)
	if err != nil {
		return nil, fmt.Errorf("ai.GenerateCommitAndPR: %w", err)
	}

	// Strip markdown code fences if the model wraps the JSON.
	cleaned := strings.TrimSpace(out)
	if strings.HasPrefix(cleaned, "```") {
		// Remove opening fence (```json or ```)
		if idx := strings.Index(cleaned, "\n"); idx != -1 {
			cleaned = cleaned[idx+1:]
		}
		// Remove closing fence
		if idx := strings.LastIndex(cleaned, "```"); idx != -1 {
			cleaned = cleaned[:idx]
		}
		cleaned = strings.TrimSpace(cleaned)
	}

	var result CommitAndPR
	if err := json.Unmarshal([]byte(cleaned), &result); err != nil {
		return nil, fmt.Errorf("ai.GenerateCommitAndPR: failed to parse response: %w (raw: %s)", err, out)
	}

	return &result, nil
}

// ReviewDiff reviews a diff and returns structured feedback.
func (s *AIService) ReviewDiff(ctx context.Context, providerID, model, workDir, diff string) (string, error) {
	if providerID == "" {
		providerID = DefaultProviderID
	}
	if model == "" {
		model = DefaultAIModel
	}

	truncated := diff
	if len(truncated) > 30000 {
		truncated = truncated[:30000] + "\n... (truncated)"
	}

	prompt := fmt.Sprintf(`You are a senior code reviewer. Review the following git diff.

For each issue found, format as:
- **[severity]** file:line — description

Severities: 🔴 Critical, 🟡 Warning, 🔵 Suggestion

End with a short summary. Be specific and actionable. If the code looks good, say so briefly.

Diff:
%s`, truncated)

	provider := s.registry.Get(providerID)
	return provider.OneShot(ctx, workDir, model, prompt)
}

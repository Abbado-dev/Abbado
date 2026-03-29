import claudeLogo from "@/assets/claude-logo.png"
import openaiLogo from "@/assets/openai-logo.png"

export type Provider = {
  id: string
  name: string
  description: string
  logo: string
  models: string[]
}

export const providers: Provider[] = [
  {
    id: "claude-code",
    name: "Claude Code",
    description: "Anthropic's coding agent",
    logo: claudeLogo,
    models: ["claude-sonnet-4-6", "claude-opus-4-6", "claude-haiku-4-5"],
  },
  {
    id: "codex",
    name: "Codex",
    description: "OpenAI's coding agent",
    logo: openaiLogo,
    models: ["gpt-5.4", "gpt-5.4-mini"],
  },
]

export type TemplateCategory = {
  id: string
  label: string
  icon: string
}

export const templateCategories: TemplateCategory[] = [
  { id: "review", label: "Review", icon: "🔍" },
  { id: "coding", label: "Coding", icon: "⚡" },
  { id: "testing", label: "Testing", icon: "🖊️" },
  { id: "docs", label: "Docs", icon: "📋" },
  { id: "devops", label: "DevOps", icon: "🔧" },
  { id: "security", label: "Security", icon: "🛡️" },
]

export type AgentTemplate = {
  id: string
  name: string
  description: string
  category: string
  provider: string
  model: string
  tools: string[]
  instructions: string
}

export const agentTemplates: AgentTemplate[] = [
  // --- Review ---
  {
    id: "pr-reviewer",
    name: "PR Reviewer",
    description: "Reviews code changes, identifies bugs, suggests improvements. Read-only — won't modify files.",
    category: "review",
    provider: "claude-code",
    model: "claude-sonnet-4-6",
    tools: ["Read", "Grep", "Glob"],
    instructions:
      "You are a code reviewer. Review the diff for bugs, security issues, performance problems, and readability. Be specific and actionable. Do not modify files.",
  },
  {
    id: "architecture-reviewer",
    name: "Architecture Reviewer",
    description: "Reviews code structure, dependencies, and architectural decisions.",
    category: "review",
    provider: "claude-code",
    model: "claude-opus-4-6",
    tools: ["Read", "Grep", "Glob"],
    instructions:
      "You are an architecture reviewer. Analyze code structure, dependency graph, and design patterns. Flag violations of SOLID principles, circular dependencies, and abstraction leaks.",
  },
  // --- Coding ---
  {
    id: "bug-fixer",
    name: "Bug Fixer",
    description: "Analyzes bugs, finds root cause, implements a fix with tests.",
    category: "coding",
    provider: "claude-code",
    model: "claude-sonnet-4-6",
    tools: ["Read", "Edit", "Write", "Bash", "Grep", "+1"],
    instructions:
      "You are a debugging specialist. First reproduce the bug, then trace the root cause, then write a minimal fix. Always add a regression test before committing.",
  },
  {
    id: "feature-builder",
    name: "Feature Builder",
    description: "Implements new features end-to-end: code, tests, and docs.",
    category: "coding",
    provider: "claude-code",
    model: "claude-sonnet-4-6",
    tools: ["Read", "Edit", "Write", "Bash", "Grep", "+1"],
    instructions:
      "You are a senior software engineer. Build features incrementally: start with the data model, then the service layer, then the API, then the UI. Write clean, tested code. Commit after each logical step.",
  },
  {
    id: "refactorer",
    name: "Refactorer",
    description: "Refactors code for clarity and maintainability without changing behavior.",
    category: "coding",
    provider: "claude-code",
    model: "claude-opus-4-6",
    tools: ["Read", "Edit", "Write", "Bash", "Grep", "+1"],
    instructions:
      "You are a refactoring specialist. Improve code structure without changing behavior. Extract abstractions only when they reduce complexity. Keep changes small and reviewable. Run tests after each change.",
  },
  // --- Testing ---
  {
    id: "test-writer",
    name: "Test Writer",
    description: "Writes missing tests to improve coverage.",
    category: "testing",
    provider: "claude-code",
    model: "claude-sonnet-4-6",
    tools: ["Read", "Write", "Bash", "Grep", "Glob"],
    instructions:
      "You are a testing specialist. Write comprehensive tests for existing code. Cover happy paths, edge cases, and error scenarios. Prefer integration tests over unit tests when they add more confidence.",
  },
  {
    id: "e2e-test-writer",
    name: "E2E Test Writer",
    description: "Writes end-to-end tests for user-facing flows.",
    category: "testing",
    provider: "claude-code",
    model: "claude-sonnet-4-6",
    tools: ["Read", "Write", "Bash", "Grep", "Glob"],
    instructions:
      "You are an E2E testing specialist. Write end-to-end tests that simulate real user interactions. Use the project's existing E2E framework. Focus on critical user flows and edge cases.",
  },
  // --- Docs ---
  {
    id: "doc-writer",
    name: "Documentation Writer",
    description: "Writes and updates documentation: README, API docs, inline comments.",
    category: "docs",
    provider: "claude-code",
    model: "claude-haiku-4-5",
    tools: ["Read", "Write", "Glob", "Grep"],
    instructions:
      "You are a documentation specialist. Write clear, concise documentation. Focus on the why, not the what. Keep READMEs actionable. Add inline comments only where the logic is not self-evident.",
  },
  {
    id: "api-documenter",
    name: "API Documenter",
    description: "Documents API endpoints with request/response examples.",
    category: "docs",
    provider: "claude-code",
    model: "claude-haiku-4-5",
    tools: ["Read", "Write", "Grep", "Glob"],
    instructions:
      "You are an API documentation specialist. Document each endpoint with method, path, parameters, request/response body examples, error codes, and authentication requirements.",
  },
  // --- DevOps ---
  {
    id: "cicd-setup",
    name: "CI/CD Setup",
    description: "Sets up or improves CI/CD pipelines (GitHub Actions, etc.).",
    category: "devops",
    provider: "claude-code",
    model: "claude-sonnet-4-6",
    tools: ["Read", "Write", "Edit", "Bash", "Grep", "+1"],
    instructions:
      "You are a DevOps engineer. Set up CI/CD pipelines that build, test, lint, and deploy. Prefer GitHub Actions. Keep workflows fast and cache dependencies. Add status badges to README.",
  },
  {
    id: "dockerfile-optimizer",
    name: "Dockerfile Optimizer",
    description: "Optimizes Docker images for size and build speed.",
    category: "devops",
    provider: "claude-code",
    model: "claude-sonnet-4-6",
    tools: ["Read", "Edit", "Write", "Bash", "Glob"],
    instructions:
      "You are a Docker specialist. Optimize Dockerfiles for minimal image size and fast builds. Use multi-stage builds, minimize layers, pin versions, and avoid installing unnecessary packages.",
  },
  // --- Security ---
  {
    id: "security-auditor",
    name: "Security Auditor",
    description: "Audits code for OWASP vulnerabilities and security issues. Read-only.",
    category: "security",
    provider: "claude-code",
    model: "claude-opus-4-6",
    tools: ["Read", "Grep", "Glob"],
    instructions:
      "You are a security auditor. Review code for OWASP top 10 vulnerabilities, injection flaws, auth issues, and data exposure. Flag severity and suggest specific mitigations. Do not modify files.",
  },
  {
    id: "dependency-checker",
    name: "Dependency Checker",
    description: "Checks for outdated or vulnerable dependencies and suggests updates.",
    category: "security",
    provider: "claude-code",
    model: "claude-sonnet-4-6",
    tools: ["Read", "Bash", "Grep", "Glob"],
    instructions:
      "You are a dependency security specialist. Check for outdated or vulnerable dependencies. Suggest version updates and flag breaking changes. Run audit commands and interpret results.",
  },
]

export function getTemplatesByCategory(
  templates: AgentTemplate[],
  categoryId?: string
): AgentTemplate[] {
  if (!categoryId || categoryId === "all") return templates
  return templates.filter((t) => t.category === categoryId)
}

const API_BASE = '/api'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(body.error || `Request failed: ${res.status}`)
  }

  if (res.status === 204) return undefined as T
  return res.json()
}

// --- Types ---

export type Agent = {
  id: string
  name: string
  cli_name: string
  model?: string
  instructions?: string
  created_at: string
  updated_at: string
}

export type Workspace = {
  id: string
  name: string
  position: number
  created_at: string
}

export type ProjectMode = 'worktree' | 'direct'

export type ProjectCommand = {
  label: string
  icon: string
  command: string
}

export type Project = {
  id: string
  workspace_id?: string
  name: string
  repo_path: string
  mode: ProjectMode
  commands?: ProjectCommand[]
  created_at: string
}

export type SessionStatus = 'active' | 'idle' | 'waiting' | 'completed' | 'failed'

export type Session = {
  id: string
  project_id: string
  agent_id: string
  reviewer_agent_id?: string
  name?: string
  branch_name: string
  base_branch: string
  worktree_path?: string
  commands?: ProjectCommand[]
  status: SessionStatus
  reviewer_status?: SessionStatus
  pid?: number
  tokens_in: number
  tokens_out: number
  cost_usd: number
  notify: boolean
  created_at: string
  updated_at: string
}

// --- Workspaces ---

export const workspacesApi = {
  list: () => request<Workspace[]>('/workspaces'),
  create: (data: { name: string }) =>
    request<Workspace>('/workspaces', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: { name: string }) =>
    request<Workspace>(`/workspaces/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<void>(`/workspaces/${id}`, { method: 'DELETE' }),
  reorder: (ids: string[]) =>
    request<void>('/workspaces/reorder', { method: 'POST', body: JSON.stringify({ ids }) }),
}

// --- Agents ---

export const agentsApi = {
  list: () => request<Agent[]>('/agents'),
  create: (data: Pick<Agent, 'name' | 'cli_name'> & Partial<Agent>) =>
    request<Agent>('/agents', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Pick<Agent, 'name' | 'cli_name'> & Partial<Agent>) =>
    request<Agent>(`/agents/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<void>(`/agents/${id}`, { method: 'DELETE' }),
}

// --- Projects ---

export const projectsApi = {
  list: () => request<Project[]>('/projects'),
  create: (data: Pick<Project, 'name' | 'repo_path'> & { mode?: ProjectMode; workspace_id?: string }) =>
    request<Project>('/projects', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: { name: string; mode: ProjectMode; commands?: ProjectCommand[]; workspace_id?: string }) =>
    request<Project>(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<void>(`/projects/${id}`, { method: 'DELETE' }),
  branches: (id: string) => request<string[]>(`/projects/${id}/branches`),
  reorder: (ids: string[]) =>
    request<void>('/projects/reorder', { method: 'POST', body: JSON.stringify({ ids }) }),
}

// --- Sessions ---

export const sessionsApi = {
  list: (projectId?: string) =>
    request<Session[]>(projectId ? `/sessions?project_id=${projectId}` : '/sessions'),
  create: (data: { project_id: string; agent_id: string; reviewer_agent_id?: string; name?: string; branch_name: string; base_branch?: string }) =>
    request<Session>('/sessions', { method: 'POST', body: JSON.stringify(data) }),
  updateAgent: (id: string, agentId: string) =>
    request<Session>(`/sessions/${id}/agent`, {
      method: 'PUT', body: JSON.stringify({ agent_id: agentId }),
    }),
  updateReviewer: (id: string, reviewerAgentId: string | null) =>
    request<Session>(`/sessions/${id}/reviewer`, {
      method: 'PUT', body: JSON.stringify({ reviewer_agent_id: reviewerAgentId ?? "" }),
    }),
  delete: (id: string) =>
    request<void>(`/sessions/${id}`, { method: 'DELETE' }),
  updateCommands: (id: string, commands: ProjectCommand[]) =>
    request<Session>(`/sessions/${id}/commands`, {
      method: 'PUT', body: JSON.stringify({ commands }),
    }),
  reorder: (ids: string[]) =>
    request<void>('/sessions/reorder', { method: 'POST', body: JSON.stringify({ ids }) }),
}

// --- Changes ---

export type DiffFile = {
  added: string
  deleted: string
  file: string
}

export type FileContent = {
  old: string
  new: string
}

export const changesApi = {
  files: (sessionId: string) =>
    request<DiffFile[]>(`/sessions/${sessionId}/changes`),
  diff: (sessionId: string, file?: string) =>
    fetch(`/api/sessions/${sessionId}/changes/diff${file ? `?file=${encodeURIComponent(file)}` : ''}`)
      .then((res) => res.text()),
  fileContent: (sessionId: string, path: string) =>
    request<FileContent>(`/sessions/${sessionId}/changes/file?path=${encodeURIComponent(path)}`),
  saveFile: (sessionId: string, path: string, content: string) =>
    request<{ status: string }>(`/sessions/${sessionId}/changes/file`, {
      method: 'PUT', body: JSON.stringify({ path, content }),
    }),
  commit: (sessionId: string, message: string, files?: string[]) =>
    request<{ status: string }>(`/sessions/${sessionId}/commit`, {
      method: 'POST', body: JSON.stringify({ message, files }),
    }),
  push: (sessionId: string) =>
    request<{ status: string }>(`/sessions/${sessionId}/push`, { method: 'POST' }),
  createPR: (sessionId: string, title: string, body: string) =>
    request<{ url: string }>(`/sessions/${sessionId}/pr`, {
      method: 'POST', body: JSON.stringify({ title, body }),
    }),
  generate: (sessionId: string) =>
    request<{ commit_message: string; pr_title: string; pr_body: string }>(`/sessions/${sessionId}/generate`, {
      method: 'POST',
    }),
  review: (sessionId: string) =>
    request<{ review: string }>(`/sessions/${sessionId}/review`, {
      method: 'POST',
    }),
  sendReview: (sessionId: string) =>
    request<{ status: string }>(`/sessions/${sessionId}/terminal/reviewer/send`, {
      method: 'POST',
    }),
}

// --- Runner ---

export const runnerApi = {
  exec: (sessionId: string, command: string) =>
    request<{ status: string }>(`/sessions/${sessionId}/terminal/runner/exec`, {
      method: 'POST', body: JSON.stringify({ command }),
    }),
  stop: (sessionId: string) =>
    request<{ status: string }>(`/sessions/${sessionId}/terminal/runner/stop`, {
      method: 'POST',
    }),
}

// --- Prompts ---

export type PromptEntry = {
  id: number
  prompt: string
  created_at: string
}

export const promptsApi = {
  list: (sessionId: string) =>
    request<PromptEntry[]>(`/sessions/${sessionId}/prompts`),
}

// --- Filesystem ---

export type DirEntry = {
  name: string
  path: string
  is_git: boolean
}

export const filesystemApi = {
  listDirs: (path: string) =>
    request<DirEntry[]>(`/filesystem/dirs?path=${encodeURIComponent(path)}`),
}

// --- Health ---

export const healthApi = {
  check: () => request<{ status: string }>('/health'),
}

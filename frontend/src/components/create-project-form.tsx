import { useState } from "react"
import { GitBranchIcon, FolderIcon, PlusIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { PathInput } from "@/components/path-input"
import { useCreateProject } from "@/hooks/use-projects"
import { useWorkspaces, useCreateWorkspace } from "@/hooks/use-workspaces"
import type { ProjectMode } from "@/lib/api"
import { cn } from "@/lib/utils"

interface CreateProjectFormProps {
  onSuccess?: () => void
}

export function CreateProjectForm({ onSuccess }: CreateProjectFormProps) {
  const createProject = useCreateProject()
  const { data: workspaces } = useWorkspaces()
  const createWorkspace = useCreateWorkspace()

  const [name, setName] = useState("")
  const [repoPath, setRepoPath] = useState("")
  const [mode, setMode] = useState<ProjectMode>("direct")
  const [workspaceId, setWorkspaceId] = useState("")
  const [newWorkspaceName, setNewWorkspaceName] = useState("")
  const [showNewWorkspace, setShowNewWorkspace] = useState(false)
  const [nameManuallySet, setNameManuallySet] = useState(false)

  function handlePathChange(path: string) {
    setRepoPath(path)
    if (!nameManuallySet) {
      const cleaned = path.replace(/\/+$/, "")
      const basename = cleaned.split("/").pop() ?? ""
      setName(basename)
    }
  }

  function handleNameChange(value: string) {
    setName(value)
    setNameManuallySet(true)
  }

  async function handleCreateWorkspace() {
    if (!newWorkspaceName.trim()) return
    const ws = await createWorkspace.mutateAsync({ name: newWorkspaceName.trim() })
    setWorkspaceId(ws.id)
    setNewWorkspaceName("")
    setShowNewWorkspace(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const cleanPath = repoPath.replace(/\/+$/, "")
    if (!name.trim() || !cleanPath) return

    // Create workspace inline if the user typed a name but didn't click "Create".
    let wsId = workspaceId
    if (!wsId && showNewWorkspace && newWorkspaceName.trim()) {
      const ws = await createWorkspace.mutateAsync({ name: newWorkspaceName.trim() })
      wsId = ws.id
    }

    createProject.mutate(
      { name: name.trim(), repo_path: cleanPath, mode, workspace_id: wsId || undefined },
      {
        onSuccess: () => {
          setName("")
          setRepoPath("")
          setMode("direct")
          setWorkspaceId("")
          setNewWorkspaceName("")
          setShowNewWorkspace(false)
          setNameManuallySet(false)
          onSuccess?.()
        },
      }
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {/* Repo path */}
      <div className="space-y-2">
        <Label htmlFor="repo-path">Repository Path</Label>
        <PathInput
          id="repo-path"
          value={repoPath}
          onChange={handlePathChange}
          placeholder="~/code/my-project"
        />
        <p className="text-xs text-muted-foreground">
          Navigate with <kbd className="rounded border bg-muted px-1 text-[10px]">Tab</kbd> and arrow keys. Git repos are highlighted.
        </p>
      </div>

      {/* Display name */}
      <div className="space-y-2">
        <Label htmlFor="project-name">Display Name</Label>
        <Input
          id="project-name"
          placeholder="my-project"
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
        />
      </div>

      {/* Workspace */}
      <div className="space-y-2">
        <Label>Workspace</Label>
        <div className="flex gap-2">
          <select
            value={workspaceId}
            onChange={(e) => setWorkspaceId(e.target.value)}
            className="flex h-8 flex-1 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">None</option>
            {workspaces?.map((ws) => (
              <option key={ws.id} value={ws.id}>{ws.name}</option>
            ))}
          </select>
          <Button type="button" variant="outline" size="sm" onClick={() => setShowNewWorkspace(!showNewWorkspace)}>
            <PlusIcon className="size-3.5" />
          </Button>
        </div>
        {showNewWorkspace && (
          <div className="flex gap-2">
            <Input
              autoFocus
              placeholder="Workspace name"
              value={newWorkspaceName}
              onChange={(e) => setNewWorkspaceName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleCreateWorkspace() } }}
              className="text-sm"
            />
            <Button type="button" size="sm" onClick={handleCreateWorkspace} disabled={!newWorkspaceName.trim()}>
              Create
            </Button>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Group related projects together.
        </p>
      </div>

      <Separator />

      {/* Mode */}
      <div className="space-y-3">
        <Label>Mode</Label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setMode("direct")}
            className={cn(
              "flex flex-col items-start gap-1.5 rounded-lg border p-4 text-left transition-colors",
              mode === "direct"
                ? "border-primary bg-accent/50"
                : "border-border hover:bg-accent/30"
            )}
          >
            <FolderIcon className="size-5 text-muted-foreground" />
            <span className="text-sm font-medium">Direct</span>
            <span className="text-xs text-muted-foreground">
              Works in the repo directory. One session at a time.
            </span>
          </button>
          <button
            type="button"
            onClick={() => setMode("worktree")}
            className={cn(
              "flex flex-col items-start gap-1.5 rounded-lg border p-4 text-left transition-colors",
              mode === "worktree"
                ? "border-primary bg-accent/50"
                : "border-border hover:bg-accent/30"
            )}
          >
            <GitBranchIcon className="size-5 text-muted-foreground" />
            <span className="text-sm font-medium">Worktree</span>
            <span className="text-xs text-muted-foreground">
              Each session gets an isolated branch. Multiple sessions.
            </span>
          </button>
        </div>
      </div>

      {/* Submit */}
      <Button
        type="submit"
        className="w-full"
        disabled={createProject.isPending || !name.trim() || !repoPath.trim()}
      >
        Add Project
      </Button>
      {createProject.isError && (
        <p className="text-sm text-destructive">{createProject.error.message}</p>
      )}
    </form>
  )
}

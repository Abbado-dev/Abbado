import { useState } from "react"
import { GitBranchIcon, FolderIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { PathInput } from "@/components/path-input"
import { useCreateProject } from "@/hooks/use-projects"
import type { ProjectMode } from "@/lib/api"
import { cn } from "@/lib/utils"

interface CreateProjectFormProps {
  onSuccess?: () => void
}

export function CreateProjectForm({ onSuccess }: CreateProjectFormProps) {
  const createProject = useCreateProject()

  const [name, setName] = useState("")
  const [repoPath, setRepoPath] = useState("")
  const [mode, setMode] = useState<ProjectMode>("direct")
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const cleanPath = repoPath.replace(/\/+$/, "")
    if (!name.trim() || !cleanPath) return

    createProject.mutate(
      { name: name.trim(), repo_path: cleanPath, mode },
      {
        onSuccess: () => {
          setName("")
          setRepoPath("")
          setMode("direct")
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

import { useState } from "react"
import { PlusIcon, XIcon, FolderIcon, GitBranchIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { IconPicker } from "@/components/icon-picker"
import { useUpdateProject } from "@/hooks/use-projects"
import { useWorkspaces } from "@/hooks/use-workspaces"
import type { Project, ProjectCommand, ProjectMode } from "@/lib/api"
import { cn } from "@/lib/utils"

interface ProjectSettingsFormProps {
  project: Project
  onSuccess?: () => void
}

export function ProjectSettingsForm({ project, onSuccess }: ProjectSettingsFormProps) {
  const updateProject = useUpdateProject()
  const { data: workspaces } = useWorkspaces()

  const [name, setName] = useState(project.name)
  const [mode, setMode] = useState<ProjectMode>(project.mode)
  const [workspaceId, setWorkspaceId] = useState(project.workspace_id ?? "")
  const [commands, setCommands] = useState<ProjectCommand[]>(project.commands ?? [])

  function addCommand() {
    setCommands([...commands, { label: "", icon: "play", command: "" }])
  }

  function updateCommand(i: number, patch: Partial<ProjectCommand>) {
    const next = [...commands]
    next[i] = { ...next[i], ...patch }
    setCommands(next)
  }

  function removeCommand(i: number) {
    setCommands(commands.filter((_, j) => j !== i))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const filtered = commands.filter((c) => c.label.trim() && c.command.trim())

    updateProject.mutate(
      { id: project.id, name: name.trim(), mode, commands: filtered.length > 0 ? filtered : undefined, workspace_id: workspaceId || undefined },
      { onSuccess }
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {/* Name */}
      <div className="space-y-2">
        <Label htmlFor="proj-name">Display Name</Label>
        <Input id="proj-name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      {/* Workspace */}
      {workspaces && workspaces.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor="proj-workspace">Workspace</Label>
          <select
            id="proj-workspace"
            value={workspaceId}
            onChange={(e) => setWorkspaceId(e.target.value)}
            className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">None</option>
            {workspaces.map((ws) => (
              <option key={ws.id} value={ws.id}>{ws.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Mode */}
      <div className="space-y-3">
        <Label>Mode</Label>
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={() => setMode("direct")}
            className={cn("flex flex-col items-start gap-1.5 rounded-lg border p-3 text-left transition-colors",
              mode === "direct" ? "border-primary bg-accent/50" : "border-border hover:bg-accent/30")}>
            <FolderIcon className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium">Direct</span>
            <span className="text-xs text-muted-foreground">One session, work in repo.</span>
          </button>
          <button type="button" onClick={() => setMode("worktree")}
            className={cn("flex flex-col items-start gap-1.5 rounded-lg border p-3 text-left transition-colors",
              mode === "worktree" ? "border-primary bg-accent/50" : "border-border hover:bg-accent/30")}>
            <GitBranchIcon className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium">Worktree</span>
            <span className="text-xs text-muted-foreground">Isolated branches, multi-session.</span>
          </button>
        </div>
      </div>

      <Separator />

      {/* Commands */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-base">Commands</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Buttons shown in the Run tab. Agents also use these commands.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addCommand}>
            <PlusIcon className="size-3.5 mr-1" /> Add
          </Button>
        </div>

        {commands.map((cmd, i) => (
          <div key={i} className="flex items-center gap-2">
            <IconPicker value={cmd.icon} onChange={(icon) => updateCommand(i, { icon })} />
            <Input
              placeholder="Label"
              value={cmd.label}
              onChange={(e) => updateCommand(i, { label: e.target.value })}
              className="w-28 text-sm"
            />
            <Input
              placeholder="make dev"
              value={cmd.command}
              onChange={(e) => updateCommand(i, { command: e.target.value })}
              className="flex-1 font-mono text-sm"
            />
            <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeCommand(i)}>
              <XIcon className="size-3.5" />
            </Button>
          </div>
        ))}

        {commands.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">
            No commands yet. Add one to get started.
          </p>
        )}
      </div>

      {/* Submit */}
      <Button type="submit" className="w-full" disabled={updateProject.isPending || !name.trim()}>
        Save Settings
      </Button>
      {updateProject.isError && (
        <p className="text-sm text-destructive">{updateProject.error.message}</p>
      )}
    </form>
  )
}

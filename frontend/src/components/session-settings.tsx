import { useState, useEffect } from "react"
import { PlusIcon, XIcon, RotateCcw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { IconPicker, getCommandIcon } from "@/components/icon-picker"
import { useAgents } from "@/hooks/use-agents"
import { useProjects } from "@/hooks/use-projects"
import { useUpdateSessionCommands } from "@/hooks/use-sessions"
import { providers } from "@/lib/providers"
import type { Session, ProjectCommand } from "@/lib/api"

interface SessionSettingsProps {
  session: Session
}

export function SessionSettings({ session }: SessionSettingsProps) {
  const { data: agents } = useAgents()
  const { data: projects } = useProjects()
  const updateCommands = useUpdateSessionCommands()

  const agent = agents?.find((a) => a.id === session.agent_id)
  const provider = agent ? providers.find((p) => p.id === agent.cli_name) : null
  const project = projects?.find((p) => p.id === session.project_id)

  const hasOverride = session.commands != null && session.commands.length > 0
  const effectiveCommands = hasOverride ? session.commands! : (project?.commands ?? [])

  const [editing, setEditing] = useState(false)
  const [commands, setCommands] = useState<ProjectCommand[]>(effectiveCommands)

  // Sync when session/project data changes.
  useEffect(() => {
    if (!editing) {
      setCommands(hasOverride ? session.commands! : (project?.commands ?? []))
    }
  }, [session.commands, project?.commands, editing, hasOverride])

  function startOverride() {
    setCommands([...(project?.commands ?? [])])
    setEditing(true)
  }

  function resetToProject() {
    updateCommands.mutate({ id: session.id, commands: [] })
    setEditing(false)
  }

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

  function save() {
    const filtered = commands.filter((c) => c.label.trim() && c.command.trim())
    updateCommands.mutate({ id: session.id, commands: filtered })
    setEditing(false)
  }

  return (
    <div className="h-full overflow-y-auto p-1 space-y-4">
      {/* Session info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Session</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Status</span>
            <Badge variant={session.status === "active" ? "default" : session.status === "failed" ? "destructive" : "secondary"}>
              {session.status}
            </Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Branch</span>
            <span className="font-mono text-xs">{session.branch_name}</span>
          </div>
          {session.worktree_path && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Worktree</span>
              <span className="font-mono text-xs truncate max-w-64">{session.worktree_path}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Created</span>
            <span className="text-xs">{new Date(session.created_at).toLocaleString()}</span>
          </div>
        </CardContent>
      </Card>

      {/* Agent info */}
      {agent && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              {provider?.logo && (
                <img src={provider.logo} alt={provider.name} className="size-6 rounded object-contain" />
              )}
              <div>
                <CardTitle className="text-sm">{agent.name}</CardTitle>
                <div className="flex items-center gap-1.5 mt-1">
                  <Badge variant="outline" className="text-[10px]">{provider?.name ?? agent.cli_name}</Badge>
                  {agent.model && <Badge variant="secondary" className="text-[10px]">{agent.model}</Badge>}
                </div>
              </div>
            </div>
          </CardHeader>
          {agent.instructions && (
            <CardContent>
              <p className="text-xs text-muted-foreground whitespace-pre-wrap">{agent.instructions}</p>
            </CardContent>
          )}
        </Card>
      )}

      <Separator />

      {/* Commands */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-base">Commands</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              {hasOverride
                ? "Overridden for this session."
                : "Inherited from project settings."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {hasOverride && !editing && (
              <Button variant="ghost" size="sm" onClick={resetToProject}>
                <RotateCcw className="size-3.5 mr-1" />
                Reset
              </Button>
            )}
            {!editing ? (
              <Button variant="outline" size="sm" onClick={startOverride}>
                Override
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={addCommand}>
                <PlusIcon className="size-3.5 mr-1" /> Add
              </Button>
            )}
          </div>
        </div>

        {/* Command list */}
        {(editing ? commands : effectiveCommands).map((cmd, i) => (
          <div key={i} className="flex items-center gap-2">
            {editing ? (
              <>
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
              </>
            ) : (
              <CommandRow cmd={cmd} />
            )}
          </div>
        ))}

        {effectiveCommands.length === 0 && !editing && (
          <p className="text-xs text-muted-foreground text-center py-4">
            No commands configured. Set them in project settings or override here.
          </p>
        )}

        {editing && (
          <div className="flex gap-2 pt-2">
            <Button size="sm" onClick={save} disabled={updateCommands.isPending}>
              Save
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

function CommandRow({ cmd }: { cmd: ProjectCommand }) {
  const Icon = getCommandIcon(cmd.icon)
  return (
    <div className="flex items-center gap-2 rounded-md border px-3 py-2 w-full">
      <Icon className="size-4 text-muted-foreground shrink-0" />
      <span className="text-sm font-medium">{cmd.label}</span>
      <span className="text-xs text-muted-foreground font-mono truncate ml-auto">{cmd.command}</span>
    </div>
  )
}

import { useState, useEffect } from "react"
import { PlusIcon, XIcon, RotateCcw, BotIcon } from "lucide-react"

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
import { sessionsApi } from "@/lib/api"
import { providers } from "@/lib/providers"
import { useQueryClient } from "@tanstack/react-query"
import type { Session, ProjectCommand, Agent } from "@/lib/api"
import { cn } from "@/lib/utils"

function AgentSelector({ agents, selectedId, onChange, allowNone }: {
  agents?: Agent[]
  selectedId?: string
  onChange: (id: string) => void
  allowNone?: boolean
}) {
  if (!agents || agents.length === 0) {
    return <p className="text-xs text-muted-foreground">No agents configured.</p>
  }

  return (
    <div className="grid gap-1.5">
      {allowNone && (
        <button
          type="button"
          onClick={() => onChange("")}
          className={cn(
            "flex items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors",
            !selectedId ? "border-primary bg-accent/50" : "border-border hover:bg-accent/30"
          )}
        >
          <span className="text-muted-foreground">None</span>
        </button>
      )}
      {agents.map((a) => {
        const p = providers.find((pr) => pr.id === a.cli_name)
        return (
          <button
            key={a.id}
            type="button"
            onClick={() => onChange(a.id)}
            className={cn(
              "flex items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors",
              selectedId === a.id ? "border-primary bg-accent/50" : "border-border hover:bg-accent/30"
            )}
          >
            {p?.logo ? (
              <img src={p.logo} alt={p.name} className="size-5 rounded object-contain" />
            ) : (
              <BotIcon className="size-4 text-muted-foreground" />
            )}
            <span className="font-medium">{a.name}</span>
            <Badge variant="outline" className="text-[10px] ml-auto">{p?.name ?? a.cli_name}</Badge>
            {a.model && <Badge variant="secondary" className="text-[10px]">{a.model}</Badge>}
          </button>
        )
      })}
    </div>
  )
}

interface SessionSettingsProps {
  session: Session
}

export function SessionSettings({ session }: SessionSettingsProps) {
  const { data: agents } = useAgents()
  const { data: projects } = useProjects()
  const updateCommands = useUpdateSessionCommands()
  const queryClient = useQueryClient()

  const project = projects?.find((p) => p.id === session.project_id)

  function changeAgent(agentId: string) {
    sessionsApi.updateAgent(session.id, agentId).then(() => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] })
    })
  }

  function changeReviewer(agentId: string | null) {
    sessionsApi.updateReviewer(session.id, agentId).then(() => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] })
    })
  }

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

      {/* Agent */}
      <div className="space-y-2">
        <Label>Agent</Label>
        <AgentSelector agents={agents} selectedId={session.agent_id} onChange={changeAgent} />
      </div>

      {/* Reviewer */}
      <div className="space-y-2">
        <Label>Reviewer (optional)</Label>
        <AgentSelector agents={agents} selectedId={session.reviewer_agent_id} onChange={(id) => changeReviewer(id || null)} allowNone />
      </div>

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

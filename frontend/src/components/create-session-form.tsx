import { useState } from "react"
import { BotIcon, GitBranchIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { useAgents } from "@/hooks/use-agents"
import { useProjects, useBranches } from "@/hooks/use-projects"
import { useCreateSession } from "@/hooks/use-sessions"
import { providers } from "@/lib/providers"
import { cn } from "@/lib/utils"

interface CreateSessionFormProps {
  projectId: string
  onSuccess?: (sessionId?: string) => void
}

export function CreateSessionForm({ projectId, onSuccess }: CreateSessionFormProps) {
  const { data: agents } = useAgents()
  const { data: projects } = useProjects()
  const { data: branches } = useBranches(projectId)
  const createSession = useCreateSession()

  const project = projects?.find((p) => p.id === projectId)
  const isDirect = project?.mode === "direct"

  const [agentId, setAgentId] = useState("")
  const [reviewerAgentId, setReviewerAgentId] = useState("")
  const [branchName, setBranchName] = useState("")
  const [baseBranch, setBaseBranch] = useState("")
  const [name, setName] = useState("")

  // Auto-detect default base branch.
  const defaultBase = branches?.find((b) => b === "main") ?? branches?.find((b) => b === "master") ?? branches?.[0] ?? "main"
  const effectiveBaseBranch = baseBranch || defaultBase

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!agentId) return
    if (!isDirect && !branchName.trim()) return

    createSession.mutate(
      {
        project_id: projectId,
        agent_id: agentId,
        reviewer_agent_id: reviewerAgentId || undefined,
        name: name.trim() || undefined,
        branch_name: isDirect ? (defaultBase || "main") : branchName.trim(),
        base_branch: isDirect ? undefined : effectiveBaseBranch,
      },
      {
        onSuccess: (session) => {
          setAgentId("")
          setReviewerAgentId("")
          setBranchName("")
          setBaseBranch("")
          setName("")
          onSuccess?.(session.id)
        },
      }
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {/* Agent selection */}
      <div className="space-y-3">
        <Label>Agent</Label>
        {!agents || agents.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No agents configured. Create one in the Agents page first.
          </p>
        ) : (
          <div className="grid gap-2">
            {agents.map((agent) => {
              const provider = providers.find((p) => p.id === agent.cli_name)
              return (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => setAgentId(agent.id)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent/50",
                    agentId === agent.id
                      ? "border-primary bg-accent/50"
                      : "border-border"
                  )}
                >
                  {provider?.logo ? (
                    <img src={provider.logo} alt={provider.name} className="size-6 rounded object-contain" />
                  ) : (
                    <BotIcon className="size-5 text-muted-foreground" />
                  )}
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-sm font-medium">{agent.name}</span>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="text-[10px]">
                        {provider?.name ?? agent.cli_name}
                      </Badge>
                      {agent.model && (
                        <Badge variant="secondary" className="text-[10px]">{agent.model}</Badge>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Reviewer agent (optional) */}
      <div className="space-y-3">
        <Label>Reviewer Agent (optional)</Label>
        <p className="text-xs text-muted-foreground">
          Enables interactive ping-pong review in a dedicated tab.
        </p>
        {agents && agents.length > 0 && (
          <div className="grid gap-2">
            <button
              type="button"
              onClick={() => setReviewerAgentId("")}
              className={cn(
                "flex items-center gap-3 rounded-lg border p-2.5 text-left text-xs transition-colors hover:bg-accent/50",
                !reviewerAgentId ? "border-primary bg-accent/50" : "border-border"
              )}
            >
              <span className="text-muted-foreground">None</span>
            </button>
            {agents.map((agent) => {
              const provider = providers.find((p) => p.id === agent.cli_name)
              return (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => setReviewerAgentId(agent.id)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border p-2.5 text-left text-xs transition-colors hover:bg-accent/50",
                    reviewerAgentId === agent.id ? "border-primary bg-accent/50" : "border-border"
                  )}
                >
                  {provider?.logo ? (
                    <img src={provider.logo} alt={provider.name} className="size-5 rounded object-contain" />
                  ) : (
                    <BotIcon className="size-4 text-muted-foreground" />
                  )}
                  <span className="font-medium">{agent.name}</span>
                  <Badge variant="outline" className="text-[10px] ml-auto">
                    {provider?.name ?? agent.cli_name}
                  </Badge>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Branch config — hidden in direct mode */}
      {!isDirect && <>
      <Separator />
      <div className="space-y-2">
        <Label htmlFor="branch-name">Branch Name</Label>
        <div className="relative">
          <GitBranchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="branch-name"
            className="pl-9"
            placeholder="feature/my-feature"
            value={branchName}
            onChange={(e) => setBranchName(e.target.value)}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          A new branch will be created if it doesn't exist.
        </p>
      </div>

      <div className="space-y-3">
        <Label>Base Branch</Label>
        {branches && branches.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {branches.map((branch) => (
              <button
                key={branch}
                type="button"
                onClick={() => setBaseBranch(branch)}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-sm font-mono transition-colors",
                  (baseBranch === branch || (!baseBranch && branch === defaultBase))
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border hover:bg-accent/50"
                )}
              >
                {branch}
              </button>
            ))}
          </div>
        ) : (
          <Input
            placeholder="main"
            value={baseBranch}
            onChange={(e) => setBaseBranch(e.target.value)}
          />
        )}
      </div>
      </>}

      {/* Optional display name */}
      <div className="space-y-2">
        <Label htmlFor="session-name">Display Name (optional)</Label>
        <Input
          id="session-name"
          placeholder="Fix auth bug"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      {/* Submit */}
      <Button
        type="submit"
        className="w-full"
        disabled={createSession.isPending || !agentId || (!isDirect && !branchName.trim())}
      >
        Create Session
      </Button>
      {createSession.isError && (
        <p className="text-sm text-destructive">{createSession.error.message}</p>
      )}
    </form>
  )
}

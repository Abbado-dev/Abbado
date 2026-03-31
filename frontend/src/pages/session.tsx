import { useState, useRef, useEffect } from "react"
import { useParams } from "react-router-dom"
import { BotIcon, TerminalIcon, GitCompareIcon, SettingsIcon, HistoryIcon, ScanEyeIcon, PlayIcon } from "lucide-react"

import { TerminalView } from "@/components/terminal-view"
import type { TerminalViewHandle } from "@/components/terminal-view"
import { ReviewerTab } from "@/components/reviewer-tab"
import { ChangesView } from "@/components/changes-view"
import { RunTab } from "@/components/run-tab"
import type { RunTabHandle } from "@/components/run-tab"
import { SessionSettings } from "@/components/session-settings"
import { PromptHistory } from "@/components/prompt-history"
import { DeleteSessionDialog } from "@/components/delete-session-dialog"
import { SessionStatus } from "@/components/session-status"
import { useSessionEvents } from "@/hooks/use-session-events"
import { useSessions } from "@/hooks/use-sessions"
import { useProjects } from "@/hooks/use-projects"
import { useAgents } from "@/hooks/use-agents"
import { providers } from "@/lib/providers"
import { cn } from "@/lib/utils"

const baseTabs = [
  { id: "agent", label: "Agent", icon: BotIcon },
  { id: "terminal", label: "Terminal", icon: TerminalIcon },
  { id: "run", label: "Run", icon: PlayIcon },
  { id: "changes", label: "Changes", icon: GitCompareIcon },
  { id: "history", label: "History", icon: HistoryIcon },
  { id: "settings", label: "Settings", icon: SettingsIcon },
] as const

const reviewerTab = { id: "reviewer" as const, label: "Review", icon: ScanEyeIcon }

type TabId = (typeof baseTabs)[number]["id"] | "reviewer"


export function SessionPage() {
  const { id } = useParams<{ id: string }>()
  const [activeTab, setActiveTab] = useState<TabId>("agent")
  const { data: sessions } = useSessions()
  const { data: projects } = useProjects()
  const { data: agents } = useAgents()

  const agentTermRef = useRef<TerminalViewHandle>(null)
  const shellTermRef = useRef<TerminalViewHandle>(null)
  const reviewerTermRef = useRef<TerminalViewHandle>(null)
  const runnerRef = useRef<RunTabHandle>(null)

  const session = sessions?.find((s) => s.id === id)
  const { activity, markActive } = useSessionEvents(id, session?.status)
  const project = session ? projects?.find((p) => p.id === session.project_id) : null
  const agent = session ? agents?.find((a) => a.id === session.agent_id) : null
  const provider = agent ? providers.find((p) => p.id === agent.cli_name) : null

  // Focus terminal when switching tabs.
  useEffect(() => {
    // Small delay to let visibility toggle take effect.
    const timer = setTimeout(() => {
      if (activeTab === "agent") agentTermRef.current?.focus()
      else if (activeTab === "terminal") shellTermRef.current?.focus()
      else if (activeTab === "reviewer") reviewerTermRef.current?.focus()
      else if (activeTab === "run") runnerRef.current?.focus()
    }, 150)
    return () => clearTimeout(timer)
  }, [activeTab])

  if (!session) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-muted-foreground">Session not found.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0 pb-3">
        <div className="flex items-center gap-3">
          {provider?.logo && (
            <img src={provider.logo} alt={provider.name} className="size-6 rounded object-contain" />
          )}
          <div>
            <h1 className="text-lg font-semibold leading-tight">
              {session.name || session.branch_name}
            </h1>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {project && <span>{project.name}</span>}
              <span>/</span>
              {session.worktree_path ? (
                <a
                  href={`vscode://file/${session.worktree_path}`}
                  className="font-mono hover:text-foreground transition-colors"
                  title="Open in VS Code"
                >
                  {session.branch_name}
                </a>
              ) : (
                <span className="font-mono">{session.branch_name}</span>
              )}
              <SessionStatus activity={activity} />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <DeleteSessionDialog session={session} />
        </div>
      </div>

      {/* Tab bar */}
      {(() => {
        const tabs = session.reviewer_agent_id
          ? [baseTabs[0], baseTabs[1], baseTabs[2], reviewerTab, baseTabs[3], baseTabs[4], baseTabs[5]]
          : [...baseTabs]
        return (
          <div className="flex shrink-0 gap-1 bg-muted/50 p-1 rounded-lg">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-6 py-3 text-sm font-medium rounded-md transition-all",
                  activeTab === tab.id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                )}
              >
                <tab.icon className="size-4" />
                {tab.label}
              </button>
            ))}
          </div>
        )
      })()}

      {/* Tab panels — terminals use visibility (keep alive), others use display */}
      <div key={session.id} className="flex-1 min-h-0 pt-2 relative">
        <div className={cn("absolute inset-0 pt-2", activeTab === "agent" ? "visible" : "invisible")}>
          <TerminalView ref={agentTermRef} sessionId={session.id} type="agent" onInput={markActive} />
        </div>
        <div className={cn("absolute inset-0 pt-2", activeTab === "terminal" ? "visible" : "invisible")}>
          <TerminalView ref={shellTermRef} sessionId={session.id} type="shell" />
        </div>
        <div className={cn("absolute inset-0 pt-2", activeTab === "run" ? "visible" : "invisible")}>
          <RunTab ref={runnerRef} sessionId={session.id} commands={session.commands?.length ? session.commands : project?.commands} />
        </div>
        {session.reviewer_agent_id && (
          <div className={cn("absolute inset-0 pt-2", activeTab === "reviewer" ? "visible" : "invisible")}>
            <ReviewerTab ref={reviewerTermRef} sessionId={session.id} />
          </div>
        )}
        <div className={cn("absolute inset-0 pt-2", activeTab !== "changes" && "hidden")}>
          <ChangesView
            sessionId={session.id}
            reviewerAgentId={session.reviewer_agent_id}
            onSwitchToReviewer={() => setActiveTab("reviewer")}
          />
        </div>
        <div className={cn("absolute inset-0 pt-2 overflow-auto", activeTab !== "history" && "hidden")}>
          <PromptHistory sessionId={session.id} />
        </div>
        <div className={cn("absolute inset-0 pt-2 overflow-auto", activeTab !== "settings" && "hidden")}>
          <SessionSettings session={session} />
        </div>
      </div>
    </div>
  )
}

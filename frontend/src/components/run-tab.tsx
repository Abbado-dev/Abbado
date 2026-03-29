import { forwardRef, useImperativeHandle, useRef } from "react"
import { Square } from "lucide-react"

import { Button } from "@/components/ui/button"
import { TerminalView } from "@/components/terminal-view"
import type { TerminalViewHandle } from "@/components/terminal-view"
import { getCommandIcon } from "@/components/icon-picker"
import { runnerApi } from "@/lib/api"
import type { ProjectCommand } from "@/lib/api"

interface RunTabProps {
  sessionId: string
  commands?: ProjectCommand[]
}

export interface RunTabHandle {
  focus: () => void
}

export const RunTab = forwardRef<RunTabHandle, RunTabProps>(
  function RunTab({ sessionId, commands }, ref) {
    const termRef = useRef<TerminalViewHandle>(null)

    useImperativeHandle(ref, () => ({
      focus: () => termRef.current?.focus(),
    }))

    const exec = (command: string) => {
      runnerApi.exec(sessionId, command)
      termRef.current?.focus()
    }

    const stop = () => {
      runnerApi.stop(sessionId)
    }

    const hasCommands = commands && commands.length > 0

    return (
      <div className="flex flex-col h-full gap-2">
        {/* Toolbar */}
        <div className="flex items-center gap-2 shrink-0">
          {commands?.map((cmd, i) => {
            const Icon = getCommandIcon(cmd.icon)
            return (
              <Button key={i} variant="outline" size="sm" onClick={() => exec(cmd.command)}>
                <Icon className="size-3.5" data-icon="inline-start" />
                {cmd.label}
              </Button>
            )
          })}

          <div className="flex-1" />

          <Button variant="destructive" size="sm" onClick={stop}>
            <Square className="size-3.5" data-icon="inline-start" />
            Stop
          </Button>

          {!hasCommands && (
            <span className="text-xs text-muted-foreground">
              Configure commands in project settings
            </span>
          )}
        </div>

        {/* Terminal */}
        <div className="flex-1 min-h-0">
          <TerminalView ref={termRef} sessionId={sessionId} type="runner" />
        </div>
      </div>
    )
  }
)

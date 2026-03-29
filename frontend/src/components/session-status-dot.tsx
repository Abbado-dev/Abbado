import type { SessionStatus } from "@/lib/api"
import { cn } from "@/lib/utils"

interface SessionStatusDotProps {
  status: SessionStatus
}

const dotColor: Record<string, string> = {
  active: "bg-green-500",
  idle: "bg-muted-foreground/50",
  waiting: "bg-amber-500",
  completed: "bg-muted-foreground/50",
  failed: "bg-destructive",
}

export function SessionStatusDot({ status }: SessionStatusDotProps) {
  const color = dotColor[status] ?? dotColor.idle

  return (
    <span className="relative flex size-2" title={status}>
      {(status === "active" || status === "waiting") && (
        <span className={cn("absolute inline-flex size-full animate-ping rounded-full opacity-75", color)} />
      )}
      <span className={cn("relative inline-flex size-2 rounded-full", color)} />
    </span>
  )
}

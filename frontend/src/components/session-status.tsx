import {
  LoaderIcon,
  CirclePauseIcon,
  AlertTriangleIcon,
  WifiOffIcon,
} from "lucide-react"
import type { SessionActivity } from "@/hooks/use-session-events"
import { cn } from "@/lib/utils"

interface SessionStatusProps {
  activity: SessionActivity
  compact?: boolean
}

const statusConfig = {
  active: {
    icon: LoaderIcon,
    label: "Working",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    animate: true,
  },
  idle: {
    icon: CirclePauseIcon,
    label: "Idle",
    color: "text-muted-foreground",
    bgColor: "bg-muted",
    animate: false,
  },
  waiting: {
    icon: AlertTriangleIcon,
    label: "Needs attention",
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
    animate: true,
  },
  disconnected: {
    icon: WifiOffIcon,
    label: "Disconnected",
    color: "text-muted-foreground",
    bgColor: "bg-muted",
    animate: false,
  },
}

export function SessionStatus({ activity, compact }: SessionStatusProps) {
  const config = statusConfig[activity.status]
  const Icon = config.icon

  if (compact) {
    return (
      <div className={cn("flex items-center gap-1.5", config.color)} title={config.label}>
        <Icon className={cn("size-3.5", config.animate && "animate-spin")} />
      </div>
    )
  }

  return (
    <div className={cn("flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium", config.bgColor, config.color)}>
      <Icon className={cn("size-3.5", config.animate && activity.status === "active" && "animate-spin")} />
      <span>{activity.label ?? config.label}</span>
      {activity.currentTool && activity.status === "active" && (
        <span className="text-[10px] opacity-70 font-mono">
          {activity.currentTool}
        </span>
      )}
    </div>
  )
}

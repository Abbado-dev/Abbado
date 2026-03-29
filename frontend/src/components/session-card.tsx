import { GitBranchIcon, ClockIcon } from "lucide-react"

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { SessionStatusDot } from "@/components/session-status-dot"
import type { Session } from "@/lib/api"

export function SessionCard({ session }: { session: Session }) {
  return (
    <Card className="hover:border-primary/30 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SessionStatusDot status={session.status} />
            <CardTitle className="text-sm font-medium">
              {session.name || session.branch_name}
            </CardTitle>
          </div>
        </div>
        <CardDescription className="flex items-center gap-2 text-xs">
          <GitBranchIcon className="size-3" />
          {session.branch_name}
          <span className="text-muted-foreground">from {session.base_branch}</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <ClockIcon className="size-3" />
            {new Date(session.created_at).toLocaleDateString()}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

import { Link } from "react-router-dom"

import { SessionCard } from "@/components/session-card"
import { ProviderUsage } from "@/components/provider-usage"
import { useSessions } from "@/hooks/use-sessions"

export function DashboardPage() {
  const { data: sessions, isLoading } = useSessions()

  const activeSessions = sessions?.filter((s) => s.status === "active" || s.status === "idle") ?? []
  const completedSessions = sessions?.filter((s) => s.status === "completed" || s.status === "failed") ?? []

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Overview of your agent sessions and provider usage.
        </p>
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground">Loading...</p>
      )}

      {/* Provider usage */}
      <ProviderUsage />

      {!isLoading && activeSessions.length === 0 && completedSessions.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">
            No sessions yet. Create a project and start a session to get going.
          </p>
        </div>
      )}

      {activeSessions.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-medium">Active Sessions</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {activeSessions.map((session) => (
              <Link key={session.id} to={`/sessions/${session.id}`}>
                <SessionCard session={session} />
              </Link>
            ))}
          </div>
        </section>
      )}

      {completedSessions.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-medium">Completed</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {completedSessions.map((session) => (
              <Link key={session.id} to={`/sessions/${session.id}`}>
                <SessionCard session={session} />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

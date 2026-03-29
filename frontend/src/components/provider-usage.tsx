import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { useSessions } from "@/hooks/use-sessions"
import { useAgents } from "@/hooks/use-agents"
import { providers } from "@/lib/providers"

type ProviderStats = {
  providerId: string
  name: string
  logo: string
  sessions: number
  activeSessions: number
}

export function ProviderUsage() {
  const { data: sessions } = useSessions()
  const { data: agents } = useAgents()

  if (!sessions || !agents || sessions.length === 0) return null

  const agentProviderMap = new Map<string, string>()
  agents.forEach((a) => agentProviderMap.set(a.id, a.cli_name))

  const statsMap = new Map<string, ProviderStats>()

  sessions.forEach((session) => {
    const providerId = agentProviderMap.get(session.agent_id) ?? "unknown"
    const provider = providers.find((p) => p.id === providerId)

    if (!statsMap.has(providerId)) {
      statsMap.set(providerId, {
        providerId,
        name: provider?.name ?? providerId,
        logo: provider?.logo ?? "",
        sessions: 0,
        activeSessions: 0,
      })
    }

    const stats = statsMap.get(providerId)!
    stats.sessions++
    if (session.status === "active" || session.status === "idle" || session.status === "waiting") {
      stats.activeSessions++
    }
  })

  const providerStats = Array.from(statsMap.values())
  const totalSessions = providerStats.reduce((sum, s) => sum + s.sessions, 0)
  const totalActive = providerStats.reduce((sum, s) => sum + s.activeSessions, 0)

  return (
    <div className="space-y-4">
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Total Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSessions}</div>
            {totalActive > 0 && (
              <p className="text-xs text-muted-foreground">{totalActive} active</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Providers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{providerStats.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalActive}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {providerStats.map((stats) => (
          <Card key={stats.providerId}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                {stats.logo && (
                  <img src={stats.logo} alt={stats.name} className="size-8 rounded object-contain" />
                )}
                <div>
                  <CardTitle className="text-sm font-medium">{stats.name}</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {stats.sessions} session{stats.sessions !== 1 ? "s" : ""}
                    {stats.activeSessions > 0 && ` · ${stats.activeSessions} active`}
                  </p>
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  )
}

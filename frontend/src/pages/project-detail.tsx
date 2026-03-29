import { useState } from "react"
import { useParams } from "react-router-dom"
import { PlusIcon, GitBranchIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet"
import { SessionCard } from "@/components/session-card"
import { CreateSessionForm } from "@/components/create-session-form"
import { useProjects } from "@/hooks/use-projects"
import { useSessions } from "@/hooks/use-sessions"

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: projects } = useProjects()
  const { data: sessions, isLoading } = useSessions(id)
  const [sheetOpen, setSheetOpen] = useState(false)

  const project = projects?.find((p) => p.id === id)

  if (!project) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-muted-foreground">Project not found.</p>
      </div>
    )
  }

  const activeSessions = sessions?.filter((s) => s.status === "active" || s.status === "idle") ?? []
  const completedSessions = sessions?.filter((s) => s.status === "completed" || s.status === "failed") ?? []

  return (
    <div className="space-y-8">
      {/* Project header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
          <p className="text-sm text-muted-foreground font-mono">{project.repo_path}</p>
        </div>

        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger render={<Button />}>
            <PlusIcon className="size-4 mr-1" />
            New Session
          </SheetTrigger>
          <SheetContent className="overflow-y-auto sm:max-w-xl">
            <SheetHeader>
              <SheetTitle>New Session</SheetTitle>
              <SheetDescription>
                Pick an agent and configure the branch for this session.
              </SheetDescription>
            </SheetHeader>
            <div className="pb-6">
              <CreateSessionForm
                projectId={project.id}
                onSuccess={() => setSheetOpen(false)}
              />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground">Loading sessions...</p>
      )}

      {!isLoading && activeSessions.length === 0 && completedSessions.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <GitBranchIcon className="size-10 text-muted-foreground mb-3" />
          <p className="text-sm font-medium">No sessions yet</p>
          <p className="text-sm text-muted-foreground mb-4">
            Create a session to start working with an agent on this project.
          </p>
          <Button variant="outline" onClick={() => setSheetOpen(true)}>
            <PlusIcon className="size-4 mr-1" />
            New Session
          </Button>
        </div>
      )}

      {activeSessions.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-medium">Active Sessions</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {activeSessions.map((session) => (
              <SessionCard key={session.id} session={session} />
            ))}
          </div>
        </section>
      )}

      {completedSessions.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-medium">Completed</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {completedSessions.map((session) => (
              <SessionCard key={session.id} session={session} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

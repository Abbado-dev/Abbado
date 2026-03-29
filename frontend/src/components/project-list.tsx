import { useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import {
  FolderGit2Icon,
  PlusIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  SettingsIcon,
  ArrowUpIcon,
  ArrowDownIcon,
} from "lucide-react"

import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { CreateProjectForm } from "@/components/create-project-form"
import { CreateSessionForm } from "@/components/create-session-form"
import { ProjectSettingsForm } from "@/components/project-settings-form"
import { SessionStatusDot } from "@/components/session-status-dot"
import { useProjects } from "@/hooks/use-projects"
import { useSessions } from "@/hooks/use-sessions"
import { useQueryClient } from "@tanstack/react-query"
import { projectsApi, sessionsApi } from "@/lib/api"
import type { Project } from "@/lib/api"
import { cn } from "@/lib/utils"

function ProjectItem({ project, onMoveUp, onMoveDown }: { project: Project; onMoveUp?: () => void; onMoveDown?: () => void }) {
  const { id: projectId, name: projectName } = project
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: sessions } = useSessions(projectId)
  const [sessionSheetOpen, setSessionSheetOpen] = useState(false)
  const [settingsSheetOpen, setSettingsSheetOpen] = useState(false)
  const [isOpen, setIsOpen] = useState(true)

  function moveSession(index: number, direction: -1 | 1) {
    if (!sessions) return
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= sessions.length) return
    const reordered = [...sessions]
    const [moved] = reordered.splice(index, 1)
    reordered.splice(newIndex, 0, moved)
    sessionsApi.reorder(reordered.map((s) => s.id)).then(() => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] })
    })
  }

  const sessionCount = sessions?.length ?? 0
  const ChevronIcon = isOpen ? ChevronDownIcon : ChevronRightIcon

  return (
    <>
      <Collapsible defaultOpen onOpenChange={(open) => setIsOpen(open)}>
        <SidebarMenuItem>
          <div className="group/project flex items-center">
            <div className="flex flex-col opacity-0 group-hover/project:opacity-100 transition-opacity shrink-0">
              {onMoveUp && (
                <button type="button" onClick={onMoveUp} className="p-0.5 hover:bg-sidebar-accent rounded" title="Move up">
                  <ArrowUpIcon className="size-2.5 text-muted-foreground" />
                </button>
              )}
              {onMoveDown && (
                <button type="button" onClick={onMoveDown} className="p-0.5 hover:bg-sidebar-accent rounded" title="Move down">
                  <ArrowDownIcon className="size-2.5 text-muted-foreground" />
                </button>
              )}
            </div>
            <CollapsibleTrigger
              className={cn(
                "flex flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors",
              )}
            >
              <ChevronIcon className="size-4 shrink-0" />
              <FolderGit2Icon className="size-4 shrink-0" />
              <span className="truncate flex-1 text-left">{projectName}</span>
              {sessionCount > 0 && !isOpen && (
                <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {sessionCount}
                </span>
              )}
            </CollapsibleTrigger>
            <button
              type="button"
              onClick={() => setSettingsSheetOpen(true)}
              className="size-6 shrink-0 flex items-center justify-center rounded hover:bg-sidebar-accent"
              title="Project settings"
            >
              <SettingsIcon className="size-3" />
            </button>
            <button
              type="button"
              onClick={() => setSessionSheetOpen(true)}
              className="size-6 shrink-0 flex items-center justify-center rounded hover:bg-sidebar-accent"
              title="New session"
            >
              <PlusIcon className="size-3.5" />
            </button>
          </div>

          <CollapsibleContent>
            <SidebarMenuSub>
              {sessions?.map((session, idx) => (
                  <SidebarMenuSubItem key={session.id}>
                    <div className="group/session flex items-center">
                      <div className="flex flex-col opacity-0 group-hover/session:opacity-100 transition-opacity shrink-0">
                        {idx > 0 && (
                          <button type="button" onClick={() => moveSession(idx, -1)} className="p-0.5 hover:bg-sidebar-accent rounded">
                            <ArrowUpIcon className="size-2 text-muted-foreground" />
                          </button>
                        )}
                        {sessions && idx < sessions.length - 1 && (
                          <button type="button" onClick={() => moveSession(idx, 1)} className="p-0.5 hover:bg-sidebar-accent rounded">
                            <ArrowDownIcon className="size-2 text-muted-foreground" />
                          </button>
                        )}
                      </div>
                      <SidebarMenuSubButton
                        render={<Link to={`/sessions/${session.id}`} />}
                        isActive={location.pathname === `/sessions/${session.id}`}
                      >
                        <SessionStatusDot status={session.status} />
                        <span className="truncate">
                          {session.name || session.branch_name}
                        </span>
                      </SidebarMenuSubButton>
                    </div>
                  </SidebarMenuSubItem>
              ))}
              {(!sessions || sessions.length === 0) && (
                <SidebarMenuSubItem>
                  <span className="px-2 py-1 text-xs text-muted-foreground">No sessions</span>
                </SidebarMenuSubItem>
              )}
            </SidebarMenuSub>
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>

      <Sheet open={sessionSheetOpen} onOpenChange={setSessionSheetOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>New Session</SheetTitle>
            <SheetDescription>
              Create a session for {projectName}.
            </SheetDescription>
          </SheetHeader>
          <div className="pb-6">
            <CreateSessionForm
              projectId={projectId}
              onSuccess={(sessionId) => {
                setSessionSheetOpen(false)
                if (sessionId) navigate(`/sessions/${sessionId}`)
              }}
            />
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={settingsSheetOpen} onOpenChange={setSettingsSheetOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Project Settings</SheetTitle>
            <SheetDescription>
              Configure commands and settings for {projectName}.
            </SheetDescription>
          </SheetHeader>
          <div className="pb-6">
            <ProjectSettingsForm
              project={project}
              onSuccess={() => setSettingsSheetOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

export function ProjectList() {
  const { data: projects } = useProjects()
  const queryClient = useQueryClient()
  const [projectSheetOpen, setProjectSheetOpen] = useState(false)

  function moveProject(index: number, direction: -1 | 1) {
    if (!projects) return
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= projects.length) return
    const reordered = [...projects]
    const [moved] = reordered.splice(index, 1)
    reordered.splice(newIndex, 0, moved)
    projectsApi.reorder(reordered.map((p) => p.id)).then(() => {
      queryClient.invalidateQueries({ queryKey: ["projects"] })
    })
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel>
        Projects
        <SidebarGroupAction onClick={() => setProjectSheetOpen(true)} title="Add project">
          <PlusIcon />
        </SidebarGroupAction>
      </SidebarGroupLabel>
      <SidebarMenu>
        {projects?.map((project, index) => (
          <ProjectItem
            key={project.id}
            project={project}
            onMoveUp={index > 0 ? () => moveProject(index, -1) : undefined}
            onMoveDown={index < (projects.length - 1) ? () => moveProject(index, 1) : undefined}
          />
        ))}
      </SidebarMenu>

      <Sheet open={projectSheetOpen} onOpenChange={setProjectSheetOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Add Project</SheetTitle>
            <SheetDescription>
              Point to an existing git repository on your machine.
            </SheetDescription>
          </SheetHeader>
          <div className="pb-6">
            <CreateProjectForm onSuccess={() => setProjectSheetOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </SidebarGroup>
  )
}

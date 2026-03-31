import { useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import {
  FolderGit2Icon,
  PlusIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  SettingsIcon,
  GripVerticalIcon,
  LayersIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

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
import { Input } from "@/components/ui/input"
import { useProjects } from "@/hooks/use-projects"
import { useSessions } from "@/hooks/use-sessions"
import { useWorkspaces, useCreateWorkspace, useUpdateWorkspace, useDeleteWorkspace } from "@/hooks/use-workspaces"
import { useQueryClient } from "@tanstack/react-query"
import { projectsApi, sessionsApi, workspacesApi } from "@/lib/api"
import type { Project, Session } from "@/lib/api"

// --- Drag handle ---

function DragHandle({ listeners, attributes }: { listeners?: ReturnType<typeof useSortable>["listeners"]; attributes?: ReturnType<typeof useSortable>["attributes"] }) {
  return (
    <button
      type="button"
      className="shrink-0 cursor-grab active:cursor-grabbing p-0.5 opacity-0 group-hover:opacity-100 transition-opacity touch-none"
      {...listeners}
      {...attributes}
    >
      <GripVerticalIcon className="size-3 text-muted-foreground" />
    </button>
  )
}

// --- Sortable session ---

function SortableSession({ session, isActive }: { session: Session; isActive: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: session.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <SidebarMenuSubItem ref={setNodeRef} style={style}>
      <div className="group flex items-center">
        <DragHandle listeners={listeners} attributes={attributes} />
        <SidebarMenuSubButton
          render={<Link to={`/sessions/${session.id}`} />}
          isActive={isActive}
        >
          <SessionStatusDot status={session.status} />
          <span className="truncate">{session.name || session.branch_name}</span>
          {session.reviewer_status && session.reviewer_status !== "idle" && (
            <span className={`size-1.5 rounded-full shrink-0 ${session.reviewer_status === "waiting" ? "bg-amber-500" : "bg-purple-400"} animate-pulse`} title={`Reviewer: ${session.reviewer_status}`} />
          )}
        </SidebarMenuSubButton>
      </div>
    </SidebarMenuSubItem>
  )
}

// --- Project item ---

function ActivityBadge({ sessions }: { sessions?: Session[] }) {
  const active = sessions?.filter((s) => s.status === "active" || s.status === "waiting") ?? []
  if (active.length === 0) return null
  const hasWaiting = active.some((s) => s.status === "waiting")
  return (
    <span className={`shrink-0 flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${hasWaiting ? "bg-amber-500/15 text-amber-400" : "bg-green-500/15 text-green-400"}`}>
      <span className={`size-1.5 rounded-full ${hasWaiting ? "bg-amber-500" : "bg-green-500"}`} />
      {active.length}
    </span>
  )
}

function ProjectItem({ project, forceOpen }: { project: Project; forceOpen?: boolean }) {
  const { id: projectId, name: projectName } = project
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: sessions } = useSessions(projectId)
  const [sessionSheetOpen, setSessionSheetOpen] = useState(false)
  const [settingsSheetOpen, setSettingsSheetOpen] = useState(false)
  const [isOpen, setIsOpen] = useState(forceOpen ?? false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleSessionDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id || !sessions) return
    const oldIdx = sessions.findIndex((s) => s.id === active.id)
    const newIdx = sessions.findIndex((s) => s.id === over.id)
    if (oldIdx < 0 || newIdx < 0) return
    const reordered = arrayMove(sessions, oldIdx, newIdx)
    sessionsApi.reorder(reordered.map((s) => s.id)).then(() => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] })
    })
  }

  const ChevronIcon = isOpen ? ChevronDownIcon : ChevronRightIcon

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <SidebarMenuItem>
          <div className="group/project flex items-center">
            <CollapsibleTrigger
              className="flex flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
            >
              <ChevronIcon className="size-4 shrink-0" />
              <FolderGit2Icon className="size-4 shrink-0" />
              <span className="truncate flex-1 text-left">{projectName}</span>
              {!isOpen && <ActivityBadge sessions={sessions} />}
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
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSessionDragEnd}>
                <SortableContext items={sessions?.map((s) => s.id) ?? []} strategy={verticalListSortingStrategy}>
                  {sessions?.map((session) => (
                    <SortableSession
                      key={session.id}
                      session={session}
                      isActive={location.pathname === `/sessions/${session.id}`}
                    />
                  ))}
                </SortableContext>
              </DndContext>
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
            <SheetDescription>Create a session for {projectName}.</SheetDescription>
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
            <SheetDescription>Configure commands and settings for {projectName}.</SheetDescription>
          </SheetHeader>
          <div className="pb-6">
            <ProjectSettingsForm project={project} onSuccess={() => setSettingsSheetOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

// --- Sortable project ---

function SortableProject({ project, forceOpen }: { project: Project; forceOpen?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: project.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="group flex items-center">
      <DragHandle listeners={listeners} attributes={attributes} />
      <div className="flex-1 min-w-0">
        <ProjectItem project={project} forceOpen={forceOpen} />
      </div>
    </div>
  )
}

// --- Sortable workspace ---

function SortableWorkspaceGroup({ workspaceId, name, projects, forceOpen, allSessions }: { workspaceId: string; name: string; projects: Project[]; forceOpen?: boolean; allSessions?: Session[] }) {
  const queryClient = useQueryClient()
  const updateWorkspace = useUpdateWorkspace()
  const deleteWorkspace = useDeleteWorkspace()
  const [isOpen, setIsOpen] = useState(forceOpen ?? false)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(name)

  // Sessions belonging to projects in this workspace
  const projectIds = new Set(projects.map((p) => p.id))
  const workspaceSessions = allSessions?.filter((s) => projectIds.has(s.project_id))

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: workspaceId })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleProjectDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const allProjects = queryClient.getQueryData<Project[]>(["projects"]) ?? []
    const oldIdx = allProjects.findIndex((p) => p.id === active.id)
    const newIdx = allProjects.findIndex((p) => p.id === over.id)
    if (oldIdx < 0 || newIdx < 0) return
    const reordered = arrayMove(allProjects, oldIdx, newIdx)
    projectsApi.reorder(reordered.map((p) => p.id)).then(() => {
      queryClient.invalidateQueries({ queryKey: ["projects"] })
    })
  }

  const ChevronIcon = isOpen ? ChevronDownIcon : ChevronRightIcon

  return (
    <div ref={setNodeRef} style={style}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <SidebarMenuItem>
          <div className="group/workspace flex items-center">
            <DragHandle listeners={listeners} attributes={attributes} />
            <CollapsibleTrigger className="flex flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:bg-sidebar-accent transition-colors">
              <ChevronIcon className="size-3 shrink-0" />
              <LayersIcon className="size-3 shrink-0" />
              {editing ? (
                <Input
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={() => { updateWorkspace.mutate({ id: workspaceId, name: editName }); setEditing(false) }}
                  onKeyDown={(e) => { if (e.key === "Enter") { updateWorkspace.mutate({ id: workspaceId, name: editName }); setEditing(false) } if (e.key === "Escape") setEditing(false) }}
                  onClick={(e) => e.stopPropagation()}
                  className="h-5 text-xs px-1 py-0 w-24"
                />
              ) : (
                <span className="truncate flex-1 text-left">{name}</span>
              )}
              {!isOpen && <ActivityBadge sessions={workspaceSessions} />}
            </CollapsibleTrigger>
            <div className="flex opacity-0 group-hover/workspace:opacity-100 transition-opacity">
              <button type="button" onClick={() => { setEditName(name); setEditing(true) }} className="size-5 flex items-center justify-center rounded hover:bg-sidebar-accent" title="Rename">
                <PencilIcon className="size-2.5" />
              </button>
              <button type="button" onClick={() => deleteWorkspace.mutate(workspaceId)} className="size-5 flex items-center justify-center rounded hover:bg-sidebar-accent text-destructive" title="Delete workspace">
                <Trash2Icon className="size-2.5" />
              </button>
            </div>
          </div>
          <CollapsibleContent>
            <SidebarMenuSub>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleProjectDragEnd}>
                <SortableContext items={projects.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                  {projects.map((project) => (
                    <SortableProject key={project.id} project={project} forceOpen={forceOpen} />
                  ))}
                </SortableContext>
              </DndContext>
            </SidebarMenuSub>
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>
    </div>
  )
}

// --- Main list ---

export function ProjectList() {
  const { data: projects } = useProjects()
  const { data: workspaces } = useWorkspaces()
  const { data: allSessions } = useSessions()
  const createWorkspace = useCreateWorkspace()
  const queryClient = useQueryClient()
  const [projectSheetOpen, setProjectSheetOpen] = useState(false)
  const location = useLocation()

  // Determine which project contains the current session.
  const currentSessionId = location.pathname.match(/\/sessions\/(.+)/)?.[1]
  const currentSession = allSessions?.find((s) => s.id === currentSessionId)
  const currentProjectId = currentSession?.project_id
  const currentProject = projects?.find((p) => p.id === currentProjectId)
  const currentWorkspaceId = currentProject?.workspace_id

  const ungrouped = projects?.filter((p) => !p.workspace_id) ?? []
  const grouped = workspaces?.map((ws) => ({
    ...ws,
    projects: projects?.filter((p) => p.workspace_id === ws.id) ?? [],
  })) ?? []

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // Workspace reorder
  function handleWorkspaceDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id || !workspaces) return
    const oldIdx = workspaces.findIndex((ws) => ws.id === active.id)
    const newIdx = workspaces.findIndex((ws) => ws.id === over.id)
    if (oldIdx < 0 || newIdx < 0) return
    const reordered = arrayMove(workspaces, oldIdx, newIdx)
    workspacesApi.reorder(reordered.map((ws) => ws.id)).then(() => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] })
    })
  }

  // Ungrouped project reorder
  function handleUngroupedDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const allProjects = projects ?? []
    const oldIdx = allProjects.findIndex((p) => p.id === active.id)
    const newIdx = allProjects.findIndex((p) => p.id === over.id)
    if (oldIdx < 0 || newIdx < 0) return
    const reordered = arrayMove(allProjects, oldIdx, newIdx)
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
        {/* Workspace groups — sortable */}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleWorkspaceDragEnd}>
          <SortableContext items={grouped.map((ws) => ws.id)} strategy={verticalListSortingStrategy}>
            {grouped.map((ws) => (
              <SortableWorkspaceGroup
                key={ws.id}
                workspaceId={ws.id}
                name={ws.name}
                projects={ws.projects}
                forceOpen={ws.id === currentWorkspaceId}
                allSessions={allSessions}
              />
            ))}
          </SortableContext>
        </DndContext>

        {/* Ungrouped projects — sortable */}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleUngroupedDragEnd}>
          <SortableContext items={ungrouped.map((p) => p.id)} strategy={verticalListSortingStrategy}>
            {ungrouped.map((project) => (
              <SortableProject key={project.id} project={project} forceOpen={project.id === currentProjectId} />
            ))}
          </SortableContext>
        </DndContext>

        {/* New workspace button */}
        <SidebarMenuItem>
          <button
            type="button"
            onClick={() => createWorkspace.mutate({ name: "New Workspace" })}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-sidebar-accent transition-colors w-full"
          >
            <PlusIcon className="size-3" />
            <span>New workspace</span>
          </button>
        </SidebarMenuItem>
      </SidebarMenu>

      <Sheet open={projectSheetOpen} onOpenChange={setProjectSheetOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Add Project</SheetTitle>
            <SheetDescription>Point to an existing git repository on your machine.</SheetDescription>
          </SheetHeader>
          <div className="pb-6">
            <CreateProjectForm onSuccess={() => setProjectSheetOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </SidebarGroup>
  )
}

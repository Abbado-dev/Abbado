import { useState } from "react"
import { FolderGit2Icon, PlusIcon, TrashIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet"
import { CreateProjectForm } from "@/components/create-project-form"
import { useProjects, useDeleteProject } from "@/hooks/use-projects"

export function ProjectsPage() {
  const { data: projects, isLoading } = useProjects()
  const deleteProject = useDeleteProject()
  const [sheetOpen, setSheetOpen] = useState(false)

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground">
            Manage your git repositories.
          </p>
        </div>

        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger render={<Button />}>
            <PlusIcon className="size-4 mr-1" />
            Add Project
          </SheetTrigger>
          <SheetContent className="overflow-y-auto sm:max-w-xl">
            <SheetHeader>
              <SheetTitle>Add Project</SheetTitle>
              <SheetDescription>
                Point to an existing git repository on your machine.
              </SheetDescription>
            </SheetHeader>
            <div className="pb-6">
              <CreateProjectForm onSuccess={() => setSheetOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground">Loading projects...</p>
      )}

      {!isLoading && (!projects || projects.length === 0) && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <FolderGit2Icon className="size-10 text-muted-foreground mb-3" />
          <p className="text-sm font-medium">No projects yet</p>
          <p className="text-sm text-muted-foreground mb-4">
            Add a git repository to get started.
          </p>
          <Button variant="outline" onClick={() => setSheetOpen(true)}>
            <PlusIcon className="size-4 mr-1" />
            Add Project
          </Button>
        </div>
      )}

      {projects && projects.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Card key={project.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FolderGit2Icon className="size-4 text-muted-foreground" />
                    <CardTitle className="text-sm font-medium">{project.name}</CardTitle>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() => deleteProject.mutate(project.id)}
                  >
                    <TrashIcon className="size-3.5" />
                  </Button>
                </div>
                <CardDescription className="text-xs font-mono truncate">
                  {project.repo_path}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

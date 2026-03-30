import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { projectsApi } from '@/lib/api'
import type { Project, ProjectMode, ProjectCommand } from '@/lib/api'

export function useBranches(projectId?: string) {
  return useQuery({
    queryKey: ['branches', projectId],
    queryFn: () => projectsApi.branches(projectId!),
    enabled: !!projectId,
  })
}

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: projectsApi.list,
  })
}

export function useCreateProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Pick<Project, 'name' | 'repo_path'> & { mode?: ProjectMode; workspace_id?: string }) =>
      projectsApi.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
  })
}

export function useUpdateProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name: string; mode: ProjectMode; commands?: ProjectCommand[]; workspace_id?: string }) =>
      projectsApi.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
  })
}

export function useDeleteProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => projectsApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
  })
}

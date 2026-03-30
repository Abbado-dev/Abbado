import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { workspacesApi } from '@/lib/api'

export function useWorkspaces() {
  return useQuery({
    queryKey: ['workspaces'],
    queryFn: workspacesApi.list,
  })
}

export function useCreateWorkspace() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string }) => workspacesApi.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workspaces'] }),
  })
}

export function useUpdateWorkspace() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      workspacesApi.update(id, { name }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workspaces'] }),
  })
}

export function useDeleteWorkspace() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => workspacesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}

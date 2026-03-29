import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { sessionsApi } from '@/lib/api'
import type { ProjectCommand } from '@/lib/api'

export function useSessions(projectId?: string) {
  return useQuery({
    queryKey: ['sessions', projectId],
    queryFn: () => sessionsApi.list(projectId),
  })
}

export function useCreateSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: sessionsApi.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sessions'] }),
  })
}

export function useUpdateSessionCommands() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, commands }: { id: string; commands: ProjectCommand[] }) =>
      sessionsApi.updateCommands(id, commands),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sessions'] }),
  })
}

export function useDeleteSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => sessionsApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sessions'] }),
  })
}

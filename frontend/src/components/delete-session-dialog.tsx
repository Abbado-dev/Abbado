import { TrashIcon } from "lucide-react"
import { useNavigate } from "react-router-dom"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { useDeleteSession } from "@/hooks/use-sessions"
import type { Session } from "@/lib/api"

interface DeleteSessionDialogProps {
  session: Session
}

export function DeleteSessionDialog({ session }: DeleteSessionDialogProps) {
  const deleteSession = useDeleteSession()
  const navigate = useNavigate()

  function handleDelete() {
    deleteSession.mutate(session.id, {
      onSuccess: () => navigate("/"),
    })
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-destructive" />
        }
      >
        <TrashIcon className="size-3.5" />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete session?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete the session <strong>{session.name || session.branch_name}</strong>,
            remove the git worktree, and delete the local branch <code className="text-xs bg-muted px-1 py-0.5 rounded">{session.branch_name}</code>.
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete Session
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

import { useState, useMemo, useRef, useCallback } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  FileIcon,
  PlusIcon,
  MinusIcon,
  RefreshCwIcon,
  GitCommitIcon,
  UploadIcon,
  GitPullRequestIcon,
  CheckIcon,
  LoaderIcon,
  SparklesIcon,
  SquareIcon,
  CheckSquareIcon,
  MinusSquareIcon,
  ScanEyeIcon,
  XIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { MonacoDiff } from "@/components/monaco-diff"
import { changesApi } from "@/lib/api"
import { cn } from "@/lib/utils"

interface ChangesViewProps {
  sessionId: string
  reviewerAgentId?: string
  onSwitchToReviewer?: () => void
}

export function ChangesView({ sessionId, reviewerAgentId, onSwitchToReviewer }: ChangesViewProps) {
  const queryClient = useQueryClient()
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [stagedFiles, setStagedFiles] = useState<Set<string>>(new Set())
  const [commitMsg, setCommitMsg] = useState("")
  const [prTitle, setPrTitle] = useState("")
  const [prBody, setPrBody] = useState("")
  const [showPRForm, setShowPRForm] = useState(false)
  const [showReview, setShowReview] = useState(false)

  const { data: files, isLoading, refetch } = useQuery({
    queryKey: ["changes", sessionId],
    queryFn: () => changesApi.files(sessionId),
  })

  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const handleModifiedChange = useCallback((content: string) => {
    if (!selectedFile) return
    clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      changesApi.saveFile(sessionId, selectedFile, content)
    }, 1000)
  }, [sessionId, selectedFile])

  const { data: fileContent } = useQuery({
    queryKey: ["file-content", sessionId, selectedFile],
    queryFn: () => changesApi.fileContent(sessionId, selectedFile!),
    enabled: selectedFile !== null,
  })

  const allFiles = useMemo(() => files?.map((f) => f.file) ?? [], [files])
  const allStaged = allFiles.length > 0 && allFiles.every((f) => stagedFiles.has(f))
  const someStaged = allFiles.some((f) => stagedFiles.has(f))

  function toggleFile(file: string) {
    setStagedFiles((prev) => {
      const next = new Set(prev)
      if (next.has(file)) next.delete(file)
      else next.add(file)
      return next
    })
  }

  function toggleAll() {
    if (allStaged) {
      setStagedFiles(new Set())
    } else {
      setStagedFiles(new Set(allFiles))
    }
  }

  const commitMutation = useMutation({
    mutationFn: ({ message, staged }: { message: string; staged: string[] }) =>
      changesApi.commit(sessionId, message, staged.length === allFiles.length ? undefined : staged),
    onSuccess: () => {
      setCommitMsg("")
      setStagedFiles(new Set())
      refetch()
      queryClient.invalidateQueries({ queryKey: ["changes", sessionId] })
    },
  })

  const pushMutation = useMutation({
    mutationFn: () => changesApi.push(sessionId),
  })

  const generateMutation = useMutation({
    mutationFn: () => changesApi.generate(sessionId),
    onSuccess: (data) => {
      setCommitMsg(data.commit_message)
      setPrTitle(data.pr_title)
      setPrBody(data.pr_body)
    },
  })

  // One-shot review (no reviewer agent configured).
  const oneShotReviewMutation = useMutation({
    mutationFn: () => changesApi.review(sessionId),
    onSuccess: () => setShowReview(true),
  })

  // Interactive review (reviewer agent configured).
  const sendReviewMutation = useMutation({
    mutationFn: () => changesApi.sendReview(sessionId),
    onSuccess: () => onSwitchToReviewer?.(),
  })

  const reviewPending = oneShotReviewMutation.isPending || sendReviewMutation.isPending
  const reviewError = oneShotReviewMutation.error || sendReviewMutation.error

  function handleReview() {
    if (reviewerAgentId) {
      sendReviewMutation.mutate()
    } else {
      oneShotReviewMutation.mutate()
    }
  }

  const prMutation = useMutation({
    mutationFn: () => changesApi.createPR(sessionId, prTitle, prBody),
    onSuccess: (data) => {
      setShowPRForm(false)
      setPrTitle("")
      setPrBody("")
      if (data.url) window.open(data.url, "_blank")
    },
  })

  const canCommit = commitMsg.trim() && stagedFiles.size > 0

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Action bar */}
      <div className="flex items-center gap-2 shrink-0">
        <Button
          size="sm"
          variant="outline"
          disabled={generateMutation.isPending || !files || files.length === 0}
          onClick={() => generateMutation.mutate()}
          title="Generate commit message and PR with AI"
        >
          {generateMutation.isPending ? <LoaderIcon className="size-3.5 animate-spin" /> : <SparklesIcon className="size-3.5" />}
          <span className="ml-1.5">Generate</span>
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={reviewPending || !files || files.length === 0}
          onClick={() => handleReview()}
          title="AI code review"
        >
          {reviewPending ? <LoaderIcon className="size-3.5 animate-spin" /> : <ScanEyeIcon className="size-3.5" />}
          <span className="ml-1.5">Review</span>
        </Button>
        <div className="w-px h-5 bg-border" />
        <Input
          placeholder="Commit message..."
          value={commitMsg}
          onChange={(e) => setCommitMsg(e.target.value)}
          className="flex-1 h-9 text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter" && canCommit) {
              commitMutation.mutate({ message: commitMsg.trim(), staged: Array.from(stagedFiles) })
            }
          }}
        />
        <Button
          size="sm"
          variant="outline"
          disabled={!canCommit || commitMutation.isPending}
          onClick={() => commitMutation.mutate({ message: commitMsg.trim(), staged: Array.from(stagedFiles) })}
          title={stagedFiles.size === 0 ? "Select files to commit" : `Commit ${stagedFiles.size} file(s)`}
        >
          {commitMutation.isPending ? <LoaderIcon className="size-3.5 animate-spin" /> : <GitCommitIcon className="size-3.5" />}
          <span className="ml-1.5">Commit{stagedFiles.size > 0 ? ` (${stagedFiles.size})` : ""}</span>
        </Button>
        <Button size="sm" variant="outline" disabled={pushMutation.isPending} onClick={() => pushMutation.mutate()}>
          {pushMutation.isPending ? <LoaderIcon className="size-3.5 animate-spin" /> : pushMutation.isSuccess ? <CheckIcon className="size-3.5" /> : <UploadIcon className="size-3.5" />}
          <span className="ml-1.5">Push</span>
        </Button>
        <Button size="sm" variant="outline" onClick={() => setShowPRForm(!showPRForm)}>
          <GitPullRequestIcon className="size-3.5" />
          <span className="ml-1.5">PR</span>
        </Button>
      </div>

      {/* PR form */}
      {showPRForm && (
        <div className="flex flex-col gap-2 p-3 rounded-lg border shrink-0">
          <Input placeholder="PR title" value={prTitle} onChange={(e) => setPrTitle(e.target.value)} className="h-8 text-sm" />
          <Textarea placeholder="PR description (optional)" value={prBody} onChange={(e) => setPrBody(e.target.value)} rows={3} className="text-sm" />
          <div className="flex gap-2">
            <Button size="sm" disabled={!prTitle.trim() || prMutation.isPending} onClick={() => prMutation.mutate()}>
              {prMutation.isPending ? <LoaderIcon className="size-3.5 animate-spin mr-1.5" /> : <GitPullRequestIcon className="size-3.5 mr-1.5" />}
              Create Pull Request
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowPRForm(false)}>Cancel</Button>
          </div>
          {prMutation.isError && <p className="text-xs text-destructive">{prMutation.error.message}</p>}
        </div>
      )}

      {/* Errors */}
      {generateMutation.isError && <p className="text-xs text-destructive shrink-0">{generateMutation.error.message}</p>}
      {reviewError && <p className="text-xs text-destructive shrink-0">{reviewError?.message}</p>}
      {commitMutation.isError && <p className="text-xs text-destructive shrink-0">{commitMutation.error.message}</p>}
      {pushMutation.isError && <p className="text-xs text-destructive shrink-0">{pushMutation.error.message}</p>}

      {/* Review panel */}
      {showReview && oneShotReviewMutation.data && (
        <div className="shrink-0 max-h-64 overflow-y-auto rounded-lg border bg-muted/30 p-4 relative">
          <button
            type="button"
            onClick={() => setShowReview(false)}
            className="absolute top-2 right-2 p-1 rounded hover:bg-accent"
          >
            <XIcon className="size-3.5" />
          </button>
          <div className="flex items-center gap-2 mb-3">
            <ScanEyeIcon className="size-4 text-primary" />
            <span className="text-sm font-medium">AI Review</span>
          </div>
          <div className="text-sm whitespace-pre-wrap prose prose-sm dark:prose-invert max-w-none">
            {oneShotReviewMutation.data.review}
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 min-h-0 rounded-lg border overflow-hidden">
        {/* File list */}
        <div className="w-72 shrink-0 border-r flex flex-col">
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <button
              type="button"
              onClick={toggleAll}
              className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {allStaged ? (
                <CheckSquareIcon className="size-3.5 text-primary" />
              ) : someStaged ? (
                <MinusSquareIcon className="size-3.5 text-primary" />
              ) : (
                <SquareIcon className="size-3.5" />
              )}
              {files ? `${stagedFiles.size}/${files.length} staged` : "Files"}
            </button>
            <Button variant="ghost" size="icon" className="size-6" onClick={() => refetch()}>
              <RefreshCwIcon className="size-3" />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {isLoading && <p className="p-3 text-xs text-muted-foreground">Loading...</p>}
            {files && files.length === 0 && <p className="p-3 text-xs text-muted-foreground">No changes.</p>}
            {files?.map((file) => {
              const isStaged = stagedFiles.has(file.file)
              return (
                <div
                  key={file.file}
                  className={cn(
                    "flex w-full items-center gap-1.5 px-2 py-1.5 text-xs transition-colors",
                    selectedFile === file.file && "bg-accent"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => toggleFile(file.file)}
                    className="shrink-0 p-0.5 hover:bg-accent rounded"
                  >
                    {isStaged ? (
                      <CheckSquareIcon className="size-3.5 text-primary" />
                    ) : (
                      <SquareIcon className="size-3.5 text-muted-foreground" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedFile(file.file)}
                    onDoubleClick={() => toggleFile(file.file)}
                    className="flex items-center gap-1.5 min-w-0 flex-1 text-left hover:text-foreground"
                  >
                    <FileIcon className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate font-mono">{file.file}</span>
                  </button>
                  <span className="flex items-center gap-1 shrink-0">
                    {file.added !== "0" && file.added !== "-" && (
                      <span className="flex items-center text-green-500">
                        <PlusIcon className="size-2.5" />{file.added}
                      </span>
                    )}
                    {file.deleted !== "0" && file.deleted !== "-" && (
                      <span className="flex items-center text-red-500">
                        <MinusIcon className="size-2.5" />{file.deleted}
                      </span>
                    )}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Monaco diff editor */}
        <div className="flex-1 min-h-0 h-full overflow-hidden">
          {!selectedFile ? (
            <div className="flex items-center justify-center h-full bg-[#1e1e1e]">
              <p className="text-sm text-muted-foreground">Select a file to review changes.</p>
            </div>
          ) : fileContent ? (
            <MonacoDiff
              original={fileContent.old}
              modified={fileContent.new}
              fileName={selectedFile}
              onModifiedChange={handleModifiedChange}
            />
          ) : (
            <div className="flex items-center justify-center h-full bg-[#1e1e1e]">
              <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

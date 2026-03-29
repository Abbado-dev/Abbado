import { useState, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { MessageSquareIcon, SearchIcon } from "lucide-react"

import { Input } from "@/components/ui/input"
import { promptsApi } from "@/lib/api"

interface PromptHistoryProps {
  sessionId: string
}

export function PromptHistory({ sessionId }: PromptHistoryProps) {
  const [search, setSearch] = useState("")

  const { data: prompts, isLoading } = useQuery({
    queryKey: ["prompts", sessionId],
    queryFn: () => promptsApi.list(sessionId),
  })

  const filtered = useMemo(() => {
    if (!prompts) return []
    if (!search.trim()) return prompts
    const q = search.toLowerCase()
    return prompts.filter((p) => p.prompt.toLowerCase().includes(q))
  }, [prompts, search])

  if (isLoading) {
    return <p className="text-xs text-muted-foreground p-4">Loading prompts...</p>
  }

  if (!prompts || prompts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
        <MessageSquareIcon className="size-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">No prompts yet.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="relative shrink-0">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
        <Input
          placeholder="Search prompts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9 text-sm"
        />
      </div>

      <div className="flex-1 overflow-y-auto space-y-2">
        {filtered.length === 0 && (
          <p className="text-xs text-muted-foreground p-4 text-center">No matching prompts.</p>
        )}
        {filtered.map((prompt) => (
          <div key={prompt.id} className="flex gap-3 rounded-lg border p-3">
            <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-medium">
              {prompts!.length - prompts!.indexOf(prompt)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm whitespace-pre-wrap break-words">
                {prompt.prompt || "(empty prompt)"}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1.5">
                {new Date(prompt.created_at).toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

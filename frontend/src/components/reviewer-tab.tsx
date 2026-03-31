import { useRef, forwardRef, useImperativeHandle } from "react"

import { TerminalView } from "@/components/terminal-view"
import type { TerminalViewHandle } from "@/components/terminal-view"

interface ReviewerTabProps {
  sessionId: string
  onInput?: (data: string) => void
}

export const ReviewerTab = forwardRef<TerminalViewHandle, ReviewerTabProps>(
  function ReviewerTab({ sessionId, onInput }, ref) {
    const termRef = useRef<TerminalViewHandle>(null)

    useImperativeHandle(ref, () => ({
      focus: () => termRef.current?.focus(),
    }))

    return <TerminalView ref={termRef} sessionId={sessionId} type="reviewer" onInput={onInput} />
  }
)

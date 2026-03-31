import { useEffect, useState, useRef, useCallback } from 'react'
import type { SessionStatus } from '@/lib/api'

export type SessionEvent = {
  session_id: string
  event: string
  payload?: string
  slot?: string
  timestamp: string
}

export type SessionActivity = {
  status: 'active' | 'idle' | 'waiting' | 'disconnected'
  currentTool?: string
  label?: string
}

function dbStatusToActivity(dbStatus?: SessionStatus): SessionActivity['status'] {
  switch (dbStatus) {
    case 'active': return 'active'
    case 'waiting': return 'waiting'
    case 'idle': return 'idle'
    case 'completed': return 'idle'
    case 'failed': return 'idle'
    default: return 'idle'
  }
}

function startSseOverride(
  timerRef: { current: ReturnType<typeof setTimeout> | undefined },
  setStatus: (status: SessionActivity['status'] | null) => void,
  setCurrentTool: (tool: string | undefined) => void,
) {
  clearTimeout(timerRef.current)
  timerRef.current = setTimeout(() => {
    setStatus(null)
    setCurrentTool(undefined)
  }, 5000)
}

/**
 * Subscribe to real-time session events via SSE.
 * DB status is always the source of truth, SSE enriches with tool info.
 */
export function useSessionEvents(
  sessionId?: string,
  initialAgentStatus?: SessionStatus,
  initialReviewerStatus?: SessionStatus,
) {
  const [agentBaseStatus, setAgentBaseStatus] = useState<SessionActivity['status']>(() => dbStatusToActivity(initialAgentStatus))
  const [reviewerBaseStatus, setReviewerBaseStatus] = useState<SessionActivity['status']>(() => dbStatusToActivity(initialReviewerStatus))
  const [agentSseStatus, setAgentSseStatus] = useState<SessionActivity['status'] | null>(null)
  const [agentCurrentTool, setAgentCurrentTool] = useState<string | undefined>()
  const [reviewerSseStatus, setReviewerSseStatus] = useState<SessionActivity['status'] | null>(null)
  const [reviewerCurrentTool, setReviewerCurrentTool] = useState<string | undefined>()
  const agentTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const reviewerTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    setAgentBaseStatus(dbStatusToActivity(initialAgentStatus))
  }, [initialAgentStatus])

  useEffect(() => {
    setReviewerBaseStatus(dbStatusToActivity(initialReviewerStatus))
  }, [initialReviewerStatus])

  useEffect(() => {
    clearTimeout(agentTimerRef.current)
    clearTimeout(reviewerTimerRef.current)
    setAgentSseStatus(null)
    setAgentCurrentTool(undefined)
    setReviewerSseStatus(null)
    setReviewerCurrentTool(undefined)

    if (!sessionId) return

    const es = new EventSource(`/api/sessions/${sessionId}/events`)

    es.onmessage = (e) => {
      const event: SessionEvent = JSON.parse(e.data)
      const isReviewerEvent = event.slot === 'reviewer'
      const setSseStatus = isReviewerEvent ? setReviewerSseStatus : setAgentSseStatus
      const setBaseStatus = isReviewerEvent ? setReviewerBaseStatus : setAgentBaseStatus
      const setCurrentTool = isReviewerEvent ? setReviewerCurrentTool : setAgentCurrentTool
      const timerRef = isReviewerEvent ? reviewerTimerRef : agentTimerRef

      let handled = true
      let nextStatus: SessionActivity['status'] | null = null
      switch (event.event) {
        case 'prompt_submit':
          nextStatus = 'active'
          setSseStatus(nextStatus)
          setCurrentTool(undefined)
          break
        case 'stop':
          nextStatus = 'idle'
          setSseStatus(nextStatus)
          setCurrentTool(undefined)
          break
        case 'notification':
          nextStatus = 'waiting'
          setSseStatus(nextStatus)
          break
        case 'tool_use':
          nextStatus = 'active'
          setSseStatus(nextStatus)
          setCurrentTool(event.payload)
          break
        default:
          handled = false
      }

      if (!handled) {
        return
      }

      if (nextStatus) {
        setBaseStatus(nextStatus)
      }

      // SSE override lasts 5s, then falls back to DB status.
      startSseOverride(timerRef, setSseStatus, setCurrentTool)
    }

    return () => {
      es.close()
      clearTimeout(agentTimerRef.current)
      clearTimeout(reviewerTimerRef.current)
    }
  }, [sessionId])

  // SSE status takes priority for 5s after an event, then DB status wins.
  const agentStatus = agentSseStatus ?? agentBaseStatus
  const reviewerStatus = reviewerSseStatus ?? reviewerBaseStatus

  const markSlotActive = useCallback((
    slot: 'agent' | 'reviewer',
    currentStatus: SessionActivity['status'],
    data: string,
  ) => {
    const submitted = data.includes('\r') || data.includes('\n')
    const resumingFromWaiting = currentStatus === 'waiting'
    if (!submitted && !resumingFromWaiting) return

    const setSseStatus = slot === 'reviewer' ? setReviewerSseStatus : setAgentSseStatus
    const setCurrentTool = slot === 'reviewer' ? setReviewerCurrentTool : setAgentCurrentTool
    const timerRef = slot === 'reviewer' ? reviewerTimerRef : agentTimerRef

    // Optimistically mark the slot active when the user actually submits input,
    // or resumes from a waiting/permission state.
    setSseStatus('active')
    setCurrentTool(undefined)
    startSseOverride(timerRef, setSseStatus, setCurrentTool)
  }, [])

  const markAgentActive = useCallback((data: string) => {
    markSlotActive('agent', agentStatus, data)
  }, [agentStatus, markSlotActive])

  const markReviewerActive = useCallback((data: string) => {
    markSlotActive('reviewer', reviewerStatus, data)
  }, [reviewerStatus, markSlotActive])

  return {
    agentActivity: { status: agentStatus, currentTool: agentCurrentTool } as SessionActivity,
    reviewerActivity: { status: reviewerStatus, currentTool: reviewerCurrentTool } as SessionActivity,
    markAgentActive,
    markReviewerActive,
  }
}

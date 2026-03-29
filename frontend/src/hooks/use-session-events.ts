import { useEffect, useState, useRef, useCallback } from 'react'
import type { SessionStatus } from '@/lib/api'

export type SessionEvent = {
  session_id: string
  event: string
  payload?: string
  timestamp: string
}

export type SessionActivity = {
  status: 'active' | 'idle' | 'waiting' | 'disconnected'
  currentTool?: string
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

/**
 * Subscribe to real-time session events via SSE.
 * DB status is always the source of truth, SSE enriches with tool info.
 */
export function useSessionEvents(sessionId?: string, initialDbStatus?: SessionStatus) {
  const [sseStatus, setSseStatus] = useState<SessionActivity['status'] | null>(null)
  const [currentTool, setCurrentTool] = useState<string | undefined>()
  const sseTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (!sessionId) return

    const es = new EventSource(`/api/sessions/${sessionId}/events`)

    es.onmessage = (e) => {
      const event: SessionEvent = JSON.parse(e.data)

      // SSE override lasts 5s, then falls back to DB status.
      clearTimeout(sseTimerRef.current)
      sseTimerRef.current = setTimeout(() => {
        setSseStatus(null)
        setCurrentTool(undefined)
      }, 5000)

      switch (event.event) {
        case 'prompt_submit':
          setSseStatus('active')
          setCurrentTool(undefined)
          break
        case 'stop':
          setSseStatus('idle')
          setCurrentTool(undefined)
          break
        case 'notification':
          setSseStatus('waiting')
          break
        case 'tool_use':
          setSseStatus('active')
          setCurrentTool(event.payload)
          break
      }
    }

    return () => {
      es.close()
      clearTimeout(sseTimerRef.current)
    }
  }, [sessionId])

  // SSE status takes priority for 5s after an event, then DB status wins.
  const status = sseStatus ?? dbStatusToActivity(initialDbStatus)

  const markActive = useCallback(() => {
    // Only transition from 'waiting' — user accepted a permission.
    setSseStatus((prev) => {
      if (prev !== 'waiting') return prev
      return 'active'
    })
    if (sseStatus === 'waiting') {
      setCurrentTool(undefined)
      clearTimeout(sseTimerRef.current)
      sseTimerRef.current = setTimeout(() => {
        setSseStatus(null)
        setCurrentTool(undefined)
      }, 5000)
    }
  }, [sseStatus])

  return {
    activity: { status, currentTool } as SessionActivity,
    markActive,
  }
}

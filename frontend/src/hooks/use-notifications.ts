import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useSessions } from './use-sessions'

function requestPermission() {
  if (!('Notification' in window)) return
  if (Notification.permission === 'default') {
    Notification.requestPermission().then((p) => {
      console.log('[abbado] Notification permission:', p)
    })
  } else {
    console.log('[abbado] Notification permission already:', Notification.permission)
  }
}

function notify(title: string, body: string) {
  console.log('[abbado] notify:', title, body, 'permission:', Notification?.permission)
  if (!('Notification' in window)) return
  if (Notification.permission !== 'granted') {
    // Try requesting again in case the user dismissed the first prompt.
    Notification.requestPermission()
    return
  }
  new Notification(title, { body, icon: '/favicon.svg' })
}

/**
 * Global SSE listener for all active sessions.
 * - Fires browser notifications on key events.
 * - Invalidates session queries so the UI updates without polling.
 */
export function useNotifications() {
  const { data: sessions } = useSessions()
  const queryClient = useQueryClient()
  const eventSourcesRef = useRef<Map<string, EventSource>>(new Map())
  const sessionNamesRef = useRef<Map<string, string>>(new Map())

  useEffect(() => {
    requestPermission()
  }, [])

  useEffect(() => {
    sessions?.forEach((s) => {
      sessionNamesRef.current.set(s.id, s.name || s.branch_name)
    })
  }, [sessions])

  useEffect(() => {
    if (!sessions) return

    const activeSessions = sessions.filter(
      (s) => s.status === 'active' || s.status === 'idle' || s.status === 'waiting'
    )
    const activeIds = new Set(activeSessions.map((s) => s.id))

    for (const [id, es] of eventSourcesRef.current) {
      if (!activeIds.has(id)) {
        es.close()
        eventSourcesRef.current.delete(id)
      }
    }

    for (const session of activeSessions) {
      if (eventSourcesRef.current.has(session.id)) continue

      const es = new EventSource(`/api/sessions/${session.id}/events`)

      es.onmessage = (e) => {
        const event = JSON.parse(e.data)
        const name = sessionNamesRef.current.get(session.id) ?? session.branch_name

        // Refresh session data on status-changing events.
        if (['prompt_submit', 'stop', 'notification', 'tool_use'].includes(event.event)) {
          queryClient.invalidateQueries({ queryKey: ['sessions'] })
        }

        // Browser notifications.
        switch (event.event) {
          case 'notification':
            notify(`${name}: Permission required`, 'The agent needs your attention.')
            break
          case 'stop':
            notify(`${name}: Finished`, 'The agent has completed its turn.')
            break
        }
      }

      eventSourcesRef.current.set(session.id, es)
    }

    return () => {
      for (const es of eventSourcesRef.current.values()) {
        es.close()
      }
      eventSourcesRef.current.clear()
    }
  }, [sessions, queryClient])
}

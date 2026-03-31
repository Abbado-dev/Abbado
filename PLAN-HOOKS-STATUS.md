# Plan: Hook-based status display on Agent and Review tabs

## Goal

Show real-time agent/reviewer status directly on the tab buttons (Agent tab, Review tab) in the session page. When the agent is working, the Agent tab should show it. When the reviewer is working, the Review tab should show it.

## Current Architecture

### Backend hooks flow

1. **Claude Code** hooks are configured in `backend/internal/service/provider_claude.go`:
   - Settings written to `~/.abbado-dev/hooks/{sessionID}/{slot}/settings.json`
   - Slot is `"agent"` or `"reviewer"`
   - Hook events: `UserPromptSubmit`, `Stop`, `Notification`, `PreToolUse`
   - Each hook runs: `jq` to extract payload → `curl POST` to callback URL

2. **Codex** hooks are configured in `backend/internal/service/provider_codex.go`:
   - Hook script at `~/.abbado-dev/hooks/{sessionID}/{slot}/codex-hook.sh`
   - Hooks config at `{codexHome}/hooks.json`
   - Events: `UserPromptSubmit`, `Stop`, `PreToolUse`
   - Script maps events to JSON and curls the callback

3. **Callback URL** includes slot: `http://localhost:{port}/api/sessions/{sessionID}/hook?slot={slot}`
   - `slot=agent` → updates `sessions.status`
   - `slot=reviewer` → updates `sessions.reviewer_status`

4. **Hook handler** (`backend/internal/handler/hooks.go`):
   - Reads `slot` from query param
   - Maps event to status: `prompt_submit`→active, `stop`→idle, `notification`→waiting, `tool_use`→active
   - Updates `status` or `reviewer_status` depending on slot
   - Broadcasts SSE event with `slot` field included

5. **SSE event** structure (`backend/internal/service/eventbus.go`):
```go
type SessionEvent struct {
    SessionID string `json:"session_id"`
    Event     string `json:"event"`
    Payload   string `json:"payload,omitempty"`
    Slot      string `json:"slot,omitempty"`    // "agent" or "reviewer"
    Timestamp time.Time `json:"timestamp"`
}
```

### Frontend current state

- `use-session-events.ts` subscribes to SSE at `/api/sessions/{id}/events`
- It tracks ONE status (agent only), ignores the `slot` field
- `session.tsx` shows `<SessionStatus activity={activity} />` in the header
- Tab buttons in `session.tsx` are static icons + labels, no status indicators

### Database

- `sessions.status` — agent status (active/idle/waiting/completed/failed)
- `sessions.reviewer_status` — reviewer status (same enum), added recently
- Both default to `'idle'`

## What needs to change

### 1. Frontend: `use-session-events.ts`

The SSE hook must track **two** statuses: agent and reviewer.

**Current return:**
```ts
{ activity: { status, currentTool }, markActive }
```

**New return:**
```ts
{
  agentActivity: { status, currentTool },
  reviewerActivity: { status, currentTool },
  markActive
}
```

**Implementation:**
- When an SSE event arrives, check `event.slot`:
  - `slot === "reviewer"` → update reviewer state
  - Otherwise → update agent state
- Each has its own 5-second SSE override timer
- DB fallback: `session.status` for agent, `session.reviewer_status` for reviewer

Add `slot` to the `SessionEvent` type:
```ts
export type SessionEvent = {
  session_id: string
  event: string
  payload?: string
  slot?: string        // ADD THIS
  timestamp: string
}
```

### 2. Frontend: `session.tsx` — status on tab buttons

Currently tabs are defined as:
```ts
const baseTabs = [
  { id: "agent", label: "Agent", icon: BotIcon },
  { id: "terminal", label: "Terminal", icon: TerminalIcon },
  { id: "run", label: "Run", icon: PlayIcon },
  { id: "changes", label: "Changes", icon: GitCompareIcon },
  { id: "history", label: "History", icon: HistoryIcon },
  { id: "settings", label: "Settings", icon: SettingsIcon },
]
```

**Changes needed:**
- Pass `agentActivity` and `reviewerActivity` from the hook
- On the **Agent tab button**: show a small colored dot or spinner next to the label when `agentActivity.status === "active"` (green) or `"waiting"` (amber)
- On the **Review tab button**: same for `reviewerActivity`
- Use the `SessionStatusDot` component or inline a small indicator

Example rendering for a tab button:
```tsx
<tab.icon className="size-4" />
{tab.label}
{tab.id === "agent" && agentActivity.status !== "idle" && (
  <span className={cn("size-2 rounded-full",
    agentActivity.status === "active" ? "bg-green-500 animate-pulse" : "bg-amber-500 animate-pulse"
  )} />
)}
```

Same pattern for the `"reviewer"` tab using `reviewerActivity`.

### 3. Frontend: `session.tsx` — header status

The header currently shows:
```tsx
<SessionStatus activity={activity} />
```

Change to show agent activity (primary) and keep the existing reviewer badge:
```tsx
<SessionStatus activity={agentActivity} />
{/* reviewer badge already exists, update to use reviewerActivity from SSE */}
```

### 4. Update callers of `useSessionEvents`

Current usage in `session.tsx`:
```ts
const { activity, markActive } = useSessionEvents(id, session?.status)
```

New usage:
```ts
const { agentActivity, reviewerActivity, markActive } = useSessionEvents(id, session?.status, session?.reviewer_status)
```

The hook signature changes to:
```ts
export function useSessionEvents(
  sessionId?: string,
  initialAgentStatus?: SessionStatus,
  initialReviewerStatus?: SessionStatus
)
```

## Files to modify

| File | Changes |
|------|---------|
| `frontend/src/hooks/use-session-events.ts` | Track two statuses (agent/reviewer) based on SSE `slot` field |
| `frontend/src/pages/session.tsx` | Destructure new hook return, show status dots on Agent/Review tabs, update header |
| `frontend/src/components/session-status.tsx` | No changes needed (already generic) |

## Verification

1. Start a session with Claude Code agent → Agent tab shows green dot when working, disappears when idle
2. Start a session with Codex reviewer → Review tab shows green dot when reviewing
3. Both can be active simultaneously — both tabs show their own status independently
4. When you switch to a tab, the status dot is visible on other tabs
5. SSE timeout (5s) falls back to DB status correctly for both

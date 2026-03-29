# Abbado Frontend

React 19 + Vite + TypeScript + Tailwind + shadcn/ui (base-ui).

## Dev

```bash
npm install
npm run dev       # http://localhost:5173 (proxies /api to backend :7777)
```

## Build

```bash
npm run build     # Output in dist/ (embedded into Go binary by build.sh)
```

## Structure

```
src/
  pages/          # Route pages (dashboard, projects, agents, session, settings)
  components/     # UI components (terminal, sidebar, forms, diff viewer, run tab)
  hooks/          # TanStack Query hooks + SSE subscriptions
  lib/            # API client, provider configs, utils
```

## Key Patterns

- **shadcn/ui** uses base-ui under the hood. Components use `render` prop, not `asChild`.
- **No polling** — query invalidation via SSE events only.
- **Terminal tabs** use `visible`/`invisible` (keep PTY alive). Other tabs use `hidden` (display:none).

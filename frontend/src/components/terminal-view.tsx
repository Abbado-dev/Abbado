import { useEffect, useRef, useImperativeHandle, forwardRef } from "react"
import { Terminal } from "@xterm/xterm"
import { FitAddon } from "@xterm/addon-fit"
import { WebLinksAddon } from "@xterm/addon-web-links"
import "@xterm/xterm/css/xterm.css"

interface TerminalViewProps {
  sessionId: string
  type: "shell" | "agent" | "reviewer" | "runner"
  onInput?: () => void
}

export interface TerminalViewHandle {
  focus: () => void
}

export const TerminalView = forwardRef<TerminalViewHandle, TerminalViewProps>(
  function TerminalView({ sessionId, type, onInput }, ref) {
    const containerRef = useRef<HTMLDivElement>(null)
    const termRef = useRef<Terminal | null>(null)
    const fitRef = useRef<FitAddon | null>(null)

    useImperativeHandle(ref, () => ({
      focus: () => {
        if (termRef.current) {
          fitRef.current?.fit()
          requestAnimationFrame(() => {
            termRef.current?.focus()
          })
        }
      },
    }))

    useEffect(() => {
      if (!containerRef.current) return

      const term = new Terminal({
        cursorBlink: true,
        fontSize: 13,
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Menlo, monospace",
        theme: {
          background: "#0a0a0a",
          foreground: "#e5e5e5",
          cursor: "#e5e5e5",
          selectionBackground: "#ffffff30",
        },
        allowProposedApi: true,
      })

      const fitAddon = new FitAddon()
      const webLinksAddon = new WebLinksAddon()
      term.loadAddon(fitAddon)
      term.loadAddon(webLinksAddon)

      term.open(containerRef.current)
      fitAddon.fit()

      termRef.current = term
      fitRef.current = fitAddon

      // WebSocket connection.
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
      const wsUrl = `${protocol}//${window.location.host}/api/sessions/${sessionId}/terminal/${type}`
      const ws = new WebSocket(wsUrl)
      ws.binaryType = "arraybuffer"

      ws.onopen = () => {
        ws.send(JSON.stringify({
          type: "resize",
          rows: term.rows,
          cols: term.cols,
        }))
      }

      ws.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
          term.write(new Uint8Array(event.data))
        } else {
          term.write(event.data)
        }
      }

      ws.onclose = () => {
        term.write("\r\n\x1b[90m--- Connection closed ---\x1b[0m\r\n")
      }

      ws.onerror = () => {
        term.write("\r\n\x1b[31m--- Connection error ---\x1b[0m\r\n")
      }

      const onData = term.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data)
          onInput?.()
        }
      })

      const onResize = term.onResize(({ rows, cols }) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "resize", rows, cols }))
        }
      })

      const handleResize = () => fitAddon.fit()
      window.addEventListener("resize", handleResize)

      const resizeObserver = new ResizeObserver(() => fitAddon.fit())
      resizeObserver.observe(containerRef.current)

      return () => {
        onData.dispose()
        onResize.dispose()
        window.removeEventListener("resize", handleResize)
        resizeObserver.disconnect()
        ws.close()
        term.dispose()
      }
    }, [sessionId, type])

    return (
      <div
        ref={containerRef}
        className="h-full w-full rounded-lg overflow-hidden bg-[#0a0a0a] p-1"
      />
    )
  }
)

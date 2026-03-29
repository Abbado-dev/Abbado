import { useRef, useCallback } from "react"
import { DiffEditor } from "@monaco-editor/react"
import type { editor } from "monaco-editor"

interface MonacoDiffProps {
  original: string
  modified: string
  fileName: string
  onModifiedChange?: (content: string) => void
}

const extToLanguage: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  py: "python",
  go: "go",
  rs: "rust",
  rb: "ruby",
  java: "java",
  kt: "kotlin",
  swift: "swift",
  c: "c",
  cpp: "cpp",
  h: "c",
  hpp: "cpp",
  cs: "csharp",
  php: "php",
  sql: "sql",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  json: "json",
  yaml: "yaml",
  yml: "yaml",
  toml: "ini",
  xml: "xml",
  html: "html",
  css: "css",
  scss: "scss",
  less: "less",
  md: "markdown",
  dockerfile: "dockerfile",
  makefile: "makefile",
  graphql: "graphql",
  proto: "protobuf",
  env: "ini",
}

function getLanguage(fileName: string): string {
  const lower = fileName.toLowerCase()
  const base = lower.split("/").pop() ?? ""

  if (base === "dockerfile") return "dockerfile"
  if (base === "makefile") return "makefile"

  const ext = base.split(".").pop() ?? ""
  return extToLanguage[ext] ?? "plaintext"
}

export function MonacoDiff({ original, modified, fileName, onModifiedChange }: MonacoDiffProps) {
  const editorRef = useRef<editor.IStandaloneDiffEditor | null>(null)

  const handleMount = useCallback((diffEditor: editor.IStandaloneDiffEditor) => {
    editorRef.current = diffEditor

    if (onModifiedChange) {
      const modifiedEditor = diffEditor.getModifiedEditor()
      modifiedEditor.onDidChangeModelContent(() => {
        onModifiedChange(modifiedEditor.getValue())
      })
    }
  }, [onModifiedChange])

  return (
    <DiffEditor
      height="100%"
      original={original}
      modified={modified}
      language={getLanguage(fileName)}
      theme="vs-dark"
      onMount={handleMount}
      options={{
        readOnly: false,
        originalEditable: false,
        renderSideBySide: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        fontSize: 12,
        lineNumbers: "on",
        renderOverviewRuler: false,
        diffWordWrap: "on",
      }}
    />
  )
}

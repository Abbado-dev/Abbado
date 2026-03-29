import { useState, useEffect, useRef, useCallback } from "react"
import { FolderIcon, FolderGit2Icon, ChevronRightIcon } from "lucide-react"

import { Input } from "@/components/ui/input"
import { filesystemApi } from "@/lib/api"
import type { DirEntry } from "@/lib/api"
import { cn } from "@/lib/utils"

interface PathInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  id?: string
}

export function PathInput({ value, onChange, placeholder, id }: PathInputProps) {
  const [suggestions, setSuggestions] = useState<DirEntry[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const fetchSuggestions = useCallback(async (path: string) => {
    if (!path || path.length < 1) {
      setSuggestions([])
      return
    }
    try {
      const dirs = await filesystemApi.listDirs(path)
      setSuggestions(dirs ?? [])
      setSelectedIndex(-1)
    } catch {
      setSuggestions([])
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(value)
    }, 150)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [value, fetchSuggestions])

  function selectSuggestion(entry: DirEntry) {
    onChange(entry.path)
    setShowSuggestions(false)
    inputRef.current?.focus()

    // Trigger a new fetch for the selected directory's children.
    setTimeout(() => {
      fetchSuggestions(entry.path + "/")
      onChange(entry.path + "/")
      setShowSuggestions(true)
    }, 50)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!showSuggestions || suggestions.length === 0) {
      // Tab autocomplete: if no dropdown, trigger fetch.
      if (e.key === "Tab" && value) {
        e.preventDefault()
        fetchSuggestions(value)
        setShowSuggestions(true)
      }
      return
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        setSelectedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : 0
        )
        break
      case "ArrowUp":
        e.preventDefault()
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : suggestions.length - 1
        )
        break
      case "Tab":
      case "Enter":
        e.preventDefault()
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          selectSuggestion(suggestions[selectedIndex])
        } else if (suggestions.length === 1) {
          selectSuggestion(suggestions[0])
        }
        break
      case "Escape":
        setShowSuggestions(false)
        setSelectedIndex(-1)
        break
    }
  }

  // Scroll selected item into view.
  useEffect(() => {
    if (selectedIndex >= 0 && listRef.current) {
      const items = listRef.current.children
      if (items[selectedIndex]) {
        items[selectedIndex].scrollIntoView({ block: "nearest" })
      }
    }
  }, [selectedIndex])

  return (
    <div className="relative">
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-mono select-none pointer-events-none">
          $
        </span>
        <Input
          ref={inputRef}
          id={id}
          className="pl-7 font-mono text-sm"
          placeholder={placeholder ?? "~/code/my-project"}
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            setShowSuggestions(true)
          }}
          onFocus={() => {
            if (suggestions.length > 0) setShowSuggestions(true)
          }}
          onBlur={() => {
            // Delay to allow click on suggestion.
            setTimeout(() => setShowSuggestions(false), 200)
          }}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={listRef}
          className="absolute z-50 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border bg-popover shadow-lg"
        >
          {suggestions.map((entry, i) => (
            <button
              key={entry.path}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => selectSuggestion(entry)}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors",
                i === selectedIndex
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-accent/50"
              )}
            >
              {entry.is_git ? (
                <FolderGit2Icon className="size-4 shrink-0 text-primary" />
              ) : (
                <FolderIcon className="size-4 shrink-0 text-muted-foreground" />
              )}
              <span className="truncate font-mono">{entry.name}</span>
              {entry.is_git && (
                <span className="ml-auto shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                  git
                </span>
              )}
              <ChevronRightIcon className="size-3 shrink-0 text-muted-foreground" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

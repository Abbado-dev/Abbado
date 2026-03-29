import { useState, useMemo, useRef, useEffect } from "react"
import {
  Play, Square, FlaskConical, Rocket, Hammer,
  RefreshCw, Database, Globe, Terminal, Wrench,
  Zap, Bug, Package, Trash2, Eye, Search,
  Server, Cloud, CloudUpload, Lock, Unlock,
  FileCode, FolderSync, GitBranch, GitMerge,
  Cpu, HardDrive, MonitorCheck, Wifi,
  type LucideIcon,
} from "lucide-react"

import { Popover as PopoverPrimitive } from "@base-ui/react/popover"
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const ICONS: { value: string; label: string; Icon: LucideIcon }[] = [
  { value: "play", label: "Play", Icon: Play },
  { value: "square", label: "Stop", Icon: Square },
  { value: "flask", label: "Test", Icon: FlaskConical },
  { value: "rocket", label: "Deploy", Icon: Rocket },
  { value: "hammer", label: "Build", Icon: Hammer },
  { value: "refresh", label: "Refresh", Icon: RefreshCw },
  { value: "database", label: "Database", Icon: Database },
  { value: "globe", label: "Web", Icon: Globe },
  { value: "terminal", label: "Terminal", Icon: Terminal },
  { value: "wrench", label: "Config", Icon: Wrench },
  { value: "zap", label: "Fast", Icon: Zap },
  { value: "bug", label: "Debug", Icon: Bug },
  { value: "package", label: "Package", Icon: Package },
  { value: "trash", label: "Clean", Icon: Trash2 },
  { value: "eye", label: "Watch", Icon: Eye },
  { value: "server", label: "Server", Icon: Server },
  { value: "cloud", label: "Cloud", Icon: Cloud },
  { value: "upload", label: "Upload", Icon: CloudUpload },
  { value: "lock", label: "Lock", Icon: Lock },
  { value: "unlock", label: "Unlock", Icon: Unlock },
  { value: "file-code", label: "Code", Icon: FileCode },
  { value: "folder-sync", label: "Sync", Icon: FolderSync },
  { value: "git-branch", label: "Branch", Icon: GitBranch },
  { value: "git-merge", label: "Merge", Icon: GitMerge },
  { value: "cpu", label: "CPU", Icon: Cpu },
  { value: "hard-drive", label: "Disk", Icon: HardDrive },
  { value: "monitor", label: "Monitor", Icon: MonitorCheck },
  { value: "wifi", label: "Network", Icon: Wifi },
]

export function getCommandIcon(icon: string): LucideIcon {
  return ICONS.find((o) => o.value === icon)?.Icon ?? Terminal
}

interface IconPickerProps {
  value: string
  onChange: (value: string) => void
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const searchRef = useRef<HTMLInputElement>(null)
  const CurrentIcon = getCommandIcon(value)

  const filtered = useMemo(
    () =>
      search
        ? ICONS.filter((i) => i.label.toLowerCase().includes(search.toLowerCase()))
        : ICONS,
    [search]
  )

  useEffect(() => {
    if (open) {
      setSearch("")
      // Focus search after popover opens.
      requestAnimationFrame(() => searchRef.current?.focus())
    }
  }, [open])

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger
        className={cn(
          "size-8 shrink-0 rounded-md border flex items-center justify-center",
          "hover:bg-accent text-muted-foreground cursor-pointer"
        )}
      >
        <CurrentIcon className="size-4" />
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner side="bottom" align="start" sideOffset={4} className="z-50">
          <PopoverPrimitive.Popup className="w-52 rounded-lg border bg-popover p-2 shadow-md outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
            {/* Search */}
            <div className="relative mb-2">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
              <Input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="h-7 pl-7 text-xs"
              />
            </div>

            {/* Grid */}
            <TooltipProvider>
              <div className="grid grid-cols-4 gap-1 max-h-40 overflow-y-auto">
                {filtered.map(({ value: v, label, Icon }) => (
                  <Tooltip key={v}>
                    <TooltipTrigger
                      render={
                        <button
                          type="button"
                          onClick={() => { onChange(v); setOpen(false) }}
                          className={cn(
                            "size-9 rounded-md flex items-center justify-center transition-colors",
                            value === v
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:bg-accent hover:text-foreground"
                          )}
                        />
                      }
                    >
                      <Icon className="size-4" />
                    </TooltipTrigger>
                    <TooltipContent side="top">{label}</TooltipContent>
                  </Tooltip>
                ))}
                {filtered.length === 0 && (
                  <p className="col-span-4 text-xs text-muted-foreground text-center py-2">No match</p>
                )}
              </div>
            </TooltipProvider>
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}

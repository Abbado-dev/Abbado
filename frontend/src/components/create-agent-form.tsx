import { useState } from "react"
import { PlusIcon, CheckIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import {
  providers,
  templateCategories,
  agentTemplates,
  getTemplatesByCategory,
} from "@/lib/providers"
import type { AgentTemplate } from "@/lib/providers"
import { useCreateAgent } from "@/hooks/use-agents"
import { cn } from "@/lib/utils"

interface CreateAgentFormProps {
  onSuccess?: () => void
}

export function CreateAgentForm({ onSuccess }: CreateAgentFormProps) {
  const createAgent = useCreateAgent()

  const [activeCategory, setActiveCategory] = useState<string>("all")
  const [showConfig, setShowConfig] = useState(false)

  // Config fields
  const [name, setName] = useState("")
  const [providerId, setProviderId] = useState(providers[0].id)
  const [model, setModel] = useState(providers[0].models[0])
  const [instructions, setInstructions] = useState("")

  const filteredTemplates = getTemplatesByCategory(agentTemplates, activeCategory)
  const selectedProvider = providers.find((p) => p.id === providerId)!

  function handleTemplateSelect(template: AgentTemplate) {
    setName(template.name)
    setProviderId(template.provider)
    setModel(template.model)
    setInstructions(template.instructions)
    setShowConfig(true)
  }

  function handleCustom() {
    setName("")
    setProviderId(providers[0].id)
    setModel(providers[0].models[0])
    setInstructions("")
    setShowConfig(true)
  }

  function handleBack() {
    setShowConfig(false)
  }

  function handleProviderChange(id: string) {
    setProviderId(id)
    const provider = providers.find((p) => p.id === id)!
    setModel(provider.models[0])
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return

    createAgent.mutate(
      {
        name: name.trim(),
        cli_name: providerId,
        model,
        instructions: instructions.trim() || undefined,
      },
      {
        onSuccess: () => {
          setShowConfig(false)
          setName("")
          setInstructions("")
          onSuccess?.()
        },
      }
    )
  }

  // --- Step 2: Config ---
  if (showConfig) {
    return (
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <button
          type="button"
          onClick={handleBack}
          className="self-start text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back to templates
        </button>

        <div className="space-y-2">
          <Label htmlFor="agent-name">Name</Label>
          <Input
            id="agent-name"
            placeholder="My Agent"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="space-y-3">
          <Label>Provider</Label>
          <div className="grid grid-cols-2 gap-2">
            {providers.map((provider) => (
              <button
                key={provider.id}
                type="button"
                onClick={() => handleProviderChange(provider.id)}
                className={cn(
                  "relative flex items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent/50",
                  providerId === provider.id
                    ? "border-primary bg-accent/50"
                    : "border-border"
                )}
              >
                {providerId === provider.id && (
                  <div className="absolute top-2.5 right-2.5 flex size-4 items-center justify-center rounded-full bg-primary">
                    <CheckIcon className="size-2.5 text-primary-foreground" />
                  </div>
                )}
                <img src={provider.logo} alt={provider.name} className="size-8 rounded object-contain" />
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">{provider.name}</span>
                  <span className="text-xs text-muted-foreground">{provider.description}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <Label>Model</Label>
          <div className="flex flex-wrap gap-2">
            {selectedProvider.models.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setModel(m)}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-sm transition-colors",
                  model === m
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border hover:bg-accent/50"
                )}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="instructions">Instructions</Label>
          <Textarea
            id="instructions"
            placeholder="You are a senior engineer..."
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={5}
          />
        </div>

        <Button type="submit" className="w-full" disabled={createAgent.isPending || !name.trim()}>
          Create Agent
        </Button>
        {createAgent.isError && (
          <p className="text-sm text-destructive">{createAgent.error.message}</p>
        )}
      </form>
    )
  }

  // --- Step 1: Template picker ---
  return (
    <div className="flex flex-col gap-4">
      {/* Category filters */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setActiveCategory("all")}
          className={cn(
            "rounded-full border px-3 py-1 text-sm transition-colors",
            activeCategory === "all"
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border hover:bg-accent/50"
          )}
        >
          All
        </button>
        {templateCategories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setActiveCategory(cat.id)}
            className={cn(
              "rounded-full border px-3 py-1 text-sm transition-colors",
              activeCategory === cat.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border hover:bg-accent/50"
            )}
          >
            {cat.icon} {cat.label}
          </button>
        ))}
      </div>

      {/* Template list */}
      <div className="flex flex-col gap-2">
        {filteredTemplates.map((template) => {
          const cat = templateCategories.find((c) => c.id === template.category)
          return (
            <button
              key={template.id}
              type="button"
              onClick={() => handleTemplateSelect(template)}
              className="flex flex-col items-start gap-1.5 rounded-lg border border-border p-4 text-left transition-colors hover:bg-accent/50"
            >
              <div className="flex flex-col gap-1.5 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{template.name}</span>
                  {cat && (
                    <Badge variant="outline" className="text-xs font-normal gap-1">
                      {cat.icon} {cat.label}
                    </Badge>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {template.description}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {template.tools.map((tool) => (
                    <span
                      key={tool}
                      className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
                    >
                      {tool}
                    </span>
                  ))}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      <Separator />

      {/* Custom agent */}
      <button
        type="button"
        onClick={handleCustom}
        className="flex items-center gap-3 rounded-lg border border-dashed border-border p-4 text-left transition-colors hover:bg-accent/50"
      >
        <div className="flex size-8 items-center justify-center rounded-md bg-muted">
          <PlusIcon className="size-4 text-muted-foreground" />
        </div>
        <div>
          <span className="text-sm font-semibold">Custom Agent</span>
          <p className="text-xs text-muted-foreground">Start from scratch with a blank configuration</p>
        </div>
      </button>
    </div>
  )
}

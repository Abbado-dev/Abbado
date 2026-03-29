import { useState } from "react"
import { BotIcon, PlusIcon, TrashIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { CreateAgentForm } from "@/components/create-agent-form"
import { useAgents, useDeleteAgent } from "@/hooks/use-agents"
import { providers } from "@/lib/providers"

function providerName(cliName: string): string {
  return providers.find((p) => p.id === cliName)?.name ?? cliName
}

function providerLogo(cliName: string): string | undefined {
  return providers.find((p) => p.id === cliName)?.logo
}

export function AgentsPage() {
  const { data: agents, isLoading } = useAgents()
  const deleteAgent = useDeleteAgent()
  const [sheetOpen, setSheetOpen] = useState(false)

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Agents</h1>
          <p className="text-sm text-muted-foreground">
            Reusable AI agent configurations. Provider-agnostic.
          </p>
        </div>

        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger render={<Button />}>
            <PlusIcon className="size-4 mr-1" />
            New Agent
          </SheetTrigger>
          <SheetContent className="overflow-y-auto sm:max-w-2xl">
            <SheetHeader>
              <SheetTitle>New Agent</SheetTitle>
              <SheetDescription className="sr-only">
                Choose a template or create a custom agent.
              </SheetDescription>
            </SheetHeader>
            <div className="pb-6">
              <CreateAgentForm onSuccess={() => setSheetOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground">Loading agents...</p>
      )}

      {!isLoading && (!agents || agents.length === 0) && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <BotIcon className="size-10 text-muted-foreground mb-3" />
          <p className="text-sm font-medium">No agents yet</p>
          <p className="text-sm text-muted-foreground mb-4">
            Create your first agent to get started.
          </p>
          <Button variant="outline" onClick={() => setSheetOpen(true)}>
            <PlusIcon className="size-4 mr-1" />
            New Agent
          </Button>
        </div>
      )}

      {agents && agents.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <Card key={agent.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {providerLogo(agent.cli_name) ? (
                      <Avatar className="size-5 rounded">
                        <AvatarImage src={providerLogo(agent.cli_name)!} alt={agent.cli_name} />
                        <AvatarFallback><BotIcon className="size-3" /></AvatarFallback>
                      </Avatar>
                    ) : (
                      <BotIcon className="size-4 text-muted-foreground" />
                    )}
                    <CardTitle className="text-sm font-medium">{agent.name}</CardTitle>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() => deleteAgent.mutate(agent.id)}
                  >
                    <TrashIcon className="size-3.5" />
                  </Button>
                </div>
                <CardDescription className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {providerName(agent.cli_name)}
                  </Badge>
                  {agent.model && (
                    <Badge variant="secondary" className="text-xs">{agent.model}</Badge>
                  )}
                </CardDescription>
              </CardHeader>
              {agent.instructions && (
                <CardContent>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {agent.instructions}
                  </p>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

import { Outlet } from "react-router-dom"

import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { useNotifications } from "@/hooks/use-notifications"

export function Layout() {
  useNotifications()

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="flex flex-col h-screen overflow-hidden">
        <main className="flex-1 min-h-0 p-4 overflow-hidden">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

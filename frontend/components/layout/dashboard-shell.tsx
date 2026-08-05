"use client";

import { MockSessionProvider } from "@/components/providers/mock-session-provider";
import { TenantSync } from "@/components/providers/tenant-sync";
import { AppNavbar } from "@/components/layout/app-navbar";
import { AppSidebar } from "@/components/layout/app-sidebar";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <MockSessionProvider>
      <TenantSync>
        <div className="flex min-h-screen bg-background">
          <AppSidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <AppNavbar />
            <main className="flex-1 p-4 md:p-6">{children}</main>
          </div>
        </div>
      </TenantSync>
    </MockSessionProvider>
  );
}

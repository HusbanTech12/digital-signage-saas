"use client";

import { UserButton } from "@clerk/nextjs";
import { useMockSession } from "@/components/providers/mock-session-provider";
import type { Role } from "@/lib/types/schema";
import { ROLE_LABELS } from "@/lib/mock-session";

const ROLES: Role[] = [
  "super_admin",
  "admin",
  "location_manager",
  "content_manager",
  "viewer",
];

export function AppNavbar() {
  const { session, role, setRole, roleLabel } = useMockSession();

  return (
    <header className="flex h-14 items-center justify-between gap-4 border-b border-border bg-background px-4 md:px-6">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{session.user.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {session.user.email} · {roleLabel}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <label className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
          <span>Mock role</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground"
            aria-label="Switch mock role"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </label>
        <UserButton />
      </div>
    </header>
  );
}

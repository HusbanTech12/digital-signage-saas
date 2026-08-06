"use client";

import { useEffect, useState } from "react";
import { useApiAuthToken } from "@/lib/api/auth-token";
import { refreshTenantFromApi } from "@/lib/data/tenant";

/**
 * When the live API is enabled, hydrate org/locations/screens from FastAPI
 * into the shared client store used by dashboard pages.
 */
export function TenantSync({ children }: { children: React.ReactNode }) {
  const { getApiToken, useLiveApi } = useApiAuthToken();
  const [ready, setReady] = useState(!useLiveApi);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!useLiveApi) {
      setReady(true);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const token = await getApiToken();
        if (!token) throw new Error("No API token");
        await refreshTenantFromApi(token);
        if (!cancelled) {
          setError(null);
          setReady(true);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Could not load tenant data from API",
          );
          // Keep mock seed data so the UI remains usable offline.
          setReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [useLiveApi, getApiToken]);

  return (
    <>
      {error ? (
        <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-xs text-amber-950 dark:text-amber-100">
          Live API sync failed ({error}). Showing local mock data. Ensure the
          backend is running, seed has been applied, and your Clerk user can
          onboard via POST /api/v1/me/onboard.
        </div>
      ) : null}
      {ready ? children : (
        <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
          Loading organization data…
        </div>
      )}
    </>
  );
}

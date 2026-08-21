"use client";

import { useEffect, useState } from "react";
import { useApiAuthToken } from "@/lib/api/auth-token";
import {
  refreshScreensFromApi,
  refreshTenantFromApi,
} from "@/lib/data/tenant";

const SCREEN_POLL_MS = 20_000;

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

  // Poll screen status so offline/online from heartbeat jobs appears live.
  useEffect(() => {
    if (!useLiveApi || !ready) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const token = await getApiToken();
        if (!token || cancelled) return;
        await refreshScreensFromApi(token);
      } catch {
        /* keep last known status */
      }
    };
    const id = window.setInterval(() => void tick(), SCREEN_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [useLiveApi, ready, getApiToken]);

  return (
    <>
      {error ? (
        <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-xs text-amber-950 dark:text-amber-100">
          Live API sync failed ({error}). Showing local mock data.
          {/failed to fetch/i.test(error) ? (
            <>
              {" "}
              Usually CORS or a unreachable API — confirm{" "}
              <code className="text-[11px]">NEXT_PUBLIC_API_URL</code> and that
              the API allows <code className="text-[11px]">http://localhost:3000</code>
              .
            </>
          ) : (
            <>
              {" "}
              Ensure the backend is running, seed has been applied, and your
              Clerk user can onboard via POST /api/v1/me/onboard.
            </>
          )}
        </div>
      ) : null}
      {ready ? (
        children
      ) : (
        <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
          Loading organization data…
        </div>
      )}
    </>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMockStore } from "@/components/providers/mock-data-provider";
import { getScreenPublicApi } from "@/lib/api/tenant";
import { DEFAULT_ORGANIZATION_ID, useLiveApi } from "@/lib/api/config";
import { saveDeviceToken } from "@/lib/display/device-token";
import { startPairingSession } from "@/lib/data/tenant";
import { upsertScreen } from "@/lib/mock-api/store";

/**
 * Kiosk pairing screen — no dashboard chrome, no Clerk required.
 * Shows a 6-digit code for the admin to enter under Screens → Enter code.
 */
export default function PairPage() {
  const router = useRouter();
  const { screens } = useMockStore();
  const [screenId, setScreenId] = useState<string | null>(null);
  const [deviceToken, setDeviceToken] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      try {
        const { screen, pairing } = await startPairingSession({
          organizationId: DEFAULT_ORGANIZATION_ID,
        });
        saveDeviceToken(screen.id, screen.deviceToken);
        setScreenId(screen.id);
        setDeviceToken(screen.deviceToken);
        setCode(pairing.code);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not start pairing.",
        );
      }
    })();
  }, []);

  // Live API: poll public screen status so this tab sees pairing complete.
  useEffect(() => {
    if (!useLiveApi() || !screenId || !deviceToken) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const screen = await getScreenPublicApi(screenId, deviceToken);
        if (cancelled) return;
        upsertScreen(screen);
      } catch {
        /* keep showing code while backend is briefly unavailable */
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), 2000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [screenId, deviceToken]);

  const screen = screens.find((s) => s.id === screenId);
  const paired = Boolean(
    screen && screen.status === "online" && screen.locationId !== null,
  );

  useEffect(() => {
    if (!paired || !screen) return;
    const t = window.setTimeout(() => {
      router.replace(`/display/${screen.id}`);
    }, 1200);
    return () => window.clearTimeout(t);
  }, [paired, screen, router]);

  async function refreshCode() {
    setError(null);
    try {
      const { screen: next, pairing } = await startPairingSession({
        organizationId: DEFAULT_ORGANIZATION_ID,
      });
      saveDeviceToken(next.id, next.deviceToken);
      setScreenId(next.id);
      setDeviceToken(next.deviceToken);
      setCode(pairing.code);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not refresh code.");
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-6 text-zinc-50">
      <p className="text-sm font-medium tracking-[0.2em] text-zinc-400 uppercase">
        Signage · Device pairing
      </p>

      {paired ? (
        <div className="mt-10 max-w-lg text-center">
          <h1 className="text-4xl font-semibold tracking-tight">Paired</h1>
          <p className="mt-3 text-zinc-400">
            Bound as <span className="text-zinc-100">{screen?.name}</span>.
            Opening display…
          </p>
        </div>
      ) : (
        <div className="mt-10 max-w-xl text-center">
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Enter this code in your dashboard
          </h1>
          <p className="mt-3 text-zinc-400">
            Screens → Enter code · assign a location · done
          </p>

          <div className="mt-10 rounded-2xl border border-zinc-800 bg-zinc-900/80 px-8 py-10">
            {error ? (
              <p className="text-rose-400">{error}</p>
            ) : (
              <p className="font-mono text-5xl tracking-[0.35em] tabular-nums md:text-6xl">
                {code ?? "······"}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => void refreshCode()}
            className="mt-8 text-sm text-zinc-400 underline-offset-4 hover:text-zinc-200 hover:underline"
          >
            Generate a new code
          </button>
        </div>
      )}
    </div>
  );
}

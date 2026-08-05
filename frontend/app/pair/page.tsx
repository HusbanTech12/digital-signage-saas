"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMockStore } from "@/components/providers/mock-data-provider";
import { startPairingSession } from "@/lib/mock-api/store";

/**
 * Kiosk pairing screen — no dashboard chrome, no Clerk required.
 * Shows a 6-digit code for the admin to enter under Screens → Enter code.
 */
export default function PairPage() {
  const router = useRouter();
  const { screens } = useMockStore();
  const [screenId, setScreenId] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const { screen, pairing } = startPairingSession();
      setScreenId(screen.id);
      setCode(pairing.code);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start pairing.");
    }
  }, []);

  const screen = screens.find((s) => s.id === screenId);
  const paired = Boolean(
    screen && screen.status === "online" && screen.locationId !== null,
  );

  // Auto-advance to the kiosk player once paired
  useEffect(() => {
    if (!paired || !screen) return;
    const t = window.setTimeout(() => {
      router.replace(`/display/${screen.id}`);
    }, 1200);
    return () => window.clearTimeout(t);
  }, [paired, screen, router]);

  function refreshCode() {
    setError(null);
    try {
      const { screen: next, pairing } = startPairingSession();
      setScreenId(next.id);
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
            onClick={refreshCode}
            className="mt-8 text-sm text-zinc-400 underline-offset-4 hover:text-zinc-200 hover:underline"
          >
            Generate a new code
          </button>
        </div>
      )}
    </div>
  );
}

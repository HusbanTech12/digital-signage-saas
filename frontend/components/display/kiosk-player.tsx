"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CanvasBoard } from "@/components/display/canvas-board";
import { MenuFallbackBoard } from "@/components/display/menu-fallback-board";
import { useLiveApi } from "@/lib/api/config";
import { readDisplayCache, writeDisplayCache } from "@/lib/display/cache";
import { touchScreenHeartbeat } from "@/lib/display/heartbeat";
import { connectScreenRealtime } from "@/lib/display/realtime";
import { saveDeviceToken } from "@/lib/display/device-token";
import {
  getScreenDeviceToken,
  resolveDisplayPayload,
} from "@/lib/display/resolve";
import type { DisplayPayload, DisplaySource } from "@/lib/display/types";
import { subscribeMockStore } from "@/lib/mock-api/store";

const POLL_MS = 4000;
const HEARTBEAT_MS = 15000;

export function KioskPlayer({
  screenId,
  initialDeviceToken,
}: {
  screenId: string;
  initialDeviceToken?: string;
}) {
  const router = useRouter();
  const liveApi = useLiveApi();
  const [payload, setPayload] = useState<DisplayPayload | null>(null);
  const [source, setSource] = useState<DisplaySource>("none");
  const [online, setOnline] = useState(true);
  const [booting, setBooting] = useState(true);
  const [wsStatus, setWsStatus] = useState<"connecting" | "open" | "closed">(
    "closed",
  );

  const applyPayload = useCallback(async (next: DisplayPayload) => {
    setPayload(next);
    setSource("live");
    await writeDisplayCache(next);
  }, []);

  const refresh = useCallback(async () => {
    const browserOnline =
      typeof navigator === "undefined" ? true : navigator.onLine;
    setOnline(browserOnline);

    if (!browserOnline) {
      const cached = await readDisplayCache(screenId);
      if (cached) {
        setPayload(cached);
        setSource("cache");
      }
      setBooting(false);
      return;
    }

    try {
      const result = await resolveDisplayPayload(screenId);
      if (result.kind === "pairing") {
        router.replace("/pair");
        return;
      }
      if (result.kind === "payload") {
        await applyPayload(result.payload);
        setBooting(false);
        return;
      }
      if (result.kind === "missing") {
        const cached = await readDisplayCache(screenId);
        if (cached) {
          setPayload(cached);
          setSource("cache");
          setBooting(false);
          return;
        }
        router.replace("/pair");
        return;
      }

      // empty — paired but no published menu
      const cached = await readDisplayCache(screenId);
      if (cached) {
        setPayload(cached);
        setSource("cache");
      } else {
        setPayload(null);
        setSource("none");
      }
      setBooting(false);
    } catch {
      const cached = await readDisplayCache(screenId);
      if (cached) {
        setPayload(cached);
        setSource("cache");
      }
      setBooting(false);
    }
  }, [applyPayload, router, screenId]);

  useEffect(() => {
    if (initialDeviceToken) {
      saveDeviceToken(screenId, initialDeviceToken);
    }
  }, [initialDeviceToken, screenId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Live: WebSocket push + polling fallback. Mock: store subscribe + poll.
  useEffect(() => {
    if (!liveApi) {
      const unsub = subscribeMockStore(() => {
        void refresh();
      });
      const pollId = window.setInterval(() => {
        void refresh();
      }, POLL_MS);
      return () => {
        unsub();
        window.clearInterval(pollId);
      };
    }

    const deviceToken =
      initialDeviceToken || getScreenDeviceToken(screenId) || null;
    let disposeWs: (() => void) | undefined;
    if (deviceToken) {
      saveDeviceToken(screenId, deviceToken);
      disposeWs = connectScreenRealtime(screenId, deviceToken, {
        onPayload: (next) => {
          void applyPayload(next);
          setBooting(false);
        },
        onStatus: setWsStatus,
      });
    }

    const pollId = window.setInterval(() => {
      void refresh();
    }, POLL_MS);

    return () => {
      disposeWs?.();
      window.clearInterval(pollId);
    };
  }, [applyPayload, initialDeviceToken, liveApi, refresh, screenId]);

  useEffect(() => {
    const onOnline = () => void refresh();
    const onOffline = () => void refresh();
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [refresh]);

  useEffect(() => {
    if (source !== "live" && source !== "cache") return;
    void touchScreenHeartbeat(screenId);
    const id = window.setInterval(() => {
      void touchScreenHeartbeat(screenId);
    }, HEARTBEAT_MS);
    return () => window.clearInterval(id);
  }, [screenId, source]);

  if (booting && !payload) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-400">
        Loading display…
      </div>
    );
  }

  if (!payload) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-6 text-center text-zinc-50">
        <p className="text-sm tracking-[0.2em] text-zinc-500 uppercase">
          Signage display
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">
          No content yet
        </h1>
        <p className="mt-3 max-w-md text-zinc-400">
          This screen is paired but has no published menu. Publish from the
          dashboard, or reconnect — last content will appear from cache when
          available.
        </p>
        <StatusChip online={online} source={source} wsStatus={wsStatus} />
      </div>
    );
  }

  const showCanvas =
    payload.canvasJson &&
    Array.isArray(payload.canvasJson.objects) &&
    payload.canvasJson.objects.length > 0;

  return (
    <div
      className={`relative min-h-screen overflow-hidden bg-zinc-950 text-zinc-50 ${
        payload.orientation === "portrait" ? "portrait" : ""
      }`}
    >
      {(source === "cache" || !online) && (
        <div className="absolute top-0 right-0 left-0 z-20 bg-amber-500/90 px-4 py-2 text-center text-sm font-medium text-zinc-950">
          {!online
            ? "Offline — showing last saved menu"
            : "Showing cached menu — reconnecting…"}
        </div>
      )}

      {showCanvas && payload.canvasJson ? (
        <div className="flex min-h-screen items-center justify-center p-0">
          <CanvasBoard
            canvasJson={payload.canvasJson}
            className="h-auto w-full max-w-[100vw]"
          />
        </div>
      ) : (
        <MenuFallbackBoard
          title={payload.menuName ?? payload.screenName}
          items={payload.items}
        />
      )}

      {showCanvas && payload.items.length > 0 ? (
        <div className="pointer-events-none absolute right-0 bottom-0 left-0 bg-gradient-to-t from-black/80 to-transparent px-6 pt-16 pb-5">
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-zinc-200">
            {payload.items.slice(0, 8).map((item) => (
              <span key={item.id} className="tabular-nums">
                {item.name}{" "}
                <span className="text-zinc-400">${item.price.toFixed(2)}</span>
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <StatusChip
        online={online}
        source={source}
        wsStatus={wsStatus}
        compact
      />
    </div>
  );
}

function StatusChip({
  online,
  source,
  wsStatus,
  compact,
}: {
  online: boolean;
  source: DisplaySource;
  wsStatus: "connecting" | "open" | "closed";
  compact?: boolean;
}) {
  const wsLabel =
    wsStatus === "open" ? "ws" : wsStatus === "connecting" ? "ws…" : "poll";
  if (compact) {
    return (
      <div className="pointer-events-none absolute right-3 bottom-3 z-30 rounded bg-black/50 px-2 py-1 font-mono text-[10px] tracking-wide text-zinc-400 uppercase">
        {online ? "live" : "offline"} · {source} · {wsLabel}
      </div>
    );
  }
  return (
    <p className="mt-8 font-mono text-xs tracking-wide text-zinc-600 uppercase">
      {online ? "online" : "offline"} · source {source} · {wsLabel}
    </p>
  );
}

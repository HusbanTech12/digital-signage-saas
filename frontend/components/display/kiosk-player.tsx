"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BackgroundAudioPlayer } from "@/components/display/background-audio-player";
import { CanvasBoard } from "@/components/display/canvas-board";
import { MenuFallbackBoard } from "@/components/display/menu-fallback-board";
import { PlaylistPlayer } from "@/components/display/playlist-player";
import { PremiumMenuBoard } from "@/components/display/premium-menu-board";
import { mergeDisplayConfig } from "@/lib/display/menu-board-theme";
import { useLiveApi } from "@/lib/api/config";
import {
  readDisplayCache,
  syncDisplayCache,
} from "@/lib/display/cache";
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
/** When offline, retry reconnect less aggressively to save CPU/radio. */
const OFFLINE_POLL_MS = 12000;

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
    // Persist JSON immediately; media prefetch runs in background
    await syncDisplayCache(next);
  }, []);

  const applyWallSync = useCallback(
    (sync: { groupId: string; syncEpochMs: number; contentMode?: string }) => {
      setPayload((prev) => {
        if (!prev?.wall || prev.wall.groupId !== sync.groupId) return prev;
        return {
          ...prev,
          wall: {
            ...prev.wall,
            syncEpochMs: sync.syncEpochMs,
            contentMode: sync.contentMode ?? prev.wall.contentMode,
          },
        };
      });
    },
    [],
  );

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
    let ackedCommandId: string | null = null;

    const runRemoteRefresh = async (commandId: string) => {
      await refresh();
      ackedCommandId = commandId;
      const result = await touchScreenHeartbeat(screenId, {
        ackedCommandId: commandId,
      });
      if (result?.pendingRefreshCommandId) {
        // Still pending — try again on next heartbeat cycle
        ackedCommandId = result.pendingRefreshCommandId;
      } else {
        ackedCommandId = null;
      }
    };

    if (deviceToken) {
      saveDeviceToken(screenId, deviceToken);
      disposeWs = connectScreenRealtime(screenId, deviceToken, {
        onPayload: (next) => {
          void applyPayload(next);
          setBooting(false);
        },
        onRefreshCommand: (commandId) => {
          void runRemoteRefresh(commandId);
        },
        onWallSync: applyWallSync,
        onStatus: setWsStatus,
      });
    }

    const intervalMs =
      typeof navigator !== "undefined" && !navigator.onLine
        ? OFFLINE_POLL_MS
        : POLL_MS;
    const pollId = window.setInterval(() => {
      void refresh();
    }, intervalMs);

    const heartbeatId = window.setInterval(() => {
      void (async () => {
        const result = await touchScreenHeartbeat(screenId, {
          ackedCommandId,
        });
        if (result?.pendingRefreshCommandId) {
          await runRemoteRefresh(result.pendingRefreshCommandId);
        }
      })();
    }, HEARTBEAT_MS);

    void (async () => {
      const result = await touchScreenHeartbeat(screenId);
      if (result?.pendingRefreshCommandId) {
        await runRemoteRefresh(result.pendingRefreshCommandId);
      }
    })();

    return () => {
      disposeWs?.();
      window.clearInterval(pollId);
      window.clearInterval(heartbeatId);
    };
  }, [applyPayload, applyWallSync, initialDeviceToken, liveApi, online, refresh, screenId]);

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

  // Mock mode: lightweight heartbeat only
  useEffect(() => {
    if (liveApi) return;
    if (source !== "live" && source !== "cache") return;
    void touchScreenHeartbeat(screenId);
    const id = window.setInterval(() => {
      void touchScreenHeartbeat(screenId);
    }, HEARTBEAT_MS);
    return () => window.clearInterval(id);
  }, [liveApi, screenId, source]);

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

  const usePremium = payload.displayConfig?.layout === "premium";
  const displayConfig = usePremium
    ? mergeDisplayConfig(payload.displayConfig)
    : payload.displayConfig
      ? mergeDisplayConfig(payload.displayConfig)
      : null;
  const showCanvas =
    !usePremium &&
    payload.canvasJson &&
    Array.isArray(payload.canvasJson.objects) &&
    payload.canvasJson.objects.length > 0;

  const contentKey = [
    payload.menuId ?? "",
    payload.menuVersion ?? "",
    payload.updatedAt ?? "",
    payload.items.map((i) => `${i.id}:${i.price}:${i.available}`).join("|"),
  ].join("::");

  const statusLabel =
    source === "live"
      ? liveApi
        ? "Live"
        : "Preview mode (mock data)"
      : source === "cache"
        ? "Cached"
        : undefined;

  const animations =
    displayConfig?.animations ?? mergeDisplayConfig(null).animations;

  const playlist =
    payload.playlist &&
    Array.isArray(payload.playlist.slides) &&
    payload.playlist.slides.length > 0
      ? payload.playlist
      : null;

  const wall = payload.wall ?? null;
  // Tiled crop only makes sense for spanning canvas layouts.
  // Premium / fallback menu boards always fill the physical screen.
  const tiledCanvas =
    Boolean(wall) &&
    wall!.contentMode === "tiled" &&
    wall!.rows > 0 &&
    wall!.cols > 0 &&
    Boolean(showCanvas) &&
    !playlist;

  const board = playlist ? (
    <PlaylistPlayer
      playlist={playlist}
      statusLabel={statusLabel}
      wall={wall}
    />
  ) : showCanvas && payload.canvasJson ? (
    <div
      className={
        tiledCanvas
          ? "h-full w-full"
          : "flex h-dvh w-screen items-center justify-center overflow-hidden p-0"
      }
    >
      <CanvasBoard
        canvasJson={payload.canvasJson}
        className={
          tiledCanvas ? "h-full w-full max-w-none" : "h-auto w-full max-w-[100vw]"
        }
        fillViewport={tiledCanvas}
        animations={animations}
        contentKey={contentKey}
      />
    </div>
  ) : usePremium && displayConfig ? (
    <PremiumMenuBoard
      items={payload.items}
      config={displayConfig}
      statusLabel={statusLabel}
      contentKey={contentKey}
    />
  ) : (
    <MenuFallbackBoard
      title={payload.menuName ?? payload.screenName}
      items={payload.items}
      animations={animations}
      contentKey={contentKey}
    />
  );

  return (
    <div
      className={`relative h-dvh w-screen overflow-hidden bg-zinc-950 text-zinc-50 ${
        payload.orientation === "portrait" ? "portrait" : ""
      }`}
    >
      {(source === "cache" || !online) && (
        <div className="absolute top-0 right-0 left-0 z-20 bg-amber-500/90 px-4 py-2 text-center text-sm font-medium text-zinc-950">
          {!online
            ? "Offline — playing cached content (menu + media)"
            : "Showing cached content — syncing…"}
        </div>
      )}

      {tiledCanvas && wall ? (
        <div className="relative h-dvh w-screen overflow-hidden">
          <div
            className="absolute top-0 left-0"
            style={{
              width: `${wall.cols * 100}vw`,
              height: `${wall.rows * 100}vh`,
              transform: `translate(-${wall.col * 100}vw, -${wall.row * 100}vh)${
                wall.bezelCompensationPct && wall.bezelCompensationPct > 0
                  ? ` scale(${1 + wall.bezelCompensationPct / 100})`
                  : ""
              }`,
              transformOrigin: "top left",
            }}
          >
            {board}
          </div>
          <div className="pointer-events-none absolute top-3 left-3 z-20 font-mono text-[10px] tracking-wide text-zinc-500 uppercase">
            Wall {wall.groupName} · {wall.row + 1},{wall.col + 1}
          </div>
        </div>
      ) : (
        <>
          {board}
          {wall ? (
            <div className="pointer-events-none absolute top-3 left-3 z-20 font-mono text-[10px] tracking-wide text-zinc-500 uppercase">
              Wall {wall.groupName} · shared · {wall.row + 1},{wall.col + 1}
            </div>
          ) : null}
        </>
      )}

      {payload.audio && payload.audio.tracks.length > 0 ? (
        <BackgroundAudioPlayer audio={payload.audio} />
      ) : null}

      {!playlist && showCanvas && payload.items.length > 0 ? (
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

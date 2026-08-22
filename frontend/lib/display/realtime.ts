import { getWsBaseUrl } from "@/lib/api/config";
import type { DisplayPayload } from "@/lib/display/types";

export type RealtimeEnvelope = {
  type: string;
  screenId: string;
  payload?: DisplayPayload | {
    command?: string;
    commandId?: string;
    groupId?: string;
    syncEpochMs?: number;
    contentMode?: string;
  };
  ts?: string;
};

type Handlers = {
  onPayload: (payload: DisplayPayload) => void;
  onRefreshCommand?: (commandId: string) => void;
  onWallSync?: (sync: {
    groupId: string;
    syncEpochMs: number;
    contentMode?: string;
  }) => void;
  onStatus?: (status: "connecting" | "open" | "closed") => void;
};

function isDisplayPayload(value: unknown): value is DisplayPayload {
  return (
    typeof value === "object" &&
    value !== null &&
    "screenId" in value &&
    typeof (value as DisplayPayload).screenId === "string"
  );
}

/**
 * Screen-scoped WebSocket with exponential backoff reconnect.
 * Returns a dispose function.
 */
export function connectScreenRealtime(
  screenId: string,
  deviceToken: string,
  handlers: Handlers,
): () => void {
  const base = getWsBaseUrl();
  if (!base) {
    handlers.onStatus?.("closed");
    return () => undefined;
  }

  let disposed = false;
  let ws: WebSocket | null = null;
  let attempt = 0;
  let timer: number | null = null;

  const clearTimer = () => {
    if (timer != null) {
      window.clearTimeout(timer);
      timer = null;
    }
  };

  const schedule = () => {
    if (disposed) return;
    clearTimer();
    const delay = Math.min(30_000, 500 * 2 ** attempt);
    attempt += 1;
    timer = window.setTimeout(connect, delay);
  };

  const connect = () => {
    if (disposed) return;
    handlers.onStatus?.("connecting");
    const url = `${base}/api/v1/screens/${encodeURIComponent(screenId)}/ws?device_token=${encodeURIComponent(deviceToken)}`;
    try {
      ws = new WebSocket(url);
    } catch {
      schedule();
      return;
    }

    ws.onopen = () => {
      attempt = 0;
      handlers.onStatus?.("open");
    };

    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(String(ev.data)) as RealtimeEnvelope;
        if (data.type === "ping") return;
        if (
          (data.type === "menu.published" ||
            data.type === "playlist.published" ||
            data.type === "wall.published" ||
            data.type === "audio.published") &&
          isDisplayPayload(data.payload)
        ) {
          handlers.onPayload(data.payload);
          return;
        }
        if (data.type === "wall.sync" && data.payload && typeof data.payload === "object") {
          const p = data.payload as {
            groupId?: string;
            syncEpochMs?: number;
            contentMode?: string;
          };
          if (p.groupId && typeof p.syncEpochMs === "number") {
            handlers.onWallSync?.({
              groupId: p.groupId,
              syncEpochMs: p.syncEpochMs,
              contentMode: p.contentMode,
            });
          }
          return;
        }
        if (data.type === "device.refresh") {
          const commandId =
            data.payload &&
            typeof data.payload === "object" &&
            "commandId" in data.payload
              ? String(
                  (data.payload as { commandId?: string }).commandId ?? "",
                )
              : "";
          if (commandId) handlers.onRefreshCommand?.(commandId);
        }
      } catch {
        /* ignore malformed frames */
      }
    };

    ws.onerror = () => {
      /* onclose will reconnect */
    };

    ws.onclose = () => {
      handlers.onStatus?.("closed");
      ws = null;
      if (!disposed) schedule();
    };
  };

  connect();

  return () => {
    disposed = true;
    clearTimer();
    if (ws) {
      ws.onclose = null;
      ws.close();
      ws = null;
    }
  };
}

import { getWsBaseUrl } from "@/lib/api/config";
import type { DisplayPayload } from "@/lib/display/types";

export type RealtimeEnvelope = {
  type: string;
  screenId: string;
  payload?: DisplayPayload;
  ts?: string;
};

type Handlers = {
  onPayload: (payload: DisplayPayload) => void;
  onStatus?: (status: "connecting" | "open" | "closed") => void;
};

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
        if (data.type === "menu.published" && data.payload?.screenId) {
          handlers.onPayload(data.payload);
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

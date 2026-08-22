import { touchScreenHeartbeatApi } from "@/lib/api/tenant";
import { useLiveApi } from "@/lib/api/config";
import { readDisplayCache, readDisplayCacheMeta } from "@/lib/display/cache";
import { getScreenDeviceToken } from "@/lib/display/resolve";
import type { DisplayPayload } from "@/lib/display/types";
import {
  touchScreenHeartbeat as touchScreenHeartbeatMock,
  upsertScreen,
} from "@/lib/mock-api/store";
import type { Screen } from "@/lib/types/schema";

const CLIENT_APP_VERSION = "1.0.0";

export type HeartbeatResult = {
  screen: Screen;
  pendingRefreshCommandId: string | null;
};

function contentSummary(payload: DisplayPayload | null): string | null {
  if (!payload) return null;
  if (payload.playlist) {
    return `Playlist: ${payload.playlist.name} (v${payload.playlist.version})`;
  }
  if (payload.menuName) {
    const ver = payload.menuVersion != null ? ` v${payload.menuVersion}` : "";
    return `Menu: ${payload.menuName}${ver}`;
  }
  if (payload.templateName) {
    return `Template: ${payload.templateName}`;
  }
  return "Paired — no published content";
}

/** Kiosk heartbeat — mock store locally, or FastAPI when live API is on. */
export async function touchScreenHeartbeat(
  screenId: string,
  options?: { ackedCommandId?: string | null },
): Promise<HeartbeatResult | null> {
  if (useLiveApi()) {
    const deviceToken = getScreenDeviceToken(screenId);
    if (!deviceToken) return null;
    try {
      const [meta, cached] = await Promise.all([
        readDisplayCacheMeta(screenId),
        readDisplayCache(screenId),
      ]);
      const updated = await touchScreenHeartbeatApi(screenId, deviceToken, {
        lastSyncAt: meta?.lastSyncAt ?? undefined,
        lastSyncError: meta?.lastSyncError ?? undefined,
        contentVersion: cached?.menuVersion ?? cached?.playlist?.version ?? undefined,
        contentUpdatedAt: cached?.updatedAt ?? meta?.payloadUpdatedAt ?? undefined,
        currentContentSummary: contentSummary(cached),
        clientAppVersion: CLIENT_APP_VERSION,
        ackedCommandId: options?.ackedCommandId ?? undefined,
      });
      upsertScreen(updated);
      const pendingRefreshCommandId =
        updated.pendingCommand === "refresh" && updated.pendingCommandId
          ? updated.pendingCommandId
          : null;
      return { screen: updated, pendingRefreshCommandId };
    } catch {
      /* offline — kiosk keeps last cached state */
      return null;
    }
  }
  touchScreenHeartbeatMock(screenId);
  return null;
}

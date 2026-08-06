import { touchScreenHeartbeatApi } from "@/lib/api/tenant";
import { useLiveApi } from "@/lib/api/config";
import { getScreenDeviceToken } from "@/lib/display/resolve";
import {
  touchScreenHeartbeat as touchScreenHeartbeatMock,
  upsertScreen,
} from "@/lib/mock-api/store";

/** Kiosk heartbeat — mock store locally, or FastAPI when live API is on. */
export async function touchScreenHeartbeat(screenId: string) {
  if (useLiveApi()) {
    const deviceToken = getScreenDeviceToken(screenId);
    if (!deviceToken) return;
    try {
      const updated = await touchScreenHeartbeatApi(screenId, deviceToken);
      upsertScreen(updated);
    } catch {
      /* offline — kiosk keeps last cached state */
    }
    return;
  }
  touchScreenHeartbeatMock(screenId);
}

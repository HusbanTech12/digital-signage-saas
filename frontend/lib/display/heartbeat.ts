import { touchScreenHeartbeatApi } from "@/lib/api/tenant";
import { useLiveApi } from "@/lib/api/config";
import {
  getMockStoreSnapshot,
  touchScreenHeartbeat as touchScreenHeartbeatMock,
  upsertScreen,
} from "@/lib/mock-api/store";

/** Kiosk heartbeat — mock store locally, or FastAPI when live API is on. */
export async function touchScreenHeartbeat(screenId: string) {
  if (useLiveApi()) {
    const screen = getMockStoreSnapshot().screens.find((s) => s.id === screenId);
    if (!screen?.deviceToken || screen.locationId === null) return;
    try {
      const updated = await touchScreenHeartbeatApi(
        screenId,
        screen.deviceToken,
      );
      upsertScreen(updated);
    } catch {
      /* offline — kiosk keeps last cached state */
    }
    return;
  }
  touchScreenHeartbeatMock(screenId);
}

import { apiFetch } from "@/lib/api/client";
import type { DisplayPayload } from "@/lib/display/types";

export function getScreenContentApi(screenId: string, deviceToken: string) {
  return apiFetch<DisplayPayload>(`/api/v1/screens/${screenId}/content`, {
    auth: false,
    query: { device_token: deviceToken },
  });
}

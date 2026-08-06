const key = (screenId: string) => `signage.deviceToken.${screenId}`;

/** Persist kiosk device token across `/pair` → `/display` navigation & reloads. */
export function saveDeviceToken(screenId: string, deviceToken: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key(screenId), deviceToken);
  } catch {
    /* private mode / quota */
  }
}

export function readDeviceToken(screenId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key(screenId));
  } catch {
    return null;
  }
}

export function clearDeviceToken(screenId: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key(screenId));
  } catch {
    /* ignore */
  }
}

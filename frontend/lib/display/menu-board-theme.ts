/** Premium fixed-layout menu board theme — configured on templates. */
import {
  DEFAULT_DISPLAY_ANIMATIONS,
  mergeAnimations,
  type DisplayAnimationConfig,
} from "@/lib/display/animations";

export type MenuBoardLayout = "premium" | "classic";

export type BoardQrPosition =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

/** On-screen QR badge sourced from the QR code library. */
export interface BoardQrConfig {
  enabled: boolean;
  /** Source QR code, so the dashboard can round-trip the selection. */
  qrCodeId: string | null;
  /**
   * Public render URL of the code. Stored on the template (rather than resolved
   * on the kiosk) so screens need no extra request and the offline cache can
   * pick it up with the rest of the payload's assets.
   */
  imageUrl: string | null;
  label: string;
  position: BoardQrPosition;
  /** Badge width as a percentage of the board's shorter side. */
  sizePct: number;
}

export const DEFAULT_BOARD_QR_CONFIG: BoardQrConfig = {
  enabled: false,
  qrCodeId: null,
  imageUrl: null,
  label: "SCAN FOR MENU",
  position: "bottom-right",
  sizePct: 14,
};

export interface MenuDisplayConfig {
  layout: MenuBoardLayout;
  /** Large header title (e.g. "Fusion Kitchen") */
  brandTitle: string;
  /** Subtitle under brand (e.g. "TODAY'S MENU") */
  subtitle: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  mutedColor: string;
  soldOutColor: string;
  /** Fixed column order — items map to these categories */
  categories: string[];
  showClock: boolean;
  /** Show unavailable items as SOLD OUT instead of hiding them */
  showSoldOut: boolean;
  /** Board + item entrance animations (kiosk-safe CSS) */
  animations: DisplayAnimationConfig;
  /** Optional QR badge overlaid on the board */
  qr: BoardQrConfig;
}

export const DEFAULT_MENU_DISPLAY_CONFIG: MenuDisplayConfig = {
  layout: "premium",
  brandTitle: "Fusion Kitchen",
  subtitle: "TODAY'S MENU",
  accentColor: "#c4a574",
  backgroundColor: "#0c0c0e",
  textColor: "#fafaf9",
  mutedColor: "#71717a",
  soldOutColor: "#991b1b",
  categories: ["Starters", "Mains", "Sweets"],
  showClock: true,
  showSoldOut: true,
  animations: { ...DEFAULT_DISPLAY_ANIMATIONS },
  qr: { ...DEFAULT_BOARD_QR_CONFIG },
};

export function mergeQrConfig(
  partial?: Partial<BoardQrConfig> | null,
): BoardQrConfig {
  const merged = { ...DEFAULT_BOARD_QR_CONFIG, ...(partial ?? {}) };
  return {
    ...merged,
    // A badge with nothing to render would just be an empty hole on the TV.
    enabled: merged.enabled && Boolean(merged.imageUrl),
    sizePct: Math.min(30, Math.max(6, merged.sizePct)),
  };
}

export function mergeDisplayConfig(
  partial?: Partial<MenuDisplayConfig> | null,
): MenuDisplayConfig {
  if (!partial) {
    return {
      ...DEFAULT_MENU_DISPLAY_CONFIG,
      animations: { ...DEFAULT_DISPLAY_ANIMATIONS },
      categories: [...DEFAULT_MENU_DISPLAY_CONFIG.categories],
      qr: { ...DEFAULT_BOARD_QR_CONFIG },
    };
  }
  return {
    ...DEFAULT_MENU_DISPLAY_CONFIG,
    ...partial,
    layout: "premium",
    categories:
      partial.categories?.length
        ? partial.categories
        : [...DEFAULT_MENU_DISPLAY_CONFIG.categories],
    animations: mergeAnimations(
      partial.animations ?? DEFAULT_DISPLAY_ANIMATIONS,
    ),
    qr: mergeQrConfig(partial.qr),
  };
}

export type { DisplayAnimationConfig };

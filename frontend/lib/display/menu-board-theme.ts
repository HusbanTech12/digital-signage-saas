/** Premium fixed-layout menu board theme — configured on templates. */
export type MenuBoardLayout = "premium" | "classic";

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
};

export function mergeDisplayConfig(
  partial?: Partial<MenuDisplayConfig> | null,
): MenuDisplayConfig {
  if (!partial) return { ...DEFAULT_MENU_DISPLAY_CONFIG };
  return {
    ...DEFAULT_MENU_DISPLAY_CONFIG,
    ...partial,
    categories:
      partial.categories?.length ? partial.categories : DEFAULT_MENU_DISPLAY_CONFIG.categories,
  };
}

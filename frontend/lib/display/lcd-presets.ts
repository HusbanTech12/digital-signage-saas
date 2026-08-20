import type { ScreenOrientation } from "@/lib/types/schema";

export interface LcdPreset {
  id: string;
  label: string;
  resolution: string;
  orientation: ScreenOrientation;
  /** Short hint shown under the select */
  hint: string;
}

/** Common restaurant / retail LCD profiles admins can match to physical TVs. */
export const LCD_PRESETS: LcdPreset[] = [
  {
    id: "fhd_landscape",
    label: "Full HD Landscape",
    resolution: "1920x1080",
    orientation: "landscape",
    hint: "Most wall-mounted menu boards (16:9)",
  },
  {
    id: "fhd_portrait",
    label: "Full HD Portrait",
    resolution: "1080x1920",
    orientation: "portrait",
    hint: "Counter pillars and tall displays (9:16)",
  },
  {
    id: "uhd_landscape",
    label: "4K Landscape",
    resolution: "3840x2160",
    orientation: "landscape",
    hint: "Large lobby or entrance TVs",
  },
  {
    id: "hd_landscape",
    label: "HD Landscape",
    resolution: "1280x720",
    orientation: "landscape",
    hint: "Older or smaller LCDs",
  },
  {
    id: "qhd_landscape",
    label: "QHD Landscape",
    resolution: "2560x1440",
    orientation: "landscape",
    hint: "Higher-density commercial panels",
  },
];

export const CUSTOM_LCD_PRESET_ID = "custom";

export function findLcdPreset(
  resolution: string,
  orientation: ScreenOrientation,
): LcdPreset | null {
  const normalized = resolution.trim().toLowerCase();
  return (
    LCD_PRESETS.find(
      (p) =>
        p.resolution.toLowerCase() === normalized &&
        p.orientation === orientation,
    ) ?? null
  );
}

export function lcdPresetSelectValue(
  resolution: string,
  orientation: ScreenOrientation,
): string {
  return findLcdPreset(resolution, orientation)?.id ?? CUSTOM_LCD_PRESET_ID;
}

export function lcdPresetLabel(
  resolution: string,
  orientation: ScreenOrientation,
): string {
  const preset = findLcdPreset(resolution, orientation);
  if (preset) return preset.label;
  return `${resolution} · ${orientation}`;
}

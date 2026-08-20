"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CUSTOM_LCD_PRESET_ID,
  LCD_PRESETS,
  lcdPresetSelectValue,
} from "@/lib/display/lcd-presets";
import type { ScreenOrientation } from "@/lib/types/schema";

export function TemplateLcdTypeFields({
  resolution,
  orientation,
  onChange,
  disabled,
}: {
  resolution: string;
  orientation: ScreenOrientation;
  onChange: (next: {
    resolution: string;
    orientation: ScreenOrientation;
  }) => void;
  disabled?: boolean;
}) {
  const matchedId = lcdPresetSelectValue(resolution, orientation);
  const [forceCustom, setForceCustom] = useState(
    matchedId === CUSTOM_LCD_PRESET_ID,
  );
  const presetId = forceCustom ? CUSTOM_LCD_PRESET_ID : matchedId;
  const activePreset =
    presetId === CUSTOM_LCD_PRESET_ID
      ? null
      : (LCD_PRESETS.find((p) => p.id === presetId) ?? null);

  function onPresetChange(nextPresetId: string) {
    if (nextPresetId === CUSTOM_LCD_PRESET_ID) {
      setForceCustom(true);
      return;
    }
    setForceCustom(false);
    const preset = LCD_PRESETS.find((p) => p.id === nextPresetId);
    if (!preset) return;
    onChange({
      resolution: preset.resolution,
      orientation: preset.orientation,
    });
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="tpl-lcd">LCD / screen type</Label>
        <select
          id="tpl-lcd"
          value={presetId}
          disabled={disabled}
          onChange={(e) => onPresetChange(e.target.value)}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50"
        >
          {LCD_PRESETS.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.label} ({preset.resolution})
            </option>
          ))}
          <option value={CUSTOM_LCD_PRESET_ID}>Custom…</option>
        </select>
        <p className="text-xs text-muted-foreground">
          {activePreset?.hint ??
            "This template is designed for this LCD size. Match it when publishing to a screen."}
        </p>
      </div>
      {presetId === CUSTOM_LCD_PRESET_ID ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="tpl-orient">Orientation</Label>
            <select
              id="tpl-orient"
              value={orientation}
              disabled={disabled}
              onChange={(e) =>
                onChange({
                  resolution,
                  orientation: e.target.value as ScreenOrientation,
                })
              }
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50"
            >
              <option value="landscape">Landscape</option>
              <option value="portrait">Portrait</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tpl-res">Resolution</Label>
            <Input
              id="tpl-res"
              value={resolution}
              disabled={disabled}
              onChange={(e) =>
                onChange({ resolution: e.target.value, orientation })
              }
              placeholder="1920x1080"
              required
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

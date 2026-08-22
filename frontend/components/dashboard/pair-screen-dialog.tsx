"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApiAuthToken } from "@/lib/api/auth-token";
import { completePairing } from "@/lib/data/tenant";
import {
  CUSTOM_LCD_PRESET_ID,
  LCD_PRESETS,
} from "@/lib/display/lcd-presets";
import type { Location, ScreenOrientation } from "@/lib/types/schema";

export function PairScreenDialog({
  open,
  onClose,
  locations,
  organizationId,
}: {
  open: boolean;
  onClose: () => void;
  locations: Location[];
  organizationId: string;
}) {
  const { getApiToken } = useApiAuthToken();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [locationId, setLocationId] = useState(locations[0]?.id ?? "");
  const [presetId, setPresetId] = useState(LCD_PRESETS[0]!.id);
  const [orientation, setOrientation] = useState<ScreenOrientation>(
    LCD_PRESETS[0]!.orientation,
  );
  const [resolution, setResolution] = useState(LCD_PRESETS[0]!.resolution);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const activePreset =
    presetId === CUSTOM_LCD_PRESET_ID
      ? null
      : LCD_PRESETS.find((p) => p.id === presetId) ?? null;

  function applyPreset(nextPresetId: string) {
    setPresetId(nextPresetId);
    if (nextPresetId === CUSTOM_LCD_PRESET_ID) return;
    const preset = LCD_PRESETS.find((p) => p.id === nextPresetId);
    if (!preset) return;
    setResolution(preset.resolution);
    setOrientation(preset.orientation);
  }

  function reset() {
    setCode("");
    setName("");
    setLocationId(locations[0]?.id ?? "");
    setPresetId(LCD_PRESETS[0]!.id);
    setResolution(LCD_PRESETS[0]!.resolution);
    setOrientation(LCD_PRESETS[0]!.orientation);
    setError(null);
    setSuccess(null);
    setSaving(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      if (!locationId) throw new Error("Select a location.");
      if (!/^\d{3,5}x\d{3,5}$/i.test(resolution.trim())) {
        throw new Error("Resolution must look like 1920x1080.");
      }
      const token = await getApiToken();
      const screen = await completePairing(
        {
          code,
          locationId,
          name: name || "Paired screen",
          organizationId,
          resolution: resolution.trim(),
          orientation,
        },
        token,
      );
      setSuccess(`Paired “${screen.name}” successfully.`);
      setTimeout(handleClose, 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pairing failed.");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close dialog"
        onClick={handleClose}
      />
      <div className="relative w-full max-w-md rounded-xl border border-border bg-background p-5 shadow-lg">
        <h2 className="text-lg font-semibold tracking-tight">Pair a screen</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Open <code className="text-xs">/pair</code> on the display, then enter
          the 6-digit code here before it expires (about 15 minutes). If the
          code expired or pairing failed, tap “Generate a new code” on the
          display and try again. Demo seed code:{" "}
          <span className="font-medium text-foreground">482917</span>
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="pair-code">Pairing code</Label>
            <Input
              id="pair-code"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pair-name">Screen name</Label>
            <Input
              id="pair-name"
              placeholder="Lobby Left"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pair-location">Location</Label>
            <select
              id="pair-location"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              required
            >
              {locations.length === 0 ? (
                <option value="">No locations available</option>
              ) : (
                locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pair-lcd">LCD type</Label>
            <select
              id="pair-lcd"
              value={presetId}
              onChange={(e) => applyPreset(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
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
                "Enter the exact pixel size of your physical LCD."}
            </p>
          </div>

          {presetId === CUSTOM_LCD_PRESET_ID ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="pair-orient">Orientation</Label>
                <select
                  id="pair-orient"
                  value={orientation}
                  onChange={(e) =>
                    setOrientation(e.target.value as ScreenOrientation)
                  }
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="landscape">Landscape</option>
                  <option value="portrait">Portrait</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pair-res">Resolution</Label>
                <Input
                  id="pair-res"
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  placeholder="1920x1080"
                  required
                />
              </div>
            </div>
          ) : null}

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          {success ? (
            <p className="text-sm text-emerald-600" role="status">
              {success}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={locations.length === 0 || saving}>
              {saving ? "Pairing…" : "Pair screen"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

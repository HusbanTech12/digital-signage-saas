"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OrientationToggle } from "@/components/dashboard/orientation-toggle";
import { useApiAuthToken } from "@/lib/api/auth-token";
import { completePairing } from "@/lib/data/tenant";
import { nominalResolution } from "@/lib/display/orientation";
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
  const [orientation, setOrientation] =
    useState<ScreenOrientation>("landscape");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  function reset() {
    setCode("");
    setName("");
    setLocationId(locations[0]?.id ?? "");
    setOrientation("landscape");
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
      const token = await getApiToken();
      const screen = await completePairing(
        {
          code,
          locationId,
          name: name || "Paired screen",
          organizationId,
          resolution: nominalResolution(orientation),
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

          <OrientationToggle value={orientation} onChange={setOrientation} />

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

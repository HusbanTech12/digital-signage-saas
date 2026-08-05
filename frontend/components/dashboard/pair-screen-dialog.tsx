"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { completePairing } from "@/lib/mock-api/store";
import type { Location } from "@/lib/types/schema";

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
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [locationId, setLocationId] = useState(locations[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!open) return null;

  function reset() {
    setCode("");
    setName("");
    setLocationId(locations[0]?.id ?? "");
    setError(null);
    setSuccess(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      if (!locationId) throw new Error("Select a location.");
      const screen = completePairing({
        code,
        locationId,
        name: name || "Paired screen",
        organizationId,
      });
      setSuccess(`Paired “${screen.name}” successfully.`);
      setTimeout(handleClose, 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pairing failed.");
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
          the 6-digit code here. Demo seed code:{" "}
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
            <Button type="submit" disabled={locations.length === 0}>
              Pair screen
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

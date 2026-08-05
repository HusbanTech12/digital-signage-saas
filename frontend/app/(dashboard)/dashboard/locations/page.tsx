"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { useMockSession } from "@/components/providers/mock-session-provider";
import { useMockStore } from "@/components/providers/mock-data-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApiAuthToken } from "@/lib/api/auth-token";
import {
  canCreateLocation,
  canDeleteLocation,
  canManageLocations,
  filterLocationsForUser,
} from "@/lib/access";
import {
  createLocation,
  deleteLocation,
  updateLocation,
} from "@/lib/data/tenant";
import type { Location } from "@/lib/types/schema";

export default function LocationsPage() {
  const { session, role } = useMockSession();
  const { locations, screens } = useMockStore();
  const { getApiToken } = useApiAuthToken();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Location | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visible = useMemo(
    () => filterLocationsForUser(locations, session.user),
    [locations, session.user],
  );

  if (!canManageLocations(role)) {
    return (
      <div className="mx-auto max-w-4xl">
        <PageHeader
          title="Locations"
          description="Location Managers cannot manage locations. Ask an Admin."
        />
      </div>
    );
  }

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
    setError(null);
  }

  function openEdit(location: Location) {
    setEditing(location);
    setFormOpen(true);
    setError(null);
  }

  async function handleDelete(location: Location) {
    setError(null);
    try {
      if (!confirm(`Delete location “${location.name}”?`)) return;
      const token = await getApiToken();
      await deleteLocation(location.id, token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Locations"
        description="Physical sites under your organization."
        actions={
          canCreateLocation(role) ? (
            <Button onClick={openCreate}>Add location</Button>
          ) : null
        }
      />

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="hidden px-4 py-3 font-medium md:table-cell">
                Address
              </th>
              <th className="px-4 py-3 font-medium">Timezone</th>
              <th className="px-4 py-3 font-medium">Screens</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  No locations yet.
                </td>
              </tr>
            ) : (
              visible.map((location) => {
                const count = screens.filter(
                  (s) => s.locationId === location.id,
                ).length;
                return (
                  <tr
                    key={location.id}
                    className="border-b border-border last:border-0"
                  >
                    <td className="px-4 py-3 font-medium">{location.name}</td>
                    <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                      {location.address}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {location.timezone}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{count}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEdit(location)}
                        >
                          Edit
                        </Button>
                        {canDeleteLocation(role) ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => void handleDelete(location)}
                          >
                            Delete
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {formOpen ? (
        <LocationFormDialog
          organizationId={session.organization.id}
          location={editing}
          getApiToken={getApiToken}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
        />
      ) : null}
    </div>
  );
}

function LocationFormDialog({
  organizationId,
  location,
  getApiToken,
  onClose,
}: {
  organizationId: string;
  location: Location | null;
  getApiToken: () => Promise<string | null>;
  onClose: () => void;
}) {
  const [name, setName] = useState(location?.name ?? "");
  const [address, setAddress] = useState(location?.address ?? "");
  const [timezone, setTimezone] = useState(
    location?.timezone ?? "America/Los_Angeles",
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const token = await getApiToken();
      if (location) {
        await updateLocation(location.id, { name, address, timezone }, token);
      } else {
        await createLocation(
          { organizationId, name, address, timezone },
          token,
        );
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-md space-y-3 rounded-xl border border-border bg-background p-5 shadow-lg"
      >
        <h2 className="text-lg font-semibold tracking-tight">
          {location ? "Edit location" : "Add location"}
        </h2>
        <div className="space-y-1.5">
          <Label htmlFor="loc-name">Name</Label>
          <Input
            id="loc-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="loc-address">Address</Label>
          <Input
            id="loc-address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="loc-tz">Timezone</Label>
          <Input
            id="loc-tz"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            required
          />
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : location ? "Save" : "Create"}
          </Button>
        </div>
      </form>
    </div>
  );
}

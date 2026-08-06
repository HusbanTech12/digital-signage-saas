"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { useMockSession } from "@/components/providers/mock-session-provider";
import { useMockStore } from "@/components/providers/mock-data-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApiAuthToken } from "@/lib/api/auth-token";
import { useLiveApi } from "@/lib/api/config";
import {
  createPosIntegrationApi,
  deletePosIntegrationApi,
  getPosSyncStatusApi,
  listPosEventsApi,
  listPosIntegrationsApi,
  simulatePosUpdatesApi,
  updatePosIntegrationApi,
} from "@/lib/api/pos";
import { canManagePos } from "@/lib/access";
import type {
  PosIntegration,
  PosSyncEvent,
  PosSyncStatus,
} from "@/lib/types/schema";

export default function SettingsPage() {
  const { session, role } = useMockSession();
  const { locations, menus, menuItems } = useMockStore();
  const { getApiToken } = useApiAuthToken();
  const live = useLiveApi();

  const [integrations, setIntegrations] = useState<PosIntegration[]>([]);
  const [events, setEvents] = useState<PosSyncEvent[]>([]);
  const [syncStatus, setSyncStatus] = useState<PosSyncStatus | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [locationId, setLocationId] = useState("");
  const [menuId, setMenuId] = useState("");
  const [simulateSku, setSimulateSku] = useState("SKU-LATTE");
  const [simulatePrice, setSimulatePrice] = useState("5.25");

  const orgLocations = useMemo(
    () =>
      locations.filter((l) => l.organizationId === session.organization.id),
    [locations, session.organization.id],
  );
  const orgMenus = useMemo(
    () => menus.filter((m) => m.organizationId === session.organization.id),
    [menus, session.organization.id],
  );
  const selected = integrations.find((i) => i.id === selectedId) ?? null;

  const refresh = useCallback(async () => {
    if (!live) return;
    const token = await getApiToken();
    if (!token) return;
    const [list, status] = await Promise.all([
      listPosIntegrationsApi(token),
      getPosSyncStatusApi(token),
    ]);
    setIntegrations(list);
    setSyncStatus(status);
    setSelectedId((prev) =>
      prev && list.some((i) => i.id === prev) ? prev : list[0]?.id ?? null,
    );
  }, [getApiToken, live]);

  useEffect(() => {
    if (!orgLocations[0] || locationId) return;
    setLocationId(orgLocations[0].id);
  }, [orgLocations, locationId]);

  useEffect(() => {
    if (!orgMenus[0] || menuId) return;
    setMenuId(orgMenus[0].id);
  }, [orgMenus, menuId]);

  useEffect(() => {
    void refresh().catch((err) =>
      setError(err instanceof Error ? err.message : "Failed to load POS"),
    );
  }, [refresh]);

  useEffect(() => {
    if (!live || !selectedId) {
      setEvents([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const token = await getApiToken();
        if (!token || cancelled) return;
        const rows = await listPosEventsApi(token, selectedId, 20);
        if (!cancelled) setEvents(rows);
      } catch {
        /* keep previous events */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getApiToken, live, selectedId, syncStatus?.lastSyncAt]);

  if (!canManagePos(role)) {
    return (
      <div className="mx-auto max-w-4xl">
        <PageHeader
          title="Settings"
          description="Only Super Admins and Admins can manage POS integrations."
        />
      </div>
    );
  }

  async function handleCreate() {
    setBusy(true);
    setError(null);
    try {
      const token = await getApiToken();
      if (!token) throw new Error("No API token");
      const items = menuItems.filter((i) => i.menuId === menuId);
      const itemMap: Record<string, string> = {};
      for (const item of items) {
        const sku =
          item.id === "item_latte"
            ? "SKU-LATTE"
            : item.id === "item_avocado"
              ? "SKU-AVOCADO"
              : item.id === "item_soup"
                ? "SKU-SOUP"
                : `SKU-${item.name.toUpperCase().replace(/[^A-Z0-9]+/g, "-")}`;
        itemMap[sku] = item.id;
      }
      await createPosIntegrationApi(token, {
        organizationId: session.organization.id,
        locationId,
        provider: "square",
        credentials: { webhookSecret: "demo-pos-secret" },
        config: { menuId, itemMap },
        status: "active",
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleToggle(integration: PosIntegration) {
    setBusy(true);
    setError(null);
    try {
      const token = await getApiToken();
      if (!token) throw new Error("No API token");
      await updatePosIntegrationApi(token, integration.id, {
        status: integration.status === "active" ? "inactive" : "active",
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(integration: PosIntegration) {
    if (!confirm(`Remove POS integration for ${integration.provider}?`)) return;
    setBusy(true);
    setError(null);
    try {
      const token = await getApiToken();
      if (!token) throw new Error("No API token");
      await deletePosIntegrationApi(token, integration.id);
      setSelectedId(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleSimulate() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const token = await getApiToken();
      if (!token) throw new Error("No API token");
      await simulatePosUpdatesApi(token, selected.id, [
        {
          type: "price_update",
          externalSku: simulateSku,
          price: Number(simulatePrice),
        },
      ]);
      await refresh();
      alert("POS simulate accepted — menu item price updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Simulate failed");
    } finally {
      setBusy(false);
    }
  }

  const locationName = (id: string) =>
    locations.find((l) => l.id === id)?.name ?? id;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Settings"
        description="Square POS sync (Prompt 10) — connect a location, map SKUs, simulate price updates."
      />

      {!live ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
          Live API is off. Set <code>NEXT_PUBLIC_API_URL</code> and seed the
          backend to manage POS integrations.
        </p>
      ) : null}

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {syncStatus ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat
            label="Active integrations"
            value={String(syncStatus.integrationsActive)}
          />
          <Stat
            label="Erroring"
            value={String(syncStatus.integrationsError)}
          />
          <Stat
            label="Last sync"
            value={
              syncStatus.lastSyncAt
                ? new Date(syncStatus.lastSyncAt).toLocaleString()
                : "—"
            }
          />
        </div>
      ) : null}

      <section className="space-y-3 rounded-xl border border-border p-4">
        <h2 className="text-sm font-semibold">Connect Square (demo)</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Location</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
            >
              {orgLocations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Menu for SKU map</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={menuId}
              onChange={(e) => setMenuId(e.target.value)}
            >
              {orgMenus.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <Button onClick={() => void handleCreate()} disabled={busy || !live}>
              Add integration
            </Button>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Provider</th>
              <th className="px-4 py-3 font-medium">Location</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {integrations.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  No POS integrations yet. Seed the API or add one above.
                </td>
              </tr>
            ) : (
              integrations.map((row) => (
                <tr
                  key={row.id}
                  className={`border-b border-border last:border-0 ${
                    selectedId === row.id ? "bg-muted/30" : ""
                  }`}
                >
                  <td className="px-4 py-3 capitalize">
                    <button
                      type="button"
                      className="font-medium hover:underline"
                      onClick={() => setSelectedId(row.id)}
                    >
                      {row.provider.replaceAll("_", " ")}
                    </button>
                    <div className="text-xs text-muted-foreground">{row.id}</div>
                  </td>
                  <td className="px-4 py-3">{locationName(row.locationId)}</td>
                  <td className="px-4 py-3 capitalize">{row.status}</td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void handleToggle(row)}
                      disabled={busy}
                    >
                      {row.status === "active" ? "Disable" : "Enable"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void handleDelete(row)}
                      disabled={busy}
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {selected ? (
        <section className="space-y-4 rounded-xl border border-border p-4">
          <h2 className="text-sm font-semibold">Simulate price update</h2>
          <p className="text-xs text-muted-foreground">
            Webhook URL:{" "}
            <code className="rounded bg-muted px-1 py-0.5">
              POST /api/v1/webhooks/pos/square/{selected.id}
            </code>
          </p>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-2">
              <Label>External SKU</Label>
              <Input
                value={simulateSku}
                onChange={(e) => setSimulateSku(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>New price</Label>
              <Input
                value={simulatePrice}
                onChange={(e) => setSimulatePrice(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={() => void handleSimulate()}
                disabled={busy || selected.status !== "active"}
              >
                Run simulate
              </Button>
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Recent sync events
            </h3>
            <ul className="divide-y divide-border rounded-lg border border-border">
              {events.length === 0 ? (
                <li className="px-3 py-4 text-sm text-muted-foreground">
                  No events yet.
                </li>
              ) : (
                events.map((ev) => (
                  <li key={ev.id} className="px-3 py-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{ev.eventType}</span>
                      <span className="capitalize text-muted-foreground">
                        {ev.status}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(ev.createdAt).toLocaleString()}
                      {ev.errorMessage ? ` · ${ev.errorMessage}` : ""}
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

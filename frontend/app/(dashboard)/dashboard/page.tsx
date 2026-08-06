"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { useMockSession } from "@/components/providers/mock-session-provider";
import { useMockStore } from "@/components/providers/mock-data-provider";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { useApiAuthToken } from "@/lib/api/auth-token";
import { useLiveApi } from "@/lib/api/config";
import { getPosSyncStatusApi } from "@/lib/api/pos";
import {
  canManageLocations,
  canManagePos,
  canPairScreens,
  filterLocationsForUser,
  filterScreensForUser,
} from "@/lib/access";
import { getMenusByOrg } from "@/lib/mock-data";
import type { PosSyncStatus } from "@/lib/types/schema";

export default function DashboardOverviewPage() {
  const { session, role, roleLabel } = useMockSession();
  const { locations, screens } = useMockStore();
  const { getApiToken } = useApiAuthToken();
  const live = useLiveApi();
  const [posStatus, setPosStatus] = useState<PosSyncStatus | null>(null);
  const orgId = session.organization.id;

  useEffect(() => {
    if (!live || !canManagePos(role)) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await getApiToken();
        if (!token || cancelled) return;
        const status = await getPosSyncStatusApi(token);
        if (!cancelled) setPosStatus(status);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getApiToken, live, role]);

  const visibleLocations = useMemo(
    () => filterLocationsForUser(locations, session.user),
    [locations, session.user],
  );
  const visibleScreens = useMemo(
    () => filterScreensForUser(screens, session.user),
    [screens, session.user],
  );

  const onlineCount = visibleScreens.filter((s) => s.status === "online").length;
  const pairingCount = screens.filter(
    (s) => s.organizationId === orgId && s.status === "pairing",
  ).length;
  const menuCount = getMenusByOrg(orgId).length;

  const stats = [
    { label: "Locations", value: visibleLocations.length },
    { label: "Screens", value: visibleScreens.length },
    { label: "Online now", value: onlineCount },
    { label: "Menus", value: menuCount },
  ];

  const recentScreens = [...visibleScreens]
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 5);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Overview"
        description={`Welcome back, ${session.user.name}. Viewing as ${roleLabel} for ${session.organization.name}.`}
        actions={
          canPairScreens(role) ? (
            <Button render={<Link href="/dashboard/screens" />}>
              Manage screens
            </Button>
          ) : null
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border border-border bg-card px-4 py-3"
          >
            <p className="text-xs text-muted-foreground">{stat.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {pairingCount > 0 ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
          {pairingCount} screen{pairingCount === 1 ? "" : "s"} waiting to be
          paired.{" "}
          <Link
            href="/dashboard/screens"
            className="font-medium underline-offset-4 hover:underline"
          >
            Enter a code
          </Link>
        </div>
      ) : null}

      {posStatus ? (
        <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-medium">POS sync</p>
              <p className="text-xs text-muted-foreground">
                {posStatus.integrationsActive} active ·{" "}
                {posStatus.integrationsError} error · last event{" "}
                {posStatus.lastEventStatus ?? "none"}
                {posStatus.lastSyncAt
                  ? ` · ${new Date(posStatus.lastSyncAt).toLocaleString()}`
                  : ""}
              </p>
            </div>
            {canManagePos(role) ? (
              <Link
                href="/dashboard/settings"
                className="text-xs font-medium underline-offset-4 hover:underline"
              >
                Manage POS
              </Link>
            ) : null}
          </div>
          {posStatus.recentFailures > 0 ? (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
              {posStatus.recentFailures} failed sync
              {posStatus.recentFailures === 1 ? "" : "s"} in the last 24h.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-xl border border-border">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">Your screens</h2>
          {canManageLocations(role) ? (
            <Link
              href="/dashboard/locations"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              View locations
            </Link>
          ) : null}
        </div>
        <ul className="divide-y divide-border">
          {recentScreens.length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-muted-foreground">
              No screens in your scope yet.
            </li>
          ) : (
            recentScreens.map((screen) => (
              <li
                key={screen.id}
                className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{screen.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {screen.resolution} · {screen.orientation}
                  </p>
                </div>
                <StatusBadge status={screen.status} />
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useApiAuthToken } from "@/lib/api/auth-token";
import {
  listContentVersions,
  restoreContentVersion,
} from "@/lib/data/content-versions";
import type { ContentEntityType, ContentVersion } from "@/lib/types/schema";

export function ContentVersionHistory({
  entityType,
  entityId,
  canRestore,
  onRestored,
}: {
  entityType: ContentEntityType;
  entityId: string;
  canRestore?: boolean;
  onRestored?: () => void;
}) {
  const { getApiToken } = useApiAuthToken();
  const [versions, setVersions] = useState<ContentVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getApiToken();
      const result = await listContentVersions(token, { entityType, entityId });
      setVersions(result.versions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load history");
    } finally {
      setLoading(false);
    }
  }, [entityId, entityType, getApiToken]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleRestore(versionId: string) {
    if (
      !confirm(
        "Restore this version into the working draft? Screens keep the last published snapshot until you publish again.",
      )
    ) {
      return;
    }
    setBusyId(versionId);
    setError(null);
    try {
      const token = await getApiToken();
      await restoreContentVersion(token, versionId);
      await refresh();
      onRestored?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Restore failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Version history</h3>
          <p className="text-xs text-muted-foreground">
            Published snapshots with restore. Kiosks serve the latest published
            snapshot until you publish again.
          </p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => void refresh()}>
          Refresh
        </Button>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading history…</p>
      ) : versions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No published versions yet.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {versions.map((v) => (
            <li
              key={v.id}
              className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm"
            >
              <div className="min-w-0">
                <p className="font-medium">
                  v{v.version}{" "}
                  <span className="font-normal text-muted-foreground">
                    · {v.status}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(v.createdAt).toLocaleString()}
                  {v.changeSummary ? ` · ${v.changeSummary}` : ""}
                </p>
              </div>
              {canRestore ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busyId === v.id}
                  onClick={() => void handleRestore(v.id)}
                >
                  {busyId === v.id ? "Restoring…" : "Restore"}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApiAuthToken } from "@/lib/api/auth-token";
import { resolveMediaUrl } from "@/lib/api/media";
import { listMedia, uploadMedia } from "@/lib/data/media";
import { useMockSession } from "@/components/providers/mock-session-provider";
import type { MediaAsset, MediaKind } from "@/lib/types/schema";
import { cn } from "@/lib/utils";

type MediaPickerProps = {
  open: boolean;
  onClose: () => void;
  onSelect: (asset: MediaAsset) => void;
  /** Restrict selectable kinds (e.g. images only). */
  kinds?: MediaKind[];
  title?: string;
};

/**
 * Reusable media picker for menus, templates, and future modules.
 */
export function MediaPicker({
  open,
  onClose,
  onSelect,
  kinds,
  title = "Choose media",
}: MediaPickerProps) {
  const { session } = useMockSession();
  const { getApiToken } = useApiAuthToken();
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getApiToken();
      const result = await listMedia(token, {
        q: q || undefined,
        kind: kinds?.length === 1 ? kinds[0] : undefined,
      });
      let list = result.assets;
      if (kinds?.length) list = list.filter((a) => kinds.includes(a.kind));
      setAssets(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load media");
    } finally {
      setLoading(false);
    }
  }, [getApiToken, q, kinds]);

  useEffect(() => {
    if (!open) return;
    void refresh();
  }, [open, refresh]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-xl border border-border bg-background shadow-lg">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="font-semibold">{title}</h2>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
        <div className="space-y-3 border-b border-border p-4">
          <div className="flex flex-wrap gap-2">
            <div className="min-w-[200px] flex-1 space-y-1">
              <Label htmlFor="picker-q">Search</Label>
              <Input
                id="picker-q"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search library"
              />
            </div>
            <div className="flex items-end">
              <label className="cursor-pointer">
                <span className="sr-only">Upload new</span>
                <input
                  type="file"
                  className="hidden"
                  accept="image/*,video/*,audio/*"
                  disabled={uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    void (async () => {
                      setUploading(true);
                      setError(null);
                      try {
                        const token = await getApiToken();
                        const asset = await uploadMedia(token, file, {
                          organizationId: session.organization.id,
                          uploadedByUserId: session.user.id,
                          kind: kinds?.[0],
                        });
                        onSelect(asset);
                        onClose();
                      } catch (err) {
                        setError(
                          err instanceof Error ? err.message : "Upload failed",
                        );
                      } finally {
                        setUploading(false);
                      }
                    })();
                  }}
                />
                <Button type="button" variant="outline" disabled={uploading}>
                  {uploading ? "Uploading…" : "Upload new"}
                </Button>
              </label>
            </div>
          </div>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : assets.length === 0 ? (
            <p className="text-sm text-muted-foreground">No matching assets.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {assets.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  className={cn(
                    "overflow-hidden rounded-lg border border-border text-left hover:border-foreground/40",
                  )}
                  onClick={() => {
                    onSelect(asset);
                    onClose();
                  }}
                >
                  <div className="aspect-video bg-muted/40">
                    {asset.mimeType.startsWith("image/") ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={resolveMediaUrl(asset.url)}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                        {asset.kind}
                      </div>
                    )}
                  </div>
                  <p className="truncate px-2 py-1.5 text-xs font-medium">
                    {asset.name}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

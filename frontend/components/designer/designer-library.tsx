"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApiAuthToken } from "@/lib/api/auth-token";
import { resolveMediaUrl } from "@/lib/api/media";
import { listMedia, uploadMedia } from "@/lib/data/media";
import { useMockSession } from "@/components/providers/mock-session-provider";
import {
  setDragPayload,
  type DesignerDragPayload,
} from "@/lib/designer/drag-payload";
import type { MediaAsset, MenuItem, Template } from "@/lib/types/schema";

/**
 * Library panels for the visual editor. Every entry is both draggable
 * (drop anywhere on the board) and clickable (drops at a default spot),
 * so the editor stays usable with keyboard and touch input.
 */

type DraggableProps = {
  payload: DesignerDragPayload;
  onQuickAdd: (payload: DesignerDragPayload) => void;
  className?: string;
  title?: string;
  children: React.ReactNode;
};

function DraggableTile({
  payload,
  onQuickAdd,
  className,
  title,
  children,
}: DraggableProps) {
  return (
    <button
      type="button"
      draggable
      title={title}
      onDragStart={(event) => setDragPayload(event, payload)}
      onClick={() => onQuickAdd(payload)}
      className={
        className ??
        "flex w-full cursor-grab items-center gap-2 rounded-lg border border-border bg-card p-2 text-left text-sm transition hover:border-foreground/40 hover:bg-muted active:cursor-grabbing"
      }
    >
      {children}
    </button>
  );
}

function PanelShell({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {hint ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">{children}</div>
    </div>
  );
}

export function DesignerTextPanel({
  onQuickAdd,
}: {
  onQuickAdd: (payload: DesignerDragPayload) => void;
}) {
  const presets = [
    {
      style: "heading" as const,
      label: "Add a heading",
      className: "text-2xl font-semibold",
    },
    {
      style: "subheading" as const,
      label: "Add a subheading",
      className: "text-lg font-medium",
    },
    {
      style: "body" as const,
      label: "Add a little bit of body text",
      className: "text-sm",
    },
  ];

  return (
    <PanelShell title="Text" hint="Drag a style onto the board.">
      <div className="space-y-2">
        {presets.map((preset) => (
          <DraggableTile
            key={preset.style}
            payload={{ kind: "text", style: preset.style }}
            onQuickAdd={onQuickAdd}
          >
            <span className={preset.className}>{preset.label}</span>
          </DraggableTile>
        ))}
      </div>
    </PanelShell>
  );
}

const SHAPE_FILLS = [
  "#f5c518",
  "#ef4444",
  "#22c55e",
  "#3b82f6",
  "#a855f7",
  "#fafafa",
  "#27272a",
];

export function DesignerElementsPanel({
  onQuickAdd,
}: {
  onQuickAdd: (payload: DesignerDragPayload) => void;
}) {
  const [fill, setFill] = useState(SHAPE_FILLS[0]);

  const shapes = [
    { shape: "rect" as const, label: "Rectangle" },
    { shape: "circle" as const, label: "Circle" },
    { shape: "line" as const, label: "Divider" },
  ];

  return (
    <PanelShell title="Elements" hint="Shapes, dividers and price rows.">
      <div className="space-y-4">
        <div>
          <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">
            Colour
          </p>
          <div className="flex flex-wrap gap-2">
            {SHAPE_FILLS.map((swatch) => (
              <button
                key={swatch}
                type="button"
                aria-label={`Use ${swatch}`}
                aria-pressed={fill === swatch}
                onClick={() => setFill(swatch)}
                style={{ backgroundColor: swatch }}
                className={`h-7 w-7 rounded-full border-2 transition ${
                  fill === swatch ? "border-foreground" : "border-transparent"
                }`}
              />
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">
            Shapes
          </p>
          <div className="grid grid-cols-3 gap-2">
            {shapes.map((entry) => (
              <DraggableTile
                key={entry.shape}
                payload={{ kind: "shape", shape: entry.shape, fill }}
                onQuickAdd={onQuickAdd}
                title={entry.label}
                className="flex aspect-square cursor-grab items-center justify-center rounded-lg border border-border bg-card transition hover:border-foreground/40 active:cursor-grabbing"
              >
                <span
                  style={{ backgroundColor: fill }}
                  className={
                    entry.shape === "circle"
                      ? "h-8 w-8 rounded-full"
                      : entry.shape === "line"
                        ? "h-1.5 w-10 rounded-full"
                        : "h-8 w-10 rounded"
                  }
                />
              </DraggableTile>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">
            Menu blocks
          </p>
          <DraggableTile payload={{ kind: "priceBox" }} onQuickAdd={onQuickAdd}>
            <span className="flex w-full items-center justify-between rounded bg-muted px-2 py-1.5 text-xs">
              <span>Item name</span>
              <span className="tabular-nums">$0.00</span>
            </span>
          </DraggableTile>
        </div>
      </div>
    </PanelShell>
  );
}

export function DesignerMenuItemsPanel({
  menuItems,
  onQuickAdd,
}: {
  menuItems: MenuItem[];
  onQuickAdd: (payload: DesignerDragPayload) => void;
}) {
  const [q, setQ] = useState("");
  const filtered = q
    ? menuItems.filter((item) =>
        item.name.toLowerCase().includes(q.toLowerCase()),
      )
    : menuItems;

  return (
    <PanelShell title="Menu items" hint="Drag priced rows onto the board.">
      <div className="space-y-3">
        <Input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Search items"
          aria-label="Search menu items"
        />
        {filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No items — add some on the Menus page first.
          </p>
        ) : (
          <div className="space-y-1.5">
            {filtered.map((item) => (
              <DraggableTile
                key={item.id}
                payload={{ kind: "menuItem", itemId: item.id }}
                onQuickAdd={onQuickAdd}
              >
                <span className="flex w-full items-center justify-between gap-2">
                  <span className="truncate">{item.name}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    ${item.price.toFixed(2)}
                  </span>
                </span>
              </DraggableTile>
            ))}
          </div>
        )}
      </div>
    </PanelShell>
  );
}

export function DesignerUploadsPanel({
  onQuickAdd,
}: {
  onQuickAdd: (payload: DesignerDragPayload) => void;
}) {
  const { session } = useMockSession();
  const { getApiToken } = useApiAuthToken();
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getApiToken();
      const result = await listMedia(token, { q: q || undefined });
      setAssets(
        result.assets.filter((asset) => asset.mimeType.startsWith("image/")),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load media");
    } finally {
      setLoading(false);
    }
  }, [getApiToken, q]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <PanelShell title="Uploads" hint="Images from your Media library.">
      <div className="space-y-3">
        <Input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Search media"
          aria-label="Search media"
        />
        <label className="block cursor-pointer">
          <span className="sr-only">Upload an image</span>
          <input
            type="file"
            className="hidden"
            accept="image/*"
            disabled={uploading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              void (async () => {
                setUploading(true);
                setError(null);
                try {
                  const token = await getApiToken();
                  await uploadMedia(token, file, {
                    organizationId: session.organization.id,
                    uploadedByUserId: session.user.id,
                    kind: "image",
                  });
                  await refresh();
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Upload failed");
                } finally {
                  setUploading(false);
                }
              })();
            }}
          />
          <Button
            variant="outline"
            className="w-full"
            disabled={uploading}
            render={<span />}
          >
            {uploading ? "Uploading…" : "Upload image"}
          </Button>
        </label>

        {error ? (
          <p className="text-xs text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        {loading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : assets.length === 0 ? (
          <p className="text-xs text-muted-foreground">No images yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {assets.map((asset) => (
              <DraggableTile
                key={asset.id}
                payload={{ kind: "image", url: resolveMediaUrl(asset.url) }}
                onQuickAdd={onQuickAdd}
                title={asset.name}
                className="cursor-grab overflow-hidden rounded-lg border border-border transition hover:border-foreground/40 active:cursor-grabbing"
              >
                <span className="block">
                  <span className="block aspect-video bg-muted/40">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={resolveMediaUrl(asset.url)}
                      alt=""
                      draggable={false}
                      className="h-full w-full object-cover"
                    />
                  </span>
                  <span className="block truncate px-2 py-1 text-xs">
                    {asset.name}
                  </span>
                </span>
              </DraggableTile>
            ))}
          </div>
        )}
      </div>
    </PanelShell>
  );
}

export function DesignerTemplatesPanel({
  templates,
  currentTemplateId,
  onQuickAdd,
}: {
  templates: Template[];
  currentTemplateId: string;
  onQuickAdd: (payload: DesignerDragPayload) => void;
}) {
  const options = templates.filter(
    (template) =>
      template.id !== currentTemplateId &&
      Array.isArray(
        (template.canvasJson as { objects?: unknown[] } | null)?.objects,
      ),
  );

  return (
    <PanelShell
      title="Layouts"
      hint="Insert the elements of another layout into this board."
    >
      {options.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No other canvas layouts available yet.
        </p>
      ) : (
        <div className="space-y-2">
          {options.map((template) => (
            <DraggableTile
              key={template.id}
              payload={{ kind: "template", templateId: template.id }}
              onQuickAdd={onQuickAdd}
              className="w-full cursor-grab overflow-hidden rounded-lg border border-border text-left transition hover:border-foreground/40 active:cursor-grabbing"
            >
              <span className="block">
                <span className="flex aspect-video items-center justify-center bg-zinc-900 text-xs text-muted-foreground">
                  {template.resolution}
                </span>
                <span className="block truncate px-2 py-1.5 text-xs font-medium">
                  {template.name}
                </span>
              </span>
            </DraggableTile>
          ))}
        </div>
      )}
    </PanelShell>
  );
}

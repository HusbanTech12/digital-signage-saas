"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Canvas as FabricCanvas } from "fabric";
import { Button } from "@/components/ui/button";
import {
  addHeading,
  addMenuItemObject,
  addPriceBox,
  deleteActiveObject,
  loadCanvasFromJson,
  saveCanvasToJson,
  type DesignerCanvasJson,
} from "@/lib/designer/canvas-io";
import type { MenuItem } from "@/lib/types/schema";

interface MenuDesignerProps {
  initialJson: DesignerCanvasJson;
  menuItems?: MenuItem[];
  readOnly?: boolean;
  onSave: (json: DesignerCanvasJson) => void;
  onPublish?: () => void;
  saving?: boolean;
  statusMessage?: string | null;
}

export function MenuDesigner({
  initialJson,
  menuItems = [],
  readOnly = false,
  onSave,
  onPublish,
  saving,
  statusMessage,
}: MenuDesignerProps) {
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const fabricRef = useRef<FabricCanvas | null>(null);
  const [ready, setReady] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    let disposed = false;
    let canvas: FabricCanvas | null = null;

    async function init() {
      if (!canvasElRef.current) return;
      const { Canvas } = await import("fabric");
      if (disposed || !canvasElRef.current) return;

      canvas = new Canvas(canvasElRef.current, {
        width: 1280,
        height: 720,
        backgroundColor: "#1a1a1a",
        selection: !readOnly,
        preserveObjectStacking: true,
      });
      fabricRef.current = canvas;

      await loadCanvasFromJson(canvas, initialJson);
      if (disposed) {
        canvas.dispose();
        return;
      }

      const markDirty = () => setDirty(true);
      canvas.on("object:modified", markDirty);
      canvas.on("object:added", markDirty);
      canvas.on("object:removed", markDirty);
      setReady(true);
      setDirty(false);
    }

    void init();

    return () => {
      disposed = true;
      canvas?.dispose();
      fabricRef.current = null;
    };
    // Re-init only when template identity changes via key on parent
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const json = saveCanvasToJson(canvas);
    onSave(json);
    setDirty(false);
  }, [onSave]);

  async function handleAddItem(item: MenuItem) {
    const canvas = fabricRef.current;
    if (!canvas || readOnly) return;
    await addMenuItemObject(canvas, item);
    setDirty(true);
  }

  async function handleAddHeading() {
    const canvas = fabricRef.current;
    if (!canvas || readOnly) return;
    await addHeading(canvas);
    setDirty(true);
  }

  async function handleAddPriceBox() {
    const canvas = fabricRef.current;
    if (!canvas || readOnly) return;
    await addPriceBox(canvas);
    setDirty(true);
  }

  function handleDelete() {
    const canvas = fabricRef.current;
    if (!canvas || readOnly) return;
    deleteActiveObject(canvas);
    setDirty(true);
  }

  return (
    <div className="flex min-h-[640px] flex-col gap-4 lg:flex-row">
      <aside className="w-full shrink-0 space-y-4 lg:w-64">
        <div className="rounded-xl border border-border p-3">
          <p className="text-xs font-medium text-muted-foreground uppercase">
            Tools
          </p>
          <div className="mt-2 flex flex-col gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={readOnly || !ready}
              onClick={() => void handleAddHeading()}
            >
              Add heading
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={readOnly || !ready}
              onClick={() => void handleAddPriceBox()}
            >
              Add price box
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={readOnly || !ready}
              onClick={handleDelete}
            >
              Delete selected
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-border p-3">
          <p className="text-xs font-medium text-muted-foreground uppercase">
            Menu items
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Click to drop onto the board.
          </p>
          <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto">
            {menuItems.length === 0 ? (
              <li className="text-xs text-muted-foreground">
                No items — add some on the Menus page.
              </li>
            ) : (
              menuItems.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    disabled={readOnly || !ready}
                    onClick={() => void handleAddItem(item)}
                    className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted disabled:opacity-50"
                  >
                    <span className="truncate">{item.name}</span>
                    <span className="ml-2 shrink-0 tabular-nums text-muted-foreground">
                      ${item.price.toFixed(2)}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      </aside>

      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            {ready ? (dirty ? "Unsaved changes" : "Saved") : "Loading canvas…"}
            {statusMessage ? ` · ${statusMessage}` : null}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={readOnly || !ready || saving}
              onClick={handleSave}
            >
              {saving ? "Saving…" : "Save layout"}
            </Button>
            {onPublish ? (
              <Button disabled={!ready || saving} onClick={onPublish}>
                Publish
              </Button>
            ) : null}
          </div>
        </div>

        <div className="overflow-auto rounded-xl border border-border bg-zinc-900 p-2">
          <canvas ref={canvasElRef} className="max-w-full" />
        </div>
      </div>
    </div>
  );
}

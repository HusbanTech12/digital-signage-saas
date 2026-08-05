"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import { publishMenu } from "@/lib/mock-api/store";
import type { Screen, Template } from "@/lib/types/schema";

export function PublishMenuDialog({
  open,
  onClose,
  menuId,
  templates,
  screens,
  defaultTemplateId,
}: {
  open: boolean;
  onClose: () => void;
  menuId: string;
  templates: Template[];
  screens: Screen[];
  defaultTemplateId?: string;
}) {
  const pairedScreens = useMemo(
    () => screens.filter((s) => s.locationId !== null),
    [screens],
  );
  const [templateId, setTemplateId] = useState(
    defaultTemplateId ?? templates[0]?.id ?? "",
  );
  const [selected, setSelected] = useState<string[]>(
    pairedScreens.filter((s) => s.status === "online").map((s) => s.id),
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!open) return null;

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function handlePublish(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      if (!templateId) throw new Error("Select a template.");
      const menu = publishMenu({
        menuId,
        templateId,
        screenIds: selected,
      });
      setSuccess(
        `Published v${menu.version} to ${selected.length} screen${selected.length === 1 ? "" : "s"}.`,
      );
      setTimeout(onClose, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publish failed.");
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
        onSubmit={handlePublish}
        className="relative w-full max-w-lg space-y-4 rounded-xl border border-border bg-background p-5 shadow-lg"
      >
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Publish menu</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose a template layout and the screens that should receive this
            menu (mock push — live WebSocket sync comes later).
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pub-template">Template</Label>
          <select
            id="pub-template"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            required
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.isGlobal ? " (global)" : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label>Screens</Label>
          <ul className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-border p-2">
            {pairedScreens.length === 0 ? (
              <li className="px-2 py-3 text-sm text-muted-foreground">
                No paired screens yet.
              </li>
            ) : (
              pairedScreens.map((screen) => (
                <li key={screen.id}>
                  <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
                    <input
                      type="checkbox"
                      checked={selected.includes(screen.id)}
                      onChange={() => toggle(screen.id)}
                    />
                    <span className="flex-1 truncate">{screen.name}</span>
                    <StatusBadge status={screen.status} />
                  </label>
                </li>
              ))
            )}
          </ul>
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

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Publish now</Button>
        </div>
      </form>
    </div>
  );
}

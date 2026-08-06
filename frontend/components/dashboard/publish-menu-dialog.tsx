"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import { useApiAuthToken } from "@/lib/api/auth-token";
import { publishMenu } from "@/lib/data/menus";
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
  const { getApiToken } = useApiAuthToken();
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
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function handlePublish(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      if (!templateId) throw new Error("Select a template.");
      const token = await getApiToken();
      const menu = await publishMenu(
        {
          menuId,
          templateId,
          screenIds: selected,
        },
        token,
      );
      setSuccess(
        `Published v${menu.version} to ${selected.length} screen${selected.length === 1 ? "" : "s"}.`,
      );
      setTimeout(onClose, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publish failed.");
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
        onSubmit={handlePublish}
        className="relative w-full max-w-lg space-y-4 rounded-xl border border-border bg-background p-5 shadow-lg"
      >
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Publish menu</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose a template and screens. Live sync arrives in Prompt 8.
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

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Screens</legend>
          {pairedScreens.length === 0 ? (
            <p className="text-sm text-muted-foreground">No paired screens.</p>
          ) : (
            <ul className="max-h-48 space-y-2 overflow-y-auto">
              {pairedScreens.map((screen) => (
                <li key={screen.id} className="flex items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    id={`scr-${screen.id}`}
                    checked={selected.includes(screen.id)}
                    onChange={() => toggle(screen.id)}
                  />
                  <label
                    htmlFor={`scr-${screen.id}`}
                    className="flex flex-1 items-center justify-between gap-2"
                  >
                    <span>{screen.name}</span>
                    <StatusBadge status={screen.status} />
                  </label>
                </li>
              ))}
            </ul>
          )}
        </fieldset>

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
          <Button type="submit" disabled={saving || pairedScreens.length === 0}>
            {saving ? "Publishing…" : "Publish"}
          </Button>
        </div>
      </form>
    </div>
  );
}

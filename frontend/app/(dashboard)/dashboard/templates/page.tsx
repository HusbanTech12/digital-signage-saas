"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PremiumMenuBoard } from "@/components/display/premium-menu-board";
import { PageHeader } from "@/components/dashboard/page-header";
import { OrientationToggle } from "@/components/dashboard/orientation-toggle";
import { useMockSession } from "@/components/providers/mock-session-provider";
import { useMockStore } from "@/components/providers/mock-data-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { canEditDesigner, canManageTemplates } from "@/lib/access";
import { useApiAuthToken } from "@/lib/api/auth-token";
import {
  createTemplate,
  deleteTemplate,
  duplicateTemplate,
} from "@/lib/data/menus";
import {
  nominalResolution,
  orientationLabel,
} from "@/lib/display/orientation";
import { mergeDisplayConfig } from "@/lib/display/menu-board-theme";
import type { ScreenOrientation } from "@/lib/types/schema";

export default function TemplatesPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-5xl p-4 text-sm text-muted-foreground">
          Loading templates…
        </div>
      }
    >
      <TemplatesPageInner />
    </Suspense>
  );
}

function TemplatesPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const menuId = searchParams.get("menuId");
  const { session, role } = useMockSession();
  const { templates, menuItems } = useMockStore();
  const { getApiToken } = useApiAuthToken();
  const [createOpen, setCreateOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewItems = useMemo(
    () =>
      menuItems
        .filter((i) => i.organizationId === session.organization.id)
        .slice(0, 12),
    [menuItems, session.organization.id],
  );

  const gallery = useMemo(
    () =>
      templates.filter(
        (t) => t.isGlobal || t.organizationId === session.organization.id,
      ),
    [templates, session.organization.id],
  );

  if (!canEditDesigner(role)) {
    return (
      <div className="mx-auto max-w-5xl">
        <PageHeader title="Templates" description="Access denied." />
      </div>
    );
  }

  async function openEditor(templateId: string, isGlobal: boolean) {
    setError(null);
    try {
      let id = templateId;
      if (isGlobal) {
        const token = await getApiToken();
        const copy = await duplicateTemplate(
          {
            templateId,
            organizationId: session.organization.id,
          },
          token,
        );
        id = copy.id;
      }
      const qs = menuId ? `?menuId=${menuId}` : "";
      router.push(`/dashboard/templates/${id}/edit${qs}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open editor.");
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Templates"
        description={
          menuId
            ? "Pick a menu board, then edit categories and items in the template."
            : "Fieldwise menu boards — branding, categories, and items, published as a package."
        }
        actions={
          canManageTemplates(role) ? (
            <Button onClick={() => setCreateOpen(true)}>New template</Button>
          ) : null
        }
      />

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {gallery.map((template) => {
          const previewConfig = mergeDisplayConfig(template.displayConfig);
          const isPortrait = template.orientation === "portrait";

          return (
            <article
              key={template.id}
              className="flex flex-col rounded-xl border border-border p-4"
            >
              <div
                className={`relative overflow-hidden rounded-lg bg-zinc-900 ${
                  isPortrait ? "aspect-[9/16] max-h-56 mx-auto w-full max-w-[10rem]" : "aspect-video"
                }`}
              >
                <div className="pointer-events-none h-full w-full">
                  <PremiumMenuBoard
                    items={previewItems}
                    config={previewConfig}
                    orientation={isPortrait ? "portrait" : "landscape"}
                    statusLabel="Preview"
                  />
                </div>
              </div>
              <h2 className="mt-3 font-semibold tracking-tight">
                {template.name}
              </h2>
              <p className="mt-1 text-xs font-medium text-foreground">
                {orientationLabel(template.orientation || "landscape")}
              </p>
              <p className="text-xs text-muted-foreground">
                Fills any screen size
              </p>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                {template.description || "No description"}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => void openEditor(template.id, template.isGlobal)}
                >
                  {template.isGlobal ? "Customize" : "Edit"}
                </Button>
                {!template.isGlobal && canManageTemplates(role) ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (!confirm(`Delete “${template.name}”?`)) return;
                      void (async () => {
                        try {
                          const token = await getApiToken();
                          await deleteTemplate(template.id, token);
                        } catch (err) {
                          setError(
                            err instanceof Error
                              ? err.message
                              : "Delete failed.",
                          );
                        }
                      })();
                    }}
                  >
                    Delete
                  </Button>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>

      {createOpen ? (
        <CreateTemplateDialog
          organizationId={session.organization.id}
          menuId={menuId}
          getApiToken={getApiToken}
          onClose={() => setCreateOpen(false)}
        />
      ) : null}
    </div>
  );
}

function CreateTemplateDialog({
  organizationId,
  menuId,
  getApiToken,
  onClose,
}: {
  organizationId: string;
  menuId: string | null;
  getApiToken: () => Promise<string | null>;
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [orientation, setOrientation] =
    useState<ScreenOrientation>("landscape");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const token = await getApiToken();
      const template = await createTemplate(
        {
          organizationId,
          name,
          description,
          resolution: nominalResolution(orientation),
          orientation,
        },
        token,
      );
      const qs = menuId ? `?menuId=${menuId}` : "";
      router.push(`/dashboard/templates/${template.id}/edit${qs}`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close"
        onClick={onClose}
      />
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-md space-y-3 rounded-xl border border-border bg-background p-5 shadow-lg"
      >
        <h2 className="text-lg font-semibold">New template</h2>
        <div className="space-y-1.5">
          <Label htmlFor="tpl-name">Name</Label>
          <Input
            id="tpl-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tpl-desc">Description</Label>
          <Input
            id="tpl-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <OrientationToggle value={orientation} onChange={setOrientation} />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Creating…" : "Create & edit"}
          </Button>
        </div>
      </form>
    </div>
  );
}

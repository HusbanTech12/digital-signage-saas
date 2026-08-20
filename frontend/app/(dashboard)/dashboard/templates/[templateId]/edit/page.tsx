"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { MenuDesigner } from "@/components/designer/menu-designer";
import { PageHeader } from "@/components/dashboard/page-header";
import { PublishMenuDialog } from "@/components/dashboard/publish-menu-dialog";
import { TemplateLayoutSettings } from "@/components/dashboard/template-layout-settings";
import { TemplateLcdTypeFields } from "@/components/dashboard/template-lcd-type-fields";
import { useMockSession } from "@/components/providers/mock-session-provider";
import { useMockStore } from "@/components/providers/mock-data-provider";
import { Button } from "@/components/ui/button";
import {
  canEditDesigner,
  canPublishMenus,
  filterScreensForUser,
} from "@/lib/access";
import type { DesignerCanvasJson } from "@/lib/designer/canvas-io";
import { mergeDisplayConfig } from "@/lib/display/menu-board-theme";
import { useApiAuthToken } from "@/lib/api/auth-token";
import { updateTemplate } from "@/lib/data/menus";
import type { ScreenOrientation } from "@/lib/types/schema";

export default function TemplateEditPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-5xl p-4 text-sm text-muted-foreground">
          Loading designer…
        </div>
      }
    >
      <TemplateEditPageInner />
    </Suspense>
  );
}

function TemplateEditPageInner() {
  const params = useParams<{ templateId: string }>();
  const searchParams = useSearchParams();
  const menuId = searchParams.get("menuId");
  const { session, role } = useMockSession();
  const { templates, menus, menuItems, screens } = useMockStore();
  const { getApiToken } = useApiAuthToken();
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [lcdResolution, setLcdResolution] = useState("1920x1080");
  const [lcdOrientation, setLcdOrientation] =
    useState<ScreenOrientation>("landscape");
  const [lcdSaving, setLcdSaving] = useState(false);

  const template = templates.find((t) => t.id === params.templateId);
  const menu = menuId
    ? menus.find(
        (m) =>
          m.id === menuId && m.organizationId === session.organization.id,
      )
    : undefined;

  useEffect(() => {
    if (!template) return;
    setLcdResolution(template.resolution || "1920x1080");
    setLcdOrientation(template.orientation || "landscape");
  }, [template?.id, template?.resolution, template?.orientation]);

  const items = useMemo(
    () =>
      menu
        ? menuItems
            .filter((i) => i.menuId === menu.id)
            .sort((a, b) => a.sortOrder - b.sortOrder)
        : menuItems
            .filter((i) => i.organizationId === session.organization.id)
            .slice(0, 12),
    [menu, menuItems, session.organization.id],
  );

  const orgTemplates = templates.filter(
    (t) => t.isGlobal || t.organizationId === session.organization.id,
  );
  const visibleScreens = filterScreensForUser(screens, session.user);
  const isPremium = template?.displayConfig?.layout === "premium";

  if (!canEditDesigner(role)) {
    return (
      <div className="mx-auto max-w-5xl">
        <PageHeader title="Designer" description="Access denied." />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <PageHeader title="Template not found" />
        <Button variant="outline" render={<Link href="/dashboard/templates" />}>
          Back to templates
        </Button>
      </div>
    );
  }

  if (template.isGlobal) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <PageHeader
          title="Read-only global template"
          description="Duplicate this template from the gallery to customize the TV layout."
        />
        <Button variant="outline" render={<Link href="/dashboard/templates" />}>
          Back to gallery
        </Button>
      </div>
    );
  }

  async function handleSaveLcdType() {
    setStatus(null);
    setLcdSaving(true);
    try {
      if (!/^\d{3,5}x\d{3,5}$/i.test(lcdResolution.trim())) {
        throw new Error("Resolution must look like 1920x1080.");
      }
      const token = await getApiToken();
      await updateTemplate(
        template!.id,
        {
          resolution: lcdResolution.trim(),
          orientation: lcdOrientation,
        },
        token,
      );
      setStatus("LCD type saved");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Save failed");
    } finally {
      setLcdSaving(false);
    }
  }

  async function handleSaveCanvas(json: DesignerCanvasJson) {
    setSaving(true);
    setStatus(null);
    try {
      const token = await getApiToken();
      await updateTemplate(template!.id, { canvasJson: json }, token);
      setStatus("Layout saved");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveDisplayConfig(
    config: ReturnType<typeof mergeDisplayConfig>,
  ) {
    setStatus(null);
    try {
      const token = await getApiToken();
      await updateTemplate(template!.id, { displayConfig: config }, token);
      setStatus("Layout saved");
    } catch (err) {
      throw err;
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <PageHeader
        title={`Template · ${template.name}`}
        description={
          menu
            ? `Editing TV layout for menu “${menu.name}”. Save, then publish to screens.`
            : isPremium
              ? "Premium 3-column TV board — branding and columns are saved on this template."
              : "Drag-and-drop canvas editor. Save persists the template layout."
        }
        actions={
          <>
            <Button
              variant="outline"
              render={<Link href="/dashboard/templates" />}
            >
              Gallery
            </Button>
            {menu && canPublishMenus(role) ? (
              <Button onClick={() => setPublishOpen(true)}>Publish</Button>
            ) : null}
          </>
        }
      />

      {status ? (
        <p className="text-sm text-muted-foreground" role="status">
          {status}
        </p>
      ) : null}

      <div className="space-y-3 rounded-xl border border-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">LCD / screen type</h2>
            <p className="text-xs text-muted-foreground">
              Target physical TV size for this layout. Match this when pairing
              or publishing to a screen.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => void handleSaveLcdType()}
            disabled={lcdSaving}
          >
            {lcdSaving ? "Saving…" : "Save LCD type"}
          </Button>
        </div>
        <TemplateLcdTypeFields
          key={template.id}
          resolution={lcdResolution}
          orientation={lcdOrientation}
          onChange={({ resolution, orientation }) => {
            setLcdResolution(resolution);
            setLcdOrientation(orientation);
          }}
        />
      </div>

      {isPremium ? (
        <TemplateLayoutSettings
          config={template.displayConfig}
          items={items}
          onSave={handleSaveDisplayConfig}
        />
      ) : (
        <MenuDesigner
          key={template.id}
          initialJson={template.canvasJson as DesignerCanvasJson}
          menuItems={items}
          onSave={handleSaveCanvas}
          onPublish={
            menu && canPublishMenus(role)
              ? () => setPublishOpen(true)
              : undefined
          }
          saving={saving}
          statusMessage={status}
        />
      )}

      {menu ? (
        <PublishMenuDialog
          open={publishOpen}
          onClose={() => setPublishOpen(false)}
          menuId={menu.id}
          templates={orgTemplates}
          screens={visibleScreens}
          defaultTemplateId={template.id}
        />
      ) : null}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import {
  QrCodeEditor,
  emptyQrForm,
  formToInput,
  formToPatch,
  qrToForm,
  type QrFormState,
} from "@/components/dashboard/qr-code-editor";
import { useMockSession } from "@/components/providers/mock-session-provider";
import { useMockStore } from "@/components/providers/mock-data-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApiAuthToken } from "@/lib/api/auth-token";
import { useLiveApi } from "@/lib/api/config";
import { qrRenderUrl } from "@/lib/api/qr-codes";
import {
  canDeleteQrCodes,
  canManageQrCodes,
  filterLocationsForUser,
} from "@/lib/access";
import {
  createQrCode,
  deleteQrCode,
  listQrCodes,
  saveQrCodeToMedia,
  updateQrCode,
} from "@/lib/data/qr-codes";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import type { QrCode } from "@/lib/types/schema";

const DESTINATION_LABELS: Record<string, string> = {
  menu: "Menu",
  ordering: "Online ordering",
  promotion: "Promotion",
  url: "Custom URL",
  text: "Plain text",
};

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "qr-code"
  );
}

async function downloadRendered(qr: QrCode, format: "svg" | "png") {
  const url = qrRenderUrl(
    format === "svg" ? qr.renderSvgUrl : qr.renderPngUrl,
    { size: format === "png" ? qr.sizePx : undefined, v: qr.updatedAt },
  );
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Export failed (${res.status})`);
  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = `${slugify(qr.name)}.${format}`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(href);
}

export default function QrCodesPage() {
  const { session, role } = useMockSession();
  const { menus, locations } = useMockStore();
  const { getApiToken } = useApiAuthToken();
  const live = useLiveApi();

  const [qrCodes, setQrCodes] = useState<QrCode[]>([]);
  const [q, setQ] = useState("");
  const [destinationType, setDestinationType] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<QrFormState>(emptyQrForm());

  const canRead = hasPermission(role, PERMISSIONS.QR_READ);
  const canEdit = canManageQrCodes(role);
  const canDelete = canDeleteQrCodes(role);
  const canSaveToMedia = hasPermission(role, PERMISSIONS.MEDIA_UPLOAD);

  const visibleLocations = useMemo(
    () => filterLocationsForUser(locations, session.user),
    [locations, session.user],
  );
  const orgMenus = useMemo(
    () => menus.filter((m) => m.organizationId === session.organization.id),
    [menus, session.organization.id],
  );

  const refresh = useCallback(async () => {
    if (!canRead) return;
    setLoading(true);
    setError(null);
    try {
      const token = await getApiToken();
      const result = await listQrCodes(token, {
        q: q || undefined,
        destinationType: destinationType || undefined,
      });
      setQrCodes(result.qrCodes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load QR codes");
    } finally {
      setLoading(false);
    }
  }, [canRead, destinationType, getApiToken, q]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function startCreate() {
    setEditingId(null);
    setForm(emptyQrForm());
    setEditorOpen(true);
    setNotice(null);
  }

  function startEdit(qr: QrCode) {
    setEditingId(qr.id);
    setForm(qrToForm(qr));
    setEditorOpen(true);
    setNotice(null);
  }

  async function handleSubmit() {
    setSaving(true);
    setError(null);
    try {
      const token = await getApiToken();
      if (editingId) {
        await updateQrCode(token, editingId, formToPatch(form));
      } else {
        await createQrCode(token, {
          ...formToInput(form),
          organizationId: session.organization.id,
          createdByUserId: session.user.id,
        });
      }
      setEditorOpen(false);
      setEditingId(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(qr: QrCode) {
    if (
      !confirm(
        `Delete "${qr.name}"? Printed codes pointing at it will stop working.`,
      )
    ) {
      return;
    }
    setError(null);
    try {
      const token = await getApiToken();
      await deleteQrCode(token, qr.id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  async function handleCopy(qr: QrCode) {
    if (!qr.publicUrl) return;
    try {
      await navigator.clipboard.writeText(qr.publicUrl);
      setNotice(`Copied the link for "${qr.name}".`);
    } catch {
      setError("Could not copy to clipboard");
    }
  }

  async function handleExport(qr: QrCode, format: "svg" | "png") {
    setError(null);
    try {
      await downloadRendered(qr, format);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    }
  }

  async function handleSaveToMedia(qr: QrCode) {
    setError(null);
    try {
      const token = await getApiToken();
      const asset = await saveQrCodeToMedia(token, qr.id);
      setNotice(`Saved "${asset.name}" to the Media Library.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save to media failed");
    }
  }

  if (!canRead) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">
          You do not have permission to view QR codes.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="QR codes"
        description="Generate branded codes for menus, ordering, and promos — then export them for print or drop them onto a screen."
        actions={
          canEdit && !editorOpen ? (
            <Button onClick={startCreate}>New QR code</Button>
          ) : null
        }
      />

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="text-sm text-muted-foreground" role="status">
          {notice}
        </p>
      ) : null}

      {editorOpen ? (
        <QrCodeEditor
          form={form}
          onChange={setForm}
          menus={orgMenus}
          locations={visibleLocations}
          saving={saving}
          onSubmit={() => void handleSubmit()}
          onCancel={() => {
            setEditorOpen(false);
            setEditingId(null);
          }}
          submitLabel={editingId ? "Save changes" : "Create QR code"}
        />
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search name, code, or URL"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-xs"
        />
        <select
          value={destinationType}
          onChange={(e) => setDestinationType(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All destinations</option>
          {Object.entries(DESTINATION_LABELS).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : qrCodes.length === 0 ? (
        <div className="rounded-xl border border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No QR codes yet. Create one to link a printed table tent or an
            on-screen promo to your menu.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {qrCodes.map((qr) => (
            <article
              key={qr.id}
              className="flex flex-col overflow-hidden rounded-xl border border-border"
            >
              <div className="flex aspect-square items-center justify-center bg-muted/30 p-4">
                {live ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={qrRenderUrl(qr.renderSvgUrl, { v: qr.updatedAt })}
                    alt={`QR code for ${qr.name}`}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <p className="px-4 text-center text-xs text-muted-foreground">
                    Connect the API to render this code.
                  </p>
                )}
              </div>

              <div className="flex flex-1 flex-col gap-3 border-t border-border p-3">
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-semibold">{qr.name}</h2>
                  <p className="text-xs text-muted-foreground">
                    {DESTINATION_LABELS[qr.destinationType] ??
                      qr.destinationType}
                    {qr.menuName ? ` · ${qr.menuName}` : ""}
                  </p>
                  <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                    {qr.encodedValue}
                  </p>
                </div>

                <p className="text-xs text-muted-foreground">
                  {qr.trackingEnabled || qr.destinationType === "menu"
                    ? `${qr.scanCount} scan${qr.scanCount === 1 ? "" : "s"}${
                        qr.lastScannedAt
                          ? ` · last ${new Date(
                              qr.lastScannedAt,
                            ).toLocaleDateString()}`
                          : ""
                      }`
                    : "Scan tracking off"}
                </p>

                <div className="mt-auto flex flex-wrap gap-2">
                  {live ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void handleExport(qr, "png")}
                      >
                        PNG
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void handleExport(qr, "svg")}
                      >
                        SVG
                      </Button>
                    </>
                  ) : null}
                  {qr.publicUrl ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void handleCopy(qr)}
                    >
                      Copy link
                    </Button>
                  ) : null}
                  {live && canSaveToMedia ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void handleSaveToMedia(qr)}
                    >
                      Save to Media
                    </Button>
                  ) : null}
                  {canEdit ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => startEdit(qr)}
                    >
                      Edit
                    </Button>
                  ) : null}
                  {canDelete ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void handleDelete(qr)}
                    >
                      Delete
                    </Button>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

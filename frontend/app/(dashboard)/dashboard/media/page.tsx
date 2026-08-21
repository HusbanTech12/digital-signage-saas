"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Folder, ImageIcon, Music, Upload, Video } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { useMockSession } from "@/components/providers/mock-session-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApiAuthToken } from "@/lib/api/auth-token";
import { resolveMediaUrl } from "@/lib/api/media";
import { canManageMedia, canUploadMedia } from "@/lib/access";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import {
  createMediaFolder,
  deleteMedia,
  deleteMediaFolder,
  downloadMedia,
  listMedia,
  replaceMedia,
  updateMedia,
  uploadMedia,
} from "@/lib/data/media";
import type { MediaAsset, MediaFolder, MediaKind } from "@/lib/types/schema";
import { cn } from "@/lib/utils";

const KINDS: { id: MediaKind | ""; label: string }[] = [
  { id: "", label: "All types" },
  { id: "image", label: "Images" },
  { id: "video", label: "Videos" },
  { id: "audio", label: "Audio" },
  { id: "logo", label: "Logos" },
  { id: "promo", label: "Promos" },
  { id: "other", label: "Other" },
];

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function KindIcon({ kind }: { kind: MediaKind }) {
  if (kind === "video") return <Video className="size-5" />;
  if (kind === "audio") return <Music className="size-5" />;
  return <ImageIcon className="size-5" />;
}

export default function MediaLibraryPage() {
  const { session, role } = useMockSession();
  const { getApiToken } = useApiAuthToken();
  const fileRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);

  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [folders, setFolders] = useState<MediaFolder[]>([]);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("");
  const [tag, setTag] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadName, setUploadName] = useState("");
  const [uploadKind, setUploadKind] = useState<MediaKind>("image");
  const [uploadTags, setUploadTags] = useState("");

  const [editAsset, setEditAsset] = useState<MediaAsset | null>(null);
  const [editName, setEditName] = useState("");
  const [editKind, setEditKind] = useState<MediaKind>("image");
  const [editTags, setEditTags] = useState("");
  const [replaceTarget, setReplaceTarget] = useState<MediaAsset | null>(null);

  const [folderOpen, setFolderOpen] = useState(false);
  const [folderName, setFolderName] = useState("");

  const breadcrumb = useMemo(() => {
    if (!folderId) return [{ id: null as string | null, name: "Library" }];
    const folder = folders.find((f) => f.id === folderId);
    return [
      { id: null as string | null, name: "Library" },
      { id: folderId, name: folder?.name ?? "Folder" },
    ];
  }, [folderId, folders]);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const token = await getApiToken();
      const result = await listMedia(token, {
        q: q || undefined,
        kind: kind || undefined,
        folderId: folderId ?? "__root__",
        tag: tag || undefined,
      });
      setAssets(result.assets);
      setFolders(result.folders);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load media");
    } finally {
      setLoading(false);
    }
  }, [getApiToken, q, kind, tag, folderId]);

  useEffect(() => {
    setLoading(true);
    const t = window.setTimeout(() => void refresh(), 150);
    return () => window.clearTimeout(t);
  }, [refresh]);

  if (!canManageMedia(role) && !hasPermission(role, PERMISSIONS.MEDIA_READ)) {
    return (
      <div className="mx-auto max-w-4xl">
        <PageHeader
          title="Media Library"
          description="You do not have permission to view media."
        />
      </div>
    );
  }

  async function run(fn: () => Promise<void>, ok: string) {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await fn();
      setSuccess(ok);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadFile) return;
    await run(async () => {
      const token = await getApiToken();
      await uploadMedia(token, uploadFile, {
        organizationId: session.organization.id,
        uploadedByUserId: session.user.id,
        name: uploadName || undefined,
        kind: uploadKind,
        folderId,
        tags: uploadTags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      });
      setUploadOpen(false);
      setUploadFile(null);
      setUploadName("");
      setUploadTags("");
    }, "Uploaded");
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Media Library"
        description="Upload and organize images, videos, audio, logos, and promo assets for menus and templates."
        actions={
          <div className="flex flex-wrap gap-2">
            {canUploadMedia(role) ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setFolderOpen(true);
                    setFolderName("");
                  }}
                >
                  New folder
                </Button>
                <Button
                  onClick={() => {
                    setUploadOpen(true);
                    setUploadFile(null);
                  }}
                >
                  <Upload className="size-4" />
                  Upload
                </Button>
              </>
            ) : null}
          </div>
        }
      />

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-300" role="status">
          {success}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 text-sm">
        {breadcrumb.map((crumb, i) => (
          <span key={`${crumb.id ?? "root"}-${i}`} className="flex items-center gap-2">
            {i > 0 ? <span className="text-muted-foreground">/</span> : null}
            <button
              type="button"
              className={cn(
                "hover:underline",
                crumb.id === folderId ? "font-medium" : "text-muted-foreground",
              )}
              onClick={() => setFolderId(crumb.id)}
            >
              {crumb.name}
            </button>
          </span>
        ))}
      </div>

      <div className="grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="media-q">Search</Label>
          <Input
            id="media-q"
            placeholder="Name or filename"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="media-kind">Type</Label>
          <select
            id="media-kind"
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            {KINDS.map((k) => (
              <option key={k.id || "all"} value={k.id}>
                {k.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="media-tag">Tag</Label>
          <Input
            id="media-tag"
            placeholder="e.g. promo"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading media…</p>
      ) : (
        <div className="space-y-4">
          {folders.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {folders.map((folder) => (
                <button
                  key={folder.id}
                  type="button"
                  className="flex items-center gap-3 rounded-xl border border-border p-4 text-left hover:bg-muted/40"
                  onClick={() => setFolderId(folder.id)}
                >
                  <Folder className="size-5 text-amber-600" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{folder.name}</p>
                    <p className="text-xs text-muted-foreground">Folder</p>
                  </div>
                  {hasPermission(role, PERMISSIONS.MEDIA_DELETE) ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!confirm(`Delete folder “${folder.name}”?`)) return;
                        void run(async () => {
                          const token = await getApiToken();
                          await deleteMediaFolder(token, folder.id);
                        }, "Folder deleted");
                      }}
                    >
                      Delete
                    </Button>
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}

          {assets.length === 0 && folders.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-6 py-14 text-center">
              <p className="font-medium">No media in this folder</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Upload images or videos to reuse across menus and templates.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {assets.map((asset) => (
                <article
                  key={asset.id}
                  className="overflow-hidden rounded-xl border border-border"
                >
                  <div className="relative aspect-video bg-muted/50">
                    {asset.mimeType.startsWith("image/") ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={resolveMediaUrl(asset.url)}
                        alt={asset.name}
                        className="h-full w-full object-cover"
                      />
                    ) : asset.mimeType.startsWith("video/") ? (
                      <video
                        src={resolveMediaUrl(asset.url)}
                        className="h-full w-full object-cover"
                        muted
                        playsInline
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground">
                        <KindIcon kind={asset.kind} />
                      </div>
                    )}
                  </div>
                  <div className="space-y-2 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{asset.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {asset.kind} · {formatBytes(asset.sizeBytes)}
                          {asset.usageCount > 0
                            ? ` · used ${asset.usageCount}×`
                            : ""}
                        </p>
                      </div>
                      <span className="rounded-md border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {asset.kind}
                      </span>
                    </div>
                    {asset.tags.length ? (
                      <p className="truncate text-xs text-muted-foreground">
                        {asset.tags.join(", ")}
                      </p>
                    ) : null}
                    <div className="flex flex-wrap gap-1">
                      {hasPermission(role, PERMISSIONS.MEDIA_UPDATE) ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => {
                            setEditAsset(asset);
                            setEditName(asset.name);
                            setEditKind(asset.kind);
                            setEditTags(asset.tags.join(", "));
                          }}
                        >
                          Edit
                        </Button>
                      ) : null}
                      {hasPermission(role, PERMISSIONS.MEDIA_UPDATE) ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy}
                          onClick={() => {
                            setReplaceTarget(asset);
                            replaceRef.current?.click();
                          }}
                        >
                          Replace
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() =>
                          void run(async () => {
                            const token = await getApiToken();
                            const { url } = await downloadMedia(token, asset.id);
                            window.open(resolveMediaUrl(url), "_blank");
                          }, "Download ready")
                        }
                      >
                        Download
                      </Button>
                      {hasPermission(role, PERMISSIONS.MEDIA_DELETE) ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy}
                          onClick={() => {
                            const force =
                              asset.usageCount > 0 &&
                              confirm(
                                `“${asset.name}” is in use. Force delete anyway?`,
                              );
                            if (asset.usageCount > 0 && !force) return;
                            if (
                              asset.usageCount === 0 &&
                              !confirm(`Delete “${asset.name}”?`)
                            )
                              return;
                            void run(async () => {
                              const token = await getApiToken();
                              await deleteMedia(
                                token,
                                asset.id,
                                asset.usageCount > 0,
                              );
                            }, "Deleted");
                          }}
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
      )}

      <input
        ref={fileRef}
        type="file"
        className="hidden"
        accept="image/*,video/*,audio/*,.svg,.pdf"
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null;
          setUploadFile(file);
          if (file && !uploadName) setUploadName(file.name.replace(/\.[^.]+$/, ""));
        }}
      />
      <input
        ref={replaceRef}
        type="file"
        className="hidden"
        accept="image/*,video/*,audio/*,.svg,.pdf"
        onChange={(e) => {
          const file = e.target.files?.[0];
          const target = replaceTarget;
          e.target.value = "";
          if (!file || !target) return;
          void run(async () => {
            const token = await getApiToken();
            await replaceMedia(token, target.id, file);
            setReplaceTarget(null);
          }, "File replaced");
        }}
      />

      {uploadOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <form
            onSubmit={(e) => void handleUpload(e)}
            className="w-full max-w-lg space-y-4 rounded-xl border border-border bg-background p-5 shadow-lg"
          >
            <div>
              <h2 className="text-lg font-semibold">Upload media</h2>
              <p className="text-sm text-muted-foreground">
                Max 50MB. Images, video, and audio are supported.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>File</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileRef.current?.click()}
                >
                  Choose file
                </Button>
                <span className="truncate self-center text-sm text-muted-foreground">
                  {uploadFile?.name ?? "No file selected"}
                </span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="up-name">Display name</Label>
              <Input
                id="up-name"
                value={uploadName}
                onChange={(e) => setUploadName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="up-kind">Kind</Label>
              <select
                id="up-kind"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={uploadKind}
                onChange={(e) => setUploadKind(e.target.value as MediaKind)}
              >
                {KINDS.filter((k) => k.id).map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="up-tags">Tags (comma-separated)</Label>
              <Input
                id="up-tags"
                value={uploadTags}
                onChange={(e) => setUploadTags(e.target.value)}
                placeholder="promo, lunch"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setUploadOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy || !uploadFile}>
                {busy ? "Uploading…" : "Upload"}
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      {folderOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <form
            className="w-full max-w-md space-y-4 rounded-xl border border-border bg-background p-5 shadow-lg"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                const token = await getApiToken();
                await createMediaFolder(token, {
                  organizationId: session.organization.id,
                  name: folderName,
                  parentId: folderId,
                  createdByUserId: session.user.id,
                });
                setFolderOpen(false);
              }, "Folder created");
            }}
          >
            <h2 className="text-lg font-semibold">New folder</h2>
            <div className="space-y-1.5">
              <Label htmlFor="folder-name">Name</Label>
              <Input
                id="folder-name"
                required
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setFolderOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                Create
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      {editAsset ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <form
            className="w-full max-w-lg space-y-4 rounded-xl border border-border bg-background p-5 shadow-lg"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                const token = await getApiToken();
                await updateMedia(token, editAsset.id, {
                  name: editName,
                  kind: editKind,
                  tags: editTags
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean),
                });
                setEditAsset(null);
              }, "Saved");
            }}
          >
            <h2 className="text-lg font-semibold">Edit {editAsset.name}</h2>
            <div className="space-y-1.5">
              <Label htmlFor="edit-media-name">Name</Label>
              <Input
                id="edit-media-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-media-kind">Kind</Label>
              <select
                id="edit-media-kind"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={editKind}
                onChange={(e) => setEditKind(e.target.value as MediaKind)}
              >
                {KINDS.filter((k) => k.id).map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-media-tags">Tags</Label>
              <Input
                id="edit-media-tags"
                value={editTags}
                onChange={(e) => setEditTags(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditAsset(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                Save
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

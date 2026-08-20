"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { useMockSession } from "@/components/providers/mock-session-provider";
import { useMockStore } from "@/components/providers/mock-data-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApiAuthToken } from "@/lib/api/auth-token";
import { canManageOrganization } from "@/lib/access";
import {
  createOrganization,
  listOrganizations,
  updateOrganization,
} from "@/lib/data/tenant";

export default function OrganizationPage() {
  const { session, role } = useMockSession();
  const { organizations, locations, screens } = useMockStore();
  const { getApiToken } = useApiAuthToken();
  const org =
    organizations.find((o) => o.id === session.organization.id) ??
    session.organization;

  const [name, setName] = useState(org.name);
  const [slug, setSlug] = useState(org.slug);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    setName(org.name);
    setSlug(org.slug);
  }, [org.id, org.name, org.slug]);

  useEffect(() => {
    void (async () => {
      try {
        const token = await getApiToken();
        if (token) await listOrganizations(token);
      } catch {
        /* keep local store */
      }
    })();
  }, [getApiToken]);

  if (!canManageOrganization(role)) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader
          title="Organization"
          description="Only Super Admins can manage organization settings."
        />
      </div>
    );
  }

  const locationCount = locations.filter(
    (l) => l.organizationId === org.id,
  ).length;
  const screenCount = screens.filter((s) => s.organizationId === org.id).length;
  const orgList = [...organizations].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    setSaving(true);
    try {
      const token = await getApiToken();
      await updateOrganization(org.id, { name, slug }, token);
      setMessage("Organization updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Organization"
        description="Top-level tenant settings for your brand. Super Admins can add more organizations."
        actions={
          <Button onClick={() => setCreateOpen(true)}>Add Organization</Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Locations" value={locationCount} />
        <Stat label="Screens" value={screenCount} />
        <Stat label="Org ID" value={org.id} mono />
      </div>

      {orgList.length > 1 ? (
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="border-b border-border bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground">
            All organizations
          </div>
          <ul className="divide-y divide-border">
            {orgList.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{item.name}</p>
                  <p className="truncate font-mono text-xs text-muted-foreground">
                    {item.slug}
                  </p>
                </div>
                {item.id === session.organization.id ? (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    Current
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <form
        onSubmit={handleSave}
        className="space-y-4 rounded-xl border border-border p-4"
      >
        <h2 className="text-sm font-semibold">Current organization</h2>
        <div className="space-y-1.5">
          <Label htmlFor="org-name">Name</Label>
          <Input
            id="org-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="org-slug">Slug</Label>
          <Input
            id="org-slug"
            value={slug}
            onChange={(e) =>
              setSlug(
                e.target.value
                  .toLowerCase()
                  .replace(/[^a-z0-9-]/g, "-")
                  .replace(/-+/g, "-"),
              )
            }
            required
          />
        </div>
        {message ? (
          <p className="text-sm text-emerald-600">{message}</p>
        ) : null}
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : null}
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </form>

      {createOpen ? (
        <CreateOrganizationDialog
          getApiToken={getApiToken}
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setMessage("Organization created.");
            setCreateOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

function CreateOrganizationDialog({
  getApiToken,
  onClose,
  onCreated,
}: {
  getApiToken: () => Promise<string | null>;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function onNameChange(value: string) {
    setName(value);
    setSlug(
      value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, ""),
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const token = await getApiToken();
      await createOrganization({ name, slug }, token);
      onCreated();
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
        <h2 className="text-lg font-semibold">Add Organization</h2>
        <p className="text-xs text-muted-foreground">
          Creates a new brand / tenant. Your current login stays on your
          existing organization.
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="new-org-name">Name</Label>
          <Input
            id="new-org-name"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Acme Cafe"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-org-slug">Slug</Label>
          <Input
            id="new-org-slug"
            value={slug}
            onChange={(e) =>
              setSlug(
                e.target.value
                  .toLowerCase()
                  .replace(/[^a-z0-9-]/g, "-")
                  .replace(/-+/g, "-"),
              )
            }
            placeholder="acme-cafe"
            required
          />
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Creating…" : "Create"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Stat({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | number;
  mono?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`mt-1 truncate font-semibold ${mono ? "font-mono text-xs" : "text-xl tabular-nums"}`}
      >
        {value}
      </p>
    </div>
  );
}

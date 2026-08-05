"use client";

import { useState } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { useMockSession } from "@/components/providers/mock-session-provider";
import { useMockStore } from "@/components/providers/mock-data-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { canManageOrganization } from "@/lib/access";
import { updateOrganization } from "@/lib/mock-api/store";

export default function OrganizationPage() {
  const { session, role } = useMockSession();
  const { organizations, locations, screens } = useMockStore();
  const org =
    organizations.find((o) => o.id === session.organization.id) ??
    session.organization;

  const [name, setName] = useState(org.name);
  const [slug, setSlug] = useState(org.slug);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    try {
      updateOrganization(org.id, { name, slug });
      setMessage("Organization updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Organization"
        description="Top-level tenant settings for your brand."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Locations" value={locationCount} />
        <Stat label="Screens" value={screenCount} />
        <Stat label="Org ID" value={org.id} mono />
      </div>

      <form
        onSubmit={handleSave}
        className="space-y-4 rounded-xl border border-border p-4"
      >
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
        <Button type="submit">Save changes</Button>
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

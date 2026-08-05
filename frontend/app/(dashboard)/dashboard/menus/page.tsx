"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { useMockSession } from "@/components/providers/mock-session-provider";
import { useMockStore } from "@/components/providers/mock-data-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { canManageMenus } from "@/lib/access";
import { createMenu, deleteMenu } from "@/lib/mock-api/store";

export default function MenusPage() {
  const { session, role } = useMockSession();
  const { menus, menuItems } = useMockStore();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const orgMenus = useMemo(
    () =>
      menus
        .filter((m) => m.organizationId === session.organization.id)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [menus, session.organization.id],
  );

  if (!canManageMenus(role)) {
    return (
      <div className="mx-auto max-w-4xl">
        <PageHeader
          title="Menus"
          description="You do not have access to menu management."
        />
      </div>
    );
  }

  function handleDelete(menuId: string, name: string) {
    setError(null);
    if (!confirm(`Delete menu “${name}” and all its items?`)) return;
    try {
      deleteMenu(menuId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Menus"
        description="Create menus, manage items, and publish to screens."
        actions={<Button onClick={() => setOpen(true)}>New menu</Button>}
      />

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Items</th>
              <th className="px-4 py-3 font-medium">Version</th>
              <th className="px-4 py-3 font-medium">Published</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {orgMenus.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  No menus yet.
                </td>
              </tr>
            ) : (
              orgMenus.map((menu) => {
                const count = menuItems.filter((i) => i.menuId === menu.id)
                  .length;
                return (
                  <tr
                    key={menu.id}
                    className="border-b border-border last:border-0"
                  >
                    <td className="px-4 py-3 font-medium">
                      <Link
                        href={`/dashboard/menus/${menu.id}`}
                        className="hover:underline"
                      >
                        {menu.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 tabular-nums">{count}</td>
                    <td className="px-4 py-3 tabular-nums">v{menu.version}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {menu.publishedAt
                        ? new Date(menu.publishedAt).toLocaleString()
                        : "Draft"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          render={<Link href={`/dashboard/menus/${menu.id}`} />}
                        >
                          Open
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(menu.id, menu.name)}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {open ? (
        <CreateMenuDialog
          organizationId={session.organization.id}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}

function CreateMenuDialog({
  organizationId,
  onClose,
}: {
  organizationId: string;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      createMenu({ organizationId, name });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed.");
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
        <h2 className="text-lg font-semibold">New menu</h2>
        <div className="space-y-1.5">
          <Label htmlFor="menu-name">Name</Label>
          <Input
            id="menu-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Create</Button>
        </div>
      </form>
    </div>
  );
}

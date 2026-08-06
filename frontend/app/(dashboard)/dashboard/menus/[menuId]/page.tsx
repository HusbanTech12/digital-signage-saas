"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { PublishMenuDialog } from "@/components/dashboard/publish-menu-dialog";
import { useMockSession } from "@/components/providers/mock-session-provider";
import { useMockStore } from "@/components/providers/mock-data-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  canManageMenus,
  canPublishMenus,
  filterScreensForUser,
} from "@/lib/access";
import { useApiAuthToken } from "@/lib/api/auth-token";
import {
  createMenuItem,
  deleteMenuItem,
  updateMenu,
  updateMenuItem,
} from "@/lib/data/menus";
import type { MenuItem } from "@/lib/types/schema";

export default function MenuDetailPage() {
  const params = useParams<{ menuId: string }>();
  const menuId = params.menuId;
  const { session, role } = useMockSession();
  const { menus, menuItems, templates, screens } = useMockStore();
  const { getApiToken } = useApiAuthToken();
  const [publishOpen, setPublishOpen] = useState(false);
  const [itemForm, setItemForm] = useState<MenuItem | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const menu = menus.find(
    (m) => m.id === menuId && m.organizationId === session.organization.id,
  );
  const items = useMemo(
    () =>
      menuItems
        .filter((i) => i.menuId === menuId)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [menuItems, menuId],
  );
  const orgTemplates = templates.filter(
    (t) => t.isGlobal || t.organizationId === session.organization.id,
  );
  const visibleScreens = filterScreensForUser(screens, session.user);

  if (!canManageMenus(role)) {
    return (
      <div className="mx-auto max-w-4xl">
        <PageHeader title="Menu" description="Access denied." />
      </div>
    );
  }

  if (!menu) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <PageHeader title="Menu not found" />
        <Button variant="outline" render={<Link href="/dashboard/menus" />}>
          Back to menus
        </Button>
      </div>
    );
  }

  async function rename(name: string) {
    setError(null);
    try {
      const token = await getApiToken();
      await updateMenu(menu!.id, { name }, token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rename failed.");
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title={menu.name}
        description={`Version ${menu.version} · ${
          menu.publishedAt
            ? `Last published ${new Date(menu.publishedAt).toLocaleString()}`
            : "Never published"
        }`}
        actions={
          <>
            <Button variant="outline" render={<Link href="/dashboard/menus" />}>
              All menus
            </Button>
            <Button
              variant="outline"
              render={
                <Link
                  href={`/dashboard/templates?menuId=${menu.id}`}
                />
              }
            >
              Design layout
            </Button>
            {canPublishMenus(role) ? (
              <Button onClick={() => setPublishOpen(true)}>Publish</Button>
            ) : null}
          </>
        }
      />

      <div className="rounded-xl border border-border p-4">
        <Label htmlFor="rename">Menu name</Label>
        <div className="mt-1.5 flex gap-2">
          <Input
            id="rename"
            defaultValue={menu.name}
            key={menu.name}
            onBlur={(e) => {
              if (e.target.value.trim() && e.target.value !== menu.name) {
                void rename(e.target.value);
              }
            }}
          />
        </div>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Menu items</h2>
        <Button size="sm" onClick={() => setItemForm("new")}>
          Add item
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Price</th>
              <th className="px-4 py-3 font-medium">Available</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  No items yet.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-border last:border-0"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium">{item.name}</div>
                    {item.description ? (
                      <div className="text-xs text-muted-foreground">
                        {item.description}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {item.category}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    ${item.price.toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    {item.available ? "Yes" : "No"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setItemForm(item)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (!confirm(`Delete “${item.name}”?`)) return;
                          void (async () => {
                            try {
                              const token = await getApiToken();
                              await deleteMenuItem(item.id, token);
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
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {itemForm ? (
        <ItemFormDialog
          organizationId={session.organization.id}
          menuId={menu.id}
          item={itemForm === "new" ? null : itemForm}
          getApiToken={getApiToken}
          onClose={() => setItemForm(null)}
        />
      ) : null}

      <PublishMenuDialog
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        menuId={menu.id}
        templates={orgTemplates}
        screens={visibleScreens}
      />
    </div>
  );
}

function ItemFormDialog({
  organizationId,
  menuId,
  item,
  getApiToken,
  onClose,
}: {
  organizationId: string;
  menuId: string;
  item: MenuItem | null;
  getApiToken: () => Promise<string | null>;
  onClose: () => void;
}) {
  const [name, setName] = useState(item?.name ?? "");
  const [price, setPrice] = useState(String(item?.price ?? "0"));
  const [category, setCategory] = useState(item?.category ?? "General");
  const [description, setDescription] = useState(item?.description ?? "");
  const [available, setAvailable] = useState(item?.available ?? true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const parsed = Number(price);
      if (Number.isNaN(parsed) || parsed < 0) {
        throw new Error("Enter a valid price.");
      }
      const token = await getApiToken();
      if (item) {
        await updateMenuItem(
          item.id,
          {
            name,
            price: parsed,
            category,
            description,
            available,
          },
          token,
        );
      } else {
        await createMenuItem(
          {
            menuId,
            organizationId,
            name,
            price: parsed,
            category,
            description,
            available,
          },
          token,
        );
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
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
        <h2 className="text-lg font-semibold">
          {item ? "Edit item" : "Add item"}
        </h2>
        <div className="space-y-1.5">
          <Label htmlFor="item-name">Name</Label>
          <Input
            id="item-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="item-price">Price</Label>
            <Input
              id="item-price"
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="item-cat">Category</Label>
            <Input
              id="item-cat"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="item-desc">Description</Label>
          <Input
            id="item-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={available}
            onChange={(e) => setAvailable(e.target.checked)}
          />
          Available
        </label>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : item ? "Save" : "Add"}
          </Button>
        </div>
      </form>
    </div>
  );
}

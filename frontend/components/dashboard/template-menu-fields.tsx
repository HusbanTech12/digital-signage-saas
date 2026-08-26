"use client";

import { useEffect, useMemo, useState } from "react";
import { MenuItemFormDialog } from "@/components/dashboard/menu-item-form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteMenuItem, updateMenuItem } from "@/lib/data/menus";
import type { Menu, MenuItem } from "@/lib/types/schema";

export function TemplateMenuFields({
  organizationId,
  menus,
  selectedMenuId,
  categories,
  items,
  getApiToken,
  onMenuChange,
  onCategoriesChange,
}: {
  organizationId: string;
  menus: Menu[];
  selectedMenuId: string;
  categories: string[];
  items: MenuItem[];
  getApiToken: () => Promise<string | null>;
  onMenuChange: (menuId: string) => void;
  onCategoriesChange: (next: string[]) => void;
}) {
  const [itemForm, setItemForm] = useState<MenuItem | "new" | null>(null);
  const [newCategory, setNewCategory] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const cat of categories) map.set(cat, 0);
    for (const item of items) {
      map.set(item.category, (map.get(item.category) ?? 0) + 1);
    }
    return map;
  }, [categories, items]);

  useEffect(() => {
    const missing = [
      ...new Set(
        items
          .map((item) => item.category.trim())
          .filter((name) => name && !categories.includes(name)),
      ),
    ];
    if (missing.length) onCategoriesChange([...categories, ...missing]);
  }, [items, categories, onCategoriesChange]);

  async function remapCategory(from: string, to: string) {
    const token = await getApiToken();
    const affected = items.filter((i) => i.category === from);
    for (const item of affected) {
      await updateMenuItem(item.id, { category: to }, token);
    }
  }

  function addCategory() {
    const name = newCategory.trim();
    if (!name) return;
    if (categories.some((c) => c.toLowerCase() === name.toLowerCase())) {
      setError("That category already exists.");
      return;
    }
    setError(null);
    onCategoriesChange([...categories, name]);
    setNewCategory("");
  }

  async function renameCategory(index: number, nextName: string) {
    const previous = categories[index];
    const name = nextName.trim();
    if (!previous || !name || name === previous) return;
    if (
      categories.some(
        (c, i) => i !== index && c.toLowerCase() === name.toLowerCase(),
      )
    ) {
      setError("That category already exists.");
      return;
    }
    setError(null);
    const next = [...categories];
    next[index] = name;
    onCategoriesChange(next);
    try {
      await remapCategory(previous, name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not rename items.");
    }
  }

  async function moveCategory(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= categories.length) return;
    const next = [...categories];
    const [row] = next.splice(index, 1);
    next.splice(target, 0, row!);
    onCategoriesChange(next);
  }

  async function removeCategory(index: number) {
    const name = categories[index];
    if (!name) return;
    if (categories.length === 1) {
      setError("Keep at least one category — the board needs a column.");
      return;
    }
    const count = counts.get(name) ?? 0;
    const fallback = categories.find((_, i) => i !== index);
    if (
      count > 0 &&
      !confirm(
        `Move ${count} item${count === 1 ? "" : "s"} from “${name}” to “${fallback}”, then remove this category?`,
      )
    ) {
      return;
    }
    setError(null);
    onCategoriesChange(categories.filter((_, i) => i !== index));
    if (count > 0 && fallback) {
      try {
        await remapCategory(name, fallback);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not reassign items.",
        );
      }
    }
  }

  async function handleDeleteItem(item: MenuItem) {
    if (!confirm(`Delete “${item.name}”?`)) return;
    setBusyId(item.id);
    setError(null);
    try {
      const token = await getApiToken();
      await deleteMenuItem(item.id, token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setBusyId(null);
    }
  }

  const selectedMenu = menus.find((m) => m.id === selectedMenuId);

  return (
    <div className="space-y-6">
      <div className="space-y-3 rounded-xl border border-border p-4">
        <div>
          <h2 className="text-sm font-semibold">Menu</h2>
          <p className="text-xs text-muted-foreground">
            Categories become columns on the board. Items belong to the selected
            menu and save immediately — they are not stored on the template.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tpl-menu">Linked menu</Label>
          <select
            id="tpl-menu"
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={selectedMenuId}
            onChange={(e) => onMenuChange(e.target.value)}
          >
            <option value="">Select a menu…</option>
            {menus.map((menu) => (
              <option key={menu.id} value={menu.id}>
                {menu.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-border p-4">
        <div>
          <h2 className="text-sm font-semibold">Categories</h2>
          <p className="text-xs text-muted-foreground">
            Landscape places these side by side; portrait stacks them. Rename or
            reorder here — matching items follow the new name.
          </p>
        </div>
        <ul className="space-y-2">
          {categories.map((category, index) => (
            <li
              key={`${category}-${index}`}
              className="flex flex-wrap items-center gap-2"
            >
              <Input
                defaultValue={category}
                aria-label={`Category ${index + 1}`}
                className="min-w-[10rem] flex-1"
                onBlur={(e) => void renameCategory(index, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.currentTarget.blur();
                  }
                }}
              />
              <span className="w-16 shrink-0 text-xs text-muted-foreground">
                {counts.get(category) ?? 0} item
                {(counts.get(category) ?? 0) === 1 ? "" : "s"}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={index === 0}
                onClick={() => void moveCategory(index, -1)}
              >
                Up
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={index === categories.length - 1}
                onClick={() => void moveCategory(index, 1)}
              >
                Down
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => void removeCategory(index)}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <Input
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            placeholder="New category"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCategory();
              }
            }}
          />
          <Button type="button" variant="outline" onClick={addCategory}>
            Add category
          </Button>
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-border p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Items</h2>
            <p className="text-xs text-muted-foreground">
              {selectedMenu
                ? `Editing “${selectedMenu.name}”. Changes publish with the template package.`
                : "Select a menu above to add items."}
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            disabled={!selectedMenuId}
            onClick={() => setItemForm("new")}
          >
            Add item
          </Button>
        </div>

        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Category</th>
                <th className="px-3 py-2 font-medium">Price</th>
                <th className="px-3 py-2 font-medium">Available</th>
                <th className="px-3 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {!selectedMenuId ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-8 text-center text-muted-foreground"
                  >
                    Link a menu to manage items.
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-8 text-center text-muted-foreground"
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
                    <td className="px-3 py-2">
                      <div className="font-medium">{item.name}</div>
                      {item.description ? (
                        <div className="text-xs text-muted-foreground">
                          {item.description}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {item.category}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      ${item.price.toFixed(2)}
                    </td>
                    <td className="px-3 py-2">
                      {item.available ? "Yes" : "No"}
                    </td>
                    <td className="px-3 py-2">
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
                          disabled={busyId === item.id}
                          onClick={() => void handleDeleteItem(item)}
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
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {itemForm && selectedMenuId ? (
        <MenuItemFormDialog
          organizationId={organizationId}
          menuId={selectedMenuId}
          item={itemForm === "new" ? null : itemForm}
          columnCategories={categories}
          getApiToken={getApiToken}
          onClose={() => setItemForm(null)}
        />
      ) : null}
    </div>
  );
}

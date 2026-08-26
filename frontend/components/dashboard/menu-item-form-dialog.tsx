"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createMenuItem, updateMenuItem } from "@/lib/data/menus";
import { DEFAULT_MENU_DISPLAY_CONFIG } from "@/lib/display/menu-board-theme";
import type { MenuItem } from "@/lib/types/schema";

export function MenuItemFormDialog({
  organizationId,
  menuId,
  item,
  columnCategories,
  getApiToken,
  onClose,
}: {
  organizationId: string;
  menuId: string;
  item: MenuItem | null;
  columnCategories: string[];
  getApiToken: () => Promise<string | null>;
  onClose: () => void;
}) {
  const defaultSelect =
    item && columnCategories.includes(item.category)
      ? item.category
      : item
        ? "__custom__"
        : (columnCategories[0] ??
          DEFAULT_MENU_DISPLAY_CONFIG.categories[0] ??
          "General");

  const [name, setName] = useState(item?.name ?? "");
  const [price, setPrice] = useState(String(item?.price ?? "0"));
  const [categorySelect, setCategorySelect] = useState(defaultSelect);
  const [customCategory, setCustomCategory] = useState(
    item && !columnCategories.includes(item.category) ? item.category : "",
  );
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
      const resolvedCategory =
        categorySelect === "__custom__"
          ? customCategory.trim()
          : categorySelect.trim();
      if (!resolvedCategory) {
        throw new Error("Select or enter a category.");
      }
      const token = await getApiToken();
      if (item) {
        await updateMenuItem(
          item.id,
          {
            name,
            price: parsed,
            category: resolvedCategory,
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
            category: resolvedCategory,
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
            <select
              id="item-cat"
              value={categorySelect}
              onChange={(e) => setCategorySelect(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              required={categorySelect !== "__custom__"}
            >
              {columnCategories.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
              <option value="__custom__">Other…</option>
            </select>
            {categorySelect === "__custom__" ? (
              <Input
                id="item-cat-custom"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                placeholder="Custom category"
                required
              />
            ) : null}
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

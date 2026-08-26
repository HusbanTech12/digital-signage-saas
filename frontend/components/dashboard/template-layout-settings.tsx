"use client";

import { forwardRef, useImperativeHandle, useMemo, useState } from "react";
import { PremiumMenuBoard } from "@/components/display/premium-menu-board";
import {
  BOARD_TRANSITION_OPTIONS,
  ITEM_ANIMATION_OPTIONS,
  type BoardTransition,
  type ItemAnimation,
} from "@/lib/display/animations";
import {
  DEFAULT_MENU_DISPLAY_CONFIG,
  mergeDisplayConfig,
  type MenuDisplayConfig,
} from "@/lib/display/menu-board-theme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MenuItem, ScreenOrientation } from "@/lib/types/schema";

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 cursor-pointer rounded border border-border bg-transparent"
          aria-label={`${label} color picker`}
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="font-mono text-xs"
        />
      </div>
    </div>
  );
}

export type TemplateLayoutSettingsHandle = {
  getConfig: () => MenuDisplayConfig;
};

export const TemplateLayoutSettings = forwardRef<
  TemplateLayoutSettingsHandle,
  {
    config: MenuDisplayConfig | null | undefined;
    items: MenuItem[];
    categories: string[];
    orientation?: ScreenOrientation;
    onPublish?: () => void;
    publishing?: boolean;
  }
>(function TemplateLayoutSettings(
  { config, items, categories, orientation = "landscape", onPublish, publishing },
  ref,
) {
  const initial = mergeDisplayConfig(config);
  const [draft, setDraft] = useState<MenuDisplayConfig>(initial);
  const [previewTick, setPreviewTick] = useState(0);

  const previewConfig = useMemo(
    () =>
      mergeDisplayConfig({
        ...draft,
        categories:
          categories.length > 0
            ? categories
            : [...DEFAULT_MENU_DISPLAY_CONFIG.categories],
      }),
    [draft, categories],
  );

  useImperativeHandle(ref, () => ({
    getConfig: () => previewConfig,
  }));

  function resetDefaults() {
    setDraft({
      ...DEFAULT_MENU_DISPLAY_CONFIG,
      animations: { ...DEFAULT_MENU_DISPLAY_CONFIG.animations },
      categories: [...DEFAULT_MENU_DISPLAY_CONFIG.categories],
    });
  }

  function patchAnimations(
    patch: Partial<MenuDisplayConfig["animations"]>,
  ) {
    setDraft((d) => ({
      ...d,
      animations: { ...d.animations, ...patch },
    }));
    setPreviewTick((t) => t + 1);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Board appearance</h2>
          <p className="text-xs text-muted-foreground">
            Branding, colors, and animations for the menu board. Categories and
            items are on the Menu tab.
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={resetDefaults}>
            Reset theme
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => onPublish?.()}
            disabled={publishing}
          >
            {publishing ? "Publishing…" : "Publish"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-xl border border-border p-4">
          <div className="space-y-1.5">
            <Label htmlFor="brand-title">Brand title (TV header)</Label>
            <Input
              id="brand-title"
              value={draft.brandTitle}
              onChange={(e) =>
                setDraft((d) => ({ ...d, brandTitle: e.target.value }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="subtitle">Subtitle</Label>
            <Input
              id="subtitle"
              value={draft.subtitle}
              onChange={(e) =>
                setDraft((d) => ({ ...d, subtitle: e.target.value }))
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <ColorField
              label="Accent (prices, headers)"
              value={draft.accentColor}
              onChange={(v) => setDraft((d) => ({ ...d, accentColor: v }))}
            />
            <ColorField
              label="Background"
              value={draft.backgroundColor}
              onChange={(v) => setDraft((d) => ({ ...d, backgroundColor: v }))}
            />
            <ColorField
              label="Text"
              value={draft.textColor}
              onChange={(v) => setDraft((d) => ({ ...d, textColor: v }))}
            />
            <ColorField
              label="Muted / descriptions"
              value={draft.mutedColor}
              onChange={(v) => setDraft((d) => ({ ...d, mutedColor: v }))}
            />
            <ColorField
              label="Sold out"
              value={draft.soldOutColor}
              onChange={(v) => setDraft((d) => ({ ...d, soldOutColor: v }))}
            />
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.showClock}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, showClock: e.target.checked }))
                }
              />
              Show live clock
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.showSoldOut}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, showSoldOut: e.target.checked }))
                }
              />
              Show sold-out items on TV
            </label>
          </div>

          <div className="space-y-3 border-t border-border pt-4">
            <div>
              <h3 className="text-sm font-semibold">Animations & transitions</h3>
              <p className="text-xs text-muted-foreground">
                CSS-only effects for TV boards. Keep duration short for low-end
                sticks and Pis.
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.animations.enabled}
                onChange={(e) =>
                  patchAnimations({ enabled: e.target.checked })
                }
              />
              Enable animations
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="board-transition">Board transition</Label>
                <select
                  id="board-transition"
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={draft.animations.boardTransition}
                  disabled={!draft.animations.enabled}
                  onChange={(e) =>
                    patchAnimations({
                      boardTransition: e.target.value as BoardTransition,
                    })
                  }
                >
                  {BOARD_TRANSITION_OPTIONS.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="item-animation">Item animation</Label>
                <select
                  id="item-animation"
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={draft.animations.itemAnimation}
                  disabled={!draft.animations.enabled}
                  onChange={(e) =>
                    patchAnimations({
                      itemAnimation: e.target.value as ItemAnimation,
                    })
                  }
                >
                  {ITEM_ANIMATION_OPTIONS.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="anim-duration">
                  Duration ({draft.animations.durationMs}ms)
                </Label>
                <input
                  id="anim-duration"
                  type="range"
                  min={150}
                  max={900}
                  step={50}
                  className="w-full"
                  value={draft.animations.durationMs}
                  disabled={!draft.animations.enabled}
                  onChange={(e) =>
                    patchAnimations({ durationMs: Number(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="anim-stagger">
                  Stagger ({draft.animations.staggerMs}ms)
                </Label>
                <input
                  id="anim-stagger"
                  type="range"
                  min={0}
                  max={120}
                  step={5}
                  className="w-full"
                  value={draft.animations.staggerMs}
                  disabled={!draft.animations.enabled}
                  onChange={(e) =>
                    patchAnimations({ staggerMs: Number(e.target.value) })
                  }
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.animations.animateOnUpdate}
                disabled={!draft.animations.enabled}
                onChange={(e) =>
                  patchAnimations({ animateOnUpdate: e.target.checked })
                }
              />
              Replay when menu content updates
            </label>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!draft.animations.enabled}
              onClick={() => setPreviewTick((t) => t + 1)}
            >
              Replay preview
            </Button>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-zinc-900">
          <p className="border-b border-border px-3 py-2 text-xs text-muted-foreground">
            Live preview · {orientation === "portrait" ? "Portrait" : "Landscape"}
          </p>
          <div
            className={
              orientation === "portrait"
                ? "mx-auto aspect-[9/16] max-h-[36rem] w-full max-w-[18rem] overflow-hidden"
                : "aspect-video overflow-hidden"
            }
          >
            <PremiumMenuBoard
              items={items}
              config={previewConfig}
              orientation={orientation}
              statusLabel="Preview"
              contentKey={`preview-${previewTick}`}
            />
          </div>
        </div>
      </div>
    </div>
  );
});

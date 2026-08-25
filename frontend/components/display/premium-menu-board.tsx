"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AnimatedBoard,
  AnimatedItem,
} from "@/components/display/animated-board";
import {
  AutoFitContent,
  DisplaySurface,
} from "@/components/display/display-surface";
import type { MenuDisplayConfig } from "@/lib/display/menu-board-theme";
import { mergeDisplayConfig } from "@/lib/display/menu-board-theme";
import type { MenuItem, ScreenOrientation } from "@/lib/types/schema";

function useLiveClock(enabled: boolean) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, [enabled]);

  return now;
}

function formatTime(d: Date) {
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDate(d: Date) {
  return d
    .toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    })
    .toUpperCase();
}

/**
 * Type scale for the fixed design stage. Sizes are absolute because the stage
 * is always the same size — the surface scales the whole board to the TV.
 */
const TYPE = {
  landscape: {
    pad: "px-14 py-10",
    brand: "text-5xl",
    subtitle: "text-sm",
    clock: "text-4xl",
    date: "text-xs",
    category: "text-2xl",
    item: "text-lg",
    description: "text-sm",
    gap: "gap-10",
    headerGap: "mb-8 pb-6",
    rowGap: "space-y-5",
  },
  portrait: {
    pad: "px-10 py-10",
    brand: "text-4xl",
    subtitle: "text-xs",
    clock: "text-3xl",
    date: "text-[10px]",
    category: "text-xl",
    item: "text-base",
    description: "text-xs",
    gap: "gap-7",
    headerGap: "mb-7 pb-5",
    rowGap: "space-y-4",
  },
} as const;

export function PremiumMenuBoard({
  items,
  config: configIn,
  orientation = "landscape",
  statusLabel,
  contentKey,
}: {
  items: MenuItem[];
  config?: Partial<MenuDisplayConfig> | null;
  /** Landscape puts categories side by side; portrait stacks them. */
  orientation?: ScreenOrientation;
  /** e.g. "Live" or "Preview" */
  statusLabel?: string;
  /** Remount board animation when this changes (publish / sync). */
  contentKey?: string;
}) {
  const config = mergeDisplayConfig(configIn);
  const now = useLiveClock(config.showClock);
  const anim = config.animations;
  const type = TYPE[orientation];

  const visibleItems = useMemo(
    () => (config.showSoldOut ? items : items.filter((i) => i.available)),
    [config.showSoldOut, items],
  );

  const byCategory = useMemo(() => {
    const map = new Map<string, MenuItem[]>();
    for (const cat of config.categories) {
      map.set(cat, []);
    }
    for (const item of visibleItems) {
      const key = config.categories.includes(item.category)
        ? item.category
        : (config.categories[0] ?? "Menu");
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    for (const [, list] of map) {
      list.sort((a, b) => a.sortOrder - b.sortOrder);
    }
    return config.categories.map((cat) => ({
      category: cat,
      items: map.get(cat) ?? [],
    }));
  }, [config.categories, visibleItems]);

  const sectionCount = Math.max(byCategory.length, 1);
  let itemIndex = 0;

  return (
    <DisplaySurface
      orientation={orientation}
      style={{ backgroundColor: config.backgroundColor }}
      stageStyle={{
        backgroundColor: config.backgroundColor,
        backgroundImage: `radial-gradient(ellipse 80% 60% at 50% 0%, color-mix(in srgb, ${config.accentColor} 12%, transparent), ${config.backgroundColor})`,
      }}
    >
      <AnimatedBoard
        animations={anim}
        contentKey={contentKey}
        className={`flex h-full w-full flex-col overflow-hidden ${type.pad}`}
        style={{ color: config.textColor }}
      >
        <header
          className={`flex shrink-0 items-start justify-between gap-8 border-b border-white/10 ${type.headerGap}`}
        >
          <div className="min-w-0">
            <h1
              className={`truncate font-semibold tracking-tight ${type.brand}`}
              style={{
                fontFamily: "Georgia, 'Times New Roman', serif",
                color: config.textColor,
              }}
            >
              {config.brandTitle}
            </h1>
            <p
              className={`mt-2 font-medium tracking-[0.35em] ${type.subtitle}`}
              style={{ color: config.accentColor }}
            >
              {config.subtitle}
            </p>
          </div>

          {config.showClock ? (
            <div className="shrink-0 text-right">
              <p
                className={`font-light tabular-nums tracking-tight ${type.clock}`}
                style={{ color: config.textColor }}
              >
                {formatTime(now)}
              </p>
              <p
                className={`mt-1 tracking-[0.2em] ${type.date}`}
                style={{ color: config.mutedColor }}
              >
                {formatDate(now)}
              </p>
              {statusLabel ? (
                <p className="mt-2 flex items-center justify-end gap-1.5 text-[10px] tracking-wide uppercase">
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full"
                    style={{
                      backgroundColor: statusLabel
                        .toLowerCase()
                        .includes("live")
                        ? "#22c55e"
                        : config.mutedColor,
                    }}
                  />
                  <span style={{ color: config.mutedColor }}>
                    {statusLabel}
                  </span>
                </p>
              ) : null}
            </div>
          ) : null}
        </header>

        <AutoFitContent
          contentKey={`${contentKey ?? ""}:${orientation}:${visibleItems.length}`}
          className="min-h-0 flex-1"
        >
          <div
            className={`grid h-full ${type.gap}`}
            style={
              orientation === "portrait"
                ? {
                    gridTemplateColumns: "minmax(0, 1fr)",
                    gridTemplateRows: `repeat(${sectionCount}, auto)`,
                    alignContent: "start",
                  }
                : {
                    gridTemplateColumns: `repeat(${sectionCount}, minmax(0, 1fr))`,
                    alignItems: "start",
                  }
            }
          >
            {byCategory.map(({ category, items: catItems }) => (
              <section key={category} className="min-w-0">
                <h2
                  className={`border-b pb-2 font-medium tracking-wide ${type.category}`}
                  style={{
                    fontFamily: "Georgia, 'Times New Roman', serif",
                    color: config.accentColor,
                    borderColor: `color-mix(in srgb, ${config.accentColor} 40%, transparent)`,
                  }}
                >
                  {category}
                </h2>

                {catItems.length === 0 ? (
                  <p
                    className="mt-6 text-sm italic"
                    style={{ color: config.mutedColor }}
                  >
                    —
                  </p>
                ) : (
                  <ul className={`mt-5 ${type.rowGap}`}>
                    {catItems.map((item) => {
                      const soldOut = !item.available;
                      const index = itemIndex++;
                      return (
                        <li
                          key={item.id}
                          className={soldOut ? "opacity-55" : undefined}
                        >
                          <AnimatedItem animations={anim} index={index}>
                            <div className="flex items-baseline gap-2">
                              <span
                                className={`min-w-0 shrink font-medium ${type.item}`}
                                style={{
                                  color: soldOut
                                    ? config.mutedColor
                                    : config.textColor,
                                  textDecoration: soldOut
                                    ? "line-through"
                                    : undefined,
                                }}
                              >
                                {item.name}
                              </span>
                              <span
                                className="min-w-[1rem] flex-1 border-b border-dotted"
                                style={{
                                  borderColor: `color-mix(in srgb, ${config.mutedColor} 50%, transparent)`,
                                }}
                                aria-hidden
                              />
                              <span
                                className={`shrink-0 tabular-nums ${type.item}`}
                                style={{
                                  color: soldOut
                                    ? config.mutedColor
                                    : config.accentColor,
                                  textDecoration: soldOut
                                    ? "line-through"
                                    : undefined,
                                }}
                              >
                                ${item.price.toFixed(2)}
                              </span>
                            </div>
                            {item.description ? (
                              <p
                                className={`mt-0.5 leading-snug ${type.description}`}
                                style={{ color: config.mutedColor }}
                              >
                                {item.description}
                              </p>
                            ) : null}
                            {soldOut && config.showSoldOut ? (
                              <p
                                className="mt-1 text-[10px] font-semibold tracking-[0.2em] uppercase"
                                style={{ color: config.soldOutColor }}
                              >
                                Sold out
                              </p>
                            ) : null}
                          </AnimatedItem>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            ))}
          </div>
        </AutoFitContent>
      </AnimatedBoard>
    </DisplaySurface>
  );
}

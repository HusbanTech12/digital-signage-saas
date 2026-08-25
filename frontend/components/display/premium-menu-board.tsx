"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AnimatedBoard,
  AnimatedItem,
} from "@/components/display/animated-board";
import {
  AutoFitContent,
  DisplaySurface,
  bu,
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
 * Type and spacing scale in board units (1% of the panel's shorter side).
 * Portrait runs a single column, so it can afford larger text than landscape.
 */
const SCALE = {
  landscape: {
    padX: 4.5,
    padY: 3.5,
    brand: 5.6,
    subtitle: 1.4,
    clock: 4,
    date: 1.1,
    status: 1,
    category: 3.2,
    item: 2.5,
    description: 1.6,
    soldOut: 1.2,
    columnGap: 4,
    rowGap: 2.6,
  },
  portrait: {
    padX: 5,
    padY: 4,
    brand: 7,
    subtitle: 1.9,
    clock: 5,
    date: 1.5,
    status: 1.4,
    category: 4,
    item: 3.2,
    description: 2,
    soldOut: 1.5,
    columnGap: 3.6,
    rowGap: 3,
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
  const isPortrait = orientation === "portrait";
  const s = SCALE[isPortrait ? "portrait" : "landscape"];

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
      style={{
        backgroundColor: config.backgroundColor,
        backgroundImage: `radial-gradient(ellipse 80% 60% at 50% 0%, color-mix(in srgb, ${config.accentColor} 12%, transparent), ${config.backgroundColor})`,
      }}
    >
      <AnimatedBoard
        animations={anim}
        contentKey={contentKey}
        className="flex h-full w-full flex-col overflow-hidden"
        style={{
          color: config.textColor,
          padding: `${bu(s.padY)} ${bu(s.padX)}`,
        }}
      >
        <header
          className="flex shrink-0 items-start justify-between border-b border-white/10"
          style={{
            gap: bu(s.columnGap),
            marginBottom: bu(s.padY * 0.8),
            paddingBottom: bu(s.padY * 0.6),
          }}
        >
          <div className="min-w-0">
            <h1
              className="truncate font-semibold tracking-tight"
              style={{
                fontFamily: "Georgia, 'Times New Roman', serif",
                color: config.textColor,
                fontSize: bu(s.brand),
                lineHeight: 1.1,
              }}
            >
              {config.brandTitle}
            </h1>
            <p
              className="font-medium tracking-[0.35em]"
              style={{
                color: config.accentColor,
                fontSize: bu(s.subtitle),
                marginTop: bu(0.8),
              }}
            >
              {config.subtitle}
            </p>
          </div>

          {config.showClock ? (
            <div className="shrink-0 text-right">
              <p
                className="font-light tabular-nums tracking-tight"
                style={{
                  color: config.textColor,
                  fontSize: bu(s.clock),
                  lineHeight: 1.1,
                }}
              >
                {formatTime(now)}
              </p>
              <p
                className="tracking-[0.2em]"
                style={{
                  color: config.mutedColor,
                  fontSize: bu(s.date),
                  marginTop: bu(0.5),
                }}
              >
                {formatDate(now)}
              </p>
              {statusLabel ? (
                <p
                  className="flex items-center justify-end tracking-wide uppercase"
                  style={{
                    fontSize: bu(s.status),
                    marginTop: bu(0.8),
                    gap: bu(0.6),
                  }}
                >
                  <span
                    className="inline-block rounded-full"
                    style={{
                      width: bu(0.8),
                      height: bu(0.8),
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
            className="grid"
            style={{
              gap: bu(s.columnGap),
              gridTemplateColumns: isPortrait
                ? "minmax(0, 1fr)"
                : `repeat(${sectionCount}, minmax(0, 1fr))`,
              alignItems: "start",
            }}
          >
            {byCategory.map(({ category, items: catItems }) => (
              <section key={category} className="min-w-0">
                <h2
                  className="border-b font-medium tracking-wide"
                  style={{
                    fontFamily: "Georgia, 'Times New Roman', serif",
                    color: config.accentColor,
                    borderColor: `color-mix(in srgb, ${config.accentColor} 40%, transparent)`,
                    fontSize: bu(s.category),
                    paddingBottom: bu(0.8),
                  }}
                >
                  {category}
                </h2>

                {catItems.length === 0 ? (
                  <p
                    className="italic"
                    style={{
                      color: config.mutedColor,
                      fontSize: bu(s.item),
                      marginTop: bu(s.rowGap),
                    }}
                  >
                    —
                  </p>
                ) : (
                  <ul style={{ marginTop: bu(s.rowGap) }}>
                    {catItems.map((item, idx) => {
                      const soldOut = !item.available;
                      const index = itemIndex++;
                      return (
                        <li
                          key={item.id}
                          className={soldOut ? "opacity-55" : undefined}
                          style={{
                            marginTop: idx === 0 ? undefined : bu(s.rowGap),
                          }}
                        >
                          <AnimatedItem animations={anim} index={index}>
                            <div
                              className="flex items-baseline"
                              style={{ gap: bu(1) }}
                            >
                              <span
                                className="min-w-0 shrink font-medium"
                                style={{
                                  color: soldOut
                                    ? config.mutedColor
                                    : config.textColor,
                                  textDecoration: soldOut
                                    ? "line-through"
                                    : undefined,
                                  fontSize: bu(s.item),
                                }}
                              >
                                {item.name}
                              </span>
                              <span
                                className="flex-1 border-b border-dotted"
                                style={{
                                  minWidth: bu(1),
                                  borderColor: `color-mix(in srgb, ${config.mutedColor} 50%, transparent)`,
                                }}
                                aria-hidden
                              />
                              <span
                                className="shrink-0 tabular-nums"
                                style={{
                                  color: soldOut
                                    ? config.mutedColor
                                    : config.accentColor,
                                  textDecoration: soldOut
                                    ? "line-through"
                                    : undefined,
                                  fontSize: bu(s.item),
                                }}
                              >
                                ${item.price.toFixed(2)}
                              </span>
                            </div>
                            {item.description ? (
                              <p
                                className="leading-snug"
                                style={{
                                  color: config.mutedColor,
                                  fontSize: bu(s.description),
                                  marginTop: bu(0.4),
                                }}
                              >
                                {item.description}
                              </p>
                            ) : null}
                            {soldOut && config.showSoldOut ? (
                              <p
                                className="font-semibold tracking-[0.2em] uppercase"
                                style={{
                                  color: config.soldOutColor,
                                  fontSize: bu(s.soldOut),
                                  marginTop: bu(0.5),
                                }}
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

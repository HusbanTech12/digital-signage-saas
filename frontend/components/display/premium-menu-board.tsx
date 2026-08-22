"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AnimatedBoard,
  AnimatedItem,
} from "@/components/display/animated-board";
import type { MenuDisplayConfig } from "@/lib/display/menu-board-theme";
import { mergeDisplayConfig } from "@/lib/display/menu-board-theme";
import type { MenuItem } from "@/lib/types/schema";

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

export function PremiumMenuBoard({
  items,
  config: configIn,
  statusLabel,
  contentKey,
}: {
  items: MenuItem[];
  config?: Partial<MenuDisplayConfig> | null;
  /** e.g. "Live" or "Preview" */
  statusLabel?: string;
  /** Remount board animation when this changes (publish / sync). */
  contentKey?: string;
}) {
  const config = mergeDisplayConfig(configIn);
  const now = useLiveClock(config.showClock);
  const anim = config.animations;

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

  let itemIndex = 0;

  return (
    <AnimatedBoard
      animations={anim}
      contentKey={contentKey}
      className="relative flex h-dvh min-h-dvh w-screen flex-col overflow-hidden px-10 py-8 md:px-14 md:py-10"
      style={{
        backgroundColor: config.backgroundColor,
        color: config.textColor,
        backgroundImage: `radial-gradient(ellipse 80% 60% at 50% 0%, color-mix(in srgb, ${config.accentColor} 12%, transparent), ${config.backgroundColor})`,
      }}
    >
      <header className="mb-8 flex shrink-0 items-start justify-between gap-8 border-b border-white/10 pb-6">
        <div>
          <h1
            className="text-4xl font-semibold tracking-tight md:text-5xl lg:text-6xl"
            style={{
              fontFamily: "Georgia, 'Times New Roman', serif",
              color: config.textColor,
            }}
          >
            {config.brandTitle}
          </h1>
          <p
            className="mt-2 text-xs font-medium tracking-[0.35em] md:text-sm"
            style={{ color: config.accentColor }}
          >
            {config.subtitle}
          </p>
        </div>

        {config.showClock ? (
          <div className="text-right">
            <p
              className="text-3xl font-light tabular-nums tracking-tight md:text-4xl"
              style={{ color: config.textColor }}
            >
              {formatTime(now)}
            </p>
            <p
              className="mt-1 text-[10px] tracking-[0.2em] md:text-xs"
              style={{ color: config.mutedColor }}
            >
              {formatDate(now)}
            </p>
            {statusLabel ? (
              <p className="mt-2 flex items-center justify-end gap-1.5 text-[10px] tracking-wide uppercase">
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{
                    backgroundColor: statusLabel.toLowerCase().includes("live")
                      ? "#22c55e"
                      : config.mutedColor,
                  }}
                />
                <span style={{ color: config.mutedColor }}>{statusLabel}</span>
              </p>
            ) : null}
          </div>
        ) : null}
      </header>

      <div className="grid flex-1 grid-cols-1 gap-10 md:grid-cols-3 md:gap-8 lg:gap-12">
        {byCategory.map(({ category, items: catItems }) => (
          <section key={category} className="min-w-0">
            <h2
              className="border-b pb-2 text-xl font-medium tracking-wide md:text-2xl"
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
              <ul className="mt-5 space-y-5">
                {catItems.map((item) => {
                  const soldOut = !item.available;
                  const index = itemIndex++;
                  return (
                    <li key={item.id} className={soldOut ? "opacity-55" : undefined}>
                      <AnimatedItem animations={anim} index={index}>
                        <div className="flex items-baseline gap-2">
                          <span
                            className="min-w-0 shrink text-base font-medium md:text-lg"
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
                            className="shrink-0 text-base tabular-nums md:text-lg"
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
                            className="mt-0.5 text-xs leading-snug md:text-sm"
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
    </AnimatedBoard>
  );
}

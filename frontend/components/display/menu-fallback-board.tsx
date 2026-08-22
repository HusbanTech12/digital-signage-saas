"use client";

import {
  AnimatedBoard,
  AnimatedItem,
} from "@/components/display/animated-board";
import {
  DEFAULT_DISPLAY_ANIMATIONS,
  mergeAnimations,
  type DisplayAnimationConfig,
} from "@/lib/display/animations";
import type { MenuItem } from "@/lib/types/schema";

/** Simple CSS menu board when no template canvas is available. */
export function MenuFallbackBoard({
  title,
  items,
  animations: animationsIn,
  contentKey,
}: {
  title: string;
  items: MenuItem[];
  animations?: Partial<DisplayAnimationConfig> | null;
  contentKey?: string;
}) {
  const animations = mergeAnimations(
    animationsIn ?? DEFAULT_DISPLAY_ANIMATIONS,
  );
  const byCategory = items.reduce<Record<string, MenuItem[]>>((acc, item) => {
    const key = item.category || "Menu";
    (acc[key] ??= []).push(item);
    return acc;
  }, {});

  const categories = Object.keys(byCategory);
  let itemIndex = 0;

  return (
    <AnimatedBoard
      animations={animations}
      contentKey={contentKey}
      className="flex h-dvh min-h-dvh w-screen flex-col bg-zinc-950 px-8 py-10 text-zinc-50 md:px-16"
    >
      <header className="border-b border-zinc-800 pb-6">
        <p className="text-sm tracking-[0.25em] text-zinc-500 uppercase">
          Live menu
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight md:text-5xl">
          {title}
        </h1>
      </header>

      {categories.length === 0 ? (
        <p className="mt-16 text-xl text-zinc-500">
          Waiting for published menu content…
        </p>
      ) : (
        <div className="mt-10 grid flex-1 gap-10 md:grid-cols-2">
          {categories.map((category) => (
            <section key={category}>
              <h2 className="mb-4 text-xl font-medium tracking-wide text-zinc-300">
                {category}
              </h2>
              <ul className="space-y-4">
                {byCategory[category].map((item) => {
                  const index = itemIndex++;
                  return (
                    <li key={item.id}>
                      <AnimatedItem animations={animations} index={index}>
                        <div className="flex items-baseline justify-between gap-4 border-b border-zinc-900 pb-3">
                          <div className="min-w-0">
                            <p className="truncate text-2xl font-medium">
                              {item.name}
                            </p>
                            {item.description ? (
                              <p className="mt-1 line-clamp-2 text-sm text-zinc-500">
                                {item.description}
                              </p>
                            ) : null}
                          </div>
                          <p className="shrink-0 text-2xl tabular-nums text-zinc-200">
                            ${item.price.toFixed(2)}
                          </p>
                        </div>
                      </AnimatedItem>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </AnimatedBoard>
  );
}

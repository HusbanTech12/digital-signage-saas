"use client";

import {
  AnimatedBoard,
  AnimatedItem,
} from "@/components/display/animated-board";
import {
  AutoFitContent,
  DisplaySurface,
} from "@/components/display/display-surface";
import {
  DEFAULT_DISPLAY_ANIMATIONS,
  mergeAnimations,
  type DisplayAnimationConfig,
} from "@/lib/display/animations";
import type { MenuItem, ScreenOrientation } from "@/lib/types/schema";

/** Simple CSS menu board when no template canvas is available. */
export function MenuFallbackBoard({
  title,
  items,
  orientation = "landscape",
  animations: animationsIn,
  contentKey,
}: {
  title: string;
  items: MenuItem[];
  /** Landscape puts categories side by side; portrait stacks them. */
  orientation?: ScreenOrientation;
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
  const isPortrait = orientation === "portrait";
  // Landscape reads best at up to three columns; portrait always stacks.
  const columns = isPortrait ? 1 : Math.min(Math.max(categories.length, 1), 3);
  let itemIndex = 0;

  return (
    <DisplaySurface
      orientation={orientation}
      className="bg-zinc-950"
      stageClassName="bg-zinc-950"
    >
      <AnimatedBoard
        animations={animations}
        contentKey={contentKey}
        className={`flex h-full w-full flex-col overflow-hidden text-zinc-50 ${
          isPortrait ? "px-10 py-10" : "px-14 py-10"
        }`}
      >
        <header className="shrink-0 border-b border-zinc-800 pb-6">
          <p className="text-xs tracking-[0.25em] text-zinc-500 uppercase">
            Live menu
          </p>
          <h1
            className={`mt-2 truncate font-semibold tracking-tight ${
              isPortrait ? "text-4xl" : "text-5xl"
            }`}
          >
            {title}
          </h1>
        </header>

        {categories.length === 0 ? (
          <p className="mt-16 text-xl text-zinc-500">
            Waiting for published menu content…
          </p>
        ) : (
          <AutoFitContent
            contentKey={`${contentKey ?? ""}:${orientation}:${items.length}`}
            className="mt-8 min-h-0 flex-1"
          >
            <div
              className={`grid h-full ${isPortrait ? "gap-7" : "gap-10"}`}
              style={{
                gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                alignContent: "start",
              }}
            >
              {categories.map((category) => (
                <section key={category} className="min-w-0">
                  <h2
                    className={`mb-4 font-medium tracking-wide text-zinc-300 ${
                      isPortrait ? "text-lg" : "text-xl"
                    }`}
                  >
                    {category}
                  </h2>
                  <ul className={isPortrait ? "space-y-3" : "space-y-4"}>
                    {byCategory[category].map((item) => {
                      const index = itemIndex++;
                      return (
                        <li key={item.id}>
                          <AnimatedItem animations={animations} index={index}>
                            <div className="flex items-baseline justify-between gap-4 border-b border-zinc-900 pb-3">
                              <div className="min-w-0">
                                <p
                                  className={`truncate font-medium ${
                                    isPortrait ? "text-lg" : "text-xl"
                                  }`}
                                >
                                  {item.name}
                                </p>
                                {item.description ? (
                                  <p className="mt-1 line-clamp-2 text-xs text-zinc-500">
                                    {item.description}
                                  </p>
                                ) : null}
                              </div>
                              <p
                                className={`shrink-0 tabular-nums text-zinc-200 ${
                                  isPortrait ? "text-lg" : "text-xl"
                                }`}
                              >
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
          </AutoFitContent>
        )}
      </AnimatedBoard>
    </DisplaySurface>
  );
}

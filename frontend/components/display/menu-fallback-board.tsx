"use client";

import {
  AnimatedBoard,
  AnimatedItem,
} from "@/components/display/animated-board";
import {
  AutoFitContent,
  DisplaySurface,
  bu,
} from "@/components/display/display-surface";
import {
  DEFAULT_DISPLAY_ANIMATIONS,
  mergeAnimations,
  type DisplayAnimationConfig,
} from "@/lib/display/animations";
import type { MenuItem, ScreenOrientation } from "@/lib/types/schema";

/** Board-unit scale; portrait runs one column so its type can be larger. */
const SCALE = {
  landscape: {
    padX: 4.5,
    padY: 3.5,
    eyebrow: 1.3,
    title: 5.4,
    category: 3,
    item: 2.5,
    description: 1.6,
    columnGap: 4,
    rowGap: 2.4,
  },
  portrait: {
    padX: 5,
    padY: 4,
    eyebrow: 1.8,
    title: 6.8,
    category: 3.8,
    item: 3.2,
    description: 2,
    columnGap: 3.6,
    rowGap: 2.8,
  },
} as const;

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
  const s = SCALE[isPortrait ? "portrait" : "landscape"];
  // Landscape reads best at up to three columns; portrait always stacks.
  const columns = isPortrait ? 1 : Math.min(Math.max(categories.length, 1), 3);
  let itemIndex = 0;

  return (
    <DisplaySurface className="bg-zinc-950">
      <AnimatedBoard
        animations={animations}
        contentKey={contentKey}
        className="flex h-full w-full flex-col overflow-hidden text-zinc-50"
        style={{ padding: `${bu(s.padY)} ${bu(s.padX)}` }}
      >
        <header
          className="shrink-0 border-b border-zinc-800"
          style={{ paddingBottom: bu(s.padY * 0.6) }}
        >
          <p
            className="tracking-[0.25em] text-zinc-500 uppercase"
            style={{ fontSize: bu(s.eyebrow) }}
          >
            Live menu
          </p>
          <h1
            className="truncate font-semibold tracking-tight"
            style={{
              fontSize: bu(s.title),
              lineHeight: 1.1,
              marginTop: bu(0.8),
            }}
          >
            {title}
          </h1>
        </header>

        {categories.length === 0 ? (
          <p
            className="text-zinc-500"
            style={{ fontSize: bu(s.item), marginTop: bu(8) }}
          >
            Waiting for published menu content…
          </p>
        ) : (
          <AutoFitContent
            contentKey={`${contentKey ?? ""}:${orientation}:${items.length}`}
            className="min-h-0 flex-1"
          >
            <div
              className="grid"
              style={{
                gap: bu(s.columnGap),
                gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                alignItems: "start",
                paddingTop: bu(s.padY * 0.8),
              }}
            >
              {categories.map((category) => (
                <section key={category} className="min-w-0">
                  <h2
                    className="font-medium tracking-wide text-zinc-300"
                    style={{
                      fontSize: bu(s.category),
                      marginBottom: bu(s.rowGap),
                    }}
                  >
                    {category}
                  </h2>
                  <ul>
                    {byCategory[category].map((item, idx) => {
                      const index = itemIndex++;
                      return (
                        <li
                          key={item.id}
                          style={{
                            marginTop: idx === 0 ? undefined : bu(s.rowGap),
                          }}
                        >
                          <AnimatedItem animations={animations} index={index}>
                            <div
                              className="flex items-baseline justify-between border-b border-zinc-900"
                              style={{
                                gap: bu(2),
                                paddingBottom: bu(s.rowGap * 0.6),
                              }}
                            >
                              <div className="min-w-0">
                                <p
                                  className="truncate font-medium"
                                  style={{ fontSize: bu(s.item) }}
                                >
                                  {item.name}
                                </p>
                                {item.description ? (
                                  <p
                                    className="line-clamp-2 text-zinc-500"
                                    style={{
                                      fontSize: bu(s.description),
                                      marginTop: bu(0.4),
                                    }}
                                  >
                                    {item.description}
                                  </p>
                                ) : null}
                              </div>
                              <p
                                className="shrink-0 tabular-nums text-zinc-200"
                                style={{ fontSize: bu(s.item) }}
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

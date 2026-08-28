"use client";

import { useEffect, useMemo, useState } from "react";
import { resolveMediaUrl } from "@/lib/api/media";
import { resolveQrCode } from "@/lib/data/qr-codes";
import type { QrResolveDto } from "@/lib/api/qr-codes";

type MenuPayload = NonNullable<QrResolveDto["menu"]>;
type MenuItemPayload = MenuPayload["items"][number];

function groupByCategory(items: MenuItemPayload[]) {
  const groups = new Map<string, MenuItemPayload[]>();
  for (const item of items) {
    const key = item.category || "Menu";
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => a.sortOrder - b.sortOrder);
  }
  return [...groups.entries()];
}

/**
 * Guest-facing menu for a scanned QR code. Deliberately plain: it loads on a
 * phone over cellular data, so no imagery beyond the item photos already
 * uploaded to the menu.
 */
export function ScannedMenu({ shortCode }: { shortCode: string }) {
  const [resolved, setResolved] = useState<QrResolveDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const result = await resolveQrCode(shortCode);
        if (cancelled) return;
        // A non-menu code can still be scanned here — honour its destination.
        if (result.redirectUrl) {
          window.location.replace(result.redirectUrl);
          return;
        }
        setResolved(result);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "This code could not be opened",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shortCode]);

  const groups = useMemo(
    () => groupByCategory(resolved?.menu?.items ?? []),
    [resolved],
  );

  if (loading) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-zinc-950 p-6 text-zinc-400">
        <p className="text-sm">Loading menu…</p>
      </main>
    );
  }

  if (error || !resolved?.menu) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-zinc-950 p-6">
        <div className="max-w-sm text-center">
          <h1 className="text-lg font-semibold text-zinc-100">
            Menu unavailable
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            {error ?? "This QR code no longer points to a menu."}
          </p>
        </div>
      </main>
    );
  }

  const menu = resolved.menu;

  return (
    <main className="min-h-dvh bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-lg px-5 py-8">
        <header className="border-b border-white/10 pb-5">
          {menu.organizationName ? (
            <p className="text-xs tracking-[0.25em] text-amber-300/80 uppercase">
              {menu.organizationName}
            </p>
          ) : null}
          <h1 className="mt-1 font-serif text-3xl font-semibold">{menu.name}</h1>
          {resolved.caption ? (
            <p className="mt-2 text-sm text-zinc-400">{resolved.caption}</p>
          ) : null}
        </header>

        {groups.length === 0 ? (
          <p className="py-10 text-center text-sm text-zinc-400">
            This menu has no items yet.
          </p>
        ) : (
          groups.map(([category, items]) => (
            <section key={category} className="pt-7">
              <h2 className="font-serif text-lg text-amber-300/90">
                {category}
              </h2>
              <ul className="mt-3 space-y-4">
                {items.map((item) => (
                  <li
                    key={item.id}
                    className={item.available ? undefined : "opacity-60"}
                  >
                    <div className="flex gap-3">
                      {item.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={resolveMediaUrl(item.imageUrl)}
                          alt=""
                          loading="lazy"
                          className="h-16 w-16 shrink-0 rounded-lg object-cover"
                        />
                      ) : null}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className="min-w-0 font-medium">
                            {item.name}
                          </span>
                          <span
                            className="flex-1 border-b border-dotted border-zinc-700"
                            aria-hidden
                          />
                          <span className="shrink-0 tabular-nums text-amber-300/90">
                            ${item.price.toFixed(2)}
                          </span>
                        </div>
                        {item.description ? (
                          <p className="mt-1 text-sm leading-snug text-zinc-400">
                            {item.description}
                          </p>
                        ) : null}
                        {!item.available ? (
                          <p className="mt-1 text-xs font-semibold tracking-widest text-red-400 uppercase">
                            Sold out
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}

        <footer className="mt-10 border-t border-white/10 pt-4 text-center text-xs text-zinc-500">
          Menu v{menu.version}
        </footer>
      </div>
    </main>
  );
}

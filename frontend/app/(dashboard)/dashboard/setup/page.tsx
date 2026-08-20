"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { useMockSession } from "@/components/providers/mock-session-provider";
import { useMockStore } from "@/components/providers/mock-data-provider";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  canManageScreens,
  filterLocationsForUser,
  filterScreensForUser,
} from "@/lib/access";
import { lcdPresetLabel } from "@/lib/display/lcd-presets";

function useAppOrigin(): string {
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);
  return origin;
}

function toAbsolute(origin: string, path: string): string {
  return origin ? `${origin}${path}` : path;
}

function CopyField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex gap-2">
        <code className="min-w-0 flex-1 truncate rounded-md border border-border bg-muted/40 px-3 py-2 text-xs">
          {value}
        </code>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => void copy()}
        >
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  );
}

export default function StreamingStickSetupPage() {
  const { session, role } = useMockSession();
  const { locations, screens } = useMockStore();
  const origin = useAppOrigin();

  const visibleLocations = useMemo(
    () => filterLocationsForUser(locations, session.user),
    [locations, session.user],
  );

  const visibleScreens = useMemo(() => {
    return filterScreensForUser(screens, session.user)
      .filter((s) => s.locationId !== null)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [screens, session.user]);

  const locationName = (locationId: string | null) => {
    if (!locationId) return "Unassigned";
    return (
      visibleLocations.find((l) => l.id === locationId)?.name ??
      locations.find((l) => l.id === locationId)?.name ??
      "Unknown"
    );
  };

  const pairUrl = toAbsolute(origin, "/pair");

  if (!canManageScreens(role)) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader
          title="Streaming stick setup"
          description="You do not have access to screen setup."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        title="Streaming stick setup"
        description="Connect any LCD TV using a Fire Stick, Chromecast, or Android TV stick — the display is just a browser in fullscreen."
        actions={
          <Button variant="outline" render={<Link href="/dashboard/screens" />}>
            Screens
          </Button>
        }
      />

      <section className="space-y-4">
        <h2 className="text-sm font-semibold">Setup steps</h2>
        <ol className="list-decimal space-y-3 pl-5 text-sm text-muted-foreground">
          <li>
            Plug the streaming stick into the LCD HDMI port and connect it to
            store Wi‑Fi.
          </li>
          <li>
            Open the stick’s browser (Silk on Fire Stick, Chrome on Android TV)
            and go to the pairing URL below.
          </li>
          <li>
            On this dashboard, open{" "}
            <Link
              href="/dashboard/screens"
              className="font-medium text-foreground underline-offset-2 hover:underline"
            >
              Screens → Enter code
            </Link>
            , type the 6-digit code, set location, and choose the matching{" "}
            <strong className="font-medium text-foreground">LCD type</strong>.
          </li>
          <li>
            Publish a menu + template to that screen (landscape template for
            landscape LCDs, portrait for tall displays).
          </li>
          <li>
            On the stick, open the screen’s{" "}
            <strong className="font-medium text-foreground">Display URL</strong>{" "}
            below and switch the browser to fullscreen. Disable sleep /
            screensaver on the stick.
          </li>
        </ol>
      </section>

      <section className="space-y-3 rounded-xl border border-border p-4">
        <h2 className="text-sm font-semibold">
          1. Pairing URL (open on the stick)
        </h2>
        <p className="text-xs text-muted-foreground">
          The TV will show a 6-digit code. Enter that code in the dashboard to
          bind the stick to a location.
        </p>
        <CopyField label="Pair URL" value={pairUrl} />
        <Button
          size="sm"
          variant="outline"
          render={<Link href="/pair" target="_blank" />}
        >
          Open /pair
        </Button>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold">2. Display URLs (per screen)</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            After pairing, open the matching URL on that stick and leave it
            fullscreen.
          </p>
        </div>

        {visibleScreens.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            No paired screens yet. Pair a stick first from{" "}
            <Link
              href="/dashboard/screens"
              className="font-medium text-foreground underline-offset-2 hover:underline"
            >
              Screens
            </Link>
            .
          </p>
        ) : (
          <div className="space-y-3">
            {visibleScreens.map((screen) => {
              const displayPath = `/display/${screen.id}`;
              const displayUrl = toAbsolute(origin, displayPath);
              return (
                <article
                  key={screen.id}
                  className="space-y-3 rounded-xl border border-border p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="font-medium tracking-tight">
                        {screen.name}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {locationName(screen.locationId)} ·{" "}
                        {lcdPresetLabel(screen.resolution, screen.orientation)}{" "}
                        · {screen.resolution}
                      </p>
                    </div>
                    <StatusBadge status={screen.status} />
                  </div>
                  <CopyField label="Display URL" value={displayUrl} />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      render={<Link href={displayPath} target="_blank" />}
                    >
                      Open display
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      render={<Link href="/dashboard/screens" />}
                    >
                      Edit LCD type
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-3 rounded-xl border border-border p-4">
        <h2 className="text-sm font-semibold">Stick tips</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
          <li>
            <span className="font-medium text-foreground">Fire Stick:</span> use
            Silk browser, bookmark the Display URL, enable fullscreen.
          </li>
          <li>
            <span className="font-medium text-foreground">
              Chromecast / Android TV:
            </span>{" "}
            use Chrome; pin or bookmark the Display URL.
          </li>
          <li>
            <span className="font-medium text-foreground">
              Best reliability:
            </span>{" "}
            Raspberry Pi or mini-PC with Chromium{" "}
            <code className="text-xs">--kiosk</code> auto-start.
          </li>
          <li>
            Match LCD type in Screens to the physical TV (e.g. Full HD
            Landscape vs Portrait) before publishing.
          </li>
          <li>
            If the stick loses Wi‑Fi briefly, the last menu stays cached on
            screen until reconnect.
          </li>
        </ul>
      </section>
    </div>
  );
}

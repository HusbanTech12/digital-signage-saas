import Link from "next/link";
import {
  CloudSun,
  Clapperboard,
  Music2,
  QrCode,
  Radio,
  Share2,
  Timer,
  Tv,
  Utensils,
  Coffee,
  Wine,
  Croissant,
  Sandwich,
  Truck,
  IceCream2,
  MonitorSmartphone,
  Wifi,
  ShieldCheck,
  RefreshCw,
  Maximize,
  Sparkles,
  Sun,
  Moon,
  Leaf,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/marketing/section-heading";

export function IntegrationsSection() {
  const items = [
    { icon: Clapperboard, label: "Video & media loops" },
    { icon: Radio, label: "Live data feeds" },
    { icon: CloudSun, label: "Weather overlays" },
    { icon: Timer, label: "Countdown timers" },
    { icon: Share2, label: "Social highlights" },
    { icon: QrCode, label: "QR promotions" },
    { icon: Music2, label: "Background audio cues" },
    { icon: Tv, label: "Channel / live TV slots" },
  ];

  return (
    <section id="integrations" className="mkt-section px-5 py-20 md:px-10 md:py-28">
      <SectionHeading
        title="Layer in the extras your floor needs"
        description="Keep the board focused on menus — then add the modules your brand actually uses."
      />
      <ul className="mx-auto mt-12 grid max-w-5xl grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4">
        {items.map(({ icon: Icon, label }) => (
          <li key={label} className="text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full border border-[var(--mkt-line)] bg-[var(--mkt-bg-elevated)]">
              <Icon className="size-5 text-[var(--mkt-accent)]" />
            </div>
            <p className="mt-3 text-sm text-[var(--mkt-fg)]">{label}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function TemplateShowcaseSection() {
  const boards = [
    { title: "Classic dual column", tone: "from-[#1a2420] to-[#0f1612]" },
    { title: "Portrait specials", tone: "from-[#241c14] to-[#120e0a]" },
    { title: "Breakfast rush", tone: "from-[#1e2218] to-[#10140e]" },
    { title: "Bar late-night", tone: "from-[#1a1520] to-[#0c0a12]" },
  ];

  return (
    <section id="templates" className="mkt-section border-t border-[var(--mkt-line)] px-5 py-20 md:px-10 md:py-28">
      <SectionHeading
        title="Layouts ready for the dinner rush"
        description="Start from a gallery board, then tune prices, photos, and promotions in minutes."
      />
      <div className="mx-auto mt-12 grid max-w-5xl gap-4 sm:grid-cols-2">
        {boards.map((board) => (
          <div
            key={board.title}
            className={`aspect-[16/10] rounded-xl bg-gradient-to-br ${board.tone} p-5 ring-1 ring-[var(--mkt-line)]`}
          >
            <p className="text-xs tracking-[0.2em] text-[var(--mkt-muted)] uppercase">
              Template
            </p>
            <p className="font-display mt-2 text-xl">{board.title}</p>
            <div className="mt-6 space-y-2 opacity-70">
              <div className="h-2 w-3/4 rounded bg-white/15" />
              <div className="h-2 w-1/2 rounded bg-white/10" />
              <div className="h-2 w-2/3 rounded bg-white/10" />
            </div>
          </div>
        ))}
      </div>
      {/* TODO: Replace placeholder trust metrics with verified product metrics */}
      <div className="mx-auto mt-12 flex max-w-3xl flex-wrap justify-center gap-8 border-t border-[var(--mkt-line)] pt-8 text-center">
        <Stat label="Locations managed" value="TODO" />
        <Stat label="Menus published weekly" value="TODO" />
        <Stat label="Operator satisfaction" value="TODO" />
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-display text-2xl font-semibold text-[var(--mkt-accent)]">
        {value}
      </p>
      <p className="mt-1 text-xs text-[var(--mkt-muted)]">{label}</p>
    </div>
  );
}

export function IndustriesSection() {
  const industries = [
    { icon: Utensils, label: "Restaurants" },
    { icon: Coffee, label: "Cafes" },
    { icon: Wine, label: "Bars" },
    { icon: Croissant, label: "Bakeries" },
    { icon: Sandwich, label: "Delis" },
    { icon: Truck, label: "Food trucks" },
    { icon: IceCream2, label: "Dessert shops" },
    { icon: Leaf, label: "Grocery cafes" },
  ];

  return (
    <section id="industries" className="mkt-section px-5 py-20 md:px-10 md:py-28">
      <SectionHeading
        title="Built for foodservice floors"
        description="From a single counter to a multi-site brand — same workflow, clearer boards."
      />
      <ul className="mx-auto mt-12 grid max-w-4xl grid-cols-2 gap-4 sm:grid-cols-4">
        {industries.map(({ icon: Icon, label }) => (
          <li
            key={label}
            className="flex flex-col items-center gap-3 rounded-xl border border-[var(--mkt-line)] bg-[var(--mkt-bg-elevated)]/60 px-4 py-6"
          >
            <Icon className="size-6 text-[var(--mkt-warm)]" />
            <span className="text-sm">{label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function WhatYouGetSection() {
  const columns = [
    {
      title: "Design + software + device path",
      body: "A browser-based designer, a cloud dashboard, and a simple kiosk player that runs on hardware you already own.",
    },
    {
      title: "Support that respects service hours",
      body: "Clear pairing, publish, and recovery steps so a board issue never becomes a dinner-service mystery.",
    },
    {
      title: "Setup measured in minutes",
      body: "Create an org, pair a screen with a code, publish a menu — no native TV app install required.",
    },
  ];

  return (
    <section
      id="what-you-get"
      className="mkt-section border-y border-[var(--mkt-line)] bg-[var(--mkt-fg)] px-5 py-20 text-[var(--mkt-bg)] md:px-10 md:py-28"
    >
      <SectionHeading
        light
        title="Everything you need to go live"
        description="One stack for design, control, and the screen on the wall."
      />
      <div className="mx-auto mt-12 grid max-w-5xl gap-10 md:grid-cols-3">
        {columns.map((col) => (
          <div key={col.title}>
            <h3 className="font-display text-xl font-semibold">{col.title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-[var(--mkt-bg)]/70">
              {col.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function DeviceCompatibilitySection() {
  const devices = [
    "Your existing smart TV browser",
    "Raspberry Pi / mini-PC kiosk",
    "Fire Stick (Silk)",
    "Android TV browser boxes",
    "Chromebook / ChromeOS kiosk",
    "Windows / macOS Chromium",
  ];

  return (
    <section id="devices" className="mkt-section px-5 py-20 md:px-10 md:py-28">
      <SectionHeading
        title="Works where your screens already are"
        description="The player is a browser tab in kiosk mode — bring your own device, or standardize later."
      />
      <ul className="mx-auto mt-12 grid max-w-3xl gap-3 sm:grid-cols-2">
        {devices.map((device) => (
          <li
            key={device}
            className="border-b border-[var(--mkt-line)] px-1 py-3 text-sm text-[var(--mkt-fg)]"
          >
            {device}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function WhyDeviceSection() {
  const features = [
    {
      icon: ShieldCheck,
      title: "Stable playback",
      body: "A lean client focused on rendering menus — not a bloated media center.",
    },
    {
      icon: RefreshCw,
      title: "Offline resilience",
      body: "Last published board stays cached locally so brief outages never blank the wall.",
    },
    {
      icon: MonitorSmartphone,
      title: "Remote management",
      body: "Pair, rename, reassign, and republish from the dashboard without touching the TV.",
    },
    {
      icon: Maximize,
      title: "Resolution aware",
      body: "Landscape and portrait layouts sized for counter tablets and lobby displays.",
    },
    {
      icon: Wifi,
      title: "Simple connectivity",
      body: "If the browser can reach your account, the board can receive updates.",
    },
  ];

  return (
    <section id="reliability" className="mkt-section border-t border-[var(--mkt-line)] px-5 py-20 md:px-10 md:py-28">
      <SectionHeading
        title="Why teams trust the player"
        description="Reliability features that matter when guests are already in line."
      />
      <ul className="mx-auto mt-12 max-w-3xl space-y-6">
        {features.map(({ icon: Icon, title, body }) => (
          <li key={title} className="flex gap-4">
            <Icon className="mt-0.5 size-5 shrink-0 text-[var(--mkt-accent)]" />
            <div>
              <h3 className="font-medium">{title}</h3>
              <p className="mt-1 text-sm text-[var(--mkt-muted)]">{body}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function DesignerShowcaseSection() {
  return (
    <section id="designer" className="mkt-section px-5 py-20 md:px-10 md:py-28">
      <div className="mx-auto grid max-w-5xl items-center gap-10 lg:grid-cols-2">
        <div>
          <h2 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
            Drag, drop, publish
          </h2>
          <p className="mt-4 text-[var(--mkt-muted)] text-pretty">
            The menu designer lets you place headings, price rows, and promo
            blocks on a live canvas. Save a template, bind a menu, and push it
            to every assigned screen.
          </p>
        </div>
        <div className="aspect-[4/3] rounded-xl border border-[var(--mkt-line)] bg-[var(--mkt-bg-elevated)] p-4">
          <div className="flex h-full flex-col rounded-lg bg-[#111] p-4">
            <div className="mb-3 flex gap-2">
              <span className="h-2 w-16 rounded bg-[var(--mkt-accent)]/40" />
              <span className="h-2 w-10 rounded bg-white/10" />
            </div>
            <div className="grid flex-1 grid-cols-[1fr_2fr] gap-3">
              <div className="space-y-2 rounded bg-white/5 p-2">
                <div className="h-2 w-full rounded bg-white/15" />
                <div className="h-2 w-4/5 rounded bg-white/10" />
                <div className="h-2 w-3/5 rounded bg-white/10" />
              </div>
              <div className="rounded bg-[#1a1a1a] p-3 ring-1 ring-white/10">
                <p className="font-display text-lg text-[var(--mkt-fg)]">
                  Lunch Board
                </p>
                <div className="mt-4 space-y-2">
                  <div className="h-2 w-full rounded bg-white/20" />
                  <div className="h-2 w-5/6 rounded bg-white/10" />
                  <div className="h-2 w-4/6 rounded bg-white/10" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function RemoteControlSection() {
  return (
    <section
      id="remote"
      className="mkt-section border-y border-[var(--mkt-line)] px-5 py-20 md:px-10 md:py-28"
    >
      <SectionHeading
        title="Change prices where the decision happens"
        description="Update from the floor or sync from the POS — the board follows."
      />
      <div className="mx-auto mt-12 grid max-w-5xl gap-8 md:grid-cols-2">
        <div className="rounded-xl border border-[var(--mkt-line)] bg-[var(--mkt-bg-elevated)] p-6">
          <MonitorSmartphone className="size-6 text-[var(--mkt-accent)]" />
          <h3 className="font-display mt-4 text-2xl">On-the-go control</h3>
          <p className="mt-3 text-sm text-[var(--mkt-muted)]">
            Adjust promos and availability from a phone-friendly dashboard when
            you are away from the back office. {/* TODO: native app timing */}
          </p>
          <div className="mt-6 aspect-[9/16] max-w-[180px] rounded-2xl border border-[var(--mkt-line)] bg-[#0a0f0c] p-3">
            <div className="h-full rounded-xl bg-white/5 p-3">
              <div className="h-2 w-1/2 rounded bg-[var(--mkt-accent)]/50" />
              <div className="mt-4 space-y-2">
                <div className="h-8 rounded bg-white/10" />
                <div className="h-8 rounded bg-white/10" />
              </div>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-[var(--mkt-line)] bg-[var(--mkt-bg-elevated)] p-6">
          <RefreshCw className="size-6 text-[var(--mkt-warm)]" />
          <h3 className="font-display mt-4 text-2xl">POS-connected prices</h3>
          <p className="mt-3 text-sm text-[var(--mkt-muted)]">
            Adapter-based integrations normalize price and availability events
            into your menu items so boards stay honest during 86s and happy
            hours.
          </p>
          <div className="mt-6 aspect-video rounded-xl border border-[var(--mkt-line)] bg-[#0a0f0c] p-4">
            <p className="text-xs tracking-widest text-[var(--mkt-muted)] uppercase">
              Sync event
            </p>
            <p className="mt-3 font-mono text-sm text-[var(--mkt-accent)]">
              Harbor Latte → $4.75
            </p>
            <p className="mt-1 text-xs text-[var(--mkt-muted)]">
              Availability: in stock
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function MultiAdminSection() {
  const roles = [
    {
      title: "Super Admin",
      body: "Owns the organization, billing surface, and every location.",
    },
    {
      title: "Admin",
      body: "Runs multiple sites — menus, screens, and publishes across assigned locations.",
    },
    {
      title: "Location Manager",
      body: "Keeps a single site sharp: pair screens, tweak items, push updates.",
    },
  ];

  return (
    <section id="roles" className="mkt-section px-5 py-20 md:px-10 md:py-28">
      <div className="mx-auto grid max-w-5xl items-start gap-10 lg:grid-cols-2">
        <div className="aspect-[16/11] rounded-xl border border-[var(--mkt-line)] bg-[var(--mkt-bg-elevated)] p-4">
          <div className="flex h-full gap-3 rounded-lg bg-[#0e1411] p-3">
            <div className="w-1/3 space-y-2 border-r border-[var(--mkt-line)] pr-3">
              <div className="h-2 w-16 rounded bg-[var(--mkt-accent)]/40" />
              <div className="h-2 w-12 rounded bg-white/15" />
              <div className="h-2 w-14 rounded bg-white/10" />
              <div className="h-2 w-10 rounded bg-white/10" />
            </div>
            <div className="flex-1 space-y-3 pt-1">
              <div className="h-3 w-1/3 rounded bg-white/20" />
              <div className="grid grid-cols-3 gap-2">
                <div className="aspect-square rounded bg-white/5" />
                <div className="aspect-square rounded bg-white/5" />
                <div className="aspect-square rounded bg-white/5" />
              </div>
            </div>
          </div>
        </div>
        <div>
          <h2 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
            Roles that match how kitchens actually run
          </h2>
          <ul className="mt-8 space-y-5">
            {roles.map((role) => (
              <li key={role.title}>
                <h3 className="font-medium text-[var(--mkt-accent)]">
                  {role.title}
                </h3>
                <p className="mt-1 text-sm text-[var(--mkt-muted)]">
                  {role.body}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

export function ScaleSection() {
  return (
    <section className="mkt-section px-5 py-24 md:px-10">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="font-display text-3xl font-semibold tracking-tight text-balance md:text-5xl">
          One screen behind the counter — or a thousand across the map
        </h2>
        <p className="mt-5 text-[var(--mkt-muted)] text-pretty">
          The same dashboard that pairs your first TV scales to multi-location
          fleets without changing how you publish.
        </p>
      </div>
    </section>
  );
}

export function AiSection() {
  return (
    <section
      id="ai"
      className="mkt-section border-y border-[var(--mkt-line)] px-5 py-20 md:px-10 md:py-24"
    >
      <div className="mx-auto flex max-w-3xl flex-col items-start gap-4 md:flex-row md:items-center md:gap-8">
        <Sparkles className="size-8 shrink-0 text-[var(--mkt-accent)]" />
        <div>
          <h2 className="font-display text-3xl font-semibold tracking-tight">
            AI-assisted menu layouts
          </h2>
          <p className="mt-3 text-[var(--mkt-muted)] text-pretty">
            Describe a board or drop in a photo of today&apos;s specials — get a
            starting layout you can refine in the designer before publishing.
          </p>
        </div>
      </div>
    </section>
  );
}

export function ThemeAutomationSection() {
  const themes = [
    { icon: Sun, label: "Breakfast", detail: "06:00 – 11:00" },
    { icon: Utensils, label: "Lunch", detail: "11:00 – 15:00" },
    { icon: Moon, label: "Dinner", detail: "15:00 – close" },
    { icon: Leaf, label: "Seasonal", detail: "Holiday ranges" },
  ];

  return (
    <section id="themes" className="mkt-section px-5 py-20 md:px-10 md:py-28">
      <SectionHeading
        title="Boards that change with the clock"
        description="Schedule breakfast, lunch, dinner, and seasonal themes so the wall stays current without a midnight login."
      />
      <ul className="mx-auto mt-12 grid max-w-4xl grid-cols-2 gap-4 md:grid-cols-4">
        {themes.map(({ icon: Icon, label, detail }) => (
          <li
            key={label}
            className="rounded-xl border border-[var(--mkt-line)] px-4 py-6 text-center"
          >
            <Icon className="mx-auto size-5 text-[var(--mkt-warm)]" />
            <p className="mt-3 font-medium">{label}</p>
            <p className="mt-1 text-xs text-[var(--mkt-muted)]">{detail}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function WhyDigitalSection() {
  return (
    <section
      id="why"
      className="mkt-section border-t border-[var(--mkt-line)] bg-[var(--mkt-bg-elevated)] px-5 py-20 md:px-10 md:py-28"
    >
      <SectionHeading
        title="Why operators move menus off paper"
        description="Industry findings — cited where available. Fill in product-specific metrics when you have them."
      />
      <ul className="mx-auto mt-12 grid max-w-5xl gap-6 md:grid-cols-2">
        <li className="border-b border-[var(--mkt-line)] pb-5">
          {/* TODO: Confirm preferred citation / latest figure for in-store decision research */}
          <p className="font-display text-3xl text-[var(--mkt-accent)]">~70%</p>
          <p className="mt-2 text-sm text-[var(--mkt-muted)]">
            of purchase decisions are made in-store (commonly cited POPAI /
            shopper-marketing research). Verify source before using in paid ads.
          </p>
        </li>
        <li className="border-b border-[var(--mkt-line)] pb-5">
          {/* TODO: Add verified attention / dwell-time study for digital vs static menus */}
          <p className="font-display text-3xl text-[var(--mkt-accent)]">TODO</p>
          <p className="mt-2 text-sm text-[var(--mkt-muted)]">
            Attention capture vs static boards — add a cited study figure here.
          </p>
        </li>
        <li className="border-b border-[var(--mkt-line)] pb-5">
          {/* TODO: Add verified revenue / upsell lift figure with source */}
          <p className="font-display text-3xl text-[var(--mkt-accent)]">TODO</p>
          <p className="mt-2 text-sm text-[var(--mkt-muted)]">
            Revenue influence from promoted items — replace with a sourced
            percentage.
          </p>
        </li>
        <li className="border-b border-[var(--mkt-line)] pb-5">
          {/* TODO: Add verified guest satisfaction metric if available */}
          <p className="font-display text-3xl text-[var(--mkt-accent)]">TODO</p>
          <p className="mt-2 text-sm text-[var(--mkt-muted)]">
            Guest satisfaction / clarity of pricing — add when you have data.
          </p>
        </li>
      </ul>
    </section>
  );
}

export function TestimonialsSection() {
  return (
    <section id="stories" className="mkt-section px-5 py-20 md:px-10 md:py-28">
      <SectionHeading
        title="Operators, in their words"
        description="Real quotes will land here — we are not inventing testimonials."
      />
      <div className="mx-auto mt-12 grid max-w-5xl gap-6 md:grid-cols-3">
        {[1, 2, 3].map((slot) => (
          <blockquote
            key={slot}
            className="rounded-xl border border-dashed border-[var(--mkt-line)] p-6"
          >
            {/* TODO: Replace with real client quote, name, role, and business */}
            <p className="text-sm text-[var(--mkt-muted)] italic">
              &ldquo;Quote placeholder — add an approved customer story.&rdquo;
            </p>
            <footer className="mt-4 text-xs text-[var(--mkt-muted)]">
              — Name, Role · Business
            </footer>
          </blockquote>
        ))}
      </div>
    </section>
  );
}

export function ContactFooterSection() {
  return (
    <section
      id="contact"
      className="mkt-section border-t border-[var(--mkt-line)] px-5 pt-20 pb-10 md:px-10"
    >
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
          Put a live board on the wall this week
        </h2>
        <p className="mt-4 text-[var(--mkt-muted)]">
          Create an account, pair a screen, and publish your first menu.
        </p>
        <div className="mt-8">
          <Button
            size="lg"
            className="bg-[var(--mkt-accent)] text-[#152010] hover:bg-[var(--mkt-accent)]/90"
            render={<Link href="/sign-up" />}
          >
            Start free
          </Button>
        </div>
      </div>

      <footer className="mx-auto mt-20 flex max-w-5xl flex-col gap-6 border-t border-[var(--mkt-line)] pt-8 text-sm text-[var(--mkt-muted)] md:flex-row md:justify-between">
        <div>
          <p className="font-display text-lg text-[var(--mkt-fg)]">Signage</p>
          <p className="mt-1">Digital menu boards for restaurants & retail.</p>
          {/* TODO: Add legal entity name and HQ address */}
          <p className="mt-3">Company details — TODO</p>
        </div>
        <div className="space-y-1">
          {/* TODO: Replace with real support / sales emails */}
          <p>hello@example.com — TODO</p>
          <p>support@example.com — TODO</p>
        </div>
        <div className="flex gap-4">
          <Link href="/sign-in" className="hover:text-[var(--mkt-fg)]">
            Sign in
          </Link>
          <Link href="/dashboard" className="hover:text-[var(--mkt-fg)]">
            Dashboard
          </Link>
        </div>
      </footer>
      <p className="mx-auto mt-8 max-w-5xl pb-6 text-xs text-[var(--mkt-muted)]/70">
        © {new Date().getFullYear()} Signage. All rights reserved.
      </p>
    </section>
  );
}

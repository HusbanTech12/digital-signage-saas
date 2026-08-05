import Link from "next/link";
import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <section className="relative min-h-[100svh] overflow-hidden">
      {/* Full-bleed visual plane */}
      <div
        aria-hidden
        className="mkt-hero-visual absolute inset-0 bg-[radial-gradient(ellipse_at_20%_20%,#24352a_0%,transparent_45%),radial-gradient(ellipse_at_80%_70%,#2a2418_0%,transparent_40%),linear-gradient(160deg,#0c1210_0%,#152018_55%,#0c1210_100%)]"
      />
      <div
        aria-hidden
        className="mkt-glow pointer-events-none absolute -top-24 right-[-10%] h-[50vh] w-[50vh] rounded-full bg-[var(--mkt-accent)]/15 blur-3xl"
      />

      {/* Dominant board mock as edge-to-edge atmosphere layer */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 top-[42%] opacity-40 md:top-[28%] md:opacity-55"
      >
        <div className="mx-auto h-full max-w-6xl px-4">
          <div className="h-full rounded-t-[1.5rem] border border-[var(--mkt-line)] bg-[#101814]/90 p-6 shadow-[0_-40px_120px_rgba(0,0,0,0.45)] md:p-10">
            <div className="grid h-full grid-cols-2 gap-6 md:gap-10">
              <div className="space-y-4 border-r border-[var(--mkt-line)] pr-4 md:pr-8">
                <p className="text-xs tracking-[0.25em] text-[var(--mkt-warm)] uppercase">
                  Lunch board
                </p>
                <div className="space-y-3 text-sm md:text-base">
                  <Row name="Harbor Latte" price="4.75" />
                  <Row name="Avocado Toast" price="11.50" />
                  <Row name="Seasonal Soup" price="8.00" />
                  <Row name="Citrus Salad" price="13.00" />
                </div>
              </div>
              <div className="space-y-4">
                <p className="text-xs tracking-[0.25em] text-[var(--mkt-accent)] uppercase">
                  Specials
                </p>
                <div className="space-y-3 text-sm md:text-base">
                  <Row name="Sunrise Burrito" price="9.25" />
                  <Row name="Smoked Salmon Bowl" price="16.00" />
                  <Row name="House Lemonade" price="3.50" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-5xl flex-col justify-center px-5 pb-40 pt-28 md:px-10 md:pb-48">
        <p className="mkt-animate-in font-display text-5xl font-semibold tracking-tight text-[var(--mkt-fg)] sm:text-6xl md:text-7xl">
          Signage
        </p>
        <p className="mkt-animate-in mkt-animate-in-delay-1 mt-3 text-sm tracking-[0.18em] text-[var(--mkt-accent)] uppercase md:text-base">
          Menu boards that update with your kitchen
        </p>
        <h1 className="mkt-animate-in mkt-animate-in-delay-2 mt-6 max-w-3xl font-display text-3xl font-semibold tracking-tight text-balance sm:text-4xl md:text-5xl">
          Turn any TV into a live digital menu board
        </h1>
        <p className="mkt-animate-in mkt-animate-in-delay-3 mt-4 max-w-xl text-base text-[var(--mkt-muted)] text-pretty md:text-lg">
          Design once, publish instantly, and keep every location in sync —
          without expensive proprietary players.
        </p>
        <div className="mkt-animate-in mkt-animate-in-delay-3 mt-8">
          <Button
            size="lg"
            className="bg-[var(--mkt-accent)] px-6 text-[#152010] hover:bg-[var(--mkt-accent)]/90"
            render={<Link href="/sign-up" />}
          >
            Start free
          </Button>
        </div>
      </div>
    </section>
  );
}

function Row({ name, price }: { name: string; price: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-[var(--mkt-line)] pb-2">
      <span>{name}</span>
      <span className="tabular-nums text-[var(--mkt-muted)]">${price}</span>
    </div>
  );
}

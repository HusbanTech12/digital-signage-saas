"use client";

import Link from "next/link";
import { Show } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";

export function MarketingNav() {
  return (
    <header className="absolute inset-x-0 top-0 z-30 flex items-center justify-between px-5 py-5 md:px-10">
      <Link
        href="/landing"
        className="font-display text-2xl font-semibold tracking-tight text-[var(--mkt-fg)] md:text-3xl"
      >
        Signage
      </Link>
      <nav className="flex items-center gap-2 md:gap-3">
        <a
          href="#contact"
          className="hidden text-sm text-[var(--mkt-muted)] transition-colors hover:text-[var(--mkt-fg)] sm:inline"
        >
          Contact
        </a>
        <Show when="signed-out">
          <Button
            variant="outline"
            className="border-[var(--mkt-line)] bg-transparent text-[var(--mkt-fg)] hover:bg-white/5"
            render={<Link href="/" />}
          >
            Sign in
          </Button>
          <Button
            className="bg-[var(--mkt-accent)] text-[#152010] hover:bg-[var(--mkt-accent)]/90"
            render={<Link href="/?mode=sign-up" />}
          >
            Start free
          </Button>
        </Show>
        <Show when="signed-in">
          <Button
            className="bg-[var(--mkt-accent)] text-[#152010] hover:bg-[var(--mkt-accent)]/90"
            render={<Link href="/dashboard" />}
          >
            Dashboard
          </Button>
        </Show>
      </nav>
    </header>
  );
}

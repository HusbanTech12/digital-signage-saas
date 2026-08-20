import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in — Signage",
  description: "Log in or create an account to manage digital menu boards.",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-80"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -20%, color-mix(in oklab, var(--foreground) 8%, transparent), transparent)",
        }}
      />
      {children}
    </div>
  );
}

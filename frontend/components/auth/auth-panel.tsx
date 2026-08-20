"use client";

import { SignIn } from "@clerk/nextjs";
import { MonitorPlay } from "lucide-react";

const clerkAppearance = {
  elements: {
    rootBox: "mx-auto w-full",
    card: "shadow-none border border-border bg-background",
    headerTitle: "text-foreground",
    headerSubtitle: "text-muted-foreground",
    socialButtonsBlockButton:
      "border-border bg-background text-foreground hover:bg-muted",
    formButtonPrimary:
      "bg-primary text-primary-foreground hover:bg-primary/90",
    footerActionLink: "text-primary hover:text-primary/80",
  },
};

export function AuthPanel() {
  return (
    <div className="w-full max-w-md space-y-6">
      <div className="text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-foreground text-background">
          <MonitorPlay className="size-6" />
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Signage</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Digital menu boards for restaurants — sign in to open your dashboard.
        </p>
      </div>

      <SignIn
        routing="hash"
        fallbackRedirectUrl="/dashboard"
        forceRedirectUrl="/dashboard"
        signUpUrl="/sign-up"
        appearance={clerkAppearance}
      />
    </div>
  );
}

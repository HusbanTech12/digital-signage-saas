"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { SignInButton, SignUpButton, useAuth, useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { useApiAuthToken } from "@/lib/api/auth-token";
import { acceptInvitation, previewInvitation } from "@/lib/data/team";
import type { InvitationPreview } from "@/lib/api/team";
import { ROLE_LABELS } from "@/lib/mock-session";
import { useLiveApi } from "@/lib/api/config";

export default function AcceptInvitePage() {
  const params = useParams<{ token: string }>();
  const token = typeof params.token === "string" ? params.token : "";
  const router = useRouter();
  const { isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();
  const { getApiToken } = useApiAuthToken();

  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await previewInvitation(token);
        if (!cancelled) setPreview(data);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Invalid invitation link",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (token) void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleAccept() {
    setAccepting(true);
    setError(null);
    try {
      const authToken = await getApiToken();
      await acceptInvitation(authToken, token, {
        clerkUserId: user?.id ?? `clerk_${Date.now()}`,
        email: user?.primaryEmailAddress?.emailAddress ?? preview?.email ?? "",
        name: user?.fullName ?? preview?.name ?? "New member",
      });
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not accept invitation");
    } finally {
      setAccepting(false);
    }
  }

  return (
    <div className="flex min-h-full flex-1 items-center justify-center bg-background px-4 py-16">
      <div className="w-full max-w-md space-y-6 rounded-xl border border-border p-6 shadow-sm">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Team invitation
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Join organization
          </h1>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading invitation…</p>
        ) : null}

        {error && !preview ? (
          <div className="space-y-3">
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
            <Button variant="outline" render={<Link href="/" />}>
              Go to sign in
            </Button>
          </div>
        ) : null}

        {preview ? (
          <div className="space-y-4">
            {!preview.valid ? (
              <p className="text-sm text-destructive" role="alert">
                {preview.error ?? "This invitation is no longer valid."}
              </p>
            ) : null}

            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Organization</dt>
                <dd className="font-medium">{preview.organizationName}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Invited email</dt>
                <dd className="font-medium">{preview.email}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Role</dt>
                <dd className="font-medium">
                  {ROLE_LABELS[preview.role] ?? preview.roleLabel}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Locations</dt>
                <dd className="font-medium">
                  {preview.locationNames.length
                    ? preview.locationNames.join(", ")
                    : "All locations"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Expires</dt>
                <dd className="font-medium">
                  {new Date(preview.expiresAt).toLocaleString()}
                </dd>
              </div>
              {preview.message ? (
                <div>
                  <dt className="text-xs text-muted-foreground">Message</dt>
                  <dd className="font-medium">{preview.message}</dd>
                </div>
              ) : null}
            </dl>

            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}

            {preview.valid ? (
              !isLoaded ? (
                <p className="text-sm text-muted-foreground">Checking session…</p>
              ) : isSignedIn || !useLiveApi() ? (
                <Button
                  className="w-full"
                  disabled={accepting}
                  onClick={() => void handleAccept()}
                >
                  {accepting ? "Accepting…" : "Accept invitation"}
                </Button>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Sign in with <strong>{preview.email}</strong> to accept, or
                    create an account with that email.
                  </p>
                  <div className="flex flex-col gap-2">
                    <SignInButton
                      mode="modal"
                      forceRedirectUrl={`/invite/${token}`}
                    >
                      <Button className="w-full">Sign in to accept</Button>
                    </SignInButton>
                    <SignUpButton
                      mode="modal"
                      forceRedirectUrl={`/invite/${token}`}
                    >
                      <Button className="w-full" variant="outline">
                        Create account
                      </Button>
                    </SignUpButton>
                  </div>
                </div>
              )
            ) : (
              <Button variant="outline" render={<Link href="/" />}>
                Back to sign in
              </Button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

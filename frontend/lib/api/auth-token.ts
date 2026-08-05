"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback } from "react";
import { DEV_CLERK_USER_BY_ROLE, useLiveApi } from "@/lib/api/config";
import { useMockSession } from "@/components/providers/mock-session-provider";
import type { Role } from "@/lib/types/schema";

/**
 * Resolve a Bearer token for FastAPI.
 * Prefers a real Clerk session JWT; falls back to `dev:<clerkUserId>` for
 * local role-switcher testing against DEV_AUTH_BYPASS.
 */
export function useApiAuthToken() {
  const { getToken, isSignedIn } = useAuth();
  const { role, session } = useMockSession();
  const live = useLiveApi();

  const getApiToken = useCallback(async (): Promise<string | null> => {
    if (!live) return null;

    if (isSignedIn) {
      try {
        const token = await getToken();
        if (token) return token;
      } catch {
        /* fall through to dev bypass */
      }
    }

    const clerkUserId =
      session.user.clerkUserId ||
      DEV_CLERK_USER_BY_ROLE[role as Role] ||
      DEV_CLERK_USER_BY_ROLE.super_admin;
    return `dev:${clerkUserId}`;
  }, [live, isSignedIn, getToken, session.user.clerkUserId, role]);

  return { getApiToken, useLiveApi: live };
}

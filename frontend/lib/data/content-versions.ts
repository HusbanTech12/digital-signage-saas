import {
  listContentVersionsApi,
  restoreContentVersionApi,
} from "@/lib/api/content-versions";
import { useLiveApi } from "@/lib/api/config";
import { withProvisioned } from "@/lib/data/tenant";
import type { ContentEntityType, ContentVersion } from "@/lib/types/schema";

type Token = string | null | undefined;

function requireToken(token: Token): string {
  if (!token) throw new Error("Missing API auth token");
  return token;
}

export async function listContentVersions(
  token: Token,
  params: { entityType: ContentEntityType; entityId: string },
): Promise<{ versions: ContentVersion[]; total: number }> {
  if (!useLiveApi()) return { versions: [], total: 0 };
  const t = requireToken(token);
  return withProvisioned(t, () => listContentVersionsApi(t, params));
}

export async function restoreContentVersion(
  token: Token,
  versionId: string,
): Promise<{ entityType: string; entityId: string; restoredVersion: number }> {
  if (!useLiveApi()) {
    throw new Error("Version restore requires live API");
  }
  const t = requireToken(token);
  return withProvisioned(t, () => restoreContentVersionApi(t, versionId));
}

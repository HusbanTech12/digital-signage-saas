import { apiFetch } from "@/lib/api/client";
import type { ContentEntityType, ContentVersion } from "@/lib/types/schema";

type Token = string;

export type ContentVersionListDto = {
  versions: ContentVersion[];
  total: number;
};

export type RestoreVersionDto = {
  entityType: string;
  entityId: string;
  restoredVersion: number;
};

export function listContentVersionsApi(
  token: Token,
  params: { entityType: ContentEntityType; entityId: string; limit?: number },
) {
  const search = new URLSearchParams();
  search.set("entityType", params.entityType);
  search.set("entityId", params.entityId);
  if (params.limit) search.set("limit", String(params.limit));
  return apiFetch<ContentVersionListDto>(
    `/api/v1/content-versions?${search.toString()}`,
    { token },
  );
}

export function getContentVersionApi(token: Token, versionId: string) {
  return apiFetch<ContentVersion>(`/api/v1/content-versions/${versionId}`, {
    token,
  });
}

export function restoreContentVersionApi(token: Token, versionId: string) {
  return apiFetch<RestoreVersionDto>(
    `/api/v1/content-versions/${versionId}/restore`,
    { token, method: "POST" },
  );
}

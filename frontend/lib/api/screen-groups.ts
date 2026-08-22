import { apiFetch } from "@/lib/api/client";

export type ScreenGroupLayout = "2x2" | "3x3" | "4x4" | "custom";
export type ScreenGroupContentMode = "shared" | "tiled";

export type ScreenGroupMember = {
  id: string;
  screenGroupId: string;
  screenId: string;
  organizationId: string;
  rowIndex: number;
  colIndex: number;
  screenName?: string | null;
  screenStatus?: string | null;
  lastHeartbeat?: string | null;
  createdAt: string;
};

export type ScreenGroup = {
  id: string;
  organizationId: string;
  locationId: string;
  name: string;
  layout: string;
  rows: number;
  cols: number;
  contentMode: string;
  activeMenuId?: string | null;
  activeTemplateId?: string | null;
  activePlaylistId?: string | null;
  syncEpochMs?: number | null;
  bezelCompensationPct?: number;
  members: ScreenGroupMember[];
  onlineMemberCount: number;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ScreenGroupCreateInput = {
  name: string;
  locationId: string;
  layout?: ScreenGroupLayout;
  rows?: number;
  cols?: number;
  contentMode?: ScreenGroupContentMode;
  bezelCompensationPct?: number;
};

export type ScreenGroupUpdateInput = {
  name?: string;
  layout?: ScreenGroupLayout;
  rows?: number;
  cols?: number;
  contentMode?: ScreenGroupContentMode;
  bezelCompensationPct?: number;
  activeMenuId?: string | null;
  activeTemplateId?: string | null;
  activePlaylistId?: string | null;
};

type AuthToken = string;

export function listScreenGroupsApi(token: AuthToken) {
  return apiFetch<{ screenGroups: ScreenGroup[]; total: number }>(
    "/api/v1/screen-groups",
    { token },
  );
}

export function getScreenGroupApi(token: AuthToken, groupId: string) {
  return apiFetch<ScreenGroup>(`/api/v1/screen-groups/${groupId}`, { token });
}

export function createScreenGroupApi(
  token: AuthToken,
  body: ScreenGroupCreateInput,
) {
  return apiFetch<ScreenGroup>("/api/v1/screen-groups", {
    method: "POST",
    token,
    body,
  });
}

export function updateScreenGroupApi(
  token: AuthToken,
  groupId: string,
  body: ScreenGroupUpdateInput,
) {
  return apiFetch<ScreenGroup>(`/api/v1/screen-groups/${groupId}`, {
    method: "PATCH",
    token,
    body,
  });
}

export function deleteScreenGroupApi(token: AuthToken, groupId: string) {
  return apiFetch<void>(`/api/v1/screen-groups/${groupId}`, {
    method: "DELETE",
    token,
  });
}

export function replaceScreenGroupMembersApi(
  token: AuthToken,
  groupId: string,
  members: { screenId: string; rowIndex: number; colIndex: number }[],
) {
  return apiFetch<ScreenGroup>(`/api/v1/screen-groups/${groupId}/members`, {
    method: "PUT",
    token,
    body: { members },
  });
}

export function publishScreenGroupApi(
  token: AuthToken,
  groupId: string,
  body: {
    playlistId?: string | null;
    menuId?: string | null;
    templateId?: string | null;
    contentMode?: ScreenGroupContentMode;
  },
) {
  return apiFetch<ScreenGroup>(`/api/v1/screen-groups/${groupId}/publish`, {
    method: "POST",
    token,
    body,
  });
}

export function syncScreenGroupApi(token: AuthToken, groupId: string) {
  return apiFetch<{
    screenGroupId: string;
    syncEpochMs: number;
    memberCount: number;
  }>(`/api/v1/screen-groups/${groupId}/sync`, {
    method: "POST",
    token,
  });
}

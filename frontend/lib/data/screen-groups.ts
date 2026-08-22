import {
  createScreenGroupApi,
  deleteScreenGroupApi,
  getScreenGroupApi,
  listScreenGroupsApi,
  publishScreenGroupApi,
  replaceScreenGroupMembersApi,
  syncScreenGroupApi,
  updateScreenGroupApi,
  type ScreenGroup,
  type ScreenGroupCreateInput,
  type ScreenGroupUpdateInput,
} from "@/lib/api/screen-groups";
import { useLiveApi } from "@/lib/api/config";
import { withProvisioned } from "@/lib/data/tenant";

type Token = string | null | undefined;

function requireToken(token: Token): string {
  if (!token) throw new Error("Missing API auth token");
  return token;
}

export async function listScreenGroups(
  token: Token,
): Promise<{ screenGroups: ScreenGroup[]; total: number }> {
  if (!useLiveApi()) return { screenGroups: [], total: 0 };
  const t = requireToken(token);
  return withProvisioned(t, () => listScreenGroupsApi(t));
}

export async function getScreenGroup(
  token: Token,
  groupId: string,
): Promise<ScreenGroup> {
  if (!useLiveApi()) throw new Error("Screen groups require live API");
  const t = requireToken(token);
  return withProvisioned(t, () => getScreenGroupApi(t, groupId));
}

export async function createScreenGroup(
  input: ScreenGroupCreateInput,
  token: Token,
): Promise<ScreenGroup> {
  if (!useLiveApi()) throw new Error("Screen groups require live API");
  const t = requireToken(token);
  return withProvisioned(t, () => createScreenGroupApi(t, input));
}

export async function updateScreenGroup(
  groupId: string,
  input: ScreenGroupUpdateInput,
  token: Token,
): Promise<ScreenGroup> {
  if (!useLiveApi()) throw new Error("Screen groups require live API");
  const t = requireToken(token);
  return withProvisioned(t, () => updateScreenGroupApi(t, groupId, input));
}

export async function deleteScreenGroup(
  groupId: string,
  token: Token,
): Promise<void> {
  if (!useLiveApi()) throw new Error("Screen groups require live API");
  const t = requireToken(token);
  await withProvisioned(t, () => deleteScreenGroupApi(t, groupId));
}

export async function replaceScreenGroupMembers(
  groupId: string,
  members: { screenId: string; rowIndex: number; colIndex: number }[],
  token: Token,
): Promise<ScreenGroup> {
  if (!useLiveApi()) throw new Error("Screen groups require live API");
  const t = requireToken(token);
  return withProvisioned(t, () =>
    replaceScreenGroupMembersApi(t, groupId, members),
  );
}

export async function publishScreenGroup(
  groupId: string,
  body: {
    playlistId?: string | null;
    menuId?: string | null;
    templateId?: string | null;
    contentMode?: "shared" | "tiled";
  },
  token: Token,
): Promise<ScreenGroup> {
  if (!useLiveApi()) throw new Error("Screen groups require live API");
  const t = requireToken(token);
  return withProvisioned(t, () => publishScreenGroupApi(t, groupId, body));
}

export async function syncScreenGroup(
  groupId: string,
  token: Token,
): Promise<{ screenGroupId: string; syncEpochMs: number; memberCount: number }> {
  if (!useLiveApi()) throw new Error("Screen groups require live API");
  const t = requireToken(token);
  return withProvisioned(t, () => syncScreenGroupApi(t, groupId));
}

import {
  acceptInvitationApi,
  cancelInvitationApi,
  inviteMemberApi,
  listTeamApi,
  previewInvitationApi,
  reactivateMemberApi,
  removeMemberApi,
  resendInvitationApi,
  suspendMemberApi,
  transferOwnershipApi,
  updateMemberLocationsApi,
  updateMemberRoleApi,
  type InviteCreateResult,
  type InvitationPreview,
  type TeamListDto,
} from "@/lib/api/team";
import { useLiveApi } from "@/lib/api/config";
import { withProvisioned } from "@/lib/data/tenant";
import {
  acceptInvitationMock,
  cancelInvitationMock,
  inviteMemberMock,
  listTeamMock,
  previewInvitationMock,
  reactivateMemberMock,
  removeMemberMock,
  resendInvitationMock,
  suspendMemberMock,
  transferOwnershipMock,
  updateMemberLocationsMock,
  updateMemberRoleMock,
} from "@/lib/mock-api/store";
import type { Role } from "@/lib/types/schema";

type Token = string | null;

function requireToken(token: Token): string {
  if (!token) throw new Error("Missing API auth token");
  return token;
}

export async function listTeam(
  token: Token,
  params?: {
    q?: string;
    role?: string;
    status?: string;
    locationId?: string;
  },
): Promise<TeamListDto> {
  if (!useLiveApi()) return listTeamMock(params);
  const t = requireToken(token);
  return withProvisioned(t, () => listTeamApi(t, params));
}

export async function inviteMember(
  token: Token,
  input: {
    organizationId: string;
    name: string;
    email: string;
    role: Role;
    locationIds: string[];
    message?: string;
    invitedByUserId: string;
  },
): Promise<InviteCreateResult> {
  if (!useLiveApi()) return inviteMemberMock(input);
  const t = requireToken(token);
  return withProvisioned(t, () =>
    inviteMemberApi(t, {
      name: input.name,
      email: input.email,
      role: input.role,
      locationIds: input.locationIds,
      message: input.message,
    }),
  );
}

export async function resendInvitation(token: Token, invitationId: string) {
  if (!useLiveApi()) return resendInvitationMock(invitationId);
  const t = requireToken(token);
  return withProvisioned(t, () => resendInvitationApi(t, invitationId));
}

export async function cancelInvitation(token: Token, invitationId: string) {
  if (!useLiveApi()) return cancelInvitationMock(invitationId);
  const t = requireToken(token);
  return withProvisioned(t, () => cancelInvitationApi(t, invitationId));
}

export async function updateMemberRole(
  token: Token,
  memberId: string,
  role: Role,
) {
  if (!useLiveApi()) return updateMemberRoleMock(memberId, role);
  const t = requireToken(token);
  return withProvisioned(t, () => updateMemberRoleApi(t, memberId, role));
}

export async function updateMemberLocations(
  token: Token,
  memberId: string,
  locationIds: string[],
) {
  if (!useLiveApi()) return updateMemberLocationsMock(memberId, locationIds);
  const t = requireToken(token);
  return withProvisioned(t, () =>
    updateMemberLocationsApi(t, memberId, locationIds),
  );
}

export async function suspendMember(token: Token, memberId: string) {
  if (!useLiveApi()) return suspendMemberMock(memberId);
  const t = requireToken(token);
  return withProvisioned(t, () => suspendMemberApi(t, memberId));
}

export async function reactivateMember(token: Token, memberId: string) {
  if (!useLiveApi()) return reactivateMemberMock(memberId);
  const t = requireToken(token);
  return withProvisioned(t, () => reactivateMemberApi(t, memberId));
}

export async function removeMember(token: Token, memberId: string) {
  if (!useLiveApi()) {
    removeMemberMock(memberId);
    return;
  }
  const t = requireToken(token);
  return withProvisioned(t, () => removeMemberApi(t, memberId));
}

export async function transferOwnership(
  token: Token,
  actorId: string,
  newOwnerUserId: string,
) {
  if (!useLiveApi()) return transferOwnershipMock(actorId, newOwnerUserId);
  const t = requireToken(token);
  return withProvisioned(t, () => transferOwnershipApi(t, newOwnerUserId));
}

export async function previewInvitation(
  inviteToken: string,
): Promise<InvitationPreview> {
  if (!useLiveApi()) return previewInvitationMock(inviteToken);
  return previewInvitationApi(inviteToken);
}

export async function acceptInvitation(
  authToken: Token,
  inviteToken: string,
  mockIdentity?: { clerkUserId: string; email: string; name: string },
) {
  if (!useLiveApi()) {
    return acceptInvitationMock({
      token: inviteToken,
      clerkUserId: mockIdentity?.clerkUserId ?? `clerk_${Date.now()}`,
      email: mockIdentity?.email ?? "",
      name: mockIdentity?.name ?? "New member",
    });
  }
  return acceptInvitationApi(requireToken(authToken), inviteToken);
}

import { apiFetch } from "@/lib/api/client";
import type { Role, TeamInvitation, User } from "@/lib/types/schema";

type AuthToken = string;

export type TeamMemberDto = User & {
  kind?: "member";
  invitationStatus?: string | null;
};

export type InvitationDto = TeamInvitation & { kind?: "invitation" };

export type TeamListDto = {
  members: TeamMemberDto[];
  invitations: InvitationDto[];
};

export type InviteCreateResult = {
  invitation: InvitationDto;
  emailSent: boolean;
  inviteUrl: string | null;
};

export type InvitationPreview = {
  organizationId: string;
  organizationName: string;
  email: string;
  name: string;
  role: Role;
  roleLabel: string;
  locationIds: string[];
  locationNames: string[];
  expiresAt: string;
  status: string;
  message: string | null;
  valid: boolean;
  error: string | null;
};

export function listTeamApi(
  token: AuthToken,
  params?: {
    q?: string;
    role?: string;
    status?: string;
    locationId?: string;
  },
) {
  const search = new URLSearchParams();
  if (params?.q) search.set("q", params.q);
  if (params?.role) search.set("role", params.role);
  if (params?.status) search.set("status", params.status);
  if (params?.locationId) search.set("locationId", params.locationId);
  const qs = search.toString();
  return apiFetch<TeamListDto>(`/api/v1/team${qs ? `?${qs}` : ""}`, { token });
}

export function inviteMemberApi(
  token: AuthToken,
  body: {
    name: string;
    email: string;
    role: Role;
    locationIds: string[];
    message?: string;
  },
) {
  return apiFetch<InviteCreateResult>("/api/v1/team/invitations", {
    method: "POST",
    token,
    body,
  });
}

export function resendInvitationApi(token: AuthToken, invitationId: string) {
  return apiFetch<InviteCreateResult>(
    `/api/v1/team/invitations/${invitationId}/resend`,
    { method: "POST", token },
  );
}

export function cancelInvitationApi(token: AuthToken, invitationId: string) {
  return apiFetch<InvitationDto>(
    `/api/v1/team/invitations/${invitationId}/cancel`,
    { method: "POST", token },
  );
}

export function updateMemberRoleApi(
  token: AuthToken,
  memberId: string,
  role: Role,
) {
  return apiFetch<TeamMemberDto>(`/api/v1/team/members/${memberId}/role`, {
    method: "PATCH",
    token,
    body: { role },
  });
}

export function updateMemberLocationsApi(
  token: AuthToken,
  memberId: string,
  locationIds: string[],
) {
  return apiFetch<TeamMemberDto>(`/api/v1/team/members/${memberId}/locations`, {
    method: "PATCH",
    token,
    body: { locationIds },
  });
}

export function suspendMemberApi(token: AuthToken, memberId: string) {
  return apiFetch<TeamMemberDto>(`/api/v1/team/members/${memberId}/suspend`, {
    method: "POST",
    token,
  });
}

export function reactivateMemberApi(token: AuthToken, memberId: string) {
  return apiFetch<TeamMemberDto>(
    `/api/v1/team/members/${memberId}/reactivate`,
    { method: "POST", token },
  );
}

export function removeMemberApi(token: AuthToken, memberId: string) {
  return apiFetch<void>(`/api/v1/team/members/${memberId}`, {
    method: "DELETE",
    token,
  });
}

export function transferOwnershipApi(token: AuthToken, newOwnerUserId: string) {
  return apiFetch<TeamMemberDto>("/api/v1/team/ownership/transfer", {
    method: "POST",
    token,
    body: { newOwnerUserId },
  });
}

export function previewInvitationApi(token: string) {
  return apiFetch<InvitationPreview>(
    `/api/v1/invitations/preview?token=${encodeURIComponent(token)}`,
    { auth: false },
  );
}

export function acceptInvitationApi(authToken: AuthToken, token: string) {
  return apiFetch<User>("/api/v1/invitations/accept", {
    method: "POST",
    token: authToken,
    body: { token },
  });
}

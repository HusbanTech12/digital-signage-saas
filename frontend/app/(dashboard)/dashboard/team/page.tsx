"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { useMockSession } from "@/components/providers/mock-session-provider";
import { useMockStore } from "@/components/providers/mock-data-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApiAuthToken } from "@/lib/api/auth-token";
import { canManageTeam } from "@/lib/access";
import { PERMISSIONS, hasPermission } from "@/lib/permissions";
import { ASSIGNABLE_ROLES, ROLE_LABELS } from "@/lib/mock-session";
import {
  cancelInvitation,
  inviteMember,
  listTeam,
  reactivateMember,
  removeMember,
  resendInvitation,
  suspendMember,
  transferOwnership,
  updateMemberLocations,
  updateMemberRole,
} from "@/lib/data/team";
import type {
  InvitationDto,
  TeamListDto,
  TeamMemberDto,
} from "@/lib/api/team";
import type { Role } from "@/lib/types/schema";
import { cn } from "@/lib/utils";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function MemberStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    suspended: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-300",
    pending: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize",
        styles[status] ?? styles.pending,
      )}
    >
      {status === "pending" ? "Pending invitation" : status}
    </span>
  );
}

function RoleBadge({ role }: { role: Role }) {
  return (
    <span className="inline-flex rounded-md border border-border bg-muted/40 px-2 py-0.5 text-xs font-medium">
      {ROLE_LABELS[role] ?? role}
    </span>
  );
}

export default function TeamPage() {
  const { session, role } = useMockSession();
  const { locations } = useMockStore();
  const { getApiToken } = useApiAuthToken();

  const [data, setData] = useState<TeamListDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("location_manager");
  const [inviteLocations, setInviteLocations] = useState<string[]>([]);
  const [inviteMessage, setInviteMessage] = useState("");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [editMember, setEditMember] = useState<TeamMemberDto | null>(null);
  const [editRole, setEditRole] = useState<Role>("admin");
  const [editLocations, setEditLocations] = useState<string[]>([]);

  const orgLocations = useMemo(
    () =>
      locations.filter((l) => l.organizationId === session.organization.id),
    [locations, session.organization.id],
  );

  const locationName = useCallback(
    (id: string) => orgLocations.find((l) => l.id === id)?.name ?? id,
    [orgLocations],
  );

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const token = await getApiToken();
      const result = await listTeam(token, {
        q: q || undefined,
        role: roleFilter || undefined,
        status: statusFilter || undefined,
        locationId: locationFilter || undefined,
      });
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load team");
    } finally {
      setLoading(false);
    }
  }, [getApiToken, q, roleFilter, statusFilter, locationFilter]);

  useEffect(() => {
    setLoading(true);
    const t = window.setTimeout(() => {
      void refresh();
    }, 200);
    return () => window.clearTimeout(t);
  }, [refresh]);

  if (!canManageTeam(role)) {
    return (
      <div className="mx-auto max-w-4xl">
        <PageHeader
          title="Team"
          description="You do not have permission to manage team members."
        />
      </div>
    );
  }

  async function runAction(fn: () => Promise<void>, okMessage: string) {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await fn();
      setSuccess(okMessage);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    await runAction(async () => {
      const token = await getApiToken();
      const result = await inviteMember(token, {
        organizationId: session.organization.id,
        name: inviteName,
        email: inviteEmail,
        role: inviteRole,
        locationIds: inviteLocations,
        message: inviteMessage || undefined,
        invitedByUserId: session.user.id,
      });
      setInviteLink(result.inviteUrl);
      if (result.emailSent) {
        setInviteOpen(false);
        setInviteName("");
        setInviteEmail("");
        setInviteMessage("");
        setInviteLocations([]);
      }
    }, "Invitation created");
  }

  function toggleLocation(
    list: string[],
    setList: (v: string[]) => void,
    id: string,
  ) {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  const members = data?.members ?? [];
  const invitations = data?.invitations ?? [];
  const empty = !loading && members.length === 0 && invitations.length === 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Team"
        description="Invite people, assign roles and location access, and manage membership for your organization."
        actions={
          hasPermission(role, PERMISSIONS.TEAM_INVITE) ? (
            <Button
              onClick={() => {
                setInviteOpen(true);
                setInviteLink(null);
                setError(null);
              }}
            >
              Invite Member
            </Button>
          ) : null
        }
      />

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-300" role="status">
          {success}
        </p>
      ) : null}

      <div className="grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="team-q">Search</Label>
          <Input
            id="team-q"
            placeholder="Name or email"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="team-role">Role</Label>
          <select
            id="team-role"
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="">All roles</option>
            {ASSIGNABLE_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="team-status">Status</Label>
          <select
            id="team-status"
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="pending">Pending invitation</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="team-loc">Location</Label>
          <select
            id="team-loc"
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
          >
            <option value="">All locations</option>
            {orgLocations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading team…</p>
      ) : empty ? (
        <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
          <p className="font-medium">No team members yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Invite your first teammate to manage menus and screens together.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Member</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Locations</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="hidden px-4 py-3 font-medium lg:table-cell">
                  Last active
                </th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">
                  Added
                </th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invitations.map((inv) => (
                <InvitationRow
                  key={inv.id}
                  inv={inv}
                  locationName={locationName}
                  busy={busy}
                  onResend={() =>
                    void runAction(async () => {
                      const token = await getApiToken();
                      const result = await resendInvitation(token, inv.id);
                      if (result.inviteUrl) setInviteLink(result.inviteUrl);
                    }, "Invitation resent")
                  }
                  onCancel={() => {
                    if (!confirm(`Cancel invitation to ${inv.email}?`)) return;
                    void runAction(async () => {
                      const token = await getApiToken();
                      await cancelInvitation(token, inv.id);
                    }, "Invitation cancelled");
                  }}
                />
              ))}
              {members.map((member) => (
                <MemberRow
                  key={member.id}
                  member={member}
                  isSelf={member.id === session.user.id}
                  locationName={locationName}
                  canUpdate={hasPermission(role, PERMISSIONS.TEAM_UPDATE)}
                  canRemove={hasPermission(role, PERMISSIONS.TEAM_REMOVE)}
                  canTransfer={hasPermission(
                    role,
                    PERMISSIONS.OWNERSHIP_TRANSFER,
                  )}
                  busy={busy}
                  onEdit={() => {
                    setEditMember(member);
                    setEditRole(member.role);
                    setEditLocations([...member.locationIds]);
                  }}
                  onSuspend={() => {
                    if (!confirm(`Suspend ${member.name}?`)) return;
                    void runAction(async () => {
                      const token = await getApiToken();
                      await suspendMember(token, member.id);
                    }, "Member suspended");
                  }}
                  onReactivate={() =>
                    void runAction(async () => {
                      const token = await getApiToken();
                      await reactivateMember(token, member.id);
                    }, "Member reactivated")
                  }
                  onRemove={() => {
                    if (
                      !confirm(
                        `Remove ${member.name} from the organization? This cannot be undone.`,
                      )
                    )
                      return;
                    void runAction(async () => {
                      const token = await getApiToken();
                      await removeMember(token, member.id);
                    }, "Member removed");
                  }}
                  onTransfer={() => {
                    if (
                      !confirm(
                        `Transfer organization ownership to ${member.name}? You will become an Admin.`,
                      )
                    )
                      return;
                    void runAction(async () => {
                      const token = await getApiToken();
                      await transferOwnership(
                        token,
                        session.user.id,
                        member.id,
                      );
                    }, "Ownership transferred");
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {inviteLink ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
          <p className="font-medium">Share this invite link</p>
          <p className="mt-1 break-all text-muted-foreground">{inviteLink}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Email delivery is not configured, so copy this link to the invitee.
          </p>
        </div>
      ) : null}

      {inviteOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <form
            onSubmit={(e) => void handleInvite(e)}
            className="w-full max-w-lg space-y-4 rounded-xl border border-border bg-background p-5 shadow-lg"
          >
            <div>
              <h2 className="text-lg font-semibold">Invite Member</h2>
              <p className="text-sm text-muted-foreground">
                Send an invitation with a role and location access.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-name">Name</Label>
              <Input
                id="inv-name"
                required
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-email">Email</Label>
              <Input
                id="inv-email"
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-role">Role</Label>
              <select
                id="inv-role"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as Role)}
              >
                {ASSIGNABLE_ROLES.filter(
                  (r) => r !== "super_admin" || role === "super_admin",
                ).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Location access</Label>
              <p className="text-xs text-muted-foreground">
                Leave empty for all locations (Owner / Admin / Content Manager).
                Location Manager and Viewer need at least one.
              </p>
              <div className="max-h-36 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                {orgLocations.map((l) => (
                  <label
                    key={l.id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={inviteLocations.includes(l.id)}
                      onChange={() =>
                        toggleLocation(
                          inviteLocations,
                          setInviteLocations,
                          l.id,
                        )
                      }
                    />
                    {l.name}
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-msg">Message (optional)</Label>
              <textarea
                id="inv-msg"
                className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={inviteMessage}
                onChange={(e) => setInviteMessage(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setInviteOpen(false)}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Sending…" : "Send invitation"}
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      {editMember ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <form
            className="w-full max-w-lg space-y-4 rounded-xl border border-border bg-background p-5 shadow-lg"
            onSubmit={(e) => {
              e.preventDefault();
              void runAction(async () => {
                const token = await getApiToken();
                await updateMemberRole(token, editMember.id, editRole);
                await updateMemberLocations(
                  token,
                  editMember.id,
                  editLocations,
                );
                setEditMember(null);
              }, "Member updated");
            }}
          >
            <div>
              <h2 className="text-lg font-semibold">Edit {editMember.name}</h2>
              <p className="text-sm text-muted-foreground">{editMember.email}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-role">Role</Label>
              <select
                id="edit-role"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={editRole}
                onChange={(e) => setEditRole(e.target.value as Role)}
              >
                {ASSIGNABLE_ROLES.filter(
                  (r) => r !== "super_admin" || role === "super_admin",
                ).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Locations</Label>
              <div className="max-h-36 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                {orgLocations.map((l) => (
                  <label
                    key={l.id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={editLocations.includes(l.id)}
                      onChange={() =>
                        toggleLocation(editLocations, setEditLocations, l.id)
                      }
                    />
                    {l.name}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditMember(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                Save
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function InvitationRow({
  inv,
  locationName,
  busy,
  onResend,
  onCancel,
}: {
  inv: InvitationDto;
  locationName: (id: string) => string;
  busy: boolean;
  onResend: () => void;
  onCancel: () => void;
}) {
  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-500/15 text-xs font-semibold text-amber-800 dark:text-amber-200">
            {initials(inv.name)}
          </span>
          <div>
            <p className="font-medium">{inv.name}</p>
            <p className="text-xs text-muted-foreground">{inv.email}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <RoleBadge role={inv.role} />
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground">
        {inv.locationIds.length === 0
          ? "All locations"
          : inv.locationIds.map(locationName).join(", ")}
      </td>
      <td className="px-4 py-3">
        <MemberStatusBadge status="pending" />
        <p className="mt-1 text-[11px] text-muted-foreground">
          Expires {formatDate(inv.expiresAt)}
        </p>
      </td>
      <td className="hidden px-4 py-3 text-xs text-muted-foreground lg:table-cell">
        —
      </td>
      <td className="hidden px-4 py-3 text-xs text-muted-foreground md:table-cell">
        {formatDate(inv.createdAt)}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex justify-end gap-1">
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={onResend}
          >
            Resend
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={onCancel}
          >
            Cancel
          </Button>
        </div>
      </td>
    </tr>
  );
}

function MemberRow({
  member,
  isSelf,
  locationName,
  canUpdate,
  canRemove,
  canTransfer,
  busy,
  onEdit,
  onSuspend,
  onReactivate,
  onRemove,
  onTransfer,
}: {
  member: TeamMemberDto;
  isSelf: boolean;
  locationName: (id: string) => string;
  canUpdate: boolean;
  canRemove: boolean;
  canTransfer: boolean;
  busy: boolean;
  onEdit: () => void;
  onSuspend: () => void;
  onReactivate: () => void;
  onRemove: () => void;
  onTransfer: () => void;
}) {
  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-xs font-semibold">
            {initials(member.name)}
          </span>
          <div>
            <p className="font-medium">
              {member.name}
              {isSelf ? (
                <span className="ml-1 text-xs text-muted-foreground">(you)</span>
              ) : null}
            </p>
            <p className="text-xs text-muted-foreground">{member.email}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <RoleBadge role={member.role} />
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground">
        {member.locationIds.length === 0
          ? "All locations"
          : member.locationIds.map(locationName).join(", ")}
      </td>
      <td className="px-4 py-3">
        <MemberStatusBadge status={member.status} />
      </td>
      <td className="hidden px-4 py-3 text-xs text-muted-foreground lg:table-cell">
        {formatDate(member.lastActiveAt)}
      </td>
      <td className="hidden px-4 py-3 text-xs text-muted-foreground md:table-cell">
        {formatDate(member.createdAt)}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex flex-wrap justify-end gap-1">
          {canUpdate ? (
            <Button size="sm" variant="outline" disabled={busy} onClick={onEdit}>
              Edit
            </Button>
          ) : null}
          {canUpdate && member.status === "active" && !isSelf ? (
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={onSuspend}
            >
              Suspend
            </Button>
          ) : null}
          {canUpdate && member.status === "suspended" ? (
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={onReactivate}
            >
              Reactivate
            </Button>
          ) : null}
          {canTransfer &&
          !isSelf &&
          member.role !== "super_admin" &&
          member.status === "active" ? (
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={onTransfer}
            >
              Make owner
            </Button>
          ) : null}
          {canRemove && !isSelf ? (
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={onRemove}
            >
              Remove
            </Button>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

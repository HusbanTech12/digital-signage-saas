/** Domain types matching AGENTS.md Section 5 — contract for mock data and future FastAPI. */

export type Role = "super_admin" | "admin" | "location_manager";

export type ScreenOrientation = "landscape" | "portrait";

export type ScreenStatus = "online" | "offline" | "pairing";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

export interface Location {
  id: string;
  organizationId: string;
  name: string;
  address: string;
  timezone: string;
  createdAt: string;
}

export interface Screen {
  id: string;
  /** null while waiting to be paired to a location */
  locationId: string | null;
  organizationId: string;
  name: string;
  deviceToken: string;
  pairingCode: string | null;
  lastHeartbeat: string | null;
  resolution: string;
  orientation: ScreenOrientation;
  status: ScreenStatus;
  activeMenuId: string | null;
  activeTemplateId: string | null;
  createdAt: string;
}

/** Ephemeral pairing session created by the /pair kiosk page. */
export interface PendingPairing {
  code: string;
  screenId: string;
  createdAt: string;
  expiresAt: string;
}

export interface Menu {
  id: string;
  organizationId: string;
  name: string;
  version: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MenuItem {
  id: string;
  menuId: string;
  organizationId: string;
  name: string;
  price: number;
  description: string;
  imageUrl: string | null;
  available: boolean;
  sortOrder: number;
  category: string;
  createdAt: string;
  updatedAt: string;
}

export interface Template {
  id: string;
  organizationId: string | null;
  name: string;
  description: string;
  thumbnailUrl: string | null;
  isGlobal: boolean;
  canvasJson: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export type ThemeRuleKind = "time_of_day" | "date_range";

export interface Theme {
  id: string;
  organizationId: string;
  name: string;
  kind: ThemeRuleKind;
  /** HH:mm local — used when kind is time_of_day */
  startTime: string | null;
  endTime: string | null;
  /** ISO date — used when kind is date_range */
  startDate: string | null;
  endDate: string | null;
  menuId: string;
  templateId: string;
  locationIds: string[];
  enabled: boolean;
  createdAt: string;
}

export interface User {
  id: string;
  clerkUserId: string;
  organizationId: string;
  email: string;
  name: string;
  role: Role;
  /** Empty = all locations (super_admin). Otherwise scoped locations. */
  locationIds: string[];
  createdAt: string;
}

export interface MockSession {
  user: User;
  organization: Organization;
}

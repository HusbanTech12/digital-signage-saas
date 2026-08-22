/** Domain types matching AGENTS.md Section 5 — contract for mock data and future FastAPI. */

export type Role =
  | "super_admin"
  | "admin"
  | "location_manager"
  | "content_manager"
  | "viewer";

export type MemberStatus = "active" | "suspended" | "pending";

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
  activePlaylistId?: string | null;
  activeAudioPlaylistId?: string | null;
  audioVolume?: number;
  audioMuted?: boolean;
  audioLoop?: boolean;
  lastSyncAt?: string | null;
  lastError?: string | null;
  lastErrorAt?: string | null;
  contentVersion?: number | null;
  contentUpdatedAt?: string | null;
  currentContentSummary?: string | null;
  clientAppVersion?: string | null;
  pendingCommand?: string | null;
  pendingCommandId?: string | null;
  pendingCommandAt?: string | null;
  pairingExpiresAt?: string | null;
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
  status?: "draft" | "published" | "archived" | string;
  publishedAt: string | null;
  publishedByUserId?: string | null;
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
  displayConfig?: import("@/lib/display/menu-board-theme").MenuDisplayConfig | null;
  /** Target LCD size this layout is designed for */
  resolution: string;
  orientation: ScreenOrientation;
  status?: "draft" | "published" | "archived" | string;
  version?: number;
  publishedAt?: string | null;
  publishedByUserId?: string | null;
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
  /** Optional background music playlist applied when this theme wins. */
  audioPlaylistId?: string | null;
  locationIds: string[];
  enabled: boolean;
  createdAt: string;
}

export type PosProvider = "square" | "clear_mock";
export type PosIntegrationStatus = "inactive" | "active" | "error";
export type PosSyncEventStatus =
  | "received"
  | "processing"
  | "applied"
  | "failed";

export interface PosIntegration {
  id: string;
  locationId: string;
  organizationId: string;
  provider: PosProvider | string;
  status: PosIntegrationStatus | string;
  config: {
    menuId?: string;
    itemMap?: Record<string, string>;
    [key: string]: unknown;
  };
  hasCredentials: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
  createdAt: string;
}

export interface PosSyncEvent {
  id: string;
  integrationId: string;
  organizationId: string;
  eventType: string;
  payload: Record<string, unknown>;
  status: PosSyncEventStatus | string;
  errorMessage: string | null;
  createdAt: string;
}

export interface PosSyncStatus {
  organizationId: string;
  integrationsActive: number;
  integrationsError: number;
  lastSyncAt: string | null;
  lastEventStatus: string | null;
  recentFailures: number;
}

export interface User {
  id: string;
  clerkUserId: string;
  organizationId: string;
  email: string;
  name: string;
  role: Role;
  /** Empty = all locations for org-wide roles. Otherwise scoped locations. */
  locationIds: string[];
  status: MemberStatus;
  lastActiveAt: string | null;
  createdAt: string;
}

export interface TeamInvitation {
  id: string;
  organizationId: string;
  email: string;
  name: string;
  role: Role;
  locationIds: string[];
  status: "pending" | "accepted" | "cancelled" | "expired";
  message: string | null;
  invitedByUserId: string | null;
  expiresAt: string;
  createdAt: string;
}

export type MediaKind =
  | "image"
  | "video"
  | "audio"
  | "logo"
  | "promo"
  | "other";

export interface MediaFolder {
  id: string;
  organizationId: string;
  parentId: string | null;
  name: string;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MediaAsset {
  id: string;
  organizationId: string;
  folderId: string | null;
  name: string;
  originalFilename: string;
  kind: MediaKind;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  url: string;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  tags: string[];
  usageCount: number;
  uploadedByUserId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export type PlaylistStatus = "draft" | "published" | "archived";
export type PlaylistContentType = "menu" | "template" | "image" | "video";

export interface PlaylistItem {
  id: string;
  playlistId: string;
  organizationId: string;
  sortOrder: number;
  contentType: PlaylistContentType | string;
  durationSeconds: number;
  label: string | null;
  menuId: string | null;
  templateId: string | null;
  mediaAssetId: string | null;
  transition: string | null;
  meta?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface Playlist {
  id: string;
  organizationId: string;
  name: string;
  description: string;
  status: PlaylistStatus | string;
  version: number;
  priority: number;
  loop: boolean;
  publishedAt: string | null;
  createdByUserId: string | null;
  publishedByUserId?: string | null;
  createdAt: string;
  updatedAt: string;
  items: PlaylistItem[];
  itemCount: number;
}

export type ContentEntityType = "menu" | "template" | "playlist";

export interface ContentVersion {
  id: string;
  organizationId: string;
  entityType: ContentEntityType | string;
  entityId: string;
  version: number;
  status: string;
  changeSummary: string | null;
  publishedByUserId: string | null;
  createdAt: string;
  snapshot?: Record<string, unknown> | null;
}

export interface MockSession {
  user: User;
  organization: Organization;
}

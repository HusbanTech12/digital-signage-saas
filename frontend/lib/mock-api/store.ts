/**
 * In-memory mock store for org / location / screen mutations.
 * Swap these functions for real API calls in Prompt 6+.
 */

import {
  locations as seedLocations,
  menuItems as seedMenuItems,
  menus as seedMenus,
  organizations as seedOrganizations,
  screens as seedScreens,
  templates as seedTemplates,
  themes as seedThemes,
} from "@/lib/mock-data";
import { createBlankCanvasJson } from "@/lib/designer/canvas-io";
import type {
  Location,
  Menu,
  MenuItem,
  Organization,
  PendingPairing,
  Screen,
  ScreenOrientation,
  Template,
  Theme,
  ThemeRuleKind,
} from "@/lib/types/schema";

type Listener = () => void;

function cloneLocations() {
  return seedLocations.map((l) => ({ ...l }));
}

function cloneScreens() {
  return seedScreens.map((s) => ({ ...s }));
}

function cloneOrganizations() {
  return seedOrganizations.map((o) => ({ ...o }));
}

function cloneMenus() {
  return seedMenus.map((m) => ({ ...m }));
}

function cloneMenuItems() {
  return seedMenuItems.map((i) => ({ ...i }));
}

function cloneTemplates() {
  return seedTemplates.map((t) => ({
    ...t,
    canvasJson: structuredClone(t.canvasJson),
  }));
}

function cloneThemes() {
  return seedThemes.map((t) => ({
    ...t,
    locationIds: [...t.locationIds],
  }));
}

let organizationsState: Organization[] = cloneOrganizations();
let locationsState: Location[] = cloneLocations();
let screensState: Screen[] = cloneScreens();
let menusState: Menu[] = cloneMenus();
let menuItemsState: MenuItem[] = cloneMenuItems();
let templatesState: Template[] = cloneTemplates();
let themesState: Theme[] = cloneThemes();
let pendingPairings: PendingPairing[] = [];

const listeners = new Set<Listener>();

export type MockStoreSnapshot = {
  organizations: Organization[];
  locations: Location[];
  screens: Screen[];
  menus: Menu[];
  menuItems: MenuItem[];
  templates: Template[];
  themes: Theme[];
  pendingPairings: PendingPairing[];
};

/** Stable snapshot reference — rebuilt only on emit() for useSyncExternalStore. */
let snapshot: MockStoreSnapshot = {
  organizations: organizationsState,
  locations: locationsState,
  screens: screensState,
  menus: menusState,
  menuItems: menuItemsState,
  templates: templatesState,
  themes: themesState,
  pendingPairings,
};

function rebuildSnapshot() {
  snapshot = {
    organizations: organizationsState,
    locations: locationsState,
    screens: screensState,
    menus: menusState,
    menuItems: menuItemsState,
    templates: templatesState,
    themes: themesState,
    pendingPairings,
  };
}

function emit() {
  rebuildSnapshot();
  for (const listener of listeners) listener();
}

export function subscribeMockStore(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getMockStoreSnapshot(): MockStoreSnapshot {
  return snapshot;
}

/** Cached server snapshot — must be referentially stable across SSR renders. */
export function getMockStoreServerSnapshot(): MockStoreSnapshot {
  return snapshot;
}

function id(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function randomPairingCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function updateOrganization(
  organizationId: string,
  patch: Partial<Pick<Organization, "name" | "slug">>,
): Organization {
  const org = organizationsState.find((o) => o.id === organizationId);
  if (!org) throw new Error("Organization not found");
  Object.assign(org, patch);
  emit();
  return { ...org };
}

export function createLocation(input: {
  organizationId: string;
  name: string;
  address: string;
  timezone: string;
}): Location {
  const location: Location = {
    id: id("loc"),
    organizationId: input.organizationId,
    name: input.name.trim(),
    address: input.address.trim(),
    timezone: input.timezone.trim() || "UTC",
    createdAt: nowIso(),
  };
  locationsState = [...locationsState, location];
  emit();
  return location;
}

export function updateLocation(
  locationId: string,
  patch: Partial<Pick<Location, "name" | "address" | "timezone">>,
): Location {
  const location = locationsState.find((l) => l.id === locationId);
  if (!location) throw new Error("Location not found");
  Object.assign(location, {
    ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
    ...(patch.address !== undefined ? { address: patch.address.trim() } : {}),
    ...(patch.timezone !== undefined ? { timezone: patch.timezone.trim() } : {}),
  });
  emit();
  return { ...location };
}

export function deleteLocation(locationId: string) {
  const hasScreens = screensState.some((s) => s.locationId === locationId);
  if (hasScreens) {
    throw new Error("Move or remove screens before deleting this location.");
  }
  locationsState = locationsState.filter((l) => l.id !== locationId);
  emit();
}

export function updateScreen(
  screenId: string,
  patch: Partial<
    Pick<Screen, "name" | "locationId" | "orientation" | "resolution">
  >,
): Screen {
  const screen = screensState.find((s) => s.id === screenId);
  if (!screen) throw new Error("Screen not found");
  Object.assign(screen, patch);
  emit();
  return { ...screen };
}

export function deleteScreen(screenId: string) {
  screensState = screensState.filter((s) => s.id !== screenId);
  pendingPairings = pendingPairings.filter((p) => p.screenId !== screenId);
  emit();
}

/** Kiosk heartbeat — keeps dashboard status online while the display client is open. */
export function touchScreenHeartbeat(screenId: string) {
  const screen = screensState.find((s) => s.id === screenId);
  if (!screen || screen.locationId === null) return;
  screen.lastHeartbeat = nowIso();
  const becameOnline = screen.status === "offline";
  if (becameOnline) {
    screen.status = "online";
    emit();
  }
  // Quiet timestamp updates — dashboard refresh picks them up on next navigation/poll.
}

/**
 * Called by the /pair kiosk page. Creates (or refreshes) a pending screen
 * with a 6-digit code for the admin to enter in the dashboard.
 */
export function startPairingSession(input?: {
  organizationId?: string;
  resolution?: string;
  orientation?: ScreenOrientation;
}): { screen: Screen; pairing: PendingPairing } {
  const organizationId = input?.organizationId ?? organizationsState[0]?.id;
  if (!organizationId) throw new Error("No organization available");

  const code = randomPairingCode();
  const createdAt = nowIso();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  const screen: Screen = {
    id: id("scr"),
    locationId: null,
    organizationId,
    name: "Unpaired screen",
    deviceToken: id("devtok"),
    pairingCode: code,
    lastHeartbeat: createdAt,
    resolution: input?.resolution ?? "1920x1080",
    orientation: input?.orientation ?? "landscape",
    status: "pairing",
    activeMenuId: null,
    activeTemplateId: null,
    createdAt,
  };

  screensState = [...screensState, screen];
  const pairing: PendingPairing = {
    code,
    screenId: screen.id,
    createdAt,
    expiresAt,
  };
  pendingPairings = [
    ...pendingPairings.filter((p) => p.screenId !== screen.id),
    pairing,
  ];
  emit();
  return { screen, pairing };
}

export function getPendingPairingByCode(code: string) {
  const normalized = code.trim();
  return (
    pendingPairings.find((p) => p.code === normalized) ??
    (() => {
      const screen = screensState.find(
        (s) => s.pairingCode === normalized && s.status === "pairing",
      );
      if (!screen) return undefined;
      return {
        code: normalized,
        screenId: screen.id,
        createdAt: screen.createdAt,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      } satisfies PendingPairing;
    })()
  );
}

/**
 * Admin enters pairing code + assigns location/name.
 */
export function completePairing(input: {
  code: string;
  locationId: string;
  name: string;
  organizationId: string;
}): Screen {
  const pairing = getPendingPairingByCode(input.code);
  if (!pairing) throw new Error("Invalid or expired pairing code.");

  if (new Date(pairing.expiresAt).getTime() < Date.now()) {
    throw new Error("Pairing code expired. Refresh the screen and try again.");
  }

  const location = locationsState.find((l) => l.id === input.locationId);
  if (!location || location.organizationId !== input.organizationId) {
    throw new Error("Location not found in this organization.");
  }

  const screen = screensState.find((s) => s.id === pairing.screenId);
  if (!screen) throw new Error("Pairing screen not found.");

  screen.locationId = input.locationId;
  screen.name = input.name.trim() || "Paired screen";
  screen.pairingCode = null;
  screen.status = "online";
  screen.lastHeartbeat = nowIso();

  pendingPairings = pendingPairings.filter((p) => p.code !== pairing.code);
  emit();
  return { ...screen };
}

// ─── Menus / items / templates / publish ────────────────────────────────────

export function createMenu(input: {
  organizationId: string;
  name: string;
}): Menu {
  const ts = nowIso();
  const menu: Menu = {
    id: id("menu"),
    organizationId: input.organizationId,
    name: input.name.trim(),
    version: 1,
    publishedAt: null,
    createdAt: ts,
    updatedAt: ts,
  };
  menusState = [...menusState, menu];
  emit();
  return menu;
}

export function updateMenu(
  menuId: string,
  patch: Partial<Pick<Menu, "name">>,
): Menu {
  const menu = menusState.find((m) => m.id === menuId);
  if (!menu) throw new Error("Menu not found");
  if (patch.name !== undefined) menu.name = patch.name.trim();
  menu.updatedAt = nowIso();
  emit();
  return { ...menu };
}

export function deleteMenu(menuId: string) {
  menusState = menusState.filter((m) => m.id !== menuId);
  menuItemsState = menuItemsState.filter((i) => i.menuId !== menuId);
  emit();
}

export function createMenuItem(input: {
  menuId: string;
  organizationId: string;
  name: string;
  price: number;
  description?: string;
  category?: string;
  available?: boolean;
}): MenuItem {
  const menu = menusState.find((m) => m.id === input.menuId);
  if (!menu) throw new Error("Menu not found");
  const siblings = menuItemsState.filter((i) => i.menuId === input.menuId);
  const ts = nowIso();
  const item: MenuItem = {
    id: id("item"),
    menuId: input.menuId,
    organizationId: input.organizationId,
    name: input.name.trim(),
    price: Number(input.price),
    description: input.description?.trim() ?? "",
    imageUrl: null,
    available: input.available ?? true,
    sortOrder: siblings.length + 1,
    category: input.category?.trim() || "General",
    createdAt: ts,
    updatedAt: ts,
  };
  menuItemsState = [...menuItemsState, item];
  menu.updatedAt = ts;
  emit();
  return item;
}

export function updateMenuItem(
  itemId: string,
  patch: Partial<
    Pick<
      MenuItem,
      "name" | "price" | "description" | "category" | "available" | "sortOrder"
    >
  >,
): MenuItem {
  const item = menuItemsState.find((i) => i.id === itemId);
  if (!item) throw new Error("Menu item not found");
  Object.assign(item, patch);
  if (patch.name !== undefined) item.name = patch.name.trim();
  if (patch.description !== undefined) item.description = patch.description.trim();
  if (patch.category !== undefined) item.category = patch.category.trim();
  if (patch.price !== undefined) item.price = Number(patch.price);
  item.updatedAt = nowIso();
  const menu = menusState.find((m) => m.id === item.menuId);
  if (menu) menu.updatedAt = item.updatedAt;
  emit();
  return { ...item };
}

export function deleteMenuItem(itemId: string) {
  const item = menuItemsState.find((i) => i.id === itemId);
  menuItemsState = menuItemsState.filter((i) => i.id !== itemId);
  if (item) {
    const menu = menusState.find((m) => m.id === item.menuId);
    if (menu) menu.updatedAt = nowIso();
  }
  emit();
}

export function createTemplate(input: {
  organizationId: string;
  name: string;
  description?: string;
}): Template {
  const ts = nowIso();
  const template: Template = {
    id: id("tpl"),
    organizationId: input.organizationId,
    name: input.name.trim(),
    description: input.description?.trim() ?? "",
    thumbnailUrl: null,
    isGlobal: false,
    canvasJson: createBlankCanvasJson(),
    createdAt: ts,
    updatedAt: ts,
  };
  templatesState = [...templatesState, template];
  emit();
  return template;
}

export function updateTemplate(
  templateId: string,
  patch: Partial<Pick<Template, "name" | "description" | "canvasJson">>,
): Template {
  const template = templatesState.find((t) => t.id === templateId);
  if (!template) throw new Error("Template not found");
  if (template.isGlobal && patch.canvasJson) {
    // Org users edit a forked copy instead of mutating the global seed.
    throw new Error("Global templates are read-only. Duplicate to edit.");
  }
  if (patch.name !== undefined) template.name = patch.name.trim();
  if (patch.description !== undefined) {
    template.description = patch.description.trim();
  }
  if (patch.canvasJson !== undefined) {
    template.canvasJson = structuredClone(patch.canvasJson);
  }
  template.updatedAt = nowIso();
  emit();
  return {
    ...template,
    canvasJson: structuredClone(template.canvasJson),
  };
}

/** Duplicate a global (or org) template into the org library so it can be edited. */
export function duplicateTemplate(input: {
  templateId: string;
  organizationId: string;
}): Template {
  const source = templatesState.find((t) => t.id === input.templateId);
  if (!source) throw new Error("Template not found");
  const ts = nowIso();
  const copy: Template = {
    id: id("tpl"),
    organizationId: input.organizationId,
    name: `${source.name} (copy)`,
    description: source.description,
    thumbnailUrl: null,
    isGlobal: false,
    canvasJson: structuredClone(source.canvasJson),
    createdAt: ts,
    updatedAt: ts,
  };
  templatesState = [...templatesState, copy];
  emit();
  return copy;
}

export function deleteTemplate(templateId: string) {
  const template = templatesState.find((t) => t.id === templateId);
  if (!template) throw new Error("Template not found");
  if (template.isGlobal) throw new Error("Cannot delete a global template.");
  templatesState = templatesState.filter((t) => t.id !== templateId);
  emit();
}

/**
 * Publish a menu: bump version, stamp publishedAt, optionally push active
 * menu/template onto selected screens (mock stand-in for real-time publish).
 */
export function publishMenu(input: {
  menuId: string;
  templateId: string;
  screenIds: string[];
}): Menu {
  const menu = menusState.find((m) => m.id === input.menuId);
  if (!menu) throw new Error("Menu not found");
  const template = templatesState.find((t) => t.id === input.templateId);
  if (!template) throw new Error("Template not found");

  const ts = nowIso();
  menu.version += 1;
  menu.publishedAt = ts;
  menu.updatedAt = ts;

  for (const screenId of input.screenIds) {
    const screen = screensState.find((s) => s.id === screenId);
    if (!screen || screen.organizationId !== menu.organizationId) continue;
    screen.activeMenuId = menu.id;
    screen.activeTemplateId = template.id;
  }

  emit();
  return { ...menu };
}

/** Reset store to seed data (useful for demos / tests). */
export function resetMockStore() {
  organizationsState = cloneOrganizations();
  locationsState = cloneLocations();
  screensState = cloneScreens();
  menusState = cloneMenus();
  menuItemsState = cloneMenuItems();
  templatesState = cloneTemplates();
  pendingPairings = [];
  emit();
}

/** Replace tenant slices after a live API fetch. */
export function hydrateTenantData(input: {
  organizations?: Organization[];
  locations?: Location[];
  screens?: Screen[];
  menus?: Menu[];
  menuItems?: MenuItem[];
  templates?: Template[];
  themes?: Theme[];
}) {
  if (input.organizations) {
    organizationsState = input.organizations.map((o) => ({ ...o }));
  }
  if (input.locations) {
    locationsState = input.locations.map((l) => ({ ...l }));
  }
  if (input.screens) {
    screensState = input.screens.map((s) => ({ ...s }));
  }
  if (input.menus) {
    menusState = input.menus.map((m) => ({ ...m }));
  }
  if (input.menuItems) {
    menuItemsState = input.menuItems.map((i) => ({ ...i }));
  }
  if (input.templates) {
    templatesState = input.templates.map((t) => ({
      ...t,
      canvasJson: structuredClone(t.canvasJson),
    }));
  }
  if (input.themes) {
    themesState = input.themes.map((t) => ({
      ...t,
      locationIds: [...t.locationIds],
    }));
  }
  emit();
}

export function upsertTheme(theme: Theme) {
  const idx = themesState.findIndex((t) => t.id === theme.id);
  if (idx === -1) {
    themesState = [...themesState, { ...theme, locationIds: [...theme.locationIds] }];
  } else {
    themesState = themesState.map((t) =>
      t.id === theme.id
        ? { ...theme, locationIds: [...theme.locationIds] }
        : t,
    );
  }
  emit();
}

export function removeThemeLocal(themeId: string) {
  themesState = themesState.filter((t) => t.id !== themeId);
  emit();
}

export function createTheme(input: {
  organizationId: string;
  name: string;
  kind: ThemeRuleKind;
  startTime: string | null;
  endTime: string | null;
  startDate: string | null;
  endDate: string | null;
  menuId: string;
  templateId: string;
  locationIds: string[];
  enabled: boolean;
}): Theme {
  const theme: Theme = {
    id: id("theme"),
    organizationId: input.organizationId,
    name: input.name.trim(),
    kind: input.kind,
    startTime: input.startTime,
    endTime: input.endTime,
    startDate: input.startDate,
    endDate: input.endDate,
    menuId: input.menuId,
    templateId: input.templateId,
    locationIds: [...input.locationIds],
    enabled: input.enabled,
    createdAt: nowIso(),
  };
  themesState = [...themesState, theme];
  emit();
  return theme;
}

export function updateTheme(
  themeId: string,
  patch: Partial<
    Pick<
      Theme,
      | "name"
      | "kind"
      | "startTime"
      | "endTime"
      | "startDate"
      | "endDate"
      | "menuId"
      | "templateId"
      | "locationIds"
      | "enabled"
    >
  >,
): Theme {
  const existing = themesState.find((t) => t.id === themeId);
  if (!existing) throw new Error("Theme not found");
  const next: Theme = {
    ...existing,
    ...patch,
    locationIds: patch.locationIds
      ? [...patch.locationIds]
      : [...existing.locationIds],
  };
  themesState = themesState.map((t) => (t.id === themeId ? next : t));
  emit();
  return next;
}

export function deleteTheme(themeId: string) {
  const exists = themesState.some((t) => t.id === themeId);
  if (!exists) throw new Error("Theme not found");
  removeThemeLocal(themeId);
}

export function upsertOrganization(org: Organization) {
  const idx = organizationsState.findIndex((o) => o.id === org.id);
  if (idx === -1) {
    organizationsState = [...organizationsState, { ...org }];
  } else {
    organizationsState = organizationsState.map((o) =>
      o.id === org.id ? { ...org } : o,
    );
  }
  emit();
}

export function upsertLocation(location: Location) {
  const idx = locationsState.findIndex((l) => l.id === location.id);
  if (idx === -1) {
    locationsState = [...locationsState, { ...location }];
  } else {
    locationsState = locationsState.map((l) =>
      l.id === location.id ? { ...location } : l,
    );
  }
  emit();
}

export function removeLocationLocal(locationId: string) {
  locationsState = locationsState.filter((l) => l.id !== locationId);
  emit();
}

export function upsertScreen(screen: Screen) {
  const idx = screensState.findIndex((s) => s.id === screen.id);
  if (idx === -1) {
    screensState = [...screensState, { ...screen }];
  } else {
    screensState = screensState.map((s) =>
      s.id === screen.id ? { ...screen } : s,
    );
  }
  emit();
}

export function removeScreenLocal(screenId: string) {
  screensState = screensState.filter((s) => s.id !== screenId);
  pendingPairings = pendingPairings.filter((p) => p.screenId !== screenId);
  emit();
}

export function upsertMenu(menu: Menu) {
  const idx = menusState.findIndex((m) => m.id === menu.id);
  if (idx === -1) menusState = [...menusState, { ...menu }];
  else menusState = menusState.map((m) => (m.id === menu.id ? { ...menu } : m));
  emit();
}

export function removeMenuLocal(menuId: string) {
  menusState = menusState.filter((m) => m.id !== menuId);
  menuItemsState = menuItemsState.filter((i) => i.menuId !== menuId);
  emit();
}

export function upsertMenuItem(item: MenuItem) {
  const idx = menuItemsState.findIndex((i) => i.id === item.id);
  if (idx === -1) menuItemsState = [...menuItemsState, { ...item }];
  else
    menuItemsState = menuItemsState.map((i) =>
      i.id === item.id ? { ...item } : i,
    );
  emit();
}

export function removeMenuItemLocal(itemId: string) {
  menuItemsState = menuItemsState.filter((i) => i.id !== itemId);
  emit();
}

export function upsertTemplate(template: Template) {
  const copy = {
    ...template,
    canvasJson: structuredClone(template.canvasJson),
  };
  const idx = templatesState.findIndex((t) => t.id === template.id);
  if (idx === -1) templatesState = [...templatesState, copy];
  else
    templatesState = templatesState.map((t) =>
      t.id === template.id ? copy : t,
    );
  emit();
}

export function removeTemplateLocal(templateId: string) {
  templatesState = templatesState.filter((t) => t.id !== templateId);
  emit();
}

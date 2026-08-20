/**
 * Typed mock data contract for the frontend-first build phase.
 * Backend APIs (Prompt 5+) must match these shapes exactly.
 */

import {
  createClassicBoardJson,
  createPortraitPromoJson,
} from "@/lib/designer/canvas-io";
import { DEFAULT_MENU_DISPLAY_CONFIG } from "@/lib/display/menu-board-theme";
import type {
  Location,
  Menu,
  MenuItem,
  Organization,
  Screen,
  Template,
  Theme,
  User,
} from "@/lib/types/schema";

export const organizations: Organization[] = [
  {
    id: "org_demo_001",
    name: "Harbor & Hearth",
    slug: "harbor-and-hearth",
    createdAt: "2026-01-10T10:00:00.000Z",
  },
];

export const locations: Location[] = [
  {
    id: "loc_downtown",
    organizationId: "org_demo_001",
    name: "Downtown Flagship",
    address: "120 Market Street, Seattle, WA",
    timezone: "America/Los_Angeles",
    createdAt: "2026-01-12T09:00:00.000Z",
  },
  {
    id: "loc_airport",
    organizationId: "org_demo_001",
    name: "Airport Kiosk",
    address: "Sea-Tac Terminal B, Seattle, WA",
    timezone: "America/Los_Angeles",
    createdAt: "2026-02-01T14:30:00.000Z",
  },
];

export const screens: Screen[] = [
  {
    id: "scr_lobby_left",
    locationId: "loc_downtown",
    organizationId: "org_demo_001",
    name: "Lobby Left",
    deviceToken: "devtok_lobby_left_demo",
    pairingCode: null,
    lastHeartbeat: "2026-08-01T18:55:00.000Z",
    resolution: "1920x1080",
    orientation: "landscape",
    status: "online",
    activeMenuId: "menu_all_day",
    activeTemplateId: "tpl_classic_board",
    createdAt: "2026-01-15T11:00:00.000Z",
  },
  {
    id: "scr_counter",
    locationId: "loc_downtown",
    organizationId: "org_demo_001",
    name: "Counter Board",
    deviceToken: "devtok_counter_demo",
    pairingCode: null,
    lastHeartbeat: "2026-08-01T17:10:00.000Z",
    resolution: "1080x1920",
    orientation: "portrait",
    status: "offline",
    activeMenuId: "menu_all_day",
    activeTemplateId: "tpl_portrait_promo",
    createdAt: "2026-01-20T16:00:00.000Z",
  },
  {
    id: "scr_pairing",
    locationId: null,
    organizationId: "org_demo_001",
    name: "Unpaired screen",
    deviceToken: "devtok_gate_b_pending",
    pairingCode: "482917",
    lastHeartbeat: null,
    resolution: "1920x1080",
    orientation: "landscape",
    status: "pairing",
    activeMenuId: null,
    activeTemplateId: null,
    createdAt: "2026-07-28T08:00:00.000Z",
  },
];


export const menus: Menu[] = [
  {
    id: "menu_all_day",
    organizationId: "org_demo_001",
    name: "All-Day Menu",
    version: 4,
    publishedAt: "2026-07-20T12:00:00.000Z",
    createdAt: "2026-01-18T10:00:00.000Z",
    updatedAt: "2026-07-20T12:00:00.000Z",
  },
  {
    id: "menu_breakfast",
    organizationId: "org_demo_001",
    name: "Breakfast Specials",
    version: 2,
    publishedAt: "2026-06-01T08:00:00.000Z",
    createdAt: "2026-03-01T09:00:00.000Z",
    updatedAt: "2026-06-01T08:00:00.000Z",
  },
];

export const menuItems: MenuItem[] = [
  {
    id: "item_latte",
    menuId: "menu_all_day",
    organizationId: "org_demo_001",
    name: "Harbor Latte",
    price: 4.75,
    description: "Double espresso with steamed milk and sea-salt caramel.",
    imageUrl: null,
    available: true,
    sortOrder: 1,
    category: "Drinks",
    createdAt: "2026-01-18T10:05:00.000Z",
    updatedAt: "2026-07-20T12:00:00.000Z",
  },
  {
    id: "item_avocado",
    menuId: "menu_all_day",
    organizationId: "org_demo_001",
    name: "Avocado Toast",
    price: 11.5,
    description: "Sourdough, smashed avocado, chili flake, soft egg.",
    imageUrl: null,
    available: true,
    sortOrder: 2,
    category: "Mains",
    createdAt: "2026-01-18T10:06:00.000Z",
    updatedAt: "2026-07-20T12:00:00.000Z",
  },
  {
    id: "item_soup",
    menuId: "menu_all_day",
    organizationId: "org_demo_001",
    name: "Seasonal Soup",
    price: 8.0,
    description: "Chef's daily pot — ask your server.",
    imageUrl: null,
    available: false,
    sortOrder: 3,
    category: "Mains",
    createdAt: "2026-01-18T10:07:00.000Z",
    updatedAt: "2026-07-15T09:00:00.000Z",
  },
  {
    id: "item_burrito",
    menuId: "menu_breakfast",
    organizationId: "org_demo_001",
    name: "Sunrise Burrito",
    price: 9.25,
    description: "Eggs, black beans, cheddar, salsa verde.",
    imageUrl: null,
    available: true,
    sortOrder: 1,
    category: "Breakfast",
    createdAt: "2026-03-01T09:10:00.000Z",
    updatedAt: "2026-06-01T08:00:00.000Z",
  },
];

export const templates: Template[] = [
  {
    id: "tpl_classic_board",
    organizationId: null,
    name: "Fusion Kitchen Premium",
    description:
      "Dark 3-column TV board with gold accents, live clock, and sold-out styling.",
    thumbnailUrl: null,
    isGlobal: true,
    canvasJson: createClassicBoardJson(),
    displayConfig: { ...DEFAULT_MENU_DISPLAY_CONFIG },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "tpl_portrait_promo",
    organizationId: "org_demo_001",
    name: "Portrait Promo",
    description: "Tall layout for counter tablets and portrait TVs.",
    thumbnailUrl: null,
    isGlobal: false,
    canvasJson: createPortraitPromoJson(),
    createdAt: "2026-02-10T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
  },
];

export const themes: Theme[] = [
  {
    id: "theme_breakfast",
    organizationId: "org_demo_001",
    name: "Breakfast Window",
    kind: "time_of_day",
    startTime: "06:00",
    endTime: "11:00",
    startDate: null,
    endDate: null,
    menuId: "menu_breakfast",
    templateId: "tpl_classic_board",
    locationIds: ["loc_downtown"],
    enabled: true,
    createdAt: "2026-03-05T00:00:00.000Z",
  },
  {
    id: "theme_holiday",
    organizationId: "org_demo_001",
    name: "Holiday Season",
    kind: "date_range",
    startTime: null,
    endTime: null,
    startDate: "2026-12-01",
    endDate: "2026-12-31",
    menuId: "menu_all_day",
    templateId: "tpl_portrait_promo",
    locationIds: ["loc_downtown", "loc_airport"],
    enabled: false,
    createdAt: "2026-06-01T00:00:00.000Z",
  },
];

export const users: User[] = [
  {
    id: "user_super",
    clerkUserId: "user_clerk_super_demo",
    organizationId: "org_demo_001",
    email: "owner@harborhearth.demo",
    name: "Alex Owner",
    role: "super_admin",
    locationIds: [],
    createdAt: "2026-01-10T10:05:00.000Z",
  },
  {
    id: "user_admin",
    clerkUserId: "user_clerk_admin_demo",
    organizationId: "org_demo_001",
    email: "admin@harborhearth.demo",
    name: "Jordan Admin",
    role: "admin",
    locationIds: ["loc_downtown", "loc_airport"],
    createdAt: "2026-01-11T10:00:00.000Z",
  },
  {
    id: "user_manager",
    clerkUserId: "user_clerk_mgr_demo",
    organizationId: "org_demo_001",
    email: "manager@harborhearth.demo",
    name: "Sam Manager",
    role: "location_manager",
    locationIds: ["loc_downtown"],
    createdAt: "2026-01-12T10:00:00.000Z",
  },
];

/** Convenience accessors used by UI until real API calls replace them. */
export function getOrganizationById(id: string) {
  return organizations.find((o) => o.id === id);
}

export function getLocationsByOrg(organizationId: string) {
  return locations.filter((l) => l.organizationId === organizationId);
}

export function getScreensByOrg(organizationId: string) {
  return screens.filter((s) => s.organizationId === organizationId);
}

export function getMenusByOrg(organizationId: string) {
  return menus.filter((m) => m.organizationId === organizationId);
}

export function getMenuItemsByMenu(menuId: string) {
  return menuItems
    .filter((i) => i.menuId === menuId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function getTemplatesForOrg(organizationId: string) {
  return templates.filter(
    (t) => t.isGlobal || t.organizationId === organizationId,
  );
}

export function getThemesByOrg(organizationId: string) {
  return themes.filter((t) => t.organizationId === organizationId);
}

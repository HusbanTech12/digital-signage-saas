import type { Role } from "@/lib/types/schema";
import {
  LayoutDashboard,
  Building2,
  MapPin,
  Monitor,
  Cast,
  UtensilsCrossed,
  Images,
  LayoutTemplate,
  CalendarClock,
  Users,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Roles that can see this item. */
  roles: Role[];
}

export const DASHBOARD_NAV: NavItem[] = [
  {
    label: "Overview",
    href: "/dashboard",
    icon: LayoutDashboard,
    roles: [
      "super_admin",
      "admin",
      "location_manager",
      "content_manager",
      "viewer",
    ],
  },
  {
    label: "Organization",
    href: "/dashboard/organization",
    icon: Building2,
    roles: ["super_admin"],
  },
  {
    label: "Locations",
    href: "/dashboard/locations",
    icon: MapPin,
    roles: ["super_admin", "admin"],
  },
  {
    label: "Screens",
    href: "/dashboard/screens",
    icon: Monitor,
    roles: ["super_admin", "admin", "location_manager", "viewer"],
  },
  {
    label: "Stick setup",
    href: "/dashboard/setup",
    icon: Cast,
    roles: ["super_admin", "admin", "location_manager"],
  },
  {
    label: "Menus",
    href: "/dashboard/menus",
    icon: UtensilsCrossed,
    roles: [
      "super_admin",
      "admin",
      "location_manager",
      "content_manager",
      "viewer",
    ],
  },
  {
    label: "Media",
    href: "/dashboard/media",
    icon: Images,
    roles: [
      "super_admin",
      "admin",
      "location_manager",
      "content_manager",
      "viewer",
    ],
  },
  {
    label: "Templates",
    href: "/dashboard/templates",
    icon: LayoutTemplate,
    roles: [
      "super_admin",
      "admin",
      "location_manager",
      "content_manager",
      "viewer",
    ],
  },
  {
    label: "Themes",
    href: "/dashboard/themes",
    icon: CalendarClock,
    roles: ["super_admin", "admin", "content_manager"],
  },
  {
    label: "Team",
    href: "/dashboard/team",
    icon: Users,
    roles: ["super_admin", "admin"],
  },
  {
    label: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
    roles: ["super_admin", "admin"],
  },
];

export function navForRole(role: Role): NavItem[] {
  return DASHBOARD_NAV.filter((item) => {
    if (item.href === "/dashboard/team") {
      return hasPermission(role, PERMISSIONS.TEAM_READ);
    }
    if (item.href === "/dashboard/media") {
      return hasPermission(role, PERMISSIONS.MEDIA_READ);
    }
    return item.roles.includes(role);
  });
}

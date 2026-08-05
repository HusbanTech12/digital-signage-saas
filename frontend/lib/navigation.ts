import type { Role } from "@/lib/types/schema";
import {
  LayoutDashboard,
  Building2,
  MapPin,
  Monitor,
  UtensilsCrossed,
  LayoutTemplate,
  CalendarClock,
  Users,
  Settings,
  type LucideIcon,
} from "lucide-react";

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
    roles: ["super_admin", "admin", "location_manager"],
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
    roles: ["super_admin", "admin", "location_manager"],
  },

  {
    label: "Menus",
    href: "/dashboard/menus",
    icon: UtensilsCrossed,
    roles: ["super_admin", "admin", "location_manager"],
  },
  {
    label: "Templates",
    href: "/dashboard/templates",
    icon: LayoutTemplate,
    roles: ["super_admin", "admin", "location_manager"],
  },

  {
    label: "Themes",
    href: "/dashboard/themes",
    icon: CalendarClock,
    roles: ["super_admin", "admin"],
  },
  {
    label: "Team",
    href: "/dashboard/team",
    icon: Users,
    roles: ["super_admin"],
  },
  {
    label: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
    roles: ["super_admin", "admin"],
  },
];

export function navForRole(role: Role): NavItem[] {
  return DASHBOARD_NAV.filter((item) => item.roles.includes(role));
}

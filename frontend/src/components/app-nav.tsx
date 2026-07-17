"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bike,
  BookOpen,
  LayoutDashboard,
  Map,
  Route,
  Settings2,
  ShieldCheck,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/planner", label: "Plan a route", icon: Map },
  { href: "/routes", label: "Saved routes", icon: Route },
  { href: "/news", label: "Ride journal", icon: BookOpen },
  { href: "/profile", label: "Profile & bikes", icon: Bike },
];

export function AppNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const items = isAdmin
    ? [...navItems, { href: "/admin", label: "Admin", icon: ShieldCheck }]
    : navItems;

  return (
    <nav className="app-nav" aria-label="Account navigation">
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link key={href} href={href} className={active ? "active" : undefined}>
            <Icon size={19} strokeWidth={active ? 2.4 : 1.8} />
            <span>{label}</span>
          </Link>
        );
      })}
      <Link href="/profile" className="nav-settings" aria-label="Account settings">
        <Settings2 size={18} />
      </Link>
    </nav>
  );
}

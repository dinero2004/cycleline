import Link from "next/link";
import { ArrowUpRight, Gauge } from "lucide-react";
import { AppNav } from "@/components/app-nav";
import { Logo } from "@/components/logo";
import { LogoutButton } from "@/components/logout-button";
import type { FitnessLevel } from "@/types";

export function AppSidebar({
  username,
  fitnessLevel,
  isAdmin,
}: {
  username: string;
  fitnessLevel: FitnessLevel;
  isAdmin: boolean;
}) {
  return (
    <aside className="app-sidebar">
      <div className="sidebar-top">
        <Logo />
        <span className="version-pill">v2.0</span>
      </div>

      <AppNav isAdmin={isAdmin} />

      <div className="sidebar-ride-card">
        <span className="eyebrow">Ready when you are</span>
        <strong>Turn today into a line.</strong>
        <Link href="/planner">
          Plan a route
          <ArrowUpRight size={16} />
        </Link>
      </div>

      <div className="sidebar-profile">
        <span className="avatar">{username.slice(0, 2).toUpperCase()}</span>
        <div>
          <strong>{username}</strong>
          <span>
            <Gauge size={13} />
            {fitnessLevel}
          </span>
        </div>
        <LogoutButton />
      </div>
    </aside>
  );
}

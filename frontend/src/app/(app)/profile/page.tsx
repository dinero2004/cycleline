import Link from "next/link";
import { ArrowRight, Mountain, Route as RouteIcon, Ruler } from "lucide-react";
import { DangerZone, PasswordCard } from "@/components/profile/account-security";
import { BikeGarage } from "@/components/profile/bike-garage";
import { ProfileForm } from "@/components/profile/profile-form";
import { backendFetch } from "@/lib/backend";
import { plannerHref } from "@/lib/route-links";
import { requireSession } from "@/lib/session";
import type { SavedRoute, UserProfile } from "@/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Profile" };

const km = new Intl.NumberFormat("en-CH", { maximumFractionDigits: 0 });
const memberSince = new Intl.DateTimeFormat("en-CH", { month: "long", year: "numeric" });

export default async function ProfilePage() {
  const session = await requireSession();
  const [{ user }, { routes }] = await Promise.all([
    backendFetch<{ user: UserProfile }>("me", { token: session.accessToken }),
    backendFetch<{ routes: SavedRoute[] }>("routes", { token: session.accessToken }).catch(() => ({ routes: [] as SavedRoute[] })),
  ]);

  const distance = routes.reduce((sum, route) => sum + Number(route.distance_km || 0), 0);
  const climbing = routes.reduce((sum, route) => sum + (route.elevation_gain_m || 0), 0);
  const stats = [
    { label: "Saved routes", value: String(user.routes_count), icon: RouteIcon },
    { label: "Distance planned", value: `${km.format(distance)} km`, icon: Ruler },
    { label: "Climbing planned", value: `${km.format(climbing)} m`, icon: Mountain },
  ];

  return (
    <div className="app-page profile-page">
      <header className="profile-header">
        <span className="profile-avatar" aria-hidden="true">
          {user.username.slice(0, 2).toUpperCase()}
        </span>
        <div className="profile-identity">
          <h1>{user.username}</h1>
          <p>
            {user.bio || "No bio yet."} <span className="profile-since">Member since {memberSince.format(new Date(user.created_at))}.</span>
          </p>
        </div>
      </header>

      <dl className="profile-stats">
        {stats.map(({ label, value, icon: Icon }) => (
          <div key={label}>
            <dt>
              <Icon size={16} aria-hidden="true" /> {label}
            </dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      <div className="profile-sections">
        <ProfileForm user={user} />
        <BikeGarage bikes={user.bikes} />

        <section className="card" aria-labelledby="routes-title">
          <header className="card-header">
            <div>
              <h2 id="routes-title" className="card-title">
                Saved routes
              </h2>
              <p className="card-description">Your latest routes. Open the library to ride, export or share them.</p>
            </div>
            <Link href="/routes" className="button button-secondary button-small">
              All routes <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </header>
          {routes.length ? (
            <ul className="profile-routes">
              {routes.slice(0, 3).map((route) => (
                <li key={route.id}>
                  <Link href={plannerHref(route)}>
                    <strong>{route.name}</strong>
                    <span>
                      {route.start_name} → {route.end_name}
                    </span>
                  </Link>
                  <span className="profile-route-facts">
                    {km.format(Number(route.distance_km))} km · {km.format(route.elevation_gain_m)} m
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-inline">
              <RouteIcon size={22} aria-hidden="true" />
              <p>
                No saved routes yet. <Link href="/planner">Plan your first one</Link>.
              </p>
            </div>
          )}
        </section>

        <PasswordCard username={user.username} />
        <DangerZone username={user.username} />
      </div>
    </div>
  );
}

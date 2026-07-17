import Link from "next/link";
import { Bike, Heart, Map, Mountain, Route, Timer, Trash2 } from "lucide-react";
import { auth } from "@/auth";
import { deleteRouteAction, toggleFavoriteRouteAction } from "@/app/actions";
import { backendFetch } from "@/lib/backend";
import { DownloadGpxButton } from "@/components/download-gpx-button";
import { RoutePreview } from "@/components/route-preview";
import type { SavedRoute } from "@/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Saved routes" };

export default async function RoutesPage() {
  const session = await auth();
  const response = await backendFetch<{ routes: SavedRoute[] }>("routes", {
    token: session!.accessToken,
  }).catch(() => ({ routes: [] }));

  return (
    <div className="app-page routes-page">
      <header className="app-page-header">
        <div>
          <span className="eyebrow">Personal library</span>
          <h1>Routes you chose to keep.</h1>
          <p>Every saved line belongs to your account and can be downloaded as GPX.</p>
        </div>
        <Link href="/planner" className="button button-dark">
          <Map size={18} /> Plan another
        </Link>
      </header>

      {response.routes.length ? (
        <div className="route-library">
          {response.routes.map((route, index) => (
            <article key={route.id} className="route-library-card">
              <div className="route-card-visual">
                <RoutePreview route={route} accent={index % 3 === 1 ? "coral" : index % 3 === 2 ? "blue" : "acid"} />
                <span>{route.route_type}</span>
              </div>
              <div className="route-card-main">
                <div className="route-card-heading">
                  <div>
                    <span>{route.profile} · {route.difficulty}</span>
                    <h2>{route.name}</h2>
                  </div>
                  {route.is_favorite && <Heart size={18} fill="currentColor" />}
                </div>
                <p className="route-places">{route.start_name} → {route.end_name}</p>
                {route.description && <p className="route-description">{route.description}</p>}
                <div className="route-facts">
                  <span>
                    <strong>{route.distance_km}</strong> km
                  </span>
                  <span>
                    <Timer size={15} /> {Math.floor(route.duration_minutes / 60)}h {route.duration_minutes % 60}m
                  </span>
                  <span>
                    <Mountain size={15} /> {route.elevation_gain_m} m
                  </span>
                  <span>
                    <Bike size={15} /> {route.bike?.name ?? "No bike"}
                  </span>
                </div>
              </div>
              <div className="route-card-actions">
                <DownloadGpxButton route={route} />
                <form action={toggleFavoriteRouteAction}>
                  <input type="hidden" name="route_id" value={route.id} />
                  <input type="hidden" name="is_favorite" value={String(route.is_favorite)} />
                  <button className="icon-button" aria-label={route.is_favorite ? "Remove favorite" : "Add favorite"}>
                    <Heart size={17} fill={route.is_favorite ? "currentColor" : "none"} />
                  </button>
                </form>
                <form action={deleteRouteAction}>
                  <input type="hidden" name="route_id" value={route.id} />
                  <button className="icon-button danger" aria-label={`Delete ${route.name}`}>
                    <Trash2 size={17} />
                  </button>
                </form>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state large">
          <Route size={32} />
          <h2>No saved routes yet.</h2>
          <p>Plan a real cycle route, review the line, then save it to your personal library.</p>
          <Link href="/planner" className="button button-acid">
            Plan your first route
          </Link>
        </div>
      )}
    </div>
  );
}

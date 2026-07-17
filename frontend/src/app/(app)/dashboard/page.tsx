import Link from "next/link";
import {
  ArrowRight,
  Bike,
  CalendarDays,
  ChevronRight,
  Map,
  Mountain,
  Route as RouteIcon,
  Sparkles,
  Timer,
} from "lucide-react";
import { auth } from "@/auth";
import { backendFetch } from "@/lib/backend";
import { RoutePreview } from "@/components/route-preview";
import type { NewsArticle, RouteSuggestion, SavedRoute, UserProfile } from "@/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  const token = session!.accessToken;

  const [profileResponse, routesResponse, suggestionsResponse, newsResponse] = await Promise.all([
    backendFetch<{ user: UserProfile }>("me", { token }).catch(() => null),
    backendFetch<{ routes: SavedRoute[] }>("routes", { token }).catch(() => ({ routes: [] })),
    backendFetch<{ suggestions: RouteSuggestion[]; profile: { target_distance_km: number } }>(
      "routes/suggestions",
      { token },
    ).catch(() => ({ suggestions: [], profile: { target_distance_km: 0 } })),
    backendFetch<{ data: NewsArticle[] }>("news?limit=3").catch(() => ({ data: [] })),
  ]);

  const profile = profileResponse?.user;
  const routes = routesResponse.routes;
  const totalDistance = routes.reduce((sum, route) => sum + Number(route.distance_km), 0);
  const weeklyDistance = routes
    .slice(0, 3)
    .reduce((sum, route) => sum + Number(route.distance_km), 0);
  const weeklyGoal = profile?.weekly_distance_goal ?? 100;
  const weeklyProgress = Math.min(100, Math.round((weeklyDistance / weeklyGoal) * 100));

  return (
    <div className="app-page dashboard-page">
      <header className="app-page-header">
        <div>
          <span className="eyebrow">
            <CalendarDays size={14} />
            Your ride desk
          </span>
          <h1>Good to see you, {session?.user.username}.</h1>
          <p>Your next good ride is already taking shape.</p>
        </div>
        <Link href="/planner" className="button button-dark">
          <Map size={18} /> Plan a route
        </Link>
      </header>

      <section className="metric-grid">
        <article className="metric-card primary">
          <span>Routes saved</span>
          <strong>{routes.length.toString().padStart(2, "0")}</strong>
          <small>
            <RouteIcon size={14} /> Personal library
          </small>
        </article>
        <article className="metric-card">
          <span>Total distance</span>
          <strong>{Math.round(totalDistance)}</strong>
          <small>kilometres planned</small>
        </article>
        <article className="metric-card coral">
          <span>Weekly goal</span>
          <strong>{weeklyProgress}%</strong>
          <small>{weeklyDistance.toFixed(1)} of {weeklyGoal} km</small>
        </article>
        <article className="metric-card">
          <span>Default bike</span>
          <strong className="metric-word">{profile?.bikes.find((bike) => bike.is_default)?.name ?? "Add one"}</strong>
          <small>
            <Bike size={14} /> {profile?.bikes.find((bike) => bike.is_default)?.type ?? "No bike selected"}
          </small>
        </article>
      </section>

      <div className="dashboard-grid">
        <section className="content-panel recent-panel">
          <div className="panel-heading-row">
            <div>
              <span className="eyebrow">Your library</span>
              <h2>Recent routes</h2>
            </div>
            <Link href="/routes" className="text-link">
              View all <ChevronRight size={16} />
            </Link>
          </div>

          {routes.length ? (
            <div className="compact-route-list">
              {routes.slice(0, 3).map((route, index) => (
                <Link href="/routes" key={route.id} className="compact-route">
                  <div className="compact-route-map">
                    <RoutePreview route={route} accent={index === 1 ? "coral" : index === 2 ? "blue" : "acid"} />
                  </div>
                  <div className="compact-route-copy">
                    <span>{route.profile} · {route.difficulty}</span>
                    <strong>{route.name}</strong>
                    <small>{route.start_name} → {route.end_name}</small>
                  </div>
                  <div className="compact-route-stats">
                    <strong>{route.distance_km} km</strong>
                    <span>
                      <Mountain size={13} /> {route.elevation_gain_m} m
                    </span>
                  </div>
                  <ChevronRight size={18} />
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty-state compact">
              <RouteIcon size={24} />
              <h3>No saved lines yet.</h3>
              <p>Your first planned route will appear here.</p>
              <Link href="/planner" className="button button-acid button-small">
                Plan now <ArrowRight size={16} />
              </Link>
            </div>
          )}
        </section>

        <aside className="content-panel goal-panel">
          <div className="panel-heading-row">
            <div>
              <span className="eyebrow">This week</span>
              <h2>{weeklyGoal} km goal</h2>
            </div>
            <Sparkles size={20} />
          </div>
          <div className="goal-ring" style={{ "--progress": `${weeklyProgress * 3.6}deg` } as React.CSSProperties}>
            <div>
              <strong>{weeklyProgress}%</strong>
              <span>planned</span>
            </div>
          </div>
          <p>
            {weeklyProgress >= 100
              ? "Goal complete. Keep the next ride easy."
              : `${Math.max(0, weeklyGoal - weeklyDistance).toFixed(1)} km left to shape this week.`}
          </p>
          <Link href="/profile" className="text-link">
            Adjust goal <ChevronRight size={16} />
          </Link>
        </aside>
      </div>

      <section className="suggestion-section">
        <div className="panel-heading-row">
          <div>
            <span className="eyebrow">Matched to your profile</span>
            <h2>Suggested next lines</h2>
          </div>
          <span className="target-pill">
            <Timer size={14} /> Target {suggestionsResponse.profile.target_distance_km} km
          </span>
        </div>
        <div className="suggestion-grid">
          {suggestionsResponse.suggestions.map((suggestion, index) => (
            <article key={suggestion.id} className={`suggestion-card suggestion-${index + 1}`}>
              <div className="suggestion-number">0{index + 1}</div>
              <span>{suggestion.surface}</span>
              <h3>{suggestion.title}</h3>
              <p>{suggestion.start_name} → {suggestion.end_name}</p>
              <div>
                <strong>{suggestion.distance_km} km</strong>
                <small>{suggestion.difficulty}</small>
              </div>
              <Link
                href={`/planner?start=${encodeURIComponent(suggestion.start_name)}&end=${encodeURIComponent(suggestion.end_name)}`}
                aria-label={`Open ${suggestion.title} in the planner`}
              >
                <ArrowRight size={18} />
              </Link>
            </article>
          ))}
        </div>
      </section>

      {newsResponse.data.length > 0 && (
        <section className="dashboard-news">
          <div className="panel-heading-row">
            <div>
              <span className="eyebrow">Ride journal</span>
              <h2>Worth knowing before you roll</h2>
            </div>
            <Link href="/news" className="text-link">
              All stories <ChevronRight size={16} />
            </Link>
          </div>
          <div className="dashboard-news-grid">
            {newsResponse.data.map((article) => (
              <Link key={article.id} href={`/news/${article.slug}`}>
                <span>{article.category}</span>
                <strong>{article.title}</strong>
                <p>{article.excerpt}</p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

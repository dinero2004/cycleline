import { auth } from "@/auth";
import { backendFetch } from "@/lib/backend";
import { RoutePlanner } from "@/components/route-planner";
import type { UserProfile } from "@/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Route planner" };

export default async function PlannerPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string; end?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;
  const response = await backendFetch<{ user: UserProfile }>("me", {
    token: session!.accessToken,
  }).catch(() => null);

  return (
    <div className="app-page planner-page">
      <header className="app-page-header">
        <div>
          <span className="eyebrow">Route studio</span>
          <h1>Build a line worth riding.</h1>
          <p>Choose two places, the bike, and the kind of surface you want under your tyres.</p>
        </div>
      </header>
      <RoutePlanner
        bikes={response?.user.bikes ?? []}
        fitnessLevel={response?.user.fitness_level ?? session!.user.fitnessLevel}
        initialStart={params.start}
        initialEnd={params.end}
      />
    </div>
  );
}

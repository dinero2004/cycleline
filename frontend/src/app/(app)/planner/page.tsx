import { backendFetch } from "@/lib/backend";
import { fitnessFor, rideProfileForBike } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { MemberStudio } from "@/components/studio/member-studio";
import type { UserProfile } from "@/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Route studio" };

export default async function PlannerPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string; end?: string; w?: string; p?: string; n?: string }>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const response = await backendFetch<{ user: UserProfile }>("me", {
    token: session.accessToken,
  }).catch(() => null);
  const bikes = response?.user.bikes ?? [];
  const bike = bikes.find((b) => b.is_default) ?? bikes[0];

  return (
    <div className="studio-page">
      <h1 className="visually-hidden">Route studio: build a line worth riding</h1>
      <MemberStudio
        fitness={fitnessFor(response?.user.fitness_level ?? session.user.fitnessLevel)}
        profile={bike ? rideProfileForBike(bike.type) : "road"}
        bikeId={bike?.id ?? null}
        params={params}
      />
    </div>
  );
}

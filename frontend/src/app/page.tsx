import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ChevronRight, Download, Mountain, Route } from "lucide-react";
import { HeroMockup } from "@/components/home/hero-mockup";
import { PublicFooter } from "@/components/public-footer";
import { PublicHeader } from "@/components/public-header";
import { ElevationChart } from "@/components/viz/elevation-chart";
import { SurfaceBar } from "@/components/viz/surface-bar";
import { SurfaceRouteShape } from "@/components/viz/surface-route-shape";
import { SAMPLE_ROUTES } from "@/data/samples";
import { buildGpx } from "@/lib/routing/gpx";
import { estimateDurationS, formatDuration } from "@/lib/routing/metrics";
import type { Fitness, RideProfile } from "@/lib/routing/types";

const PROFILE_LABEL: Record<RideProfile, string> = {
  road: "Road",
  gravel: "Gravel",
  mtb: "MTB",
  ebike: "E-bike",
  commuter: "Commuter",
};

const FITNESS: { level: Fitness; label: string }[] = [
  { level: "beginner", label: "Beginner" },
  { level: "intermediate", label: "Intermediate" },
  { level: "strong", label: "Strong" },
];

export default function HomePage() {
  const [gravel, road] = SAMPLE_ROUTES;
  const gpxPreview = buildGpx({
    name: road.name,
    coordinates: road.route.geometry.coordinates.slice(0, 3),
    time: new Date("2026-01-01T00:00:00Z"),
  })
    .split("\n")
    .slice(0, 12)
    .join("\n");

  return (
    <div className="marketing-page">
      <PublicHeader />

      <main id="main">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-backdrop" aria-hidden="true" />
          <div className="hero-inner">
            <div className="hero-copy">
              <span className="eyebrow">Cycling route planner</span>
              <h1 id="hero-title">
                Routes that
                <span className="outline-text">ride better.</span>
              </h1>
              <p>
                CycleLine turns a destination, your current fitness, and the bike in your garage into a route you will
                actually want to ride.
              </p>
              <div className="hero-actions">
                <Link href="/planner" className="button button-primary">
                  Start planning
                  <ArrowRight size={18} />
                </Link>
                <Link href="#routes" className="button button-secondary">
                  Explore sample routes
                </Link>
              </div>
              <dl className="hero-proof">
                <div>
                  <dt>Ride profiles</dt>
                  <dd>5</dd>
                </div>
                <div>
                  <dt>Fitness levels for ride time</dt>
                  <dd>3</dd>
                </div>
                <div>
                  <dt>Export to your bike computer</dt>
                  <dd>.GPX</dd>
                </div>
              </dl>
            </div>
            <HeroMockup sample={gravel} />
          </div>
        </section>

        <section className="bento-section" id="features" aria-labelledby="features-title">
          <div className="section-heading">
            <span className="eyebrow">What you get</span>
            <h2 id="features-title">
              Planning that
              <span className="outline-text">starts with you.</span>
            </h2>
            <p>
              Most route tools stop at a line on a map. CycleLine remembers the rider, the bike, and the kind of day you
              are trying to have.
            </p>
          </div>

          <div className="bento">
            <article className="bento-card">
              <div className="bento-copy">
                <span className="eyebrow">01 · Route builder</span>
                <h3>Route with context</h3>
                <p>
                  Click to add waypoints and the line snaps to rideable roads and paths as you draw. Every stretch is
                  tagged paved, gravel or trail from OpenStreetMap, and unknown surfaces are shown as unknown.
                </p>
              </div>
              <div className="bento-visual map-visual">
                <SurfaceRouteShape
                  route={gravel.route}
                  label={`${gravel.name} drawn by surface, with ${gravel.route.waypoints.length} waypoints`}
                />
                <SurfaceBar mix={gravel.route.surfaceMix} inferredM={gravel.route.inferredSurfaceM} />
              </div>
            </article>

            <article className="bento-card">
              <div className="bento-copy">
                <span className="eyebrow">02 · Elevation & metrics</span>
                <h3>Match your form</h3>
                <p>
                  Climbing and descending, a gradient overlay that marks the steep parts, and a ride time that depends
                  on your fitness, the surface and the grade.
                </p>
              </div>
              <div className="bento-visual">
                <ElevationChart
                  points={road.route.elevation}
                  segments={road.route.segments}
                  height={110}
                  label={`Elevation profile of ${road.name}`}
                />
                <dl className="metric-row">
                  <div>
                    <dt>Up / down</dt>
                    <dd>
                      +{road.route.ascentM} / −{road.route.descentM} m
                    </dd>
                  </div>
                  <div>
                    <dt>Max grade</dt>
                    <dd>{road.route.maxGradePct}%</dd>
                  </div>
                  {FITNESS.map(({ level, label }) => (
                    <div key={level}>
                      <dt>{label}</dt>
                      <dd>{formatDuration(estimateDurationS(road.route, level))}</dd>
                    </div>
                  ))}
                </dl>
                <p className="bento-note">
                  {road.name}, {(road.route.distanceM / 1000).toFixed(1)} km. Ride time without stops.
                </p>
              </div>
            </article>

            <article className="bento-card">
              <div className="bento-copy">
                <span className="eyebrow">03 · Export</span>
                <h3>Take it to your bike</h3>
                <p>
                  Download a .gpx with the track, your waypoints and elevation. Load it into Garmin Connect, the Wahoo
                  app or the Hammerhead dashboard and it is on your bike computer.
                </p>
              </div>
              <div className="bento-visual">
                <pre className="gpx-preview" aria-label="Start of an exported GPX file">
                  <code>{gpxPreview}</code>
                </pre>
                <ul className="device-list" aria-label="Works with">
                  <li>Garmin</li>
                  <li>Wahoo</li>
                  <li>Hammerhead</li>
                </ul>
              </div>
            </article>

            <article className="bento-card bento-wide" id="routes" aria-labelledby="routes-title">
              <div className="bento-copy">
                <span className="eyebrow">04 · Saved routes</span>
                <h3 id="routes-title">Keep every good route</h3>
                <p>
                  Save the lines you want to ride and build a personal library. These three were planned with
                  CycleLine around Zürich.
                </p>
              </div>
              <ul className="route-cards">
                {SAMPLE_ROUTES.map((sample) => (
                  <li key={sample.slug} className="route-card">
                    <div className="route-card-photo">
                      <Image src={sample.image} alt="" fill sizes="(max-width: 760px) 100vw, 380px" />
                      <span className="badge badge-distance">{(sample.route.distanceM / 1000).toFixed(1)} km</span>
                      <span className="badge badge-type">{PROFILE_LABEL[sample.profile]}</span>
                    </div>
                    <div className="route-card-body">
                      <h4>{sample.name}</h4>
                      <p>
                        {sample.startName} → {sample.endName}
                      </p>
                      <p className="route-card-climb">
                        <Mountain size={15} aria-hidden="true" /> {sample.route.ascentM} m climb
                      </p>
                      <SurfaceBar mix={sample.route.surfaceMix} inferredM={sample.route.inferredSurfaceM} />
                    </div>
                  </li>
                ))}
              </ul>
            </article>
          </div>
        </section>

        <section className="how-section" id="how-it-works" aria-labelledby="how-title">
          <div className="how-image">
            <Image
              src="/images/cycling/gravel-forest.png"
              alt="A gravel bicycle beside a forest route"
              fill
              sizes="(max-width: 900px) 100vw, 46vw"
            />
          </div>
          <div className="how-copy">
            <span className="eyebrow">How it works</span>
            <h2 id="how-title">
              Three decisions.
              <span className="outline-text">One better ride.</span>
            </h2>
            <ol>
              <li>
                <span>1</span>
                <div>
                  <strong>Tell us where</strong>
                  <p>Start with two places or open a route suggested for your profile.</p>
                </div>
              </li>
              <li>
                <span>2</span>
                <div>
                  <strong>Choose the ride</strong>
                  <p>Pick your bike, surface profile, and one-way or return format.</p>
                </div>
              </li>
              <li>
                <span>3</span>
                <div>
                  <strong>Make it yours</strong>
                  <p>Review the map, save it to your library, and come back when it is time to roll.</p>
                </div>
              </li>
            </ol>
            <Link href="/login" className="text-link">
              Open CycleLine
              <ChevronRight size={17} />
            </Link>
          </div>
        </section>

        <section className="final-cta" aria-labelledby="cta-title">
          <Route size={34} aria-hidden="true" />
          <h2 id="cta-title">
            Stop searching.
            <span className="outline-text">Start riding.</span>
          </h2>
          <p>Create an account, choose your bike, and turn a free afternoon into a saved line.</p>
          <div className="hero-actions">
            <Link href="/login" className="button button-primary">
              Create your CycleLine account
              <ArrowRight size={18} />
            </Link>
            <Link href="/planner" className="button button-secondary">
              <Download size={17} aria-hidden="true" /> Plan and export a route
            </Link>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}

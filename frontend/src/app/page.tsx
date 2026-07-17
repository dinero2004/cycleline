import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Bike,
  Check,
  ChevronRight,
  Gauge,
  MapPinned,
  Route,
  Sparkles,
} from "lucide-react";
import { PublicFooter } from "@/components/public-footer";
import { PublicHeader } from "@/components/public-header";

const features = [
  {
    number: "01",
    icon: MapPinned,
    title: "Route with context",
    text: "Build a real cycling line from place to place, choose your surface, and see distance, time, and climbing before you commit.",
  },
  {
    number: "02",
    icon: Gauge,
    title: "Match your form",
    text: "Your fitness level and preferred distance shape suggestions that are ambitious enough—without turning every ride into a test.",
  },
  {
    number: "03",
    icon: Bike,
    title: "Choose the right bike",
    text: "Keep your road, gravel, city, touring, mountain, or electric bike in one garage and attach the right one to every route.",
  },
];

const cyclingBrands = [
  {
    name: "Trek",
    src: "https://commons.wikimedia.org/wiki/Special:Redirect/file/2018_Trek_logo_word_mark_black.svg",
    width: 288,
    height: 34,
  },
  {
    name: "Specialized",
    src: "https://upload.wikimedia.org/wikipedia/en/5/52/Specialized_logo.svg",
    width: 300,
    height: 48,
  },
  {
    name: "Canyon",
    src: "https://commons.wikimedia.org/wiki/Special:Redirect/file/CanyonBicycles.svg",
    width: 1024,
    height: 144,
  },
  {
    name: "Giant",
    src: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Giant_bycicles_logo_2.svg",
    width: 550,
    height: 105,
  },
  {
    name: "Cannondale",
    src: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Cannondale_Logo.svg",
    width: 570,
    height: 74,
  },
  {
    name: "Brompton",
    src: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Brompton_Bicycle_logo_2019.svg",
    width: 147,
    height: 36,
  },
  {
    name: "Shimano",
    src: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Shimano_logo.svg",
    width: 121,
    height: 30,
  },
];

export default function HomePage() {
  return (
    <div className="marketing-page">
      <PublicHeader />

      <main>
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow-row">
              <span className="live-dot" />
              Personal route intelligence
            </div>
            <h1>
              Find your line.
              <span>Ride it your way.</span>
            </h1>
            <p>
              CycleLine turns a destination, your current fitness, and the bike in your garage into
              a route you will actually want to ride.
            </p>
            <div className="hero-actions">
              <Link href="/login" className="button button-acid">
                Build your first route
                <ArrowRight size={18} />
              </Link>
              <Link href="#how-it-works" className="text-link">
                See how it works
                <ChevronRight size={17} />
              </Link>
            </div>
            <div className="hero-proof">
              <div className="avatar-stack" aria-label="Rider community">
                <span>AR</span>
                <span>JM</span>
                <span>LK</span>
              </div>
              <p>
                <strong>Routes that fit real riders</strong>
                <span>No generic “one route fits all” planning.</span>
              </p>
            </div>
          </div>

          <div className="hero-visual">
            <Image
              src="/images/cycling/alpine-riders.png"
              alt="Three cyclists riding above an alpine lake"
              fill
              priority
              sizes="(max-width: 900px) 100vw, 48vw"
            />
            <div className="hero-route-line" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <div className="floating-metric floating-metric-top">
              <span>Suggested today</span>
              <strong>42.8 km</strong>
              <small>Gravel · 610 m up</small>
            </div>
            <div className="floating-metric floating-metric-bottom">
              <span className="metric-icon">
                <Sparkles size={18} />
              </span>
              <p>
                <strong>Good match</strong>
                <small>For intermediate fitness</small>
              </p>
            </div>
          </div>
        </section>

        <section className="signal-strip" aria-label="CycleLine benefits">
          <span>
            <Check size={15} /> Live cycling routes
          </span>
          <span>
            <Check size={15} /> Bike-aware planning
          </span>
          <span>
            <Check size={15} /> GPX-ready geometry
          </span>
          <span>
            <Check size={15} /> Private route library
          </span>
        </section>

        <section className="brand-showcase" aria-labelledby="brand-showcase-title">
          <div>
            <span className="eyebrow">Built for every garage</span>
            <h2 id="brand-showcase-title">Plan with the bikes riders already love.</h2>
            <p>Popular cycling brands shown as prototype placeholders, not endorsements or partnerships.</p>
          </div>
          <div
            className="brand-marquee"
            aria-label="Popular cycling brand logos. Focus or hover to pause the animation."
            tabIndex={0}
          >
            <div className="brand-track">
              {["primary", "duplicate"].map((group) => {
                const isDuplicate = group === "duplicate";

                return (
                  <div
                    className="brand-track-group"
                    aria-hidden={isDuplicate ? "true" : undefined}
                    key={group}
                  >
                    {cyclingBrands.map((brand) => (
                      <span className="brand-logo-card" key={`${group}-${brand.name}`}>
                        <Image
                          className="brand-logo-image"
                          src={brand.src}
                          alt={isDuplicate ? "" : `${brand.name} logo`}
                          width={brand.width}
                          height={brand.height}
                          sizes="220px"
                          unoptimized
                        />
                      </span>
                    ))}
                  </div>
                );
              })}
            </div>
            <span className="brand-marquee-hint" aria-hidden="true">
              Hover to pause
            </span>
          </div>
        </section>

        <section className="feature-section" id="features">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Built around the rider</span>
              <h2>Planning that starts with you.</h2>
            </div>
            <p>
              Most route tools stop at a line on a map. CycleLine remembers the rider, the bike, and
              the kind of day you are trying to have.
            </p>
          </div>
          <div className="feature-grid">
            {features.map(({ number, icon: Icon, title, text }) => (
              <article key={number} className="feature-card">
                <div>
                  <span>{number}</span>
                  <Icon size={22} />
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="how-section" id="how-it-works">
          <div className="how-image">
            <Image
              src="/images/cycling/gravel-forest.png"
              alt="A gravel bicycle beside a forest route"
              fill
              sizes="(max-width: 900px) 100vw, 46vw"
            />
            <span className="image-label">A quieter line through the forest</span>
          </div>
          <div className="how-copy">
            <span className="eyebrow">From idea to saved route</span>
            <h2>Three decisions. One better ride.</h2>
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
            <Link href="/login" className="button button-light">
              Open CycleLine
              <ArrowRight size={18} />
            </Link>
          </div>
        </section>

        <section className="final-cta">
          <Route size={38} />
          <span className="eyebrow">Your next ride starts here</span>
          <h2>Stop searching. Start riding.</h2>
          <p>Create an account, choose your bike, and turn a free afternoon into a saved line.</p>
          <Link href="/login" className="button button-acid">
            Create your CycleLine account
            <ArrowRight size={18} />
          </Link>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}

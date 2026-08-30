"use client";

import {
  ArrowLeftRight,
  Bell,
  Bike,
  Bookmark,
  BookmarkCheck,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  Clock3,
  CloudSun,
  Flag,
  Gauge,
  Layers3,
  LocateFixed,
  Map,
  MapPin,
  Menu,
  Minus,
  Mountain,
  Navigation,
  Plus,
  Route,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TriangleAlert,
  UserRound,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import "./cycleline-planner.css";

type Preference = "balanced" | "safer" | "faster" | "flatter";

type RouteOption = {
  id: number;
  label: string;
  time: string;
  minutes: number;
  distance: string;
  climb: string;
  safety: number;
  color: string;
  note: string;
};

const routes: RouteOption[] = [
  {
    id: 0,
    label: "Recommended",
    time: "24 min",
    minutes: 24,
    distance: "7.8 km",
    climb: "42 m",
    safety: 92,
    color: "#cbff45",
    note: "78% protected lanes",
  },
  {
    id: 1,
    label: "Quiet streets",
    time: "27 min",
    minutes: 27,
    distance: "8.2 km",
    climb: "36 m",
    safety: 96,
    color: "#ff835d",
    note: "Lowest traffic exposure",
  },
  {
    id: 2,
    label: "Fastest",
    time: "21 min",
    minutes: 21,
    distance: "7.4 km",
    climb: "58 m",
    safety: 78,
    color: "#d79cff",
    note: "3 min faster",
  },
];

const preferenceLabels: Record<Preference, string> = {
  balanced: "Balanced",
  safer: "Safer",
  faster: "Faster",
  flatter: "Flatter",
};

function NavButton({
  icon: Icon,
  label,
  active,
}: {
  icon: typeof Map;
  label: string;
  active?: boolean;
}) {
  return (
    <button className={`nav-button ${active ? "active" : ""}`} type="button">
      <Icon size={19} strokeWidth={active ? 2.4 : 2} />
      <span>{label}</span>
    </button>
  );
}

export default function Home() {
  const [origin, setOrigin] = useState("Zürich HB");
  const [destination, setDestination] = useState("Bellevueplatz");
  const [preference, setPreference] = useState<Preference>("balanced");
  const [selectedRoute, setSelectedRoute] = useState(0);
  const [saved, setSaved] = useState(false);
  const [showLayers, setShowLayers] = useState(false);
  const [showAlerts, setShowAlerts] = useState(true);
  const [showDetails, setShowDetails] = useState(true);
  const [mobilePlanner, setMobilePlanner] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setSaved(window.localStorage.getItem("cycleline-saved-route") === "true");
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 2600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const activeRoute = routes[selectedRoute];
  const readiness = useMemo(() => {
    if (preference === "faster") return 82;
    if (preference === "safer") return 96;
    return 91;
  }, [preference]);

  function swapLocations() {
    setOrigin(destination);
    setDestination(origin);
    setNotice("Route reversed");
  }

  function planRoute(event: FormEvent) {
    event.preventDefault();
    if (!origin.trim() || !destination.trim()) {
      setNotice("Add a start and destination");
      return;
    }
    const routeForPreference: Record<Preference, number> = {
      balanced: 0,
      safer: 1,
      faster: 2,
      flatter: 1,
    };
    setSelectedRoute(routeForPreference[preference]);
    setShowDetails(true);
    setNotice(`${preferenceLabels[preference]} route ready`);
  }

  function toggleSaved() {
    const next = !saved;
    setSaved(next);
    window.localStorage.setItem("cycleline-saved-route", String(next));
    setNotice(next ? "Route saved to My rides" : "Removed from saved rides");
  }

  return (
    <main className="planner-app-shell">
      <aside className="sidebar" aria-label="Primary navigation">
        <a className="brand" href="#top" aria-label="CycleLine home">
          <span className="brand-mark"><Route size={22} strokeWidth={2.6} /></span>
          <span>CycleLine</span>
        </a>

        <nav className="side-nav">
          <NavButton icon={Map} label="Plan" active />
          <NavButton icon={Bookmark} label="Saved" />
          <NavButton icon={Gauge} label="Activity" />
        </nav>

        <div className="sidebar-bottom">
          <button className="profile-button" type="button">
            <span className="planner-avatar">LM</span>
            <span className="profile-copy"><strong>Lazar</strong><small>Zurich, CH</small></span>
            <ChevronRight size={16} />
          </button>
        </div>
      </aside>

      <section className="workspace" id="top">
        <header className="topbar">
          <button className="mobile-menu" type="button" aria-label="Open menu">
            <Menu size={21} />
          </button>
          <a className="planner-mobile-brand" href="#top">
            <span className="brand-mark"><Route size={19} strokeWidth={2.6} /></span>
            CycleLine
          </a>
          <div className="topbar-actions">
            <button className="city-button" type="button">
              <MapPin size={16} /> Zürich <ChevronDown size={14} />
            </button>
            <button className="planner-icon-button" type="button" aria-label="Notifications">
              <Bell size={18} />
              <span className="notification-dot" />
            </button>
            <button className="mini-avatar" type="button" aria-label="Open profile">LM</button>
          </div>
        </header>

        <div className="map-stage">
          <div
            className="map-canvas"
            style={{ "--map-zoom": zoom } as React.CSSProperties}
            aria-label="Route map from Zürich HB to Bellevueplatz"
          >
            <div className="district district-one">Kreis 5</div>
            <div className="district district-two">Old Town</div>
            <div className="district district-three">Enge</div>
            <div className="water"><span>Lake Zürich</span></div>
            <div className="park park-one" />
            <div className="park park-two" />

            <div className="road road-a" />
            <div className="road road-b" />
            <div className="road road-c" />
            <div className="road road-d" />
            <div className="road road-e" />
            <div className="road road-f" />
            <div className="road road-g" />

            <div className={`route-path route-main ${selectedRoute === 0 ? "selected" : "muted"}`}>
              <span className="route-segment r1" /><span className="route-segment r2" />
              <span className="route-segment r3" /><span className="route-segment r4" />
              <span className="route-segment r5" />
            </div>
            <div className={`route-path route-quiet ${selectedRoute === 1 ? "selected" : "muted"}`}>
              <span className="route-segment q1" /><span className="route-segment q2" />
              <span className="route-segment q3" /><span className="route-segment q4" />
            </div>
            <div className={`route-path route-fast ${selectedRoute === 2 ? "selected" : "muted"}`}>
              <span className="route-segment f1" /><span className="route-segment f2" />
              <span className="route-segment f3" /><span className="route-segment f4" />
            </div>

            <div className="map-pin start-pin"><span><Navigation size={14} fill="currentColor" /></span></div>
            <div className="map-pin end-pin"><span><Flag size={14} fill="currentColor" /></span></div>

            {showAlerts && (
              <>
                <button className="hazard hazard-one" type="button" aria-label="Roadworks reported">
                  <TriangleAlert size={15} />
                  <span>Roadworks</span>
                </button>
                <button className="hazard hazard-two" type="button" aria-label="Busy junction reported">
                  <TriangleAlert size={15} />
                </button>
              </>
            )}

            <div className="map-tools" aria-label="Map controls">
              <div className="tool-group layers-wrap">
                <button
                  className={`map-tool ${showLayers ? "active" : ""}`}
                  type="button"
                  aria-label="Map layers"
                  aria-expanded={showLayers}
                  onClick={() => setShowLayers(!showLayers)}
                >
                  <Layers3 size={18} />
                </button>
                {showLayers && (
                  <div className="layer-popover">
                    <strong>Map layers</strong>
                    <label><input type="checkbox" defaultChecked /> Cycle network</label>
                    <label><input type="checkbox" checked={showAlerts} onChange={(event) => setShowAlerts(event.target.checked)} /> Live alerts</label>
                    <label><input type="checkbox" defaultChecked /> Parks & water</label>
                  </div>
                )}
              </div>
              <div className="tool-group">
                <button className="map-tool" type="button" aria-label="Zoom in" onClick={() => setZoom((value) => Math.min(1.15, value + 0.05))}><Plus size={18} /></button>
                <button className="map-tool" type="button" aria-label="Zoom out" onClick={() => setZoom((value) => Math.max(0.9, value - 0.05))}><Minus size={18} /></button>
              </div>
              <button className="map-tool" type="button" aria-label="Center on my location" onClick={() => setNotice("Map centered on your location")}><LocateFixed size={18} /></button>
            </div>
          </div>

          <section className={`planner-card ${mobilePlanner ? "mobile-open" : "mobile-closed"}`} aria-label="Plan a ride">
            <div className="planner-heading">
              <div>
                <h1>Choose your line.</h1>
                <p>Fast, quiet or flat — make the ride yours.</p>
              </div>
              <button className="close-mobile" type="button" aria-label="Hide planner" onClick={() => setMobilePlanner(false)}><X size={20} /></button>
            </div>

            <form onSubmit={planRoute}>
              <div className="location-fields">
                <span className="location-line" aria-hidden="true" />
                <div className="location-field">
                  <span className="field-icon start-dot" />
                  <span className="field-copy"><small>Start</small>
                    <input value={origin} onChange={(event) => setOrigin(event.target.value)} aria-label="Starting point" />
                  </span>
                  <button type="button" className="field-action" aria-label="Use my location" onClick={() => { setOrigin("My location"); setNotice("Using your current location"); }}><LocateFixed size={17} /></button>
                </div>

                <button className="swap-button" type="button" onClick={swapLocations} aria-label="Swap start and destination"><ArrowLeftRight size={16} /></button>

                <div className="location-field">
                  <MapPin className="destination-icon" size={18} />
                  <span className="field-copy"><small>Destination</small>
                    <input value={destination} onChange={(event) => setDestination(event.target.value)} aria-label="Destination" />
                  </span>
                  <button type="button" className="field-action" aria-label="Search destination"><Search size={17} /></button>
                </div>
              </div>

              <div className="preference-block">
                <div className="section-label-row">
                  <span>Route preference</span>
                  <button type="button" onClick={() => setNotice("Advanced preferences coming up")}><SlidersHorizontal size={14} /> Fine-tune</button>
                </div>
                <div className="segment-control" role="radiogroup" aria-label="Route preference">
                  {(["balanced", "safer", "faster", "flatter"] as Preference[]).map((item) => (
                    <button
                      type="button"
                      role="radio"
                      aria-checked={preference === item}
                      className={preference === item ? "active" : ""}
                      onClick={() => setPreference(item)}
                      key={item}
                    >
                      {item === "balanced" && <Sparkles size={14} />}
                      {item === "safer" && <ShieldCheck size={14} />}
                      {item === "faster" && <Clock3 size={14} />}
                      {item === "flatter" && <Mountain size={14} />}
                      {preferenceLabels[item]}
                    </button>
                  ))}
                </div>
              </div>

              <button className="primary-button" type="submit"><Navigation size={17} fill="currentColor" /> Find my line</button>
            </form>

            <div className="quick-commute">
              <div className="commute-icon"><CalendarClock size={18} /></div>
              <div><strong>After-work loop</strong><span>Studio → Adlisberg · 48 min</span></div>
              <button type="button" aria-label="Plan after-work loop" onClick={() => { setOrigin("Studio"); setDestination("Adlisberg"); setNotice("After-work loop loaded"); }}><ChevronRight size={17} /></button>
            </div>
          </section>

          {mobilePlanner && <div className="mobile-scrim" onClick={() => setMobilePlanner(false)} aria-hidden="true" />}

          {!mobilePlanner && (
            <button className="mobile-plan-button" type="button" onClick={() => setMobilePlanner(true)}><Navigation size={17} fill="currentColor" /> Plan a ride</button>
          )}

          <section className={`route-panel ${showDetails ? "expanded" : "collapsed"}`} aria-label="Route options">
            <button className="panel-handle" type="button" onClick={() => setShowDetails(!showDetails)} aria-label={showDetails ? "Collapse route details" : "Expand route details"}>
              <span />
            </button>
            <div className="route-panel-heading">
              <div>
                <h2>{showDetails ? "Pick your line" : `${activeRoute.time} · ${activeRoute.distance}`}</h2>
                {showDetails && <p>Three good options, compared clearly.</p>}
              </div>
              <button className={`save-button ${saved ? "saved" : ""}`} type="button" onClick={toggleSaved}>
                {saved ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}
                {saved ? "Saved" : "Save"}
              </button>
            </div>

            {showDetails && (
              <>
                <div className="route-options">
                  {routes.map((route) => (
                    <button
                      type="button"
                      className={`route-option ${selectedRoute === route.id ? "selected" : ""}`}
                      onClick={() => setSelectedRoute(route.id)}
                      key={route.id}
                      style={{ "--route-color": route.color } as React.CSSProperties}
                    >
                      <span className="route-radio"><i /></span>
                      <span className="route-copy">
                        <span className="route-title"><strong>{route.label}</strong>{route.id === 0 && <em>Best fit</em>}</span>
                        <span className="route-meta"><b>{route.time}</b><span>{route.distance}</span><span>{route.climb} climb</span></span>
                        <span className="route-note"><ShieldCheck size={13} /> {route.safety} safety · {route.note}</span>
                      </span>
                    </button>
                  ))}
                </div>

                <div className="ride-readiness">
                  <div className="readiness-score"><span>{readiness}</span><small>/ 100</small></div>
                  <div className="readiness-copy"><strong>Great conditions</strong><span>Dry roads, light wind, daylight throughout</span></div>
                  <div className="weather-mini"><CloudSun size={20} /><strong>18°</strong><span>NW 7</span></div>
                </div>

                <div className="route-actions">
                  <button className="start-button" type="button" onClick={() => setNotice("Navigation started — ride safely")}><Navigation size={17} fill="currentColor" /> Ride this line</button>
                  <button className="secondary-button" type="button" onClick={() => setNotice("Departure set for 07:45")}><Clock3 size={17} /> Leave at 07:45</button>
                </div>
              </>
            )}
          </section>

          <button className="report-button" type="button" onClick={() => setNotice("Tap a location to report a hazard")}><TriangleAlert size={16} /> Report</button>
        </div>
      </section>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        <NavButton icon={Map} label="Plan" active />
        <NavButton icon={Bookmark} label="Saved" />
        <button className="mobile-ride-button" type="button" onClick={() => setNotice("Ride recording started")}><Bike size={20} /><span>Ride</span></button>
        <NavButton icon={Gauge} label="Activity" />
        <NavButton icon={UserRound} label="Profile" />
      </nav>

      {notice && <div className="toast" role="status"><ShieldCheck size={17} />{notice}</div>}
    </main>
  );
}

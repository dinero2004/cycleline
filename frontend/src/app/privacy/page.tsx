import Link from "next/link";
import { PublicFooter } from "@/components/public-footer";
import { PublicHeader } from "@/components/public-header";

export const metadata = { title: "Privacy notice" };

export default function PrivacyPage() {
  return (
    <div className="marketing-page">
      <PublicHeader />
      <main className="legal-page">
        <header>
          <p className="eyebrow">Legal</p>
          <h1>Privacy notice</h1>
          <p className="legal-lead">
            What CycleLine stores, why, and who else sees it. It follows the Swiss Federal Act on Data Protection (FADP).
          </p>
        </header>

        <section className="legal-section" aria-labelledby="controller">
          <h2 id="controller">Who is responsible</h2>
          <p>
            Minkov Digital, Lazar Minkov, Scheunerweg 28, 3063 Ittigen, Switzerland. See the <Link href="/imprint">imprint</Link>.
          </p>
        </section>

        <section className="legal-section" aria-labelledby="account">
          <h2 id="account">Your account</h2>
          <p>
            When you create an account we store your email address, username and password (only as a secure hash), plus what you add
            yourself: a short bio, fitness level, distance goals, your bikes and your saved routes. We use it to run your account and
            to tailor route suggestions, nothing else. We don&apos;t sell it and don&apos;t use it for advertising.
          </p>
          <p>You can change these details on your profile at any time, and delete your account there; that removes your routes and bikes too.</p>
        </section>

        <section className="legal-section" aria-labelledby="planning">
          <h2 id="planning">Planning routes</h2>
          <ul>
            <li>
              Place searches, waypoints and route requests go from our server to routing and map services (BRouter, Nominatim by the
              OpenStreetMap Foundation, Open-Meteo for elevation and, where set up, Valhalla or GraphHopper). They receive the
              coordinates and search words, not your account details or your IP address.
            </li>
            <li>
              Map tiles load straight from OpenStreetMap and OpenTopoMap servers, so those servers see your IP address, like any
              website you visit.
            </li>
            <li>
              Your location is used only when you press &ldquo;Use my location&rdquo;. Your browser asks first; the position becomes
              the start of your route and is not stored unless you save the route.
            </li>
          </ul>
        </section>

        <section className="legal-section" aria-labelledby="assistant">
          <h2 id="assistant">Route assistant</h2>
          <p>
            If you use the route assistant, your message and the waypoints of the route on screen are sent to the AI provider that
            runs it (Anthropic, or a Llama model on a server we choose) to produce the answer. Don&apos;t put personal details in
            your messages.
          </p>
        </section>

        <section className="legal-section" aria-labelledby="device">
          <h2 id="device">Stored on your device</h2>
          <p>
            A sign-in cookie keeps you logged in. Your browser&apos;s local storage keeps your light or dark theme choice, unsaved
            route drafts and demo drafts until you sign up. There are no tracking or advertising cookies.
          </p>
        </section>

        <section className="legal-section" aria-labelledby="hosting">
          <h2 id="hosting">Hosting</h2>
          <p>
            The website runs on Vercel and is delivered through Cloudflare; both process technical request data such as IP addresses
            to deliver and protect the site. The CycleLine database runs on a server operated by Minkov Digital.
          </p>
        </section>

        <section className="legal-section" aria-labelledby="rights">
          <h2 id="rights">Your rights</h2>
          <p>
            You can ask what we store about you, have it corrected or deleted, and complain to the Federal Data Protection and
            Information Commissioner (FDPIC). Write to the address above.
          </p>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}

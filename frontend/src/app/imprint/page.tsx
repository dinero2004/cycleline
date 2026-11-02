import Link from "next/link";
import { PublicFooter } from "@/components/public-footer";
import { PublicHeader } from "@/components/public-header";

export const metadata = { title: "Imprint" };

export default function ImprintPage() {
  return (
    <div className="marketing-page">
      <PublicHeader />
      <main className="legal-page">
        <header>
          <p className="eyebrow">Legal</p>
          <h1>Imprint</h1>
        </header>

        <section className="card legal-card" aria-labelledby="operator">
          <h2 id="operator">Operator of CycleLine</h2>
          <address>
            <strong>Minkov Digital</strong>
            <span>Lazar Minkov</span>
            <span>Scheunerweg 28</span>
            <span>3063 Ittigen</span>
            <span>Switzerland</span>
          </address>
          <dl className="legal-facts">
            <div>
              <dt>Legal form</dt>
              <dd>Sole proprietorship (Einzelunternehmen)</dd>
            </div>
            <div>
              <dt>Responsible person</dt>
              <dd>Lazar Minkov</dd>
            </div>
            <div>
              <dt>UID</dt>
              <dd>CHE-384.253.212</dd>
            </div>
          </dl>
        </section>

        <section className="legal-section" aria-labelledby="liability">
          <h2 id="liability">Routes and liability</h2>
          <p>
            CycleLine suggests routes from OpenStreetMap data and public routing services. Roads, paths and conditions change: check
            every route yourself, follow local traffic rules and signs, and ride at your own risk. We accept no liability for the
            accuracy, completeness or currency of routes, surfaces, elevation or ride times.
          </p>
          <p>Links to other websites are outside our responsibility; their operators are responsible for their content.</p>
        </section>

        <section className="legal-section" aria-labelledby="credits">
          <h2 id="credits">Map data and credits</h2>
          <p>
            Map data © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>, available under the Open
            Database License. Topographic tiles by OpenTopoMap (CC-BY-SA). Routing by BRouter; elevation by Open-Meteo.
          </p>
        </section>

        <p className="legal-more">
          How we handle your data: <Link href="/privacy">privacy notice</Link>.
        </p>
      </main>
      <PublicFooter />
    </div>
  );
}

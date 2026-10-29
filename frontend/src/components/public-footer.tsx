import Link from "next/link";
import { Logo } from "@/components/logo";

export function PublicFooter() {
  return (
    <footer className="public-footer">
      <div className="public-footer-inner">
        <div className="footer-brand">
          <Logo />
          <p>Plan with intent. Ride your line.</p>
        </div>
        <nav className="footer-links" aria-label="Footer">
          <Link href="/news">Ride journal</Link>
          <Link href="/login">Account</Link>
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
            Map data
          </a>
        </nav>
        <p className="footer-copy">© {new Date().getFullYear()} CycleLine</p>
      </div>
    </footer>
  );
}

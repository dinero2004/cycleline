import Link from "next/link";
import { Logo } from "@/components/logo";

export function PublicFooter() {
  return (
    <footer className="public-footer">
      <div>
        <Logo />
        <p>Plan with intent. Ride your line.</p>
      </div>
      <div className="footer-links">
        <Link href="/news">Ride journal</Link>
        <Link href="/login">Account</Link>
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
          Map data
        </a>
      </div>
      <p>© {new Date().getFullYear()} CycleLine</p>
    </footer>
  );
}

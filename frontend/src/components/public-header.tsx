import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { auth } from "@/auth";
import { Logo } from "@/components/logo";
import { MobileMenu } from "@/components/mobile-menu";
import { ThemeToggle } from "@/components/theme-toggle";

const links = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/news", label: "Ride journal" },
  { href: "/#features", label: "Features" },
];

export async function PublicHeader() {
  const session = await auth();
  const account = session
    ? { href: "/dashboard", label: "Open dashboard" }
    : { href: "/login", label: "Log in" };

  return (
    <header className="public-header">
      <div className="public-header-inner">
        <Logo />
        <nav aria-label="Primary navigation" className="public-nav">
          {links.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="public-header-actions">
          <ThemeToggle />
          <Link className="nav-login" href={account.href}>
            {account.label}
          </Link>
          <Link className="button button-primary button-small" href="/planner">
            Plan a route
            <ArrowUpRight size={16} />
          </Link>
        </div>
        <MobileMenu links={[...links, account]} />
      </div>
    </header>
  );
}

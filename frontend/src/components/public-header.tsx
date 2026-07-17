import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { auth } from "@/auth";
import { Logo } from "@/components/logo";

export async function PublicHeader() {
  const session = await auth();

  return (
    <header className="public-header">
      <Logo />
      <nav aria-label="Primary navigation">
        <Link href="/#how-it-works">How it works</Link>
        <Link href="/news">Ride journal</Link>
        <Link href="/#features">Features</Link>
      </nav>
      <Link className="button button-dark button-small" href={session ? "/dashboard" : "/login"}>
        {session ? "Open dashboard" : "Start riding"}
        <ArrowUpRight size={16} />
      </Link>
    </header>
  );
}

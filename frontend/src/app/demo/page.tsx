import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LogoMark } from "@/components/logo";
import { GuestStudio } from "@/components/studio/guest-studio-loader";
import { ThemeToggle } from "@/components/theme-toggle";
import Link from "next/link";

export const metadata = {
  title: "Try Route Studio",
  description: "Plan a cycling route without an account: real routing, elevation, surface mix and GPX export.",
};

export default async function DemoPage({ searchParams }: { searchParams: Promise<{ w?: string; p?: string; n?: string }> }) {
  const session = await auth();
  const params = await searchParams;
  // Signed-in riders get the full studio with the same plan.
  if (session) redirect(`/planner${params.w ? `?${new URLSearchParams(params as Record<string, string>)}` : ""}`);

  return (
    <div className="demo-page">
      <header className="demo-header">
        <Link href="/" className="logo" aria-label="CycleLine home">
          <LogoMark />
          <span className="logo-word">CycleLine</span>
        </Link>
        <span className="eyebrow">Route studio · demo</span>
        <ThemeToggle />
        <Link href="/login" className="nav-login">
          Log in
        </Link>
      </header>
      <main className="demo-main" id="main">
        <h1 className="visually-hidden">Route Studio demo</h1>
        <GuestStudio params={params} />
      </main>
    </div>
  );
}

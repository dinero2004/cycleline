import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Check } from "lucide-react";
import { auth } from "@/auth";
import { AuthPanel } from "@/components/auth-panel";
import { Logo } from "@/components/logo";

export const metadata = {
  title: "Sign in",
};

const BENEFITS = ["Save every route and ride it again", "Suggestions that match your fitness", "Your bikes, ready for the next line"];

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const session = await auth();
  const { mode } = await searchParams;
  if (session) {
    redirect("/dashboard");
  }

  return (
    <main className="auth-page">
      <section className="auth-visual">
        <Image src="/images/cycling/city-community.png" alt="" fill priority sizes="(max-width: 960px) 0vw, 48vw" />
        <div className="auth-visual-content">
          <Logo />
          <div>
            <p className="auth-visual-title">Keep the routes worth riding again.</p>
            <ul>
              {BENEFITS.map((benefit) => (
                <li key={benefit}>
                  <Check size={16} aria-hidden="true" /> {benefit}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="auth-form-side">
        <header className="auth-topbar">
          <Link href="/" className="back-link">
            <ArrowLeft size={16} aria-hidden="true" /> CycleLine
          </Link>
          <span className="auth-brand">
            <Logo />
          </span>
        </header>
        <AuthPanel initialMode={mode === "register" ? "register" : "login"} />
        <p className="auth-legal">
          By continuing you agree to keep the rubber side down, and to our <Link href="/privacy">privacy notice</Link>.{" "}
          <Link href="/imprint">Imprint</Link>
        </p>
      </section>
    </main>
  );
}

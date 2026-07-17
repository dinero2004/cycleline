import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { auth } from "@/auth";
import { AuthPanel } from "@/components/auth-panel";
import { Logo } from "@/components/logo";

export const metadata = {
  title: "Sign in",
};

export default async function LoginPage() {
  const session = await auth();
  if (session) {
    redirect("/dashboard");
  }

  return (
    <main className="auth-page">
      <section className="auth-visual">
        <Image
          src="/hero-images/cofeeride.png"
          alt="Cyclists exploring a mountain road"
          fill
          priority
          sizes="(max-width: 900px) 0vw, 52vw"
        />
        <div className="auth-visual-overlay" />
        <div className="auth-visual-content">
          <Logo />
          <div>
            <span className="eyebrow">One account. Every ride.</span>
            <h2>Keep the routes worth riding again.</h2>
            <ul>
              <li>
                <CheckCircle2 size={18} /> Personal route library
              </li>
              <li>
                <CheckCircle2 size={18} /> Fitness-aware suggestions
              </li>
              <li>
                <CheckCircle2 size={18} /> Your complete bike garage
              </li>
            </ul>
          </div>
        </div>
      </section>
      <section className="auth-form-side">
        <Link href="/" className="back-link">
          <ArrowLeft size={16} /> Back to CycleLine
        </Link>
        <AuthPanel />
        <p className="auth-legal">By continuing, you agree to keep the rubber side down.</p>
      </section>
    </main>
  );
}

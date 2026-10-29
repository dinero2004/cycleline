import { AppSidebar } from "@/components/app-sidebar";
import { LogoMark } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { requireSession } from "@/lib/session";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <AppSidebar
        username={session.user.username}
        fitnessLevel={session.user.fitnessLevel}
        isAdmin={session.user.isAdmin}
      />
      <main className="app-main" id="main">
        <div className="mobile-brand">
          <span className="mobile-brand-logo">
            <LogoMark size={18} />
            CycleLine
          </span>
          <span className="mobile-brand-user">{session.user.username}</span>
          <ThemeToggle />
        </div>
        {children}
      </main>
    </div>
  );
}

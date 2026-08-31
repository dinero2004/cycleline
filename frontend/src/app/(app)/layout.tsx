import { AppSidebar } from "@/components/app-sidebar";
import { requireSession } from "@/lib/session";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();

  return (
    <div className="app-shell">
      <AppSidebar
        username={session.user.username}
        fitnessLevel={session.user.fitnessLevel}
        isAdmin={session.user.isAdmin}
      />
      <main className="app-main">
        <div className="mobile-brand">
          <span>CycleLine</span>
          <span>{session.user.username}</span>
        </div>
        {children}
      </main>
    </div>
  );
}

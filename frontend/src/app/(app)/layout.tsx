import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppSidebar } from "@/components/app-sidebar";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

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

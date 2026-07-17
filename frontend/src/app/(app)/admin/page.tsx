import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { auth } from "@/auth";
import { backendFetch } from "@/lib/backend";
import { AdminConsole } from "@/components/admin-console";
import type { AdminStats, AdminUser, NewsArticle } from "@/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin" };

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user.isAdmin) {
    redirect("/dashboard");
  }

  const token = session.accessToken;
  const [statsResponse, usersResponse, newsResponse] = await Promise.all([
    backendFetch<{ stats: AdminStats }>("admin/dashboard", { token }),
    backendFetch<{ data: AdminUser[] }>("admin/users?limit=100", { token }),
    backendFetch<{ articles: NewsArticle[] }>("admin/news", { token }),
  ]);

  return (
    <div className="app-page admin-page">
      <header className="app-page-header">
        <div>
          <span className="eyebrow">
            <ShieldCheck size={14} /> Operations
          </span>
          <h1>CycleLine control room.</h1>
          <p>Manage users, ride data, access, and the public news journal.</p>
        </div>
      </header>
      <AdminConsole
        stats={statsResponse.stats}
        users={usersResponse.data}
        articles={newsResponse.articles}
        currentUserId={session.user.id}
      />
    </div>
  );
}

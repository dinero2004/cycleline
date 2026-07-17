"use client";

import { useState, useTransition } from "react";
import {
  Bike,
  FileText,
  KeyRound,
  LoaderCircle,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import {
  adminDeleteUserAction,
  adminResetDataAction,
  adminResetPasswordAction,
  adminUpdateUserAction,
  createNewsAction,
  deleteNewsAction,
  generateNewsDraftAction,
} from "@/app/actions";
import type { AdminStats, AdminUser, NewsArticle } from "@/types";

function ConfirmButton({
  children,
  message,
  className = "button button-ghost button-small",
  ariaLabel,
}: {
  children: React.ReactNode;
  message: string;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <button
      className={className}
      aria-label={ariaLabel}
      onClick={(event) => {
        if (!window.confirm(message)) {
          event.preventDefault();
        }
      }}
    >
      {children}
    </button>
  );
}

function NewsComposer() {
  const [isPending, startTransition] = useTransition();
  const [topic, setTopic] = useState("");
  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("Local");
  const [imageUrl, setImageUrl] = useState("");
  const [status, setStatus] = useState<"draft" | "published">("draft");

  function generate() {
    if (topic.trim().length < 3) {
      toast.error("Add a topic first.");
      return;
    }

    startTransition(async () => {
      const response = await generateNewsDraftAction({ topic, category });
      if (!response.ok || !response.draft) {
        toast.error(response.message);
        return;
      }
      setTitle(response.draft.title ?? "");
      setExcerpt(response.draft.excerpt ?? "");
      setBody(response.draft.body ?? "");
      toast.success(response.message);
    });
  }

  function save() {
    startTransition(async () => {
      const response = await createNewsAction({
        title,
        excerpt,
        body,
        category,
        image_url: imageUrl,
        status,
      });
      if (response.ok) {
        toast.success(response.message);
        setTopic("");
        setTitle("");
        setExcerpt("");
        setBody("");
        setImageUrl("");
      } else {
        toast.error(response.message);
      }
    });
  }

  return (
    <section className="content-panel news-composer">
      <div className="panel-heading-row">
        <div>
          <span className="eyebrow">Editorial desk</span>
          <h2>Create a news article</h2>
        </div>
        <span className="target-pill">
          <Sparkles size={14} /> Draft helper
        </span>
      </div>

      <div className="draft-generator">
        <label>
          Story topic
          <input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="e.g. spring maintenance checks" />
        </label>
        <label>
          Category
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option>Local</option>
            <option>Training</option>
            <option>Gear</option>
            <option>Safety</option>
            <option>Community</option>
          </select>
        </label>
        <button type="button" className="button button-dark" onClick={generate} disabled={isPending}>
          {isPending ? <LoaderCircle className="spin" size={17} /> : <Sparkles size={17} />}
          Generate starter draft
        </button>
      </div>

      <div className="stack-form">
        <label>
          Title
          <input value={title} onChange={(event) => setTitle(event.target.value)} minLength={5} required />
        </label>
        <label>
          Excerpt
          <textarea value={excerpt} onChange={(event) => setExcerpt(event.target.value)} minLength={20} required />
        </label>
        <label>
          Article
          <textarea className="article-editor" value={body} onChange={(event) => setBody(event.target.value)} minLength={80} required />
        </label>
        <label>
          Cover image URL
          <input value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} type="url" placeholder="https://images.unsplash.com/…" />
        </label>
        <div className="composer-actions">
          <label>
            Status
            <select value={status} onChange={(event) => setStatus(event.target.value as "draft" | "published")}>
              <option value="draft">Save as draft</option>
              <option value="published">Publish now</option>
            </select>
          </label>
          <button type="button" className="button button-acid" onClick={save} disabled={isPending || !title || !excerpt || body.length < 80}>
            {isPending && <LoaderCircle className="spin" size={17} />}
            {status === "published" ? "Publish article" : "Save draft"}
          </button>
        </div>
      </div>
    </section>
  );
}

export function AdminConsole({
  stats,
  users,
  articles,
  currentUserId,
}: {
  stats: AdminStats;
  users: AdminUser[];
  articles: NewsArticle[];
  currentUserId: string;
}) {
  const [tab, setTab] = useState<"users" | "news">("users");

  return (
    <>
      <section className="metric-grid admin-metrics">
        <article className="metric-card primary">
          <span>Accounts</span>
          <strong>{stats.users}</strong>
          <small><Users size={14} /> registered riders</small>
        </article>
        <article className="metric-card">
          <span>Routes</span>
          <strong>{stats.routes}</strong>
          <small>{stats.distance_km} km planned</small>
        </article>
        <article className="metric-card coral">
          <span>Bikes</span>
          <strong>{stats.bikes}</strong>
          <small><Bike size={14} /> in rider garages</small>
        </article>
        <article className="metric-card">
          <span>Published</span>
          <strong>{stats.published_articles}</strong>
          <small><FileText size={14} /> journal stories</small>
        </article>
      </section>

      <div className="admin-tabs">
        <button type="button" className={tab === "users" ? "active" : undefined} onClick={() => setTab("users")}>
          <Users size={17} /> Users and access
        </button>
        <button type="button" className={tab === "news" ? "active" : undefined} onClick={() => setTab("news")}>
          <FileText size={17} /> News and drafts
        </button>
      </div>

      {tab === "users" ? (
        <section className="content-panel admin-users">
          <div className="panel-heading-row">
            <div>
              <span className="eyebrow">User management</span>
              <h2>Accounts and ride data</h2>
            </div>
            <span className="target-pill">
              <ShieldCheck size={14} /> Admin protected
            </span>
          </div>
          <div className="admin-table">
            <div className="admin-table-head">
              <span>Rider</span>
              <span>Activity</span>
              <span>Fitness</span>
              <span>Role</span>
              <span>Actions</span>
            </div>
            {users.map((user) => (
              <article key={user.id} className="admin-user-row">
                <div className="admin-user">
                  <span>{user.username.slice(0, 2).toUpperCase()}</span>
                  <div>
                    <strong>{user.username}</strong>
                    <small>{user.email}</small>
                  </div>
                </div>
                <div className="admin-activity">
                  <strong>{user.routes_count}</strong> routes
                  <small>{user.bikes_count} bikes</small>
                </div>
                <form action={adminUpdateUserAction} className="admin-inline-form">
                  <input type="hidden" name="user_id" value={user.id} />
                  <input type="hidden" name="is_admin" value={String(user.is_admin)} />
                  <select name="fitness_level" defaultValue={user.fitness_level} aria-label={`Fitness level for ${user.username}`}>
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                  <button className="icon-button" aria-label="Save fitness level">
                    <RefreshCcw size={15} />
                  </button>
                </form>
                <form action={adminUpdateUserAction} className="admin-role-form">
                  <input type="hidden" name="user_id" value={user.id} />
                  <input type="hidden" name="fitness_level" value={user.fitness_level} />
                  <input type="hidden" name="is_admin" value={String(!user.is_admin)} />
                  <button
                    className={user.is_admin ? "role-pill admin" : "role-pill"}
                    disabled={String(user.id) === currentUserId}
                  >
                    {user.is_admin ? "Admin" : "Rider"}
                  </button>
                </form>
                <div className="admin-actions">
                  <details>
                    <summary className="icon-button" aria-label="Reset password">
                      <KeyRound size={16} />
                    </summary>
                    <form action={adminResetPasswordAction} className="popover-form">
                      <strong>Set temporary password</strong>
                      <input type="hidden" name="user_id" value={user.id} />
                      <input name="password" type="password" placeholder="Minimum 10 characters" minLength={10} required />
                      <input name="password_confirmation" type="password" placeholder="Repeat password" minLength={10} required />
                      <button className="button button-dark button-small">Reset password</button>
                    </form>
                  </details>
                  <form action={adminResetDataAction}>
                    <input type="hidden" name="user_id" value={user.id} />
                    <ConfirmButton message={`Reset all routes, bikes, and profile preferences for ${user.username}?`}>
                      <RefreshCcw size={15} /> Reset data
                    </ConfirmButton>
                  </form>
                  <form action={adminDeleteUserAction}>
                    <input type="hidden" name="user_id" value={user.id} />
                    <ConfirmButton
                      message={`Permanently delete ${user.username} and all owned routes?`}
                      className="icon-button danger"
                      ariaLabel={`Delete ${user.username}`}
                    >
                      <Trash2 size={16} />
                    </ConfirmButton>
                  </form>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : (
        <div className="admin-news-grid">
          <NewsComposer />
          <section className="content-panel article-manager">
            <div className="panel-heading-row">
              <div>
                <span className="eyebrow">Content library</span>
                <h2>Published and draft</h2>
              </div>
              <span className="target-pill">{articles.length} articles</span>
            </div>
            <div className="article-admin-list">
              {articles.map((article) => (
                <article key={article.id}>
                  <div>
                    <span className={`status-pill ${article.status}`}>{article.status}</span>
                    <small>{article.category}</small>
                  </div>
                  <h3>{article.title}</h3>
                  <p>{article.excerpt}</p>
                  <form action={deleteNewsAction}>
                    <input type="hidden" name="article_id" value={article.id} />
                    <ConfirmButton
                      message={`Delete “${article.title}”?`}
                      className="icon-button danger"
                      ariaLabel={`Delete ${article.title}`}
                    >
                      <Trash2 size={16} />
                    </ConfirmButton>
                  </form>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  );
}

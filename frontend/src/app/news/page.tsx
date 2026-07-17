import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, CalendarDays } from "lucide-react";
import { backendFetch } from "@/lib/backend";
import { PublicFooter } from "@/components/public-footer";
import { PublicHeader } from "@/components/public-header";
import type { NewsArticle } from "@/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ride journal" };

export default async function NewsPage() {
  let articles: NewsArticle[] = [];

  try {
    const response = await backendFetch<{ data: NewsArticle[] }>("news?limit=12");
    articles = response.data;
  } catch {
    articles = [];
  }

  return (
    <div className="marketing-page">
      <PublicHeader />
      <main className="news-page">
        <header className="news-hero">
          <span className="eyebrow">Ride journal</span>
          <h1>Notes for better days on two wheels.</h1>
          <p>Local route changes, practical training advice, and gear guidance from CycleLine.</p>
        </header>

        {articles.length ? (
          <div className="news-grid">
            {articles.map((article, index) => (
              <article key={article.id} className={index === 0 ? "news-card featured" : "news-card"}>
                <Link href={`/news/${article.slug}`} className="news-image">
                  {article.image_url ? (
                    <Image
                      src={article.image_url}
                      alt=""
                      fill
                      sizes={index === 0 ? "(max-width: 900px) 100vw, 60vw" : "(max-width: 900px) 100vw, 30vw"}
                    />
                  ) : (
                    <span className="news-placeholder" />
                  )}
                </Link>
                <div>
                  <div className="article-meta">
                    <span>{article.category}</span>
                    <span>
                      <CalendarDays size={13} />
                      {article.published_at
                        ? new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(article.published_at))
                        : "Draft"}
                    </span>
                  </div>
                  <h2>
                    <Link href={`/news/${article.slug}`}>{article.title}</Link>
                  </h2>
                  <p>{article.excerpt}</p>
                  <Link href={`/news/${article.slug}`} className="text-link">
                    Read the story <ArrowUpRight size={16} />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <span>Journal offline</span>
            <h2>The API is taking a breather.</h2>
            <p>Start the Laravel backend to load the latest CycleLine stories.</p>
          </div>
        )}
      </main>
      <PublicFooter />
    </div>
  );
}

import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { backendFetch } from "@/lib/backend";
import { PublicFooter } from "@/components/public-footer";
import { PublicHeader } from "@/components/public-header";
import type { NewsArticle } from "@/types";

export const dynamic = "force-dynamic";

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let article: NewsArticle;

  try {
    const response = await backendFetch<{ article: NewsArticle }>(`news/${slug}`);
    article = response.article;
  } catch {
    notFound();
  }

  return (
    <div className="marketing-page">
      <PublicHeader />
      <main className="article-page">
        <Link href="/news" className="back-link">
          <ArrowLeft size={16} /> Back to journal
        </Link>
        <header>
          <div className="article-meta">
            <span>{article.category}</span>
            <span>
              <CalendarDays size={13} />
              {article.published_at
                ? new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(new Date(article.published_at))
                : ""}
            </span>
          </div>
          <h1>{article.title}</h1>
          <p>{article.excerpt}</p>
        </header>
        {article.image_url && (
          <div className="article-cover">
            <Image
              src={article.image_url}
              alt={`${article.title} cover`}
              fill
              priority
              sizes="(max-width: 1100px) 100vw, 1100px"
            />
          </div>
        )}
        <article className="article-body">
          {article.body.split(/\n{2,}/).map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </article>
      </main>
      <PublicFooter />
    </div>
  );
}

import type { NewsItem, StockMetadata } from "../types";

interface NewsApiArticle {
  title: string;
  description: string | null;
  content: string | null;
  url: string;
  source: { name: string };
  publishedAt: string;
}

export class NewsService {
  static async getNewsForDate(
    date: string,
    stock: StockMetadata
  ): Promise<NewsItem[]> {
    const { symbol, name, region } = stock;
    console.log(
      `[NewsService] Fetching news for ${symbol} (${name}) on ${date}`
    );

    try {
      // No guard here anymore — backend handles historical news via Google RSS fallback
      const params = new URLSearchParams({
        symbol: symbol,
        name: name,
        date: date,
        region: region || "US",
      });

      const response = await fetch(`/api/news?${params.toString()}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `HTTP error! status: ${response.status}`
        );
      }

      const data = await response.json();
      console.log(
        `[NewsService] Received ${data.articles?.length || 0} articles from API`
      );

      if (data.articles && data.articles.length > 0) {
        return data.articles.slice(0, 5).map((a: NewsApiArticle) => ({
          title: a.title,
          description: a.description || a.content || "",
          url: a.url,
          source: a.source.name,
          publishedAt: a.publishedAt,
        }));
      } else {
        console.log(
          `[NewsService] No articles found for ${symbol} on ${date}.`
        );
        return [];
      }
    } catch (err) {
      console.error("[NewsService] Real news fetch failed:", err);
      return [];
    }
  }
}

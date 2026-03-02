import type { NewsItem, StockMetadata, TimeRange } from "../types";

interface NewsApiArticle {
  title: string;
  description: string | null;
  content: string | null;
  url: string;
  source: { name: string };
  publishedAt: string;
  category?: "company" | "macro";
}

// TimeRange → API period 코드
const PERIOD_MAP: Record<TimeRange, string> = {
  "1M": "D",
  "3M": "D",
  "6M": "D",
  "1Y": "D",
  "5Y": "W",
  MAX: "M",
};

export class NewsService {
  static async getNewsForDate(
    date: string,
    stock: StockMetadata,
    timeRange: TimeRange = "1Y"
  ): Promise<NewsItem[]> {
    const { symbol, name, region } = stock;
    const period = PERIOD_MAP[timeRange];

    console.log(`[NewsService] ${symbol} | ${timeRange}(${period}) | ${date}`);

    try {
      const params = new URLSearchParams({
        symbol,
        name,
        date,
        region: region || "US",
        period,
      });

      const response = await fetch(`/api/news?${params.toString()}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `HTTP error! status: ${response.status}`
        );
      }

      const data = await response.json();
      console.log(`[NewsService] ${data.articles?.length || 0}건 수신`);

      if (data.articles && data.articles.length > 0) {
        return data.articles.map((a: NewsApiArticle) => ({
          title: a.title,
          description: a.description || a.content || "",
          url: a.url,
          source: a.source.name,
          publishedAt: a.publishedAt,
          category: a.category,
        }));
      }

      return [];
    } catch (err) {
      console.error("[NewsService] 뉴스 조회 실패:", err);
      return [];
    }
  }
}

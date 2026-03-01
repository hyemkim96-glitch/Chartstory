import type { NewsItem } from "../types";

interface NewsApiArticle {
  title: string;
  description: string | null;
  content: string | null;
  url: string;
  source: { name: string };
  publishedAt: string;
}

export class NewsService {
  private static readonly API_KEY = import.meta.env.VITE_NEWS_API_KEY;

  static async getNewsForDate(
    symbol: string,
    date: string
  ): Promise<NewsItem[]> {
    console.log(`Fetching news for ${symbol} on ${date}`);

    if (this.API_KEY) {
      try {
        // NewsAPI example (via Vite proxy)
        const response = await fetch(
          `/news-api/everything?q=${symbol}&from=${date}&to=${date}&sortBy=relevancy&apiKey=${this.API_KEY}`
        );
        const data = await response.json();

        if (data.status === "ok" && data.articles.length > 0) {
          return data.articles.slice(0, 5).map((a: NewsApiArticle) => ({
            title: a.title,
            description: a.description || a.content || "",
            url: a.url,
            source: a.source.name,
            publishedAt: a.publishedAt,
          }));
        }
      } catch (err) {
        console.error("NewsAPI Error:", err);
      }
    }

    // Default mock news
    await new Promise((resolve) => setTimeout(resolve, 800));
    return [
      {
        title: `${symbol} Strategic Outlook on ${date}`,
        description: `Analysts are evaluating the long-term impact of recent corporate decisions at ${symbol}. Trading volume remains above average as institutional players reposition their portfolios for the upcoming quarter.`,
        url: "#",
        source: "Market Insights",
        publishedAt: date,
      },
      {
        title: `Sector Report: Impact on ${symbol}`,
        description: `How the latest consumer feedback and tech innovations are driving market sentiment for companies like ${symbol}.`,
        url: "#",
        source: "Financial Daily",
        publishedAt: date,
      },
    ];
  }
}

import type { AISummary, NewsItem } from "../types";

export class AIService {
  private static readonly API_KEY = import.meta.env.VITE_GROQ_API_KEY;
  private static readonly API_URL =
    "https://api.groq.com/openai/v1/chat/completions";
  private static readonly MODEL = "llama-3.3-70b-versatile";

  static async summarizeNews(
    symbol: string,
    date: string,
    news: NewsItem[]
  ): Promise<AISummary> {
    if (news.length === 0) {
      throw new Error("No news articles found to summarize.");
    }

    if (!this.API_KEY) {
      console.warn("VITE_GROQ_API_KEY is missing. Returning mock data.");
      await new Promise((resolve) => setTimeout(resolve, 1500));
      return this.getMockSummary(symbol, date, news);
    }

    try {
      const newsContext = news
        .map(
          (n) =>
            `Source: ${n.source}\nTitle: ${n.title}\nContent: ${n.description}`
        )
        .join("\n\n");

      const prompt = `You are a financial analyst. Summarize the following news about ${symbol} for the date ${date}.
Provide a "headline", a "summary", and a "sentiment" (positive, negative, or neutral).
Format the output as JSON:
{
  "headline": "...",
  "summary": "...",
  "sentiment": "positive|negative|neutral"
}

News Articles:
${newsContext}`;

      const response = await fetch(this.API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.API_KEY}`,
        },
        body: JSON.stringify({
          model: this.MODEL,
          messages: [
            {
              role: "system",
              content:
                "You categorize and summarize stock market news accurately. Always respond with valid JSON only.",
            },
            { role: "user", content: prompt },
          ],
          temperature: 0,
          max_tokens: 1000,
        }),
      });

      if (!response.ok) {
        throw new Error(`Groq API error: ${response.status}`);
      }

      const data = await response.json();
      const responseText = data.choices[0].message.content;
      const cleaned = responseText.replace(/```json\n?|\n?```/g, "").trim();
      const result = JSON.parse(cleaned);

      return {
        headline: result.headline || `${symbol} Market Update`,
        content: result.summary || "Summary generation failed.",
        sentiment: result.sentiment || "neutral",
        date: date,
        sourceLinks: news.map((n) => ({ title: n.title, url: n.url })),
      };
    } catch (err) {
      console.error("Groq API Error:", err);
      return this.getMockSummary(symbol, date, news);
    }
  }

  private static getMockSummary(
    symbol: string,
    date: string,
    news: NewsItem[]
  ): AISummary {
    return {
      headline: `${symbol} Resilience Analyzed (${date})`,
      content: `[MOCK] ${symbol} demonstrated robustness on ${date}. Analyzing ${news.length} news signals suggests that market players are pricing in the latest sector rotation. Sentiment remains cautiously optimistic as volume stabilizes near key resistance levels.`,
      sentiment: "positive",
      date: date,
      sourceLinks: news.map((n) => ({ title: n.title, url: n.url })),
    };
  }
}

import type { AISummary, NewsItem } from "../types";

export class AIService {
  private static get apiKey() {
    return import.meta.env.VITE_GROQ_API_KEY;
  }
  private static readonly API_URL =
    "https://api.groq.com/openai/v1/chat/completions";
  private static readonly MODEL = "llama-3.3-70b-versatile";

  static async summarizeNews(
    symbol: string,
    date: string,
    news: NewsItem[]
  ): Promise<AISummary> {
    console.log(
      `[AIService] Summarizing news for ${symbol} on ${date}. Key present: ${!!this.apiKey}`
    );

    if (news.length === 0) {
      return {
        headline: "검색된 기사가 없습니다.",
        content: `${date} 기준 ${symbol}에 대해 검색된 주요 뉴스가 없습니다. NewsAPI(무료 버전) 정책상 30일 이전의 과거 뉴스는 조회가 제한될 수 있습니다.`,
        sentiment: "neutral",
        date: date,
        sourceLinks: [],
      };
    }

    if (!this.apiKey) {
      console.warn(
        "[AIService] VITE_GROQ_API_KEY가 없습니다. .env.local 혹은 Vercel 환경변수를 확인해주세요."
      );
      return {
        headline: "AI 요약 기능 비활성화",
        content:
          "VITE_GROQ_API_KEY 설정이 필요합니다. 환경변수 추가 후 로컬은 npm run dev를 재시작, Vercel은 다시 배포(Redeploy)해야 반영됩니다.",
        sentiment: "neutral",
        date: date,
        sourceLinks: news.map((n) => ({ title: n.title, url: n.url })),
      };
    }

    try {
      const newsContext = news
        .map(
          (n) => `출처: ${n.source}\n제목: ${n.title}\n내용: ${n.description}`
        )
        .join("\n\n");

      const prompt = `당신은 한국어로 응답하는 금융 애널리스트입니다. ${date} 기준 ${symbol}에 관한 다음 뉴스를 분석하고 한국어로 요약해 주세요.
반드시 아래 JSON 형식으로만 응답하세요 (마크다운 코드블록 없이):
{
  "headline": "한 문장의 핵심 헤드라인 (한국어)",
  "summary": "2~3문장의 분석 요약 (한국어)",
  "sentiment": "positive 또는 negative 또는 neutral"
}

뉴스 기사:
${newsContext}`;

      const response = await fetch(this.API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.MODEL,
          messages: [
            {
              role: "system",
              content:
                "주식 시장 뉴스를 정확하게 분석하고 한국어로 요약합니다. 반드시 유효한 JSON만 응답하세요.",
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.3,
          max_tokens: 1000,
        }),
      });

      if (!response.ok) {
        throw new Error(`Groq API 오류: ${response.status}`);
      }

      const data = await response.json();
      const responseText = data.choices[0].message.content;
      const cleaned = responseText.replace(/```json\n?|\n?```/g, "").trim();
      const result = JSON.parse(cleaned);

      return {
        headline: result.headline || `${symbol} 시장 업데이트`,
        content: result.summary || "요약 생성에 실패했습니다.",
        sentiment: result.sentiment || "neutral",
        date: date,
        sourceLinks: news.map((n) => ({ title: n.title, url: n.url })),
      };
    } catch (err) {
      console.error(
        `[AIService] AI 요약 오류 (API_KEY present: ${!!this.apiKey}):`,
        err
      );
      // Even if AI fails, at least show the news links if they exist
      return {
        headline: `${symbol} 뉴스 요약 실패`,
        content:
          "AI를 통한 뉴스 요약 중 오류가 발생했습니다. 하단의 참고 뉴스를 직접 확인해 주세요.",
        sentiment: "neutral",
        date: date,
        sourceLinks: news.map((n) => ({ title: n.title, url: n.url })),
      };
    }
  }

  // getMockSummary removed
}

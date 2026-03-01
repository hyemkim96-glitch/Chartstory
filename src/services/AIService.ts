import type { AISummary, NewsItem } from "../types";

export interface CandleInfo {
  open: number;
  high: number;
  low: number;
  close: number;
  changeRate: number; // (close - open) / open * 100
}

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
    news: NewsItem[],
    candle?: CandleInfo
  ): Promise<AISummary> {
    console.log(
      `[AIService] Summarizing news for ${symbol} on ${date}. Key present: ${!!this.apiKey}`
    );

    if (news.length === 0) {
      return {
        headline: "검색된 기사가 없습니다.",
        content: `${date} 기준 ${symbol}에 대해 검색된 주요 뉴스가 없습니다. 해당 시점에 특별한 시장 공시나 보도가 없었을 수 있습니다.`,
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
      // 종목 관련 기사 vs 거시/시장 기사 분리
      const companyNews = news.filter((n) => n.category !== "macro");
      const macroNews = news.filter((n) => n.category === "macro");

      const fmtArticles = (items: NewsItem[]) =>
        items
          .map(
            (n) =>
              `출처: ${n.source}\n제목: ${n.title}\n내용: ${n.description || ""}`
          )
          .join("\n\n");

      // 캔들 가격 변동 컨텍스트
      const priceContext = candle
        ? `\n[당일 주가 정보]\n시가: ${candle.open} / 고가: ${candle.high} / 저가: ${candle.low} / 종가: ${candle.close}\n등락률: ${candle.changeRate >= 0 ? "+" : ""}${candle.changeRate.toFixed(2)}%\n`
        : "";

      const companySection =
        companyNews.length > 0
          ? `[종목 직접 관련 뉴스]\n${fmtArticles(companyNews)}`
          : "[종목 직접 관련 뉴스]\n없음";

      const macroSection =
        macroNews.length > 0
          ? `[거시경제 / 시장 / 정치 / 글로벌 뉴스]\n${fmtArticles(macroNews)}`
          : "[거시경제 / 시장 / 정치 / 글로벌 뉴스]\n없음";

      const prompt = `당신은 한국어로 응답하는 전문 금융 애널리스트입니다.
${date} 기준 ${symbol} 주가 변동의 원인을 아래 뉴스를 바탕으로 분석해 주세요.
${priceContext}
주가는 단순히 해당 종목 뉴스만이 아니라 금리 결정, 정치 이벤트, 지정학적 리스크, 환율, 섹터 이슈, 글로벌 시장 동향 등 다양한 요인에 의해 움직입니다. 아래 두 카테고리의 뉴스를 모두 고려하여 가장 설득력 있는 원인을 분석하세요.

${companySection}

${macroSection}

반드시 아래 JSON 형식으로만 응답하세요 (마크다운 코드블록 없이):
{
  "headline": "한 문장의 핵심 헤드라인 — 주가 변동의 주된 원인 중심 (한국어)",
  "summary": "3~4문장 분석. 종목 자체 요인과 거시/외부 요인을 구분하여 설명. 어떤 요인이 더 지배적이었는지 판단 포함 (한국어)",
  "sentiment": "positive 또는 negative 또는 neutral"
}`;

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
                "주식 시장 뉴스와 거시경제 데이터를 종합 분석하는 전문 금융 애널리스트입니다. 종목 고유 요인뿐 아니라 금리, 정치, 지정학적 리스크 등 외부 요인도 반드시 고려합니다. 반드시 유효한 JSON만 응답하세요.",
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.3,
          max_tokens: 1200,
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
}

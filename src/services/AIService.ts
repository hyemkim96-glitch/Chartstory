import type { AISummary, NewsItem } from "../types";

// Deterministic pseudo-random from seed
function seededRand(seed: string): () => number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i);
    h |= 0;
  }
  return () => {
    h = Math.imul(2654435761, h ^ (h >>> 16));
    h |= 0;
    return (h >>> 0) / 0xffffffff;
  };
}

function pick<T>(arr: T[], rand: () => number): T {
  return arr[Math.floor(rand() * arr.length)];
}

const mockHeadlines = [
  (s: string) => `${s}, 기관 수급 집중 속 변동성 확대`,
  (s: string) => `${s} 주가 분기점 — 매수세 유입 여부가 관건`,
  (s: string) => `${s} 실적 기대감 선반영, 차익실현 압력 상존`,
  (s: string) => `${s} 섹터 모멘텀 주목 — 외국인 포지션 변화`,
  (s: string) => `${s} 단기 조정 후 반등 시도, 지지선 테스트`,
];

const mockContents = [
  (s: string, date: string) =>
    `${date} 기준, ${s}은 전일 대비 유의미한 가격 움직임을 보였습니다. 기관 투자자들의 순매수가 확인되며 수급 개선 기대감이 높아지고 있습니다. 단기 저항선 돌파 여부에 따라 추가 상승 가능성도 열려 있습니다.`,
  (s: string, date: string) =>
    `${date}, ${s} 주가는 거래량 증가와 함께 주요 기술적 지지선 근방에서 방향성을 모색 중입니다. 애널리스트들은 중장기 펀더멘털이 여전히 견조하다고 평가하며, 섹터 전반적인 재평가 가능성을 주시하고 있습니다.`,
  (s: string, date: string) =>
    `${date} ${s} 관련 주요 뉴스를 종합하면, 시장 참여자들의 심리가 다소 엇갈리는 양상입니다. 외국인 수급 방향이 단기 주가를 좌우할 전망이며, 차익실현 매물 소화 여부가 핵심 변수로 부각됩니다.`,
];

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
      throw new Error("요약할 뉴스 기사가 없습니다.");
    }

    if (!this.API_KEY) {
      console.warn("VITE_GROQ_API_KEY가 없습니다. 목업 데이터를 반환합니다.");
      await new Promise((resolve) => setTimeout(resolve, 1500));
      return this.getMockSummary(symbol, date, news);
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
          Authorization: `Bearer ${this.API_KEY}`,
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
      console.error("Groq API 오류:", err);
      return this.getMockSummary(symbol, date, news);
    }
  }

  private static getMockSummary(
    symbol: string,
    date: string,
    news: NewsItem[]
  ): AISummary {
    const rand = seededRand(`${symbol}::${date}::summary`);
    const sentiments: Array<"positive" | "negative" | "neutral"> = [
      "positive",
      "negative",
      "neutral",
    ];

    return {
      headline: pick(mockHeadlines, rand)(symbol),
      content: pick(mockContents, rand)(symbol, date),
      sentiment: pick(sentiments, rand),
      date: date,
      sourceLinks: news.map((n) => ({ title: n.title, url: n.url })),
    };
  }
}

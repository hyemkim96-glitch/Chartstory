import type { AISummary, NewsItem, TimeRange } from "../types";

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
    candle?: CandleInfo,
    timeRange: TimeRange = "1Y"
  ): Promise<AISummary> {
    console.log(
      `[AIService] Summarizing ${symbol} | ${timeRange} | ${date}. Key: ${!!this.apiKey}`
    );

    // 기간 레이블 (프롬프트용)
    const periodLabel: Record<TimeRange, string> = {
      "1M": "당일",
      "3M": "당일",
      "6M": "당일",
      "1Y": "당일",
      "5Y": "해당 주",
      MAX: "해당 월",
    };
    const periodStr = periodLabel[timeRange];

    // MAX(월봉)는 "2020년 3월", 5Y(주봉)는 "해당 주", 나머지는 날짜 그대로
    const dateLabel =
      timeRange === "MAX"
        ? `${new Date(date).getUTCFullYear()}년 ${new Date(date).getUTCMonth() + 1}월`
        : date;

    if (news.length === 0) {
      return {
        headline: "검색된 기사가 없습니다.",
        content: `${dateLabel} ${symbol}에 대해 검색된 주요 뉴스가 없습니다. 해당 시점에 특별한 시장 이슈가 없었을 수 있습니다.`,
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
          .map((n) => {
            const base = `출처: ${n.source}\n제목: ${n.title}`;
            return n.description ? `${base}\n내용: ${n.description}` : base;
          })
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

      // 년봉: 연도 중 가장 임팩트 컸던 사건 중심으로 분석 요청
      const yearlyInstruction =
        timeRange === "MAX"
          ? "\n이 월의 뉴스 중 주가 변동에 가장 큰 영향을 미친 핵심 사건 1~2개에 집중하여 분석해 주세요. 사소한 뉴스는 무시하고, 핵심 이벤트만 다루세요."
          : "";

      const prompt = `당신은 한국어로 응답하는 전문 금융 애널리스트입니다.
${dateLabel} ${symbol} 주가의 ${periodStr} 흐름과 변동 원인을 아래 뉴스를 바탕으로 분석해 주세요.${yearlyInstruction}
${priceContext}
주가는 종목 뉴스 외에도 금리, 정치 이벤트, 지정학적 리스크, 환율, 섹터 이슈, 글로벌 동향 등 다양한 요인에 의해 움직입니다. 두 카테고리 뉴스를 모두 고려하여 원인을 분석하세요.

${companySection}

${macroSection}

반드시 아래 JSON 형식으로만 응답하세요 (마크다운 코드블록 없이):
{
  "headline": "위 뉴스 제목에 실제로 등장한 단어(기업명·수치·사건명)를 그대로 사용한 25자 이내 헤드라인. '주가 상승/하락' 같은 추상적 표현 절대 금지. 예: '엔비디아 실적 서프라이즈·AI 수요 급등', '연준 75bp 인상·달러 강세 압박'",
  "summary": "2문장 이내의 간결한 종합 분석. 무엇이 왜 일어났는지 핵심만 (한국어)",
  "keyFactors": [
    "기업요인: 실적/경영/제품 등 종목 자체 원인 (없으면 생략)",
    "거시요인: 금리/환율/경기 등 경제적 원인 (없으면 생략)",
    "정치/외부: 정치·지정학·규제 등 외부 원인 (없으면 생략)"
  ],
  "sentiment": "positive 또는 negative 또는 neutral"
}
keyFactors는 실제로 해당하는 항목만 2~4개 포함하세요. 각 항목은 30자 이내로 간결하게.`;

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
        keyFactors: Array.isArray(result.keyFactors)
          ? result.keyFactors
          : undefined,
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

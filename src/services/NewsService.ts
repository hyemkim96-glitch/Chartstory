import type { NewsItem } from "../types";

interface NewsApiArticle {
  title: string;
  description: string | null;
  content: string | null;
  url: string;
  source: { name: string };
  publishedAt: string;
}

// Deterministic pseudo-random from a seed string
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

const events = [
  "어닝 서프라이즈 발표",
  "신제품 출시",
  "애널리스트 목표가 상향",
  "대형 기관 블록딜",
  "임원 지분 매입",
  "경쟁사 실적 부진",
  "금리 인상 우려",
  "규제 리스크 대두",
  "공급망 차질",
  "M&A 루머 부각",
  "분기 실적 예상치 하회",
  "CEO 교체 발표",
  "글로벌 매크로 불확실성",
  "섹터 순환매 유입",
  "자사주 매입 발표",
];

const outlooks = [
  "단기 변동성이 확대될 것으로 보인다",
  "중장기 펀더멘털은 견조하다는 평가가 우세하다",
  "기관 투자자들의 포지션 조정이 관찰된다",
  "리테일 투자자 심리가 엇갈리는 양상이다",
  "외국인 수급이 방향성을 좌우할 전망이다",
  "업사이드 모멘텀이 제한적일 수 있다",
  "섹터 전반에 걸친 재평가 가능성이 있다",
  "차익실현 매물 소화 여부가 관건이다",
];

const sources = [
  "한국경제",
  "매일경제",
  "연합인포맥스",
  "Bloomberg Korea",
  "Reuters",
  "Market Watch",
  "Financial Times",
];

export class NewsService {
  static async getNewsForDate(
    symbol: string,
    date: string
  ): Promise<NewsItem[]> {
    console.log(`[NewsService] Fetching news for ${symbol} on ${date}`);

    try {
      // Check if date is within last 30 days (NewsAPI free tier limit)
      const newsDate = new Date(date);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      if (newsDate < thirtyDaysAgo) {
        console.warn(
          `[NewsService] Date ${date} is older than 30 days. Real news might not be available.`
        );
      }

      const response = await fetch(
        `/api/news?symbol=${encodeURIComponent(symbol)}&date=${date}`
      );

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
          `[NewsService] No articles found for ${symbol} on ${date}. Using mock data.`
        );
      }
    } catch (err) {
      console.warn(
        "[NewsService] Real news fetch failed, falling back to mock:",
        err
      );
    }

    // Date-seeded mock news — different for every (symbol, date) combination
    await new Promise((resolve) => setTimeout(resolve, 800));

    const rand = seededRand(`${symbol}::${date}`);
    const rand2 = seededRand(`${symbol}::${date}::2`);

    const event1 = pick(events, rand);
    const event2 = pick(
      events.filter((e) => e !== event1),
      rand
    );
    const outlook1 = pick(outlooks, rand);
    const outlook2 = pick(
      outlooks.filter((o) => o !== outlook1),
      rand2
    );
    const source1 = pick(sources, rand);
    const source2 = pick(
      sources.filter((s) => s !== source1),
      rand2
    );

    return [
      {
        title: `${symbol} — ${event1} (${date})`,
        description: `${date} 기준 ${symbol}에서 ${event1}가 주목받고 있다. ${outlook1}는 전망이 나오며 시장 참여자들의 관심이 집중되고 있다.`,
        url: "#",
        source: source1,
        publishedAt: date,
      },
      {
        title: `[분석] ${symbol} ${event2} 영향 점검`,
        description: `${symbol}의 ${event2} 이슈가 수면 위로 부상했다. 전문가들은 ${outlook2}고 분석하며 단기 주가 흐름에 주목하고 있다.`,
        url: "#",
        source: source2,
        publishedAt: date,
      },
    ];
  }
}

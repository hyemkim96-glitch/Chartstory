// Vercel Serverless Function — NewsAPI proxy
// API key stays server-side; browser never sees NEWSAPI_KEY

const NEWSAPI_KEY = process.env.NEWSAPI_KEY ?? "";
const NEWSAPI_BASE = "https://newsapi.org/v2";

interface Article {
  title: string;
  description: string | null;
  content: string | null;
  url: string;
  source: { name: string };
  publishedAt: string;
  category?: "company" | "macro";
}

// ── 기간 범위 계산 ─────────────────────────────────────────────────────────
// period: "D" | "W" | "M" | "Y"
// date: 클릭한 캔들의 기준 날짜 (일봉=당일, 주봉=해당주 월요일, 월봉=1일, 년봉=1월1일)
function getDateRange(
  date: string,
  period: string
): { fromDate: string; toDate: string } {
  const d = new Date(date);

  if (period === "Y") {
    // 해당 연도 전체
    const year = d.getUTCFullYear();
    return {
      fromDate: `${year}-01-01`,
      toDate: `${year}-12-31`,
    };
  }

  if (period === "M") {
    // 해당 월 전체
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth(); // 0-indexed
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const mm = String(month + 1).padStart(2, "0");
    return {
      fromDate: `${year}-${mm}-01`,
      toDate: `${year}-${mm}-${String(lastDay).padStart(2, "0")}`,
    };
  }

  if (period === "W") {
    // 해당 주 전체 (월요일 ~ 일요일)
    const dow = d.getUTCDay(); // 0=Sun
    const monday = new Date(d);
    monday.setUTCDate(d.getUTCDate() - (dow === 0 ? 6 : dow - 1));
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);
    return {
      fromDate: monday.toISOString().split("T")[0],
      toDate: sunday.toISOString().split("T")[0],
    };
  }

  // "D" — 전날 ~ 당일
  const prev = new Date(d);
  prev.setUTCDate(d.getUTCDate() - 1);
  return {
    fromDate: prev.toISOString().split("T")[0],
    toDate: date,
  };
}

// ── NewsAPI helper ─────────────────────────────────────────────────────────
async function fetchNewsApi(
  query: string,
  fromDate: string,
  toDate: string,
  language: string,
  pageSize: number,
  category: "company" | "macro"
): Promise<Article[]> {
  const apiUrl = `${NEWSAPI_BASE}/everything?q=${encodeURIComponent(query)}&from=${fromDate}&to=${toDate}&sortBy=relevancy&language=${language}&pageSize=${pageSize}&apiKey=${NEWSAPI_KEY}`;
  const response = await fetch(apiUrl);
  const data = await response.json();
  return (data.articles ?? []).map((a: Article) => ({ ...a, category }));
}

// ── Google News RSS helper ─────────────────────────────────────────────────
async function fetchRSS(
  query: string,
  fromDate: string,
  toDate: string,
  hl: string,
  gl: string,
  ceid: string,
  category: "company" | "macro",
  limit = 5
): Promise<Article[]> {
  const googleUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}+after:${fromDate}+before:${toDate}&hl=${hl}&gl=${gl}&ceid=${ceid}`;
  const rssRes = await fetch(googleUrl);
  const rssText = await rssRes.text();

  const items: Article[] = [];
  const clean = (str: string) =>
    str.replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1").trim();

  for (const match of rssText.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const c = match[1];
    const title = c.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "";
    const link = c.match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? "";
    const pubDate = c.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] ?? "";
    const source = c.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] ?? "";

    if (title && link) {
      items.push({
        title: clean(title).replace(/ - .*$/, ""),
        description: null,
        content: null,
        url: clean(link),
        publishedAt: new Date(pubDate).toISOString(),
        source: { name: clean(source) },
        category,
      });
    }
    if (items.length >= limit) break;
  }
  return items;
}

// ── Main handler ─────────────────────────────────────────────────────────────
export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");

  if (!NEWSAPI_KEY) {
    return res.status(500).json({ error: "NEWSAPI_KEY가 설정되지 않았습니다." });
  }

  try {
    const url = new URL(req.url, "http://localhost");
    const symbol = url.searchParams.get("symbol") ?? "";
    const date = url.searchParams.get("date") ?? "";
    const name = url.searchParams.get("name") ?? "";
    const region = url.searchParams.get("region") ?? "US";
    const period = url.searchParams.get("period") ?? "D"; // D | W | M | Y

    if (!symbol || !date) {
      return res.status(400).json({ error: "symbol, date 파라미터가 필요합니다." });
    }

    const { fromDate, toDate } = getDateRange(date, period);
    console.log(
      `[api/news] ${symbol} | period=${period} | ${fromDate} ~ ${toDate}`
    );

    const language = region === "KR" ? "ko" : "en";
    const hl = region === "KR" ? "ko" : "en-US";
    const gl = region === "KR" ? "KR" : "US";
    const ceid = region === "KR" ? "KR:ko" : "US:en";

    // 검색 쿼리 구성
    // 년봉은 연도를 쿼리에 포함해 관련성 높이기
    const yearSuffix = period === "Y" ? ` ${new Date(date).getUTCFullYear()}년` : "";
    const stockQuery = name
      ? `${symbol} OR "${name}"${yearSuffix}`
      : symbol + yearSuffix;

    // KR은 시장/경제 + 국내정치를 분리해서 더 풍부하게 수집
    const macroQuery =
      region === "KR"
        ? "코스피 OR 한국은행 OR 기준금리 OR 환율 OR 외국인매도 OR 미중무역"
        : '"stock market" OR "Federal Reserve" OR "interest rate" OR "S&P 500" OR "inflation" OR "recession" OR "tariff"';

    const politicsQuery =
      region === "KR"
        ? "대통령 OR 탄핵 OR 계엄 OR 국회 OR 정치 OR 여야 OR 정권"
        : null; // 미국은 별도 정치 쿼리 불필요 (macro에 포함)

    // NewsAPI 무료 플랜은 30일 이내만 지원
    const diffDays =
      (Date.now() - new Date(fromDate).getTime()) / (1000 * 3600 * 24);

    let articles: Article[] = [];

    const companyLimit = period === "Y" ? 7 : 5;
    const macroLimit = period === "Y" ? 4 : 3;
    const politicsLimit = 3;

    if (diffDays > 28) {
      // ── Google News RSS fallback ────────────────────────────────────────
      const requests: Promise<Article[]>[] = [
        fetchRSS(stockQuery, fromDate, toDate, hl, gl, ceid, "company", companyLimit),
        fetchRSS(macroQuery, fromDate, toDate, hl, gl, ceid, "macro", macroLimit),
      ];
      if (politicsQuery) {
        requests.push(fetchRSS(politicsQuery, fromDate, toDate, hl, gl, ceid, "macro", politicsLimit));
      }
      const results = await Promise.all(requests);
      articles = results.flat();
    } else {
      // ── NewsAPI ────────────────────────────────────────────────────────
      const requests: Promise<Article[]>[] = [
        fetchNewsApi(stockQuery, fromDate, toDate, language, companyLimit, "company"),
        fetchNewsApi(macroQuery, fromDate, toDate, language, macroLimit, "macro"),
      ];
      if (politicsQuery) {
        requests.push(fetchNewsApi(politicsQuery, fromDate, toDate, language, politicsLimit, "macro"));
      }
      const results = await Promise.all(requests);
      articles = results.flat();
    }

    console.log(
      `[api/news] Total: ${articles.length} articles (company + macro)`
    );
    return res.status(200).json({ articles });
  } catch (err) {
    console.error("NewsAPI/RSS proxy 오류:", err);
    return res.status(500).json({ error: String(err) });
  }
}

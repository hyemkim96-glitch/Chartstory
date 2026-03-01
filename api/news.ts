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

    if (!symbol || !date) {
      return res.status(400).json({ error: "symbol, date 파라미터가 필요합니다." });
    }

    // ── 검색 쿼리 구성 ──────────────────────────────────────────────────────
    const stockQuery = name ? `${symbol} OR "${name}"` : symbol;

    // 거시경제 / 정치 / 글로벌 이슈 쿼리 (지역별)
    const macroQuery =
      region === "KR"
        ? "코스피 OR 한국은행 OR 기준금리 OR 환율 OR 국내증시 OR 미중무역"
        : '"stock market" OR "Federal Reserve" OR "interest rate" OR "S&P 500" OR "inflation" OR "recession" OR "tariff"';

    const language = region === "KR" ? "ko" : "en";
    const hl = region === "KR" ? "ko" : "en-US";
    const gl = region === "KR" ? "KR" : "US";
    const ceid = region === "KR" ? "KR:ko" : "US:en";

    // 날짜 범위: 전날 ~ 해당 날
    const d = new Date(date);
    const prev = new Date(d);
    prev.setDate(prev.getDate() - 1);
    const fromDate = prev.toISOString().split("T")[0];

    const diffDays = (Date.now() - d.getTime()) / (1000 * 3600 * 24);

    let articles: Article[] = [];

    if (diffDays > 28) {
      // ── Google News RSS fallback (오래된 날짜) ───────────────────────────
      console.log(`[api/news] Old date (${Math.floor(diffDays)}d ago) → RSS`);

      const [stockItems, macroItems] = await Promise.all([
        fetchRSS(stockQuery, fromDate, date, hl, gl, ceid, "company", 6),
        fetchRSS(macroQuery, fromDate, date, hl, gl, ceid, "macro", 4),
      ]);

      articles = [...stockItems, ...macroItems];
    } else {
      // ── NewsAPI (최근 날짜) ───────────────────────────────────────────────
      console.log(`[api/news] Recent date → NewsAPI`);

      const [stockItems, macroItems] = await Promise.all([
        fetchNewsApi(stockQuery, fromDate, date, language, 6, "company"),
        fetchNewsApi(macroQuery, fromDate, date, language, 4, "macro"),
      ]);

      articles = [...stockItems, ...macroItems];
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

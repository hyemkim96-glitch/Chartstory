// Vercel Serverless Function — Google News RSS proxy
// No API key required; uses Google News RSS for all date ranges

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
function getDateRange(
  date: string,
  period: string
): { fromDate: string; toDate: string } {
  const d = new Date(date);

  if (period === "Y") {
    const year = d.getUTCFullYear();
    return { fromDate: `${year}-01-01`, toDate: `${year}-12-31` };
  }

  if (period === "M") {
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth();
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const mm = String(month + 1).padStart(2, "0");
    return {
      fromDate: `${year}-${mm}-01`,
      toDate: `${year}-${mm}-${String(lastDay).padStart(2, "0")}`,
    };
  }

  if (period === "W") {
    const dow = d.getUTCDay();
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
  return { fromDate: prev.toISOString().split("T")[0], toDate: date };
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

  try {
    const url = new URL(req.url, "http://localhost");
    const symbol = url.searchParams.get("symbol") ?? "";
    const date = url.searchParams.get("date") ?? "";
    const name = url.searchParams.get("name") ?? "";
    const region = url.searchParams.get("region") ?? "US";
    const period = url.searchParams.get("period") ?? "D";

    if (!symbol || !date) {
      return res
        .status(400)
        .json({ error: "symbol, date 파라미터가 필요합니다." });
    }

    const { fromDate, toDate } = getDateRange(date, period);
    console.log(
      `[api/news] ${symbol} | period=${period} | ${fromDate} ~ ${toDate}`
    );

    const hl = region === "KR" ? "ko" : "en-US";
    const gl = region === "KR" ? "KR" : "US";
    const ceid = region === "KR" ? "KR:ko" : "US:en";

    const year = new Date(date).getUTCFullYear();
    const yearSuffix =
      period === "Y" ? (region === "KR" ? ` ${year}년` : ` ${year}`) : "";
    const stockQuery = name
      ? `${symbol} OR "${name}"${yearSuffix}`
      : symbol + yearSuffix;

    const macroQuery =
      region === "KR"
        ? "코스피 OR 한국은행 OR 기준금리 OR 환율 OR 외국인매도 OR 미중무역 OR 트럼프 OR 관세"
        : '"stock market" OR "Federal Reserve" OR "interest rate" OR "S&P 500" OR "inflation" OR "recession" OR "tariff" OR "Trump"';

    const politicsQuery =
      region === "KR"
        ? "대통령 OR 탄핵 OR 계엄 OR 국회 OR 정치 OR 여야 OR 정권"
        : null;

    const geopoliticsQuery =
      region === "KR"
        ? "이란 OR 이스라엘 OR 전쟁 OR 중동 OR 지정학 OR 분쟁 OR 러시아 OR 우크라이나 OR 북한 OR 미중갈등"
        : "Iran OR Israel OR war OR \"Middle East\" OR geopolitical OR conflict OR NATO OR Russia OR Ukraine";

    const companyLimit = period === "Y" ? 7 : 5;
    const macroLimit = period === "Y" ? 4 : 3;
    const politicsLimit = 3;
    const geopoliticsLimit = 3;

    const requests: Promise<Article[]>[] = [
      fetchRSS(
        stockQuery,
        fromDate,
        toDate,
        hl,
        gl,
        ceid,
        "company",
        companyLimit
      ),
      fetchRSS(
        macroQuery,
        fromDate,
        toDate,
        hl,
        gl,
        ceid,
        "macro",
        macroLimit
      ),
      fetchRSS(
        geopoliticsQuery,
        fromDate,
        toDate,
        hl,
        gl,
        ceid,
        "macro",
        geopoliticsLimit
      ),
    ];
    if (politicsQuery) {
      requests.push(
        fetchRSS(
          politicsQuery,
          fromDate,
          toDate,
          hl,
          gl,
          ceid,
          "macro",
          politicsLimit
        )
      );
    }

    const articles = (await Promise.all(requests)).flat();
    console.log(`[api/news] Total: ${articles.length} articles`);
    return res.status(200).json({ articles });
  } catch (err) {
    console.error("Google News RSS proxy 오류:", err);
    return res.status(500).json({ error: String(err) });
  }
}

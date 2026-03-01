import path from "path";
import { fileURLToPath } from "url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import type { Plugin } from "vite";
import type { IncomingMessage, ServerResponse } from "http";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── KIS dev middleware plugin ────────────────────────────────────────────────
// Handles /api/kis requests locally so `pnpm dev` works without vercel dev.
// Credentials are read from .env.local via loadEnv (never sent to browser).
function kisDevPlugin(
  appKey: string,
  appSecret: string,
  accountType: string
): Plugin {
  if (!appKey || !appSecret) return { name: "kis-dev-noop" };

  const KIS_BASE =
    accountType === "virtual"
      ? "https://openapivts.koreainvestment.com:29443"
      : "https://openapi.koreainvestment.com:9443";

  let tokenCache: { token: string; exp: number } | null = null;

  async function getToken(): Promise<string> {
    if (tokenCache && Date.now() < tokenCache.exp) return tokenCache.token;
    const res = await fetch(`${KIS_BASE}/oauth2/tokenP`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "client_credentials",
        appkey: appKey,
        appsecret: appSecret,
      }),
    });
    if (!res.ok) throw new Error(`KIS 토큰 발급 실패: ${res.status}`);
    const d = (await res.json()) as any;
    tokenCache = {
      token: d.access_token,
      exp: Date.now() + (d.expires_in - 300) * 1000,
    };
    return tokenCache.token;
  }

  function daysAgo(n: number): string {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10).replace(/-/g, "");
  }

  function toIso(yyyymmdd: string): string {
    return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
  }

  function kisHeaders(token: string, trId: string): Record<string, string> {
    return {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      appkey: appKey,
      appsecret: appSecret,
      tr_id: trId,
    };
  }

  interface Row {
    time: string;
    open: number;
    high: number;
    low: number;
    close: number;
    value: number;
  }

  async function fetchKR(
    token: string,
    symbol: string,
    period: string,
    from: string,
    to: string
  ): Promise<Row[]> {
    const url = new URL(
      `${KIS_BASE}/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice`
    );
    url.searchParams.set("FID_COND_MRKT_DIV_CODE", "J");
    url.searchParams.set("FID_INPUT_ISCD", symbol);
    url.searchParams.set("FID_INPUT_DATE_1", from);
    url.searchParams.set("FID_INPUT_DATE_2", to);
    url.searchParams.set("FID_PERIOD_DIV_CODE", period);
    url.searchParams.set("FID_ORG_ADJ_PRC", "0");
    const res = await fetch(url.toString(), {
      headers: kisHeaders(token, "FHKST03010100"),
    });
    const d = (await res.json()) as any;
    return (d.output2 ?? [])
      .map((r: Record<string, string>) => ({
        time: toIso(r.stck_bsop_date),
        open: Number(r.stck_oprc),
        high: Number(r.stck_hgpr),
        low: Number(r.stck_lwpr),
        close: Number(r.stck_clpr),
        value: Number(r.acml_vol),
      }))
      .filter((r: Row) => r.open > 0);
  }

  async function fetchUS(
    token: string,
    symbol: string,
    excd: string,
    gubn: string,
    bymd: string
  ): Promise<Row[]> {
    const url = new URL(
      `${KIS_BASE}/uapi/overseas-price/v1/quotations/dailyprice`
    );
    url.searchParams.set("AUTH", "");
    url.searchParams.set("EXCD", excd);
    url.searchParams.set("SYMB", symbol);
    url.searchParams.set("GUBN", gubn);
    url.searchParams.set("BYMD", bymd);
    url.searchParams.set("MODYN", "N");
    const res = await fetch(url.toString(), {
      headers: kisHeaders(token, "HHDFS76240000"),
    });
    const d = (await res.json()) as any;
    return (d.output2 ?? [])
      .map((r: Record<string, string>) => ({
        time: toIso(r.xymd),
        open: Number(r.open),
        high: Number(r.high),
        low: Number(r.low),
        close: Number(r.clos),
        value: Number(r.tvol),
      }))
      .filter((r: Row) => r.open > 0);
  }

  function toYearly(rows: Row[]): Row[] {
    const map = new Map<string, Row>();
    for (const r of rows) {
      const key = r.time.slice(0, 4) + "-01-01";
      if (!map.has(key)) {
        map.set(key, { ...r, time: key });
      } else {
        const y = map.get(key)!;
        y.high = Math.max(y.high, r.high);
        y.low = Math.min(y.low, r.low);
        y.close = r.close;
        y.value += r.value;
      }
    }
    return [...map.values()].sort((a, b) => a.time.localeCompare(b.time));
  }

  function dedup(rows: Row[]): Row[] {
    const seen = new Set<string>();
    return rows
      .filter((r) => {
        if (seen.has(r.time)) return false;
        seen.add(r.time);
        return true;
      })
      .sort((a, b) => a.time.localeCompare(b.time));
  }

  return {
    name: "kis-dev-proxy",
    configureServer(server) {
      server.middlewares.use(
        async (
          req: IncomingMessage,
          res: ServerResponse,
          next: () => void
        ) => {
          if (!req.url?.startsWith("/api/kis")) return next();

          res.setHeader("Content-Type", "application/json");
          res.setHeader("Access-Control-Allow-Origin", "*");

          try {
            const url = new URL(req.url, "http://localhost");
            const action = url.searchParams.get("action") ?? "chart";
            const rawSymbol = url.searchParams.get("symbol") ?? "";
            const period = url.searchParams.get("period") ?? "D";
            const exchange = url.searchParams.get("exchange") ?? "NASDAQ";

            const token = await getToken();
            const isKorean = /^\d{6}(\.KS|\.KQ)?$/.test(rawSymbol);
            const symbol = rawSymbol.replace(/\.(KS|KQ)$/, "");
            const excdMap: Record<string, string> = { NASDAQ: "NAS", NYSE: "NYS", AMEX: "AMS" };
            const excd = excdMap[exchange] ?? "NAS";

            // ── Quote ───────────────────────────────────────────────────────
            if (action === "quote") {
              const quoteUrl = new URL(
                isKorean
                  ? `${KIS_BASE}/uapi/domestic-stock/v1/quotations/inquire-price`
                  : `${KIS_BASE}/uapi/overseas-price/v1/quotations/price`
              );
              if (isKorean) {
                quoteUrl.searchParams.set("FID_COND_MRKT_DIV_CODE", "J");
                quoteUrl.searchParams.set("FID_INPUT_ISCD", symbol);
              } else {
                quoteUrl.searchParams.set("AUTH", "");
                quoteUrl.searchParams.set("EXCD", excd);
                quoteUrl.searchParams.set("SYMB", symbol);
              }
              if (isKorean) {
                const qRes = await fetch(quoteUrl.toString(), {
                  headers: kisHeaders(token, "FHKST01010100"),
                });
                const qd = (await qRes.json()) as any;
                if (qd.rt_cd !== "0" || !qd.output) {
                  res.statusCode = 404;
                  res.end(JSON.stringify({ error: "시세 데이터 없음" }));
                  return;
                }
                const o = qd.output;
                res.end(JSON.stringify({
                  price: Number(o.stck_prpr),
                  change: Number(o.prdy_vrss),
                  changeRate: Number(o.prdy_ctrt),
                  marketCap: Number(o.hts_avls),
                  per: Number(o.per) || undefined,
                  currency: "KRW",
                }));
              } else {
                // US stock fundamental data requires a separate call
                const infoUrl = new URL(`${KIS_BASE}/uapi/overseas-price/v1/quotations/search-info`);
                infoUrl.searchParams.set("AUTH", "");
                infoUrl.searchParams.set("EXCD", excd);
                infoUrl.searchParams.set("SYMB", symbol);

                const [qRes, infoRes] = await Promise.all([
                  fetch(quoteUrl.toString(), { headers: kisHeaders(token, "HHDFS00000300") }),
                  fetch(infoUrl.toString(), { headers: kisHeaders(token, "HHDFS00000500") }).catch(() => null)
                ]);

                const qd = (await qRes.json()) as any;
                const id = infoRes ? (await infoRes.json()) as any : null;

                if (qd.rt_cd !== "0" || !qd.output) {
                  res.statusCode = 404;
                  res.end(JSON.stringify({ error: "시세 데이터 없음" }));
                  return;
                }
                const o = qd.output;
                const io = id?.output;

                res.end(JSON.stringify({
                  price: Number(o.last),
                  change: Number(o.diff),
                  changeRate: Number(o.rate),
                  marketCap: io ? Number(io.tomv) : undefined, // Million USD
                  per: io ? Number(io.perx) : undefined,
                  currency: "USD",
                }));
              }
              return;
            }

            const today = daysAgo(0);
            let rows: Row[] = [];

            if (isKorean) {
              const kisPeriod = period === "Y" ? "M" : period;
              const chunks: [string, string][] =
                period === "D"
                  ? [
                    // 10년치 일봉 (병렬 요청, 24 chunks × ~150일)
                    [daysAgo(3650), daysAgo(3501)],
                    [daysAgo(3500), daysAgo(3351)],
                    [daysAgo(3350), daysAgo(3201)],
                    [daysAgo(3200), daysAgo(3051)],
                    [daysAgo(3050), daysAgo(2901)],
                    [daysAgo(2900), daysAgo(2751)],
                    [daysAgo(2750), daysAgo(2601)],
                    [daysAgo(2600), daysAgo(2451)],
                    [daysAgo(2450), daysAgo(2301)],
                    [daysAgo(2300), daysAgo(2151)],
                    [daysAgo(2150), daysAgo(2001)],
                    [daysAgo(2000), daysAgo(1851)],
                    [daysAgo(1850), daysAgo(1701)],
                    [daysAgo(1700), daysAgo(1551)],
                    [daysAgo(1550), daysAgo(1401)],
                    [daysAgo(1400), daysAgo(1251)],
                    [daysAgo(1250), daysAgo(1101)],
                    [daysAgo(1100), daysAgo(951)],
                    [daysAgo(950), daysAgo(801)],
                    [daysAgo(800), daysAgo(651)],
                    [daysAgo(650), daysAgo(501)],
                    [daysAgo(500), daysAgo(351)],
                    [daysAgo(350), daysAgo(176)],
                    [daysAgo(175), today],
                  ]
                  : period === "W"
                    ? [
                      [daysAgo(1825), daysAgo(1126)],
                      [daysAgo(1125), daysAgo(426)],
                      [daysAgo(425), today],
                    ]
                    : period === "M"
                      ? [
                        [daysAgo(3650), daysAgo(1826)],
                        [daysAgo(1825), today],
                      ]
                      : [
                        [daysAgo(7300), daysAgo(5476)],
                        [daysAgo(5475), daysAgo(3651)],
                        [daysAgo(3650), daysAgo(1826)],
                        [daysAgo(1825), today],
                      ];

              const krResults = await Promise.all(
                chunks.map(([from, to]) => fetchKR(token, symbol, kisPeriod, from, to))
              );
              rows = krResults.flat();
              rows = dedup(rows);
              if (period === "Y") rows = toYearly(rows);
            } else {
              const gubnMap: Record<string, string> = {
                D: "0",
                W: "1",
                M: "2",
                Y: "2",
              };
              const gubn = gubnMap[period] ?? "0";
              const bymds: string[] =
                period === "D"
                  ? [
                      // 10년치 일봉 (37 bymds × ~100일)
                      today,
                      daysAgo(100), daysAgo(200), daysAgo(300), daysAgo(400),
                      daysAgo(500), daysAgo(600), daysAgo(700), daysAgo(800),
                      daysAgo(900), daysAgo(1000), daysAgo(1100), daysAgo(1200),
                      daysAgo(1300), daysAgo(1400), daysAgo(1500), daysAgo(1600),
                      daysAgo(1700), daysAgo(1800), daysAgo(1900), daysAgo(2000),
                      daysAgo(2100), daysAgo(2200), daysAgo(2300), daysAgo(2400),
                      daysAgo(2500), daysAgo(2600), daysAgo(2700), daysAgo(2800),
                      daysAgo(2900), daysAgo(3000), daysAgo(3100), daysAgo(3200),
                      daysAgo(3300), daysAgo(3400), daysAgo(3500), daysAgo(3600),
                    ]
                  : period === "W"
                    ? [today, daysAgo(700), daysAgo(1400), daysAgo(2100)]
                    : [today, daysAgo(3000), daysAgo(6000)];

              const usResults = await Promise.all(
                bymds.map((bymd) => fetchUS(token, symbol, excd, gubn, bymd))
              );
              rows = usResults.flat();
              rows = dedup(rows);
              if (period === "Y") rows = toYearly(rows);
            }

            res.end(JSON.stringify(rows));
          } catch (err) {
            console.error("KIS dev proxy 오류:", err);
            res.statusCode = 500;
            res.end(JSON.stringify({ error: String(err) }));
          }
        }
      );
    },
  };
}

// ── News dev middleware plugin ──────────────────────────────────────────────
// Handles /api/news requests locally — mirrors api/news.ts behavior exactly
function newsDevPlugin(apiKey: string): Plugin {
  if (!apiKey) return { name: "news-dev-noop" };

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
    // D — 전날 ~ 당일
    const prev = new Date(d);
    prev.setUTCDate(d.getUTCDate() - 1);
    return { fromDate: prev.toISOString().split("T")[0], toDate: date };
  }

  async function fetchRSS(
    query: string,
    fromDate: string,
    toDate: string,
    hl: string,
    gl: string,
    ceid: string,
    category: "company" | "macro",
    limit = 5
  ): Promise<any[]> {
    const googleUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}+after:${fromDate}+before:${toDate}&hl=${hl}&gl=${gl}&ceid=${ceid}`;
    const rssRes = await fetch(googleUrl);
    const rssText = await rssRes.text();
    const items: any[] = [];
    const clean = (s: string) => s.replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1").trim();
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

  async function fetchNewsApi(
    query: string,
    fromDate: string,
    toDate: string,
    language: string,
    pageSize: number,
    category: "company" | "macro"
  ): Promise<any[]> {
    const apiUrl = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&from=${fromDate}&to=${toDate}&sortBy=relevancy&language=${language}&pageSize=${pageSize}&apiKey=${apiKey}`;
    const r = await fetch(apiUrl);
    const d = (await r.json()) as any;
    return (d.articles ?? []).map((a: any) => ({ ...a, category }));
  }

  return {
    name: "news-dev-proxy",
    configureServer(server) {
      server.middlewares.use(
        async (
          req: IncomingMessage,
          res: ServerResponse,
          next: () => void
        ) => {
          if (!req.url?.startsWith("/api/news")) return next();

          res.setHeader("Content-Type", "application/json");
          res.setHeader("Access-Control-Allow-Origin", "*");

          try {
            const url = new URL(req.url, "http://localhost");
            const symbol = url.searchParams.get("symbol") ?? "";
            const date = url.searchParams.get("date") ?? "";
            const name = url.searchParams.get("name") ?? "";
            const region = url.searchParams.get("region") ?? "US";
            const period = url.searchParams.get("period") ?? "D";

            const { fromDate, toDate } = getDateRange(date, period);
            const language = region === "KR" ? "ko" : "en";
            const hl = region === "KR" ? "ko" : "en-US";
            const gl = region === "KR" ? "KR" : "US";
            const ceid = region === "KR" ? "KR:ko" : "US:en";

            const year = new Date(date).getUTCFullYear();
            const yearSuffix = period === "Y"
              ? (region === "KR" ? ` ${year}년` : ` ${year}`)
              : "";
            const stockQuery = name
              ? `${symbol} OR "${name}"${yearSuffix}`
              : symbol + yearSuffix;
            const macroQuery =
              region === "KR"
                ? "코스피 OR 한국은행 OR 기준금리 OR 환율 OR 외국인매도 OR 미중무역"
                : '"stock market" OR "Federal Reserve" OR "interest rate" OR "S&P 500" OR "inflation" OR "recession" OR "tariff"';
            const politicsQuery =
              region === "KR"
                ? "대통령 OR 탄핵 OR 계엄 OR 국회 OR 정치 OR 여야 OR 정권"
                : null;

            const diffDays =
              (Date.now() - new Date(fromDate).getTime()) / (1000 * 3600 * 24);

            const companyLimit = period === "Y" ? 7 : 5;
            const macroLimit = period === "Y" ? 4 : 3;
            const politicsLimit = 3;

            let articles: any[] = [];
            if (diffDays > 28) {
              const requests = [
                fetchRSS(stockQuery, fromDate, toDate, hl, gl, ceid, "company", companyLimit),
                fetchRSS(macroQuery, fromDate, toDate, hl, gl, ceid, "macro", macroLimit),
              ];
              if (politicsQuery) {
                requests.push(fetchRSS(politicsQuery, fromDate, toDate, hl, gl, ceid, "macro", politicsLimit));
              }
              articles = (await Promise.all(requests)).flat();
            } else {
              const requests = [
                fetchNewsApi(stockQuery, fromDate, toDate, language, companyLimit, "company"),
                fetchNewsApi(macroQuery, fromDate, toDate, language, macroLimit, "macro"),
              ];
              if (politicsQuery) {
                requests.push(fetchNewsApi(politicsQuery, fromDate, toDate, language, politicsLimit, "macro"));
              }
              articles = (await Promise.all(requests)).flat();
            }

            res.end(JSON.stringify({ articles }));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: String(err) }));
          }
        }
      );
    },
  };
}

// ── Vite config ──────────────────────────────────────────────────────────────
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), ""); // load ALL .env.local vars

  return {
    plugins: [
      react(),
      tailwindcss(),
      kisDevPlugin(
        env.KIS_APP_KEY,
        env.KIS_APP_SECRET,
        env.KIS_ACCOUNT_TYPE ?? "real"
      ),
      newsDevPlugin(env.NEWSAPI_KEY),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});

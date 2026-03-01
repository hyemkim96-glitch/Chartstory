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
    const d = await res.json();
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
    const d = await res.json();
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
    const d = await res.json();
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
              const qRes = await fetch(quoteUrl.toString(), {
                headers: kisHeaders(token, isKorean ? "FHKST01010100" : "HHDFS00000300"),
              });
              const qd = await qRes.json();
              if (qd.rt_cd !== "0" || !qd.output) {
                res.statusCode = 404;
                res.end(JSON.stringify({ error: "시세 데이터 없음" }));
                return;
              }
              const o = qd.output;
              const quote = isKorean
                ? {
                    price: Number(o.stck_prpr),
                    change: Number(o.prdy_vrss),
                    changeRate: Number(o.prdy_ctrt),
                    marketCap: Number(o.hts_avls),
                    per: Number(o.per) || undefined,
                    currency: "KRW",
                  }
                : {
                    price: Number(o.last),
                    change: Number(o.diff),
                    changeRate: Number(o.rate),
                    currency: "USD",
                  };
              res.end(JSON.stringify(quote));
              return;
            }

            const today = daysAgo(0);
            let rows: Row[] = [];

            if (isKorean) {
              const kisPeriod = period === "Y" ? "M" : period;
              const chunks: [string, string][] =
                period === "D"
                  ? [
                      [daysAgo(730), daysAgo(580)],
                      [daysAgo(579), daysAgo(420)],
                      [daysAgo(419), daysAgo(260)],
                      [daysAgo(259), daysAgo(100)],
                      [daysAgo(99), today],
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

              for (const [from, to] of chunks) {
                const chunk = await fetchKR(token, symbol, kisPeriod, from, to);
                rows.push(...chunk);
              }
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
                  ? [today, daysAgo(100), daysAgo(200), daysAgo(300), daysAgo(400), daysAgo(500), daysAgo(600), daysAgo(700)]
                  : period === "W"
                    ? [today, daysAgo(700), daysAgo(1400), daysAgo(2100)]
                    : [today, daysAgo(3000), daysAgo(6000)];

              for (const bymd of bymds) {
                const chunk = await fetchUS(token, symbol, excd, gubn, bymd);
                rows.push(...chunk);
              }
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
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      proxy: {
        "/news-api": {
          target: "https://newsapi.org/v2",
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/news-api/, ""),
        },
      },
    },
  };
});

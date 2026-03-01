// Vercel Serverless Function — KIS Open Trading API proxy
// Credentials stay server-side; browser never sees APP_KEY / APP_SECRET

const KIS_BASE =
  process.env.KIS_ACCOUNT_TYPE === "virtual"
    ? "https://openapivts.koreainvestment.com:29443"
    : "https://openapi.koreainvestment.com:9443";

const APP_KEY = process.env.KIS_APP_KEY ?? "";
const APP_SECRET = process.env.KIS_APP_SECRET ?? "";

// ── Token cache (lives for the function instance lifetime) ──────────────────
let tokenCache: { token: string; exp: number } | null = null;

async function getToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.exp) return tokenCache.token;

  const res = await fetch(`${KIS_BASE}/oauth2/tokenP`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      appkey: APP_KEY,
      appsecret: APP_SECRET,
    }),
  });

  if (!res.ok) throw new Error(`Token request failed: ${res.status}`);
  const d = await res.json();
  tokenCache = {
    token: d.access_token,
    exp: Date.now() + (d.expires_in - 300) * 1000,
  };
  return tokenCache.token;
}

// ── Helpers ─────────────────────────────────────────────────────────────────
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
    appkey: APP_KEY,
    appsecret: APP_SECRET,
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

// ── Korean stock chart ───────────────────────────────────────────────────────
async function fetchKR(
  token: string,
  symbol: string,
  period: string, // D / W / M
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

// ── US stock chart ───────────────────────────────────────────────────────────
async function fetchUS(
  token: string,
  symbol: string,
  excd: string,
  gubn: string, // 0=일 1=주 2=월
  bymd: string // end date YYYYMMDD
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

// ── Aggregate helper (monthly → yearly) ─────────────────────────────────────
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

// ── Korean stock quote ────────────────────────────────────────────────────────
async function fetchKRQuote(token: string, symbol: string) {
  const url = new URL(
    `${KIS_BASE}/uapi/domestic-stock/v1/quotations/inquire-price`
  );
  url.searchParams.set("FID_COND_MRKT_DIV_CODE", "J");
  url.searchParams.set("FID_INPUT_ISCD", symbol);

  const res = await fetch(url.toString(), {
    headers: kisHeaders(token, "FHKST01010100"),
  });
  const d = await res.json();
  if (d.rt_cd !== "0" || !d.output) return null;
  const o = d.output;

  const rtData = {
    price: Number(o.stck_prpr),
    change: Number(o.prdy_vrss),
    changeRate: Number(o.prdy_ctrt),
    marketCap: Number(o.hts_avls), // 억원 단위로 추정
    per: Number(o.per) || undefined,
    currency: "KRW",
  };
  console.log(`[KIS KR] ${symbol} raw marketCap: ${o.hts_avls}, mapped: ${rtData.marketCap}`);
  return rtData;
}

// ── US stock quote ─────────────────────────────────────────────────────────
async function fetchUSQuote(token: string, symbol: string, excd: string) {
  // 1. Price data (Real-time)
  const priceUrl = new URL(`${KIS_BASE}/uapi/overseas-price/v1/quotations/price`);
  priceUrl.searchParams.set("AUTH", "");
  priceUrl.searchParams.set("EXCD", excd);
  priceUrl.searchParams.set("SYMB", symbol);

  // 2. Fundamental data (Search info)
  const infoUrl = new URL(`${KIS_BASE}/uapi/overseas-price/v1/quotations/search-info`);
  infoUrl.searchParams.set("AUTH", "");
  infoUrl.searchParams.set("EXCD", excd);
  infoUrl.searchParams.set("SYMB", symbol);

  const [priceRes, infoRes] = await Promise.all([
    fetch(priceUrl.toString(), { headers: kisHeaders(token, "HHDFS00000300") }),
    fetch(infoUrl.toString(), { headers: kisHeaders(token, "HHDFS00000500") }).catch(() => null)
  ]);

  const pData = await priceRes.json();
  const iData = infoRes ? await infoRes.json() : null;

  if (pData.rt_cd !== "0" || !pData.output) return null;
  const po = pData.output;
  const io = iData?.output;

  const rtData = {
    price: Number(po.last),
    change: Number(po.diff),
    changeRate: Number(po.rate),
    marketCap: io ? Number(io.tomv) : undefined, // tomv: 시가총액 (Million USD)
    per: io ? Number(io.perx) : undefined, // perx: PER
    currency: "USD",
  };

  console.log(`[KIS US] ${symbol} price: ${rtData.price}, per: ${rtData.per}, marketCap: ${rtData.marketCap}`);
  return rtData;
}

// ── Main handler ─────────────────────────────────────────────────────────────
export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");

  if (!APP_KEY || !APP_SECRET) {
    return res.status(500).json({ error: "KIS 자격증명이 설정되지 않았습니다." });
  }

  try {
    const url = new URL(req.url, "http://localhost");
    const action = url.searchParams.get("action") ?? "chart";
    const rawSymbol = url.searchParams.get("symbol") ?? "";
    const period = url.searchParams.get("period") ?? "D"; // D W M Y
    const exchange = url.searchParams.get("exchange") ?? "NASDAQ";

    const token = await getToken();

    // Strip .KS / .KQ suffix for Korean stocks
    const isKorean = /^\d{6}(\.KS|\.KQ)?$/.test(rawSymbol);
    const symbol = rawSymbol.replace(/\.(KS|KQ)$/, "");
    const excdMap: Record<string, string> = { NASDAQ: "NAS", NYSE: "NYS", AMEX: "AMS" };
    const excd = excdMap[exchange] ?? "NAS";

    // ── Quote ───────────────────────────────────────────────────────────────
    if (action === "quote") {
      const quote = isKorean
        ? await fetchKRQuote(token, symbol)
        : await fetchUSQuote(token, symbol, excd);
      if (!quote) return res.status(404).json({ error: "시세 데이터 없음" });
      return res.status(200).json(quote);
    }

    const today = daysAgo(0);

    let rows: Row[] = [];

    if (isKorean) {
      // ── Korean stock ──────────────────────────────────────────────────────
      const kisPeriod = period === "Y" ? "M" : period;

      // Date chunks — each chunk ≤ ~100 trading days
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
              : // Y — fetch monthly for ~20 years then aggregate
              [
                [daysAgo(7300), daysAgo(5476)],
                [daysAgo(5475), daysAgo(3651)],
                [daysAgo(3650), daysAgo(1826)],
                [daysAgo(1825), today],
              ];

      const chunkResults = await Promise.all(
        chunks.map(([from, to]) => fetchKR(token, symbol, kisPeriod, from, to))
      );
      rows = chunkResults.flat();

      rows = dedup(rows);
      if (period === "Y") rows = toYearly(rows);
    } else {
      // ── US stock ──────────────────────────────────────────────────────────
      const gubnMap: Record<string, string> = { D: "0", W: "1", M: "2", Y: "2" };
      const gubn = gubnMap[period] ?? "0";

      // For US stocks, BYMD = end date; each request returns ≤100 rows going backwards
      const bymds: string[] =
        period === "D"
          ? [today, daysAgo(100), daysAgo(200), daysAgo(300), daysAgo(400), daysAgo(500), daysAgo(600), daysAgo(700)]
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

    return res.status(200).json(rows);
  } catch (err) {
    console.error("KIS API 오류:", err);
    return res.status(500).json({ error: String(err) });
  }
}

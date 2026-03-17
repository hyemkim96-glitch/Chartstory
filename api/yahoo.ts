// Vercel Serverless Function — Yahoo Finance proxy
// No auth required; server-side to avoid CORS restrictions

import type { TimeRange } from "../src/types";

const YAHOO_BASE = "https://query1.finance.yahoo.com";

const RANGE_MAP: Record<TimeRange, { interval: string; range: string }> = {
  "1M": { interval: "1d", range: "1mo" },
  "3M": { interval: "1d", range: "3mo" },
  "6M": { interval: "1d", range: "6mo" },
  "1Y": { interval: "1d", range: "1y" },
  "5Y": { interval: "1wk", range: "5y" },
  MAX: { interval: "1mo", range: "max" },
};

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  Accept: "application/json",
};

function toIso(ts: number): string {
  return new Date(ts * 1000).toISOString().split("T")[0];
}

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");

  try {
    const url = new URL(req.url, "http://localhost");
    const action = url.searchParams.get("action") ?? "chart";
    const symbol = url.searchParams.get("symbol") ?? "";

    if (!symbol) return res.status(400).json({ error: "symbol required" });

    // ── Quote ────────────────────────────────────────────────────────────────
    if (action === "quote") {
      const r = await fetch(
        `${YAHOO_BASE}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`,
        { headers: FETCH_HEADERS }
      );
      if (!r.ok) return res.status(r.status).json({ error: "Yahoo error" });

      const data = await r.json();
      const meta = data.chart?.result?.[0]?.meta;
      if (!meta) return res.status(404).json({ error: "No quote data" });

      const price: number = meta.regularMarketPrice ?? 0;
      const prev: number =
        meta.previousClose ?? meta.chartPreviousClose ?? price;
      const change = price - prev;
      const changeRate = prev !== 0 ? (change / prev) * 100 : 0;

      return res.status(200).json({
        price,
        change,
        changeRate,
        marketCap: meta.marketCap ? meta.marketCap / 1_000_000 : undefined, // → Million USD
        per: undefined, // not available from chart endpoint
        currency: meta.currency ?? "USD",
      });
    }

    // ── Chart data ───────────────────────────────────────────────────────────
    const range = (url.searchParams.get("range") ?? "1Y") as TimeRange;
    const { interval, range: yahooRange } = RANGE_MAP[range] ?? RANGE_MAP["1Y"];

    const r = await fetch(
      `${YAHOO_BASE}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${yahooRange}&events=history`,
      { headers: FETCH_HEADERS }
    );
    if (!r.ok) return res.status(r.status).json({ error: "Yahoo error" });

    const data = await r.json();
    const result = data.chart?.result?.[0];
    if (!result) return res.status(404).json({ error: "No chart data" });

    const timestamps: number[] = result.timestamp ?? [];
    const q = result.indicators?.quote?.[0] ?? {};
    const { open = [], high = [], low = [], close = [], volume = [] } = q;

    const rows = timestamps
      .map((ts, i) => ({
        time: toIso(ts),
        open: open[i] as number,
        high: high[i] as number,
        low: low[i] as number,
        close: close[i] as number,
        value: (volume[i] as number) ?? 0,
      }))
      .filter(
        (row) =>
          row.open != null &&
          row.open > 0 &&
          row.high != null &&
          row.high > 0 &&
          row.low != null &&
          row.low > 0 &&
          row.close != null &&
          row.close > 0
      );

    return res.status(200).json(rows);
  } catch (err) {
    console.error("Yahoo Finance API 오류:", err);
    return res.status(500).json({ error: String(err) });
  }
}

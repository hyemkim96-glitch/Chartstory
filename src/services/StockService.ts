import type {
  OHLCVData,
  TimeRange,
  MarketEvent,
  StockMetadata,
  QuoteData,
} from "../types";
import type { Time } from "lightweight-charts";

// ── Seeded mock fallback (used when KIS API unavailable) ─────────────────────
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

function generateMock(symbol: string, days: number): OHLCVData[] {
  const data: OHLCVData[] = [];
  const now = new Date();
  const rand = seededRand(symbol);
  let last = 100 + rand() * 200;

  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    if (date.getDay() === 0 || date.getDay() === 6) continue;
    const time = date.toISOString().split("T")[0];
    const open = last + (rand() - 0.5) * 5;
    const high = Math.max(open, open + rand() * 5);
    const low = Math.min(open, open - rand() * 5);
    const close = low + rand() * (high - low);
    data.push({
      time: time as Time,
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      value: Math.floor(rand() * 1000000),
    });
    last = close;
  }
  return data;
}

function aggregateWeekly(daily: OHLCVData[]): OHLCVData[] {
  const map = new Map<string, OHLCVData>();
  for (const d of daily) {
    const date = new Date(d.time as string);
    const dow = date.getUTCDay();
    const monday = new Date(date);
    monday.setUTCDate(date.getUTCDate() - (dow === 0 ? 6 : dow - 1));
    const key = monday.toISOString().split("T")[0];
    if (!map.has(key)) {
      map.set(key, { ...d, time: key as Time });
    } else {
      const w = map.get(key)!;
      w.high = Math.max(w.high, d.high);
      w.low = Math.min(w.low, d.low);
      w.close = d.close;
      w.value = (w.value ?? 0) + (d.value ?? 0);
    }
  }
  return [...map.values()];
}

function aggregateMonthly(daily: OHLCVData[]): OHLCVData[] {
  const map = new Map<string, OHLCVData>();
  for (const d of daily) {
    const key = (d.time as string).slice(0, 7) + "-01";
    if (!map.has(key)) {
      map.set(key, { ...d, time: key as Time });
    } else {
      const m = map.get(key)!;
      m.high = Math.max(m.high, d.high);
      m.low = Math.min(m.low, d.low);
      m.close = d.close;
      m.value = (m.value ?? 0) + (d.value ?? 0);
    }
  }
  return [...map.values()];
}

function aggregateYearly(daily: OHLCVData[]): OHLCVData[] {
  const map = new Map<string, OHLCVData>();
  for (const d of daily) {
    const key = (d.time as string).slice(0, 4) + "-01-01";
    if (!map.has(key)) {
      map.set(key, { ...d, time: key as Time });
    } else {
      const y = map.get(key)!;
      y.high = Math.max(y.high, d.high);
      y.low = Math.min(y.low, d.low);
      y.close = d.close;
      y.value = (y.value ?? 0) + (d.value ?? 0);
    }
  }
  return [...map.values()];
}

function getMockData(symbol: string, range: TimeRange): OHLCVData[] {
  const daysMap: Record<TimeRange, number> = {
    일: 730,
    주: 1825,
    월: 5475,
    년: 9125,
  };
  const daily = generateMock(symbol, daysMap[range]);
  if (range === "주") return aggregateWeekly(daily);
  if (range === "월") return aggregateMonthly(daily);
  if (range === "년") return aggregateYearly(daily);
  return daily;
}

// ── Period mapping for KIS API ───────────────────────────────────────────────
const PERIOD_MAP: Record<TimeRange, string> = {
  일: "D",
  주: "W",
  월: "M",
  년: "Y",
};

// ── Main service ─────────────────────────────────────────────────────────────
export class StockService {
  static async getChartData(
    symbol: string,
    range: TimeRange,
    stock?: StockMetadata
  ): Promise<OHLCVData[]> {
    console.log(`차트 데이터 요청: ${symbol} (${range})`);

    const period = PERIOD_MAP[range];
    const exchange = stock?.exchange ?? "NASDAQ";

    const params = new URLSearchParams({ symbol, period, exchange });
    const url = `/api/kis?${params.toString()}`;

    try {
      // 30 s timeout — KIS API calls run in parallel on the server
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30000);

      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);

      if (!res.ok) throw new Error(`KIS API ${res.status}`);
      const rows: Array<{
        time: string;
        open: number;
        high: number;
        low: number;
        close: number;
        value: number;
      }> = await res.json();

      if (rows.length === 0) throw new Error("데이터 없음");

      return rows.map((r) => ({
        time: r.time as Time,
        open: r.open,
        high: r.high,
        low: r.low,
        close: r.close,
        value: r.value,
      }));
    } catch (err) {
      console.warn("KIS API 실패, 목업 데이터 사용:", err);
      return getMockData(symbol, range);
    }
  }

  static async getQuote(
    symbol: string,
    stock?: StockMetadata
  ): Promise<QuoteData | null> {
    const exchange = stock?.exchange ?? "NASDAQ";
    const params = new URLSearchParams({ action: "quote", symbol, exchange });

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(`/api/kis?${params.toString()}`, {
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`KIS quote ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn("KIS Quote 실패:", err);
      return null;
    }
  }

  static async getEvents(
    symbol: string,
    data: OHLCVData[]
  ): Promise<MarketEvent[]> {
    const events: MarketEvent[] = [];
    for (const d of data) {
      const vol = (d.high - d.low) / d.open;
      if (vol > 0.03 && events.length < 5) {
        events.push({
          time: d.time,
          label: "●",
          text: `${symbol} 주요 이벤트`,
        });
      }
    }
    return events;
  }

  static async searchStocks(query: string): Promise<StockMetadata[]> {
    const all: StockMetadata[] = [
      // US - Tech & Huge Cap
      {
        symbol: "AAPL",
        name: "Apple Inc.",
        exchange: "NASDAQ",
        region: "US",
        currency: "USD",
      },
      {
        symbol: "MSFT",
        name: "Microsoft Corp.",
        exchange: "NASDAQ",
        region: "US",
        currency: "USD",
      },
      {
        symbol: "GOOGL",
        name: "Alphabet Inc. (Class A)",
        exchange: "NASDAQ",
        region: "US",
        currency: "USD",
      },
      {
        symbol: "AMZN",
        name: "Amazon.com, Inc.",
        exchange: "NASDAQ",
        region: "US",
        currency: "USD",
      },
      {
        symbol: "NVDA",
        name: "NVIDIA Corp.",
        exchange: "NASDAQ",
        region: "US",
        currency: "USD",
      },
      {
        symbol: "TSLA",
        name: "Tesla, Inc.",
        exchange: "NASDAQ",
        region: "US",
        currency: "USD",
      },
      {
        symbol: "META",
        name: "Meta Platforms, Inc.",
        exchange: "NASDAQ",
        region: "US",
        currency: "USD",
      },
      {
        symbol: "AVGO",
        name: "Broadcom Inc.",
        exchange: "NASDAQ",
        region: "US",
        currency: "USD",
      },
      {
        symbol: "COST",
        name: "Costco Wholesale Corp.",
        exchange: "NASDAQ",
        region: "US",
        currency: "USD",
      },
      {
        symbol: "NFLX",
        name: "Netflix, Inc.",
        exchange: "NASDAQ",
        region: "US",
        currency: "USD",
      },
      {
        symbol: "AMD",
        name: "Advanced Micro Devices, Inc.",
        exchange: "NASDAQ",
        region: "US",
        currency: "USD",
      },
      {
        symbol: "ARM",
        name: "Arm Holdings plc",
        exchange: "NASDAQ",
        region: "US",
        currency: "USD",
      },
      {
        symbol: "BRK.B",
        name: "Berkshire Hathaway Inc.",
        exchange: "NYSE",
        region: "US",
        currency: "USD",
      },
      {
        symbol: "V",
        name: "Visa Inc.",
        exchange: "NYSE",
        region: "US",
        currency: "USD",
      },
      {
        symbol: "JPM",
        name: "JPMorgan Chase & Co.",
        exchange: "NYSE",
        region: "US",
        currency: "USD",
      },
      {
        symbol: "LLY",
        name: "Eli Lilly and Co.",
        exchange: "NYSE",
        region: "US",
        currency: "USD",
      },
      {
        symbol: "WMT",
        name: "Walmart Inc.",
        exchange: "NYSE",
        region: "US",
        currency: "USD",
      },
      // KR - Major
      {
        symbol: "005930.KS",
        name: "삼성전자",
        exchange: "KRX",
        region: "KR",
        currency: "KRW",
      },
      {
        symbol: "000660.KS",
        name: "SK하이닉스",
        exchange: "KRX",
        region: "KR",
        currency: "KRW",
      },
      {
        symbol: "005935.KS",
        name: "삼성전자우",
        exchange: "KRX",
        region: "KR",
        currency: "KRW",
      },
      {
        symbol: "207940.KS",
        name: "삼성바이오로직스",
        exchange: "KRX",
        region: "KR",
        currency: "KRW",
      },
      {
        symbol: "005380.KS",
        name: "현대차",
        exchange: "KRX",
        region: "KR",
        currency: "KRW",
      },
      {
        symbol: "000270.KS",
        name: "기아",
        exchange: "KRX",
        region: "KR",
        currency: "KRW",
      },
      {
        symbol: "068270.KS",
        name: "셀트리온",
        exchange: "KRX",
        region: "KR",
        currency: "KRW",
      },
      {
        symbol: "005490.KS",
        name: "POSCO홀딩스",
        exchange: "KRX",
        region: "KR",
        currency: "KRW",
      },
      {
        symbol: "035420.KS",
        name: "NAVER",
        exchange: "KRX",
        region: "KR",
        currency: "KRW",
      },
      {
        symbol: "035720.KS",
        name: "카카오",
        exchange: "KRX",
        region: "KR",
        currency: "KRW",
      },
      {
        symbol: "051910.KS",
        name: "LG화학",
        exchange: "KRX",
        region: "KR",
        currency: "KRW",
      },
      {
        symbol: "373220.KS",
        name: "LG에너지솔루션",
        exchange: "KRX",
        region: "KR",
        currency: "KRW",
      },
      {
        symbol: "105560.KS",
        name: "KB금융",
        exchange: "KRX",
        region: "KR",
        currency: "KRW",
      },
      {
        symbol: "055550.KS",
        name: "신한지주",
        exchange: "KRX",
        region: "KR",
        currency: "KRW",
      },
      {
        symbol: "012330.KS",
        name: "현대모비스",
        exchange: "KRX",
        region: "KR",
        currency: "KRW",
      },
      {
        symbol: "006400.KS",
        name: "삼성SDI",
        exchange: "KRX",
        region: "KR",
        currency: "KRW",
      },
      {
        symbol: "032830.KS",
        name: "삼성생명",
        exchange: "KRX",
        region: "KR",
        currency: "KRW",
      },
      {
        symbol: "000810.KS",
        name: "삼성화재",
        exchange: "KRX",
        region: "KR",
        currency: "KRW",
      },
      {
        symbol: "015760.KS",
        name: "한국전력",
        exchange: "KRX",
        region: "KR",
        currency: "KRW",
      },
      {
        symbol: "017670.KS",
        name: "SK텔레콤",
        exchange: "KRX",
        region: "KR",
        currency: "KRW",
      },
      {
        symbol: "033780.KS",
        name: "KT&G",
        exchange: "KRX",
        region: "KR",
        currency: "KRW",
      },
      {
        symbol: "011200.KS",
        name: "HMM",
        exchange: "KRX",
        region: "KR",
        currency: "KRW",
      },
      {
        symbol: "247540.KQ",
        name: "에코프로비엠",
        exchange: "KRX",
        region: "KR",
        currency: "KRW",
      },
      {
        symbol: "086520.KQ",
        name: "에코프로",
        exchange: "KRX",
        region: "KR",
        currency: "KRW",
      },
      {
        symbol: "091990.KQ",
        name: "셀트리온헬스케어",
        exchange: "KRX",
        region: "KR",
        currency: "KRW",
      },
      {
        symbol: "066970.KQ",
        name: "엘앤에프",
        exchange: "KRX",
        region: "KR",
        currency: "KRW",
      },
      {
        symbol: "277810.KQ",
        name: "레인보우로보틱스",
        exchange: "KRX",
        region: "KR",
        currency: "KRW",
      },
      {
        symbol: "028300.KQ",
        name: "에이치엘비",
        exchange: "KRX",
        region: "KR",
        currency: "KRW",
      },
      {
        symbol: "035900.KQ",
        name: "JYP Ent.",
        exchange: "KRX",
        region: "KR",
        currency: "KRW",
      },
      {
        symbol: "352820.KS",
        name: "하이브",
        exchange: "KRX",
        region: "KR",
        currency: "KRW",
      },
      {
        symbol: "003550.KS",
        name: "LG",
        exchange: "KRX",
        region: "KR",
        currency: "KRW",
      },
      {
        symbol: "010130.KS",
        name: "고려아연",
        exchange: "KRX",
        region: "KR",
        currency: "KRW",
      },
      {
        symbol: "010950.KS",
        name: "S-Oil",
        exchange: "KRX",
        region: "KR",
        currency: "KRW",
      },
      {
        symbol: "000720.KS",
        name: "현대건설",
        exchange: "KRX",
        region: "KR",
        currency: "KRW",
      },
      {
        symbol: "000100.KS",
        name: "유한양행",
        exchange: "KRX",
        region: "KR",
        currency: "KRW",
      },
      {
        symbol: "034220.KS",
        name: "LG디스플레이",
        exchange: "KRX",
        region: "KR",
        currency: "KRW",
      },
      {
        symbol: "009150.KS",
        name: "삼성전기",
        exchange: "KRX",
        region: "KR",
        currency: "KRW",
      },
      {
        symbol: "018260.KS",
        name: "삼성에스디에스",
        exchange: "KRX",
        region: "KR",
        currency: "KRW",
      },
      {
        symbol: "036570.KS",
        name: "엔씨소프트",
        exchange: "KRX",
        region: "KR",
        currency: "KRW",
      },
      {
        symbol: "024110.KS",
        name: "기업은행",
        exchange: "KRX",
        region: "KR",
        currency: "KRW",
      },
      {
        symbol: "086790.KS",
        name: "하나금융지주",
        exchange: "KRX",
        region: "KR",
        currency: "KRW",
      },
      {
        symbol: "323410.KS",
        name: "카카오뱅크",
        exchange: "KRX",
        region: "KR",
        currency: "KRW",
      },
      {
        symbol: "377300.KS",
        name: "카카오페이",
        exchange: "KRX",
        region: "KR",
        currency: "KRW",
      },
      {
        symbol: "402340.KS",
        name: "SK스퀘어",
        exchange: "KRX",
        region: "KR",
        currency: "KRW",
      },
      {
        symbol: "316140.KS",
        name: "우리금융지주",
        exchange: "KRX",
        region: "KR",
        currency: "KRW",
      },
      {
        symbol: "004170.KS",
        name: "신세계",
        exchange: "KRX",
        region: "KR",
        currency: "KRW",
      },
      {
        symbol: "023530.KS",
        name: "롯데쇼핑",
        exchange: "KRX",
        region: "KR",
        currency: "KRW",
      },
      {
        symbol: "000080.KS",
        name: "하이트진로",
        exchange: "KRX",
        region: "KR",
        currency: "KRW",
      },
      {
        symbol: "005830.KS",
        name: "DB손해보험",
        exchange: "KRX",
        region: "KR",
        currency: "KRW",
      },
      {
        symbol: "000120.KS",
        name: "대한통운",
        exchange: "KRX",
        region: "KR",
        currency: "KRW",
      },
      {
        symbol: "011070.KS",
        name: "LG이노텍",
        exchange: "KRX",
        region: "KR",
        currency: "KRW",
      },
      {
        symbol: "011170.KS",
        name: "롯데케미칼",
        exchange: "KRX",
        region: "KR",
        currency: "KRW",
      },
      {
        symbol: "009830.KS",
        name: "한화솔루션",
        exchange: "KRX",
        region: "KR",
        currency: "KRW",
      },
      {
        symbol: "010140.KS",
        name: "삼성중공업",
        exchange: "KRX",
        region: "KR",
        currency: "KRW",
      },
      {
        symbol: "009540.KS",
        name: "HD현대중공업",
        exchange: "KRX",
        region: "KR",
        currency: "KRW",
      },
      {
        symbol: "030200.KS",
        name: "KT",
        exchange: "KRX",
        region: "KR",
        currency: "KRW",
      },
    ];

    const q = query.toLowerCase();
    return all.filter(
      (s) =>
        s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)
    );
  }
}

import type { OHLCVData, TimeRange, MarketEvent } from "../types";
import type { Time } from "lightweight-charts";

// Deterministic pseudo-random generator seeded by symbol
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

// Generate daily OHLCV data going back `days` calendar days from today
function generateDailyData(symbol: string, days: number): OHLCVData[] {
  const data: OHLCVData[] = [];
  const now = new Date();
  const rand = seededRand(symbol);
  let lastClose = 100 + rand() * 200;

  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    if (date.getDay() === 0 || date.getDay() === 6) continue;

    const time = date.toISOString().split("T")[0];
    const open = lastClose + (rand() - 0.5) * 5;
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
    lastClose = close;
  }
  return data;
}

// Aggregate daily data into weekly candles (week starts Monday)
function aggregateWeekly(daily: OHLCVData[]): OHLCVData[] {
  const weeks = new Map<string, OHLCVData>();
  for (const d of daily) {
    const date = new Date(d.time as string);
    const dow = date.getUTCDay();
    const monday = new Date(date);
    monday.setUTCDate(date.getUTCDate() - (dow === 0 ? 6 : dow - 1));
    const key = monday.toISOString().split("T")[0];
    if (!weeks.has(key)) {
      weeks.set(key, { ...d, time: key as Time });
    } else {
      const w = weeks.get(key)!;
      w.high = Math.max(w.high, d.high);
      w.low = Math.min(w.low, d.low);
      w.close = d.close;
      w.value = (w.value ?? 0) + (d.value ?? 0);
    }
  }
  return [...weeks.values()];
}

// Aggregate daily data into monthly candles (key = YYYY-MM-01)
function aggregateMonthly(daily: OHLCVData[]): OHLCVData[] {
  const months = new Map<string, OHLCVData>();
  for (const d of daily) {
    const key = (d.time as string).substring(0, 7) + "-01";
    if (!months.has(key)) {
      months.set(key, { ...d, time: key as Time });
    } else {
      const m = months.get(key)!;
      m.high = Math.max(m.high, d.high);
      m.low = Math.min(m.low, d.low);
      m.close = d.close;
      m.value = (m.value ?? 0) + (d.value ?? 0);
    }
  }
  return [...months.values()];
}

// Aggregate daily data into yearly candles (key = YYYY-01-01)
function aggregateYearly(daily: OHLCVData[]): OHLCVData[] {
  const years = new Map<string, OHLCVData>();
  for (const d of daily) {
    const key = (d.time as string).substring(0, 4) + "-01-01";
    if (!years.has(key)) {
      years.set(key, { ...d, time: key as Time });
    } else {
      const y = years.get(key)!;
      y.high = Math.max(y.high, d.high);
      y.low = Math.min(y.low, d.low);
      y.close = d.close;
      y.value = (y.value ?? 0) + (d.value ?? 0);
    }
  }
  return [...years.values()];
}

export class StockService {
  static async getChartData(
    symbol: string,
    range: TimeRange
  ): Promise<OHLCVData[]> {
    console.log(`Fetching data for ${symbol} (${range})`);
    await new Promise((resolve) => setTimeout(resolve, 300));

    switch (range) {
      case "일": {
        // 2년치 일봉
        return generateDailyData(symbol, 730);
      }
      case "주": {
        // 5년치 일봉 → 주봉으로 집계
        const daily = generateDailyData(symbol, 1825);
        return aggregateWeekly(daily);
      }
      case "월": {
        // 15년치 일봉 → 월봉으로 집계
        const daily = generateDailyData(symbol, 5475);
        return aggregateMonthly(daily);
      }
      case "년": {
        // 25년치 일봉 → 년봉으로 집계
        const daily = generateDailyData(symbol, 9125);
        return aggregateYearly(daily);
      }
    }
  }

  static async getEvents(
    symbol: string,
    data: OHLCVData[]
  ): Promise<MarketEvent[]> {
    const events: MarketEvent[] = [];
    data.forEach((d) => {
      const volatility = (d.high - d.low) / d.open;
      if (volatility > 0.03 && events.length < 5) {
        events.push({
          time: d.time,
          label: "●",
          text: `${symbol} 주요 이벤트`,
        });
      }
    });
    return events;
  }

  static async searchStocks(query: string) {
    const allStocks = [
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
        symbol: "TSLA",
        name: "Tesla, Inc.",
        exchange: "NASDAQ",
        region: "US",
        currency: "USD",
      },
      {
        symbol: "005930.KS",
        name: "삼성전자",
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
    ];

    return allStocks.filter(
      (s) =>
        s.symbol.toLowerCase().includes(query.toLowerCase()) ||
        s.name.toLowerCase().includes(query.toLowerCase())
    );
  }
}

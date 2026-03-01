import type { OHLCVData, TimeRange, MarketEvent } from "../types";
import type { Time } from "lightweight-charts";

export class StockService {
  /**
   * Fetches OHLCV data for a given symbol and time range.
   */
  static async getChartData(
    symbol: string,
    range: TimeRange
  ): Promise<OHLCVData[]> {
    console.log(`Fetching data for ${symbol} (${range})`);
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    const data: OHLCVData[] = [];
    const now = new Date();
    let days = 30;

    switch (range) {
      case "1W":
        days = 7;
        break;
      case "1M":
        days = 30;
        break;
      case "3M":
        days = 90;
        break;
      case "1Y":
        days = 365;
        break;
      case "ALL":
        days = 1000;
        break;
    }

    let lastClose = 180 + Math.random() * 20;

    for (let i = days; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      if (date.getDay() === 0 || date.getDay() === 6) continue;

      const time = date.toISOString().split("T")[0];
      const open = lastClose + (Math.random() - 0.5) * 5;
      const high = Math.max(open, open + Math.random() * 5);
      const low = Math.min(open, open - Math.random() * 5);
      const close = low + Math.random() * (high - low);

      data.push({
        time: time as Time,
        open: Number(open.toFixed(2)),
        high: Number(high.toFixed(2)),
        low: Number(low.toFixed(2)),
        close: Number(close.toFixed(2)),
        value: Math.floor(Math.random() * 1000000),
      });
      lastClose = close;
    }

    return data;
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
          label: "💡",
          text: `Significant move in ${symbol}`,
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

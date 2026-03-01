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

  // ── 주요 세계 사건 데이터베이스 ───────────────────────────────────────────
  private static readonly WORLD_EVENTS: {
    date: string;
    label: string;
    text: string;
    wikiUrl: string;
  }[] = [
    {
      date: "2001-09-11",
      label: "9/11",
      text: "미국 9.11 테러 — 전 세계 증시 급락",
      wikiUrl: "https://ko.wikipedia.org/wiki/9%C2%B711_%ED%85%8C%EB%9F%AC",
    },
    {
      date: "2003-03-20",
      label: "이라크",
      text: "이라크 전쟁 개전",
      wikiUrl:
        "https://ko.wikipedia.org/wiki/%EC%9D%B4%EB%9D%BC%ED%81%AC_%EC%A0%84%EC%9F%81",
    },
    {
      date: "2008-09-15",
      label: "리먼",
      text: "리먼브라더스 파산 — 글로벌 금융위기",
      wikiUrl:
        "https://ko.wikipedia.org/wiki/%EB%A6%AC%EB%A8%BC_%EB%B8%8C%EB%9D%BC%EB%8D%94%EC%8A%A4",
    },
    {
      date: "2010-05-06",
      label: "플래시",
      text: "플래시 크래시 — 순간 9.2% 폭락",
      wikiUrl:
        "https://ko.wikipedia.org/wiki/2010%EB%85%84_%ED%94%8C%EB%9E%98%EC%8B%9C_%ED%81%AC%EB%9E%98%EC%8B%9C",
    },
    {
      date: "2011-08-05",
      label: "신용강등",
      text: "S&P, 미국 국가신용등급 AA+로 강등",
      wikiUrl:
        "https://ko.wikipedia.org/wiki/2011%EB%85%84_%EB%AF%B8%EA%B5%AD_%EB%B6%80%EC%B1%84_%ED%95%9C%EB%8F%84_%EC%9C%84%EA%B8%B0",
    },
    {
      date: "2015-08-24",
      label: "차이나쇼크",
      text: "중국 증시 폭락 — 블랙먼데이",
      wikiUrl:
        "https://ko.wikipedia.org/wiki/2015%EB%85%84_%EC%A4%91%EA%B5%AD_%EC%A3%BC%EA%B0%80_%EB%B6%95%EA%B4%B4",
    },
    {
      date: "2016-06-24",
      label: "브렉시트",
      text: "영국 EU 탈퇴 결정 — 파운드화 급락",
      wikiUrl:
        "https://ko.wikipedia.org/wiki/%EB%B8%8C%EB%A0%89%EC%8B%9C%ED%8A%B8",
    },
    {
      date: "2018-12-24",
      label: "크리스마스폭락",
      text: "크리스마스 이브 폭락 — 연준 긴축 우려",
      wikiUrl:
        "https://news.google.com/search?q=2018+%ED%81%AC%EB%A6%AC%EC%8A%A4%EB%A7%88%EC%8A%A4+%EC%A6%9D%EC%8B%9C+%ED%8F%AD%EB%9D%BD+%EC%97%B0%EC%A4%80&hl=ko&gl=KR&ceid=KR:ko",
    },
    {
      date: "2020-01-27",
      label: "코로나공포",
      text: "COVID-19 팬데믹 공포 확산 — 급락 시작",
      wikiUrl:
        "https://ko.wikipedia.org/wiki/COVID-19_%ED%8C%AC%EB%8D%B0%EB%AF%B9",
    },
    {
      date: "2020-03-16",
      label: "코로나저점",
      text: "코로나19 최악 — 서킷브레이커 발동",
      wikiUrl:
        "https://ko.wikipedia.org/wiki/COVID-19_%ED%8C%AC%EB%8D%B0%EB%AF%B9",
    },
    {
      date: "2020-11-09",
      label: "백신",
      text: "화이자 백신 90% 효과 발표 — 강한 반등",
      wikiUrl:
        "https://ko.wikipedia.org/wiki/COVID-19_%EB%B0%B1%EC%8B%A0_(%ED%99%94%EC%9D%B4%EC%9E%90-%EB%B0%94%EC%9D%B4%EC%98%A4%EC%97%94%ED%85%8D)",
    },
    {
      date: "2022-02-24",
      label: "우크라이나",
      text: "러시아, 우크라이나 침공 개시",
      wikiUrl:
        "https://ko.wikipedia.org/wiki/%EB%9F%AC%EC%8B%9C%EC%95%84%EC%9D%98_%EC%9A%B0%ED%81%AC%EB%9D%BC%EC%9D%B4%EB%82%98_%EC%B9%A8%EA%B3%B5",
    },
    {
      date: "2022-06-15",
      label: "75bp인상",
      text: "연준, 28년만에 75bp 금리인상 단행",
      wikiUrl:
        "https://news.google.com/search?q=%EC%97%B0%EC%A4%80+75bp+%EA%B8%88%EB%A6%AC%EC%9D%B8%EC%83%81+2022&hl=ko&gl=KR&ceid=KR:ko",
    },
    {
      date: "2022-10-13",
      label: "CPI쇼크",
      text: "미국 CPI 8.2% — 인플레이션 쇼크",
      wikiUrl:
        "https://news.google.com/search?q=%EB%AF%B8%EA%B5%AD+CPI+%EC%87%BC%ED%81%AC+%EC%9D%B8%ED%94%8C%EB%A0%88%EC%9D%B4%EC%85%98+2022&hl=ko&gl=KR&ceid=KR:ko",
    },
    {
      date: "2023-03-10",
      label: "SVB파산",
      text: "실리콘밸리은행(SVB) 파산 — 금융 불안",
      wikiUrl:
        "https://ko.wikipedia.org/wiki/%EC%8B%A4%EB%A6%AC%EC%BD%98%EB%B0%B8%EB%A6%AC%EC%9D%80%ED%96%89",
    },
    {
      date: "2023-11-01",
      label: "피벗기대",
      text: "연준 금리동결 — 피벗 기대감 급등",
      wikiUrl:
        "https://news.google.com/search?q=%EC%97%B0%EC%A4%80+%EA%B8%88%EB%A6%AC%EB%8F%99%EA%B2%B0+%ED%94%BC%EB%B2%97+2023&hl=ko&gl=KR&ceid=KR:ko",
    },
    {
      date: "2024-08-05",
      label: "엔캐리청산",
      text: "일본 금리인상 — 엔 캐리 트레이드 청산 폭락",
      wikiUrl:
        "https://news.google.com/search?q=%EC%97%94+%EC%BA%90%EB%A6%AC+%EC%B2%AD%EC%82%B0+%ED%8F%AD%EB%9D%BD+2024&hl=ko&gl=KR&ceid=KR:ko",
    },
  ];

  static async getEvents(
    _symbol: string,
    data: OHLCVData[],
    timeRange: TimeRange = "일"
  ): Promise<MarketEvent[]> {
    if (data.length === 0) return [];

    const dateTimes = new Set(data.map((d) => String(d.time)));
    const dateList = data.map((d) => String(d.time)).sort();
    const firstDate = dateList[0];
    const lastDate = dateList[dateList.length - 1];

    const events: MarketEvent[] = [];

    // ── 세계 주요 사건 마커 ───────────────────────────────────────────────
    for (const ev of StockService.WORLD_EVENTS) {
      let matchDate = "";

      if (timeRange === "년") {
        // 년봉: 사건 연도와 같은 연도의 캔들에 표시
        const yearKey = ev.date.slice(0, 4) + "-01-01";
        if (dateTimes.has(yearKey)) matchDate = yearKey;
      } else if (timeRange === "월") {
        // 월봉: 사건 월과 같은 월의 캔들에 표시
        const monthKey = ev.date.slice(0, 7) + "-01";
        if (dateTimes.has(monthKey)) matchDate = monthKey;
      } else {
        // 일봉/주봉: 범위 체크 후 ±7일 내 가장 가까운 거래일
        if (ev.date < firstDate || ev.date > lastDate) continue;
        if (dateTimes.has(ev.date)) {
          matchDate = ev.date;
        } else {
          for (let delta = 1; delta <= 7; delta++) {
            const after = new Date(ev.date);
            after.setDate(after.getDate() + delta);
            const afterStr = after.toISOString().split("T")[0];
            if (dateTimes.has(afterStr)) {
              matchDate = afterStr;
              break;
            }
            const before = new Date(ev.date);
            before.setDate(before.getDate() - delta);
            const beforeStr = before.toISOString().split("T")[0];
            if (dateTimes.has(beforeStr)) {
              matchDate = beforeStr;
              break;
            }
          }
        }
      }

      if (!matchDate) continue;

      events.push({
        time: matchDate as import("lightweight-charts").Time,
        label: ev.label,
        text: ev.text,
        color: "#f97316", // 주황색 — 세계 사건
        eventType: "world",
        wikiUrl: ev.wikiUrl,
      });
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

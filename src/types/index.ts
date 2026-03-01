import type { Time } from "lightweight-charts";

export type TimeRange = "일" | "주" | "월" | "년";

export interface StockMetadata {
  symbol: string;
  name: string;
  exchange: string;
  region: string;
  currency: string;
}

export interface OHLCVData {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
  value?: number;
}

export interface NewsItem {
  title: string;
  description: string;
  url: string;
  source: string;
  publishedAt: string;
  category?: "company" | "macro"; // 종목 직접 관련 vs 거시/정치/글로벌
}

export interface AISummary {
  headline: string;
  content: string;
  sentiment: "positive" | "negative" | "neutral";
  date: string;
  sourceLinks: { title: string; url: string }[];
}

export interface ChartSelection {
  from: Time;
  to: Time;
  selectedDate?: Time;
}

export interface MarketEvent {
  time: Time;
  text: string;
  label: string;
  color?: string; // 마커 색상 (기본: 보라, 세계 사건: 빨강/주황)
  eventType?: "world" | "volatility"; // 이벤트 타입
}

export interface QuoteData {
  price: number;
  change: number;
  changeRate: number;
  marketCap?: number; // 억원 (KRW) / 사용 불가 (USD)
  per?: number;
  currency: string; // "KRW" | "USD"
}

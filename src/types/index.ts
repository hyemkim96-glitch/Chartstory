import type { Time } from "lightweight-charts";

export type TimeRange = "1W" | "1M" | "3M" | "1Y" | "ALL";

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
}

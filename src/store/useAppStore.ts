import { create } from "zustand";
import type {
  StockMetadata,
  OHLCVData,
  AISummary,
  ChartSelection,
  TimeRange,
  QuoteData,
} from "../types";

interface AppState {
  currentStock: StockMetadata | null;
  timeRange: TimeRange;
  chartData: OHLCVData[];
  selection: ChartSelection | null;
  summary: AISummary | null;
  isLoading: boolean;
  error: string | null;
  quote: QuoteData | null;
  quoteLoading: boolean;

  setStock: (stock: StockMetadata) => void;
  setTimeRange: (range: TimeRange) => void;
  setChartData: (data: OHLCVData[]) => void;
  setSelection: (selection: ChartSelection | null) => void;
  setSummary: (summary: AISummary | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setQuote: (quote: QuoteData | null) => void;
  setQuoteLoading: (loading: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentStock: {
    symbol: "AAPL",
    name: "Apple Inc.",
    exchange: "NASDAQ",
    region: "US",
    currency: "USD",
  },
  timeRange: "일",
  chartData: [],
  selection: null,
  summary: null,
  isLoading: false,
  error: null,
  quote: null,
  quoteLoading: false,

  setStock: (stock) => set({ currentStock: stock }),
  setTimeRange: (timeRange) => set({ timeRange }),
  setChartData: (data) => set({ chartData: data }),
  setSelection: (selection) => set({ selection }),
  setSummary: (summary) => set({ summary }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  setQuote: (quote) => set({ quote }),
  setQuoteLoading: (loading) => set({ quoteLoading: loading }),
}));

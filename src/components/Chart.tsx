import { useEffect, useRef } from "react";
import {
  createChart,
  ColorType,
  CandlestickSeries,
  createSeriesMarkers,
} from "lightweight-charts";
import type {
  CandlestickData,
  Time,
  IChartApi,
  ISeriesApi,
  ISeriesMarkersPluginApi,
  MouseEventParams,
  BusinessDay,
} from "lightweight-charts";
import { useAppStore } from "@/store/useAppStore";
import { StockService } from "@/services/StockService";
import { NewsService } from "@/services/NewsService";
import { AIService } from "@/services/AIService";

export default function Chart() {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const markersPluginRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const {
    currentStock,
    timeRange,
    setSelection,
    setLoading,
    setSummary,
    setError,
  } = useAppStore();

  // 1. Initialize Chart (Once)
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#64748b",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(255, 255, 255, 0.05)" },
        horzLines: { color: "rgba(255, 255, 255, 0.05)" },
      },
      crosshair: {
        vertLine: {
          color: "rgba(59, 130, 246, 0.5)",
          width: 1,
          labelBackgroundColor: "#1e293b",
        },
        horzLine: {
          color: "rgba(59, 130, 246, 0.5)",
          width: 1,
          labelBackgroundColor: "#1e293b",
        },
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight || 500,
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981",
      downColor: "#f43f5e",
      borderVisible: false,
      wickUpColor: "#10b981",
      wickDownColor: "#f43f5e",
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const resizeObserver = new ResizeObserver((entries) => {
      if (entries.length > 0 && chart) {
        const { width, height } = entries[0].contentRect;
        chart.applyOptions({ width, height });
      }
    });

    resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // 2. Fetch Data (On Stock/Range Change)
  useEffect(() => {
    let isCancelled = false;

    const fetchData = async () => {
      if (!currentStock || !seriesRef.current) return;
      try {
        const stockData = await StockService.getChartData(
          currentStock.symbol,
          timeRange,
          currentStock
        );
        if (!isCancelled && seriesRef.current) {
          seriesRef.current.setData(stockData as CandlestickData<Time>[]);

          // Fetch and set markers
          const events = await StockService.getEvents(
            currentStock.symbol,
            stockData
          );
          if (!isCancelled && seriesRef.current) {
            markersPluginRef.current?.detach();
            markersPluginRef.current = createSeriesMarkers(
              seriesRef.current,
              events.map((ev) => ({
                time: ev.time,
                position: "aboveBar",
                color: "#6366f1",
                shape: "circle",
                text: ev.label,
              }))
            );
          }
        }
      } catch (err) {
        console.error("Failed to fetch chart data:", err);
      }
    };

    fetchData();

    return () => {
      isCancelled = true;
    };
  }, [currentStock, timeRange]);

  // 3. Handle Interactions
  useEffect(() => {
    if (!chartRef.current) return;

    const handleChartClick = async (param: MouseEventParams) => {
      if (param.time && currentStock) {
        let dateStr = "";

        if (typeof param.time === "string") {
          dateStr = param.time;
        } else if (typeof param.time === "number") {
          // Unix timestamp
          dateStr = new Date(param.time * 1000).toISOString().split("T")[0];
        } else {
          // BusinessDay object { year: number, month: number, day: number }
          const bd = param.time as BusinessDay;
          dateStr = `${bd.year}-${String(bd.month).padStart(2, "0")}-${String(bd.day).padStart(2, "0")}`;
        }

        setSelection({
          from: param.time,
          to: param.time,
          selectedDate: param.time,
        });

        // Trigger AI Summary
        setLoading(true);
        setError(null);
        try {
          const news = await NewsService.getNewsForDate(
            currentStock.symbol,
            dateStr
          );
          const summary = await AIService.summarizeNews(
            currentStock.symbol,
            dateStr,
            news
          );
          setSummary(summary);
        } catch (err) {
          setError(
            err instanceof Error ? err.message : "Failed to generate summary"
          );
          setSummary(null);
        } finally {
          setLoading(false);
        }
      }
    };

    chartRef.current.subscribeClick(handleChartClick);

    return () => {
      chartRef.current?.unsubscribeClick(handleChartClick);
    };
  }, [currentStock, setSelection, setLoading, setSummary, setError]);

  return (
    <div className="w-full h-full">
      <div ref={chartContainerRef} className="w-full h-full" />
    </div>
  );
}

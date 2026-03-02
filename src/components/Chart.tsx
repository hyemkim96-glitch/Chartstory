import { useEffect, useRef, useState } from "react";
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
import { AIService, type CandleInfo } from "@/services/AIService";
import type { OHLCVData } from "@/types";

type TooltipData = {
  x: number;
  y: number;
  label: string;
  text: string;
  wikiUrl: string;
} | null;

function extractDate(time: Time): string {
  if (typeof time === "string") return time;
  if (typeof time === "number") {
    return new Date(time * 1000).toISOString().split("T")[0];
  }
  // BusinessDay
  const bd = time as BusinessDay;
  return `${bd.year}-${String(bd.month).padStart(2, "0")}-${String(bd.day).padStart(2, "0")}`;
}

export default function Chart() {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const markersPluginRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const chartDataRef = useRef<OHLCVData[]>([]); // 클릭 시 캔들 조회용
  const eventsRef = useRef<import("@/types").MarketEvent[]>([]); // 세계 사건 위키 링크용
  const [tooltip, setTooltip] = useState<TooltipData>(null);
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
      handleScroll: false,
      handleScale: false,
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
          chartDataRef.current = stockData; // 클릭 시 캔들 조회용 저장
          seriesRef.current.setData(stockData as CandlestickData<Time>[]);

          // 프리셋별 표시 범위 설정 (스크롤/확대 비활성화)
          if (stockData.length > 0) {
            const lastDate = String(stockData[stockData.length - 1].time);
            if (timeRange === "MAX") {
              chartRef.current?.timeScale().fitContent();
            } else {
              const from = new Date(lastDate);
              if (timeRange === "1M") from.setMonth(from.getMonth() - 1);
              else if (timeRange === "3M") from.setMonth(from.getMonth() - 3);
              else if (timeRange === "6M") from.setMonth(from.getMonth() - 6);
              else if (timeRange === "1Y")
                from.setFullYear(from.getFullYear() - 1);
              else if (timeRange === "5Y")
                from.setFullYear(from.getFullYear() - 5);
              chartRef.current?.timeScale().setVisibleRange({
                from: from.toISOString().split("T")[0] as Time,
                to: lastDate as Time,
              });
            }
          }

          // 세계 사건 + 변동성 마커
          const events = await StockService.getEvents(
            currentStock.symbol,
            stockData,
            timeRange
          );
          if (!isCancelled && seriesRef.current) {
            eventsRef.current = events; // 클릭 시 위키 링크 조회용
            markersPluginRef.current?.detach();
            markersPluginRef.current = createSeriesMarkers(
              seriesRef.current,
              events.map((ev) => ({
                time: ev.time,
                position: "aboveBar" as const,
                color: ev.color ?? "#6366f1",
                shape: "circle" as const,
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

    // Hover: 세계 사건 마커 위 툴팁 표시
    const handleCrosshairMove = (param: MouseEventParams) => {
      if (!param.time || !param.point) {
        setTooltip(null);
        return;
      }
      const dateStr = extractDate(param.time);
      const worldEvent = eventsRef.current.find(
        (ev) => ev.eventType === "world" && String(ev.time) === dateStr
      );
      if (worldEvent?.wikiUrl) {
        setTooltip({
          x: param.point.x,
          y: param.point.y,
          label: worldEvent.label,
          text: worldEvent.text,
          wikiUrl: worldEvent.wikiUrl,
        });
      } else {
        setTooltip(null);
      }
    };

    const handleChartClick = async (param: MouseEventParams) => {
      if (param.time && currentStock) {
        const dateStr = extractDate(param.time);

        // 세계 사건 마커: 클릭 시 링크 이동 (뉴스 호출은 하지 않음)
        const worldEvent = eventsRef.current.find(
          (ev) => ev.eventType === "world" && String(ev.time) === dateStr
        );
        if (worldEvent?.wikiUrl) {
          window.open(worldEvent.wikiUrl, "_blank", "noopener,noreferrer");
          return;
        }

        setSelection({
          from: param.time,
          to: param.time,
          selectedDate: param.time,
        });

        // 클릭한 캔들 찾기 → AI에 가격 컨텍스트 전달
        const candle = chartDataRef.current.find(
          (d) => String(d.time) === dateStr
        );
        const candleInfo: CandleInfo | undefined = candle
          ? {
              open: candle.open,
              high: candle.high,
              low: candle.low,
              close: candle.close,
              changeRate: ((candle.close - candle.open) / candle.open) * 100,
            }
          : undefined;

        // Trigger AI Summary
        setLoading(true);
        setError(null);
        try {
          const news = await NewsService.getNewsForDate(
            dateStr,
            currentStock,
            timeRange
          );
          const summary = await AIService.summarizeNews(
            currentStock.symbol,
            dateStr,
            news,
            candleInfo,
            timeRange
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

    chartRef.current.subscribeCrosshairMove(handleCrosshairMove);
    chartRef.current.subscribeClick(handleChartClick);

    return () => {
      chartRef.current?.unsubscribeCrosshairMove(handleCrosshairMove);
      chartRef.current?.unsubscribeClick(handleChartClick);
    };
  }, [currentStock, timeRange, setSelection, setLoading, setSummary, setError]);

  // Tooltip positioning: flip if near right/top edge
  const containerWidth = chartContainerRef.current?.clientWidth ?? 800;
  const TOOLTIP_W = 230;
  const TOOLTIP_H = 90;
  const tooltipLeft = tooltip
    ? tooltip.x + 12 + TOOLTIP_W > containerWidth
      ? tooltip.x - TOOLTIP_W - 12
      : tooltip.x + 12
    : 0;
  const tooltipTop = tooltip
    ? tooltip.y - 12 < 0
      ? tooltip.y + 12
      : tooltip.y - TOOLTIP_H
    : 0;

  return (
    <div className="w-full h-full relative">
      <div ref={chartContainerRef} className="w-full h-full" />
      {tooltip && (
        <div
          className="pointer-events-none absolute z-50 border border-[#f97316]/60 bg-[#1a1a1a] shadow-lg"
          style={{
            left: tooltipLeft,
            top: tooltipTop,
            width: TOOLTIP_W,
            padding: "10px 12px",
          }}
        >
          <p className="text-[10px] font-bold text-[#f97316] uppercase tracking-widest mb-1.5">
            {tooltip.label}
          </p>
          <p className="text-xs text-[#e5e5e5] leading-snug mb-2">
            {tooltip.text}
          </p>
          <p className="text-[10px] text-[#6b6b6b]">클릭하여 자세히 보기 →</p>
        </div>
      )}
    </div>
  );
}

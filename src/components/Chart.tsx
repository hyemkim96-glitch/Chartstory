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
import { AIService, type CandleInfo } from "@/services/AIService";
import type { OHLCVData } from "@/types";

export default function Chart() {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const markersPluginRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const chartDataRef = useRef<OHLCVData[]>([]); // 클릭 시 캔들 조회용
  const eventsRef = useRef<import("@/types").MarketEvent[]>([]); // 세계 사건 위키 링크용
  const {
    currentStock,
    timeRange,
    setSelection,
    setLoading,
    setSummary,
    setWorldEvent,
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
          chartDataRef.current = stockData; // 클릭 시 캔들 조회용 저장
          seriesRef.current.setData(stockData as CandlestickData<Time>[]);

          // 일봉: 최근 2년만 기본 표시 (좌우 스크롤로 과거 탐색)
          // 그 외: 전체 데이터 맞춤
          if (timeRange === "일" && stockData.length > 0) {
            const lastDate = String(stockData[stockData.length - 1].time);
            const twoYearsAgo = new Date(lastDate);
            twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
            chartRef.current?.timeScale().setVisibleRange({
              from: twoYearsAgo.toISOString().split("T")[0] as Time,
              to: lastDate as Time,
            });
          } else {
            chartRef.current?.timeScale().fitContent();
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

        // 세계 사건 마커: 사이드바에 링크 표시 (차트 클릭으로는 위키 자동이동 X)
        const worldEvent = eventsRef.current.find(
          (ev) => ev.eventType === "world" && String(ev.time) === dateStr
        );
        setWorldEvent(
          worldEvent?.wikiUrl
            ? {
                label: worldEvent.label,
                text: worldEvent.text,
                wikiUrl: worldEvent.wikiUrl,
              }
            : null
        );

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

    chartRef.current.subscribeClick(handleChartClick);

    return () => {
      chartRef.current?.unsubscribeClick(handleChartClick);
    };
  }, [
    currentStock,
    setSelection,
    setLoading,
    setSummary,
    setWorldEvent,
    setError,
  ]);

  return (
    <div className="w-full h-full">
      <div ref={chartContainerRef} className="w-full h-full" />
    </div>
  );
}

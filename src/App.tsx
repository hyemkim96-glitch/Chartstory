import { useEffect } from "react";
import Layout from "./components/Layout";
import Chart from "./components/Chart";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppStore } from "@/store/useAppStore";
import { StockService } from "@/services/StockService";
import type { TimeRange } from "@/types";
import { cn } from "@/lib/utils";

// ── Formatting helpers ───────────────────────────────────────────────────────
function fmtPrice(price: number, currency: string): string {
  if (currency === "KRW") return price.toLocaleString("ko-KR") + "원";
  return (
    "$" +
    price.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function fmtChange(change: number, currency: string): string {
  const abs = Math.abs(change);
  const sign = change >= 0 ? "+" : "-";
  if (currency === "KRW") return sign + abs.toLocaleString("ko-KR") + "원";
  return (
    sign +
    "$" +
    abs.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function fmtChangeRate(rate: number): string {
  return (rate >= 0 ? "+" : "") + rate.toFixed(2) + "%";
}

function fmtMarketCap(cap: number | undefined, currency: string): string {
  if (!cap || cap <= 0) return "—";
  if (currency === "KRW") {
    if (cap >= 10000) return (cap / 10000).toFixed(1) + "조";
    return cap.toLocaleString("ko-KR") + "억";
  }
  // US Market Cap comes in Million USD
  if (cap >= 1000000) return (cap / 1000000).toFixed(2) + "T";
  if (cap >= 1000) return (cap / 1000).toFixed(2) + "B";
  return cap.toFixed(2) + "M";
}

function fmtPer(per: number | undefined): string {
  if (!per || per <= 0) return "—";
  return per.toFixed(2);
}

// ── App ──────────────────────────────────────────────────────────────────────
function App() {
  const {
    currentStock,
    timeRange,
    setTimeRange,
    quote,
    quoteLoading,
    setQuote,
    setQuoteLoading,
  } = useAppStore();

  // Fetch quote whenever the selected stock changes
  useEffect(() => {
    if (!currentStock) return;
    let cancelled = false;

    setQuoteLoading(true);
    setQuote(null);

    StockService.getQuote(currentStock.symbol, currentStock).then((q) => {
      if (!cancelled) {
        setQuote(q);
        setQuoteLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [currentStock, setQuote, setQuoteLoading]);

  const isUp = (quote?.change ?? 0) >= 0;
  const currency = quote?.currency ?? currentStock?.currency ?? "USD";

  return (
    <Layout>
      <div className="space-y-6">
        {/* 종목 헤더 */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b border-default">
          <div className="space-y-1">
            <h2 className="text-3xl font-bold tracking-tight text-primary leading-none tabular-nums">
              {currentStock?.symbol}
            </h2>
            <p className="text-sm text-secondary">
              {currentStock?.name} &middot; {currentStock?.exchange}
            </p>
          </div>

          <div className="flex flex-row items-end gap-8 bg-surface-02 border border-default p-5">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-secondary uppercase tracking-wider">
                현재가
              </span>
              <div className="text-2xl font-bold text-primary tabular-nums leading-none">
                {quoteLoading
                  ? "—"
                  : quote
                    ? fmtPrice(quote.price, currency)
                    : "—"}
              </div>
            </div>
            <div className="flex flex-col gap-1 text-right">
              <span className="text-xs font-medium text-secondary uppercase tracking-wider">
                등락률
              </span>
              <div
                className={cn(
                  "text-lg font-bold tabular-nums leading-none",
                  quoteLoading || !quote
                    ? "text-secondary"
                    : isUp
                      ? "text-up"
                      : "text-down"
                )}
              >
                {quoteLoading || !quote ? (
                  "—"
                ) : (
                  <>
                    {fmtChangeRate(quote.changeRate)}{" "}
                    <span className="text-xs font-normal text-secondary ml-1">
                      {fmtChange(quote.change, currency)}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 차트 섹션 */}
        <div className="bg-surface-02 border border-default">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-6 pt-5 pb-4 border-b border-default">
            <div>
              <h3 className="text-base font-semibold text-primary">
                가격 차트
              </h3>
              <p className="text-xs text-secondary mt-0.5">
                과거 데이터 분석 — 날짜를 클릭하면 AI 분석이 생성됩니다
              </p>
            </div>

            <Tabs
              value={timeRange}
              onValueChange={(val) => setTimeRange(val as TimeRange)}
              className="bg-surface-03 p-1 border border-default"
            >
              <TabsList className="bg-transparent border-0 gap-0.5">
                {(["일", "주", "월", "년"] as TimeRange[]).map((r) => (
                  <TabsTrigger
                    key={r}
                    value={r}
                    className="text-xs font-medium px-4 data-[state=active]:bg-[#1A6EFF] data-[state=active]:text-white transition-colors"
                  >
                    {r}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          <div className="h-[480px] p-4">
            <Chart />
          </div>
        </div>

        {/* 주요 지표 */}
        <div className="grid grid-cols-1 md:grid-cols-3 border border-default">
          <div className="p-5 border-r border-default">
            <p className="text-xs font-medium text-secondary uppercase tracking-wider mb-2">
              시가총액
            </p>
            <div className="text-xl font-semibold text-primary tabular-nums">
              {quoteLoading ? "—" : fmtMarketCap(quote?.marketCap, currency)}
            </div>
          </div>
          <div className="p-5 border-r border-default">
            <p className="text-xs font-medium text-secondary uppercase tracking-wider mb-2">
              PER
            </p>
            <div className="text-xl font-semibold text-primary tabular-nums">
              {quoteLoading ? "—" : fmtPer(quote?.per)}
            </div>
          </div>
          <div className="p-5">
            <p className="text-xs font-medium text-secondary uppercase tracking-wider mb-2">
              배당수익률
            </p>
            <div className="text-xl font-semibold text-primary tabular-nums">
              —
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default App;

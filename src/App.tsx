import Layout from "./components/Layout";
import Chart from "./components/Chart";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppStore } from "@/store/useAppStore";
import type { TimeRange } from "@/types";

function App() {
  const { currentStock, timeRange, setTimeRange } = useAppStore();

  return (
    <Layout>
      <div className="space-y-6">
        {/* 종목 헤더 */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b border-default">
          <div className="space-y-1">
            <h2 className="text-[2.5rem] font-bold tracking-tight text-primary leading-none tabular-nums">
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
              <div className="text-[2rem] font-bold text-primary tabular-nums leading-none">
                $187.24
              </div>
            </div>
            <div className="flex flex-col gap-1 text-right">
              <span className="text-xs font-medium text-secondary uppercase tracking-wider">
                등락률
              </span>
              <div className="text-lg font-bold text-up tabular-nums leading-none">
                +1.42%{" "}
                <span className="text-sm font-normal text-secondary">
                  +$2.63
                </span>
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
                {(["1W", "1M", "3M", "1Y", "ALL"] as TimeRange[]).map((r) => (
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
              $2.94T
            </div>
          </div>
          <div className="p-5 border-r border-default">
            <p className="text-xs font-medium text-secondary uppercase tracking-wider mb-2">
              PER
            </p>
            <div className="text-xl font-semibold text-primary tabular-nums">
              28.42
            </div>
          </div>
          <div className="p-5">
            <p className="text-xs font-medium text-secondary uppercase tracking-wider mb-2">
              배당수익률
            </p>
            <div className="text-xl font-semibold text-primary tabular-nums">
              0.52%
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default App;

import Layout from "./components/Layout";
import Chart from "./components/Chart";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppStore } from "@/store/useAppStore";
import type { TimeRange } from "@/types";
import { TrendingUp, Globe, Clock } from "lucide-react";

function App() {
  const { currentStock, timeRange, setTimeRange } = useAppStore();

  return (
    <Layout>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Market Banner */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h2 className="text-4xl font-black tracking-tight text-white">
                {currentStock?.symbol}
              </h2>
              <div className="px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-bold uppercase tracking-widest">
                Real-time
              </div>
            </div>
            <div className="flex items-center gap-4 text-slate-400">
              <div className="flex items-center gap-1.5 font-medium text-sm">
                <Globe className="w-4 h-4 text-slate-600" />
                {currentStock?.name} · {currentStock?.exchange}
              </div>
              <div className="w-1 h-1 rounded-full bg-slate-700" />
              <div className="flex items-center gap-1.5 font-medium text-sm">
                <Clock className="w-4 h-4 text-slate-600" />
                Market Open
              </div>
            </div>
          </div>

          <div className="flex flex-row items-end gap-8 bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-md shadow-xl transition-all hover:bg-white/10 group">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                Last Price
              </span>
              <div className="text-3xl font-black text-white">$187.24</div>
            </div>
            <div className="flex flex-col text-right">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                Today's Range
              </span>
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-lg">
                <TrendingUp className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                +1.42%{" "}
                <span className="text-emerald-500/50 text-sm">+$2.63</span>
              </div>
            </div>
          </div>
        </div>

        {/* Chart Section */}
        <div className="relative glass-dark rounded-[2.5rem] border border-white/5 p-8 shadow-2xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
            <div className="flex flex-col">
              <h3 className="text-lg font-bold text-white">
                Price Performance
              </h3>
              <p className="text-xs text-slate-500">
                Historical data analysis & events toggle
              </p>
            </div>

            <Tabs
              value={timeRange}
              onValueChange={(val) => setTimeRange(val as TimeRange)}
              className="bg-black/20 p-1.5 rounded-2xl border border-white/5"
            >
              <TabsList className="bg-transparent border-0 gap-1">
                {["1W", "1M", "3M", "1Y", "ALL"].map((r) => (
                  <TabsTrigger
                    key={r}
                    value={r}
                    className="rounded-xl px-5 text-xs font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all duration-300"
                  >
                    {r}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          <div className="h-[520px] rounded-3xl overflow-hidden bg-black/40 border border-white/5 shadow-inner p-4">
            <Chart />
          </div>
        </div>

        {/* Quick Insights Tiles */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-3xl bg-blue-600/5 border border-blue-500/10 hover:bg-blue-600/10 transition-colors">
            <h4 className="text-[10px] font-bold text-blue-400 uppercase tracking-[0.2em] mb-3">
              Market Cap
            </h4>
            <div className="text-xl font-bold text-slate-100">$2.94T</div>
          </div>
          <div className="p-6 rounded-3xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-3">
              PE Ratio
            </h4>
            <div className="text-xl font-bold text-slate-100">28.42</div>
          </div>
          <div className="p-6 rounded-3xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-3">
              Dividend
            </h4>
            <div className="text-xl font-bold text-slate-100">0.52%</div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default App;

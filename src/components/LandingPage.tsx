import { useEffect, useRef, useState } from "react";
import { MousePointer2, Sparkles, Globe2, Search, Loader2 } from "lucide-react";
import { StockService } from "@/services/StockService";
import type { StockMetadata } from "@/types";

interface LandingPageProps {
  onStart: (stock: StockMetadata) => void;
}

// ── Mini chart demo: candles positions (x, y-top, height, type) ──────────────
const CANDLES = [
  { x: 24, yt: 88, h: 26, up: true },
  { x: 52, yt: 76, h: 34, up: false },
  { x: 80, yt: 68, h: 28, up: true },
  { x: 108, yt: 54, h: 38, up: false, selected: true },
  { x: 136, yt: 70, h: 30, up: true },
  { x: 164, yt: 62, h: 24, up: true },
  { x: 192, yt: 56, h: 36, up: false },
  { x: 220, yt: 48, h: 32, up: true },
];

const WORLD_EVENTS = [
  { year: "2008", label: "리먼", x: "23%", color: "#f97316" },
  { year: "2020", label: "코로나", x: "55%", color: "#f97316" },
  { year: "2022", label: "금리쇼크", x: "78%", color: "#f97316" },
];

export default function LandingPage({ onStart }: LandingPageProps) {
  const scrollRefs = useRef<NodeListOf<Element> | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StockMetadata[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.trim()) {
        setIsSearching(true);
        try {
          const res = await StockService.searchStocks(query);
          setResults(res);
        } catch {
          // ignore
        } finally {
          setIsSearching(false);
        }
      } else {
        setResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setResults([]);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
          }
        });
      },
      { threshold: 0.12, rootMargin: "-40px 0px" }
    );
    scrollRefs.current = document.querySelectorAll(".scroll-fade");
    scrollRefs.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-surface-01 text-primary overflow-x-hidden">
      {/* ── Nav ─────────────────────────────────────────────────── */}
      <nav className="fixed top-0 inset-x-0 z-50 flex items-center px-8 h-14 border-b border-default bg-surface-01/90 backdrop-blur-sm">
        <span className="text-sm font-bold tracking-tight text-primary">
          ChartStory
        </span>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────── */}
      <section className="relative flex flex-col items-center justify-center min-h-screen px-6 pt-14 overflow-hidden">
        {/* Background: subtle animated chart lines */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          preserveAspectRatio="none"
          aria-hidden
        >
          <polyline
            points="0,320 120,280 240,310 360,240 480,260 600,200 720,230 840,170 960,190 1080,140 1200,160 1320,110 1440,130"
            fill="none"
            stroke="#1a6eff"
            strokeWidth="1.5"
            strokeDasharray="800"
            strokeDashoffset="800"
            style={{
              animation:
                "hero-line-draw 2.4s cubic-bezier(0.4,0,0.2,1) forwards 0.5s",
            }}
          />
          <polyline
            points="0,400 150,360 300,390 450,320 600,340 750,280 900,310 1050,250 1200,270 1350,220 1440,240"
            fill="none"
            stroke="#1a6eff"
            strokeWidth="1"
            strokeDasharray="800"
            strokeDashoffset="800"
            style={{
              animation:
                "hero-line-draw 2.8s cubic-bezier(0.4,0,0.2,1) forwards 0.9s",
            }}
          />
        </svg>

        <div className="relative text-center max-w-3xl mx-auto">
          <div
            className="inline-flex items-center gap-2 text-xs font-semibold text-brand border border-brand/30 bg-brand/5 px-3 py-1.5 mb-8"
            style={{ opacity: 0, animation: "fadeIn 0.6s ease forwards 0.4s" }}
          >
            <Sparkles className="w-3 h-3" />
            AI 기반 주가 변동 분석
          </div>

          <h1
            className="text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.08] tracking-tight mb-6"
            style={{ opacity: 0, animation: "fadeIn 0.7s ease forwards 0.7s" }}
          >
            주가가 움직인 이유,
            <br />
            <span
              style={{
                background: "linear-gradient(135deg, #1a6eff 0%, #60a5fa 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              한눈에 파악하세요
            </span>
          </h1>

          <p
            className="text-base md:text-lg text-secondary leading-relaxed max-w-xl mx-auto mb-10"
            style={{ opacity: 0, animation: "fadeIn 0.7s ease forwards 1.0s" }}
          >
            차트의 모든 변동점 뒤에는 이유가 있습니다.
            <br />
            AI가 그 날의 경제·정치·기업 이벤트를 즉시 분석합니다.
          </p>

          {/* Search input */}
          <div
            ref={searchRef}
            className="relative w-full max-w-md mx-auto"
            style={{ opacity: 0, animation: "fadeIn 0.6s ease forwards 1.2s" }}
          >
            <div className="relative">
              {isSearching ? (
                <Loader2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary animate-spin" />
              ) : (
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-placeholder" />
              )}
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="종목명 또는 심볼 검색... (예: 삼성전자, AAPL)"
                className="w-full pl-10 pr-4 h-12 bg-surface-02 border border-default text-sm text-primary placeholder:text-placeholder focus:border-brand outline-none transition-colors"
              />
            </div>
            {results.length > 0 && (
              <div className="absolute top-full left-0 right-0 bg-surface-03 border border-default z-50 max-h-64 overflow-y-auto">
                {results.map((stock) => (
                  <button
                    key={stock.symbol}
                    onClick={() => onStart(stock)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-surface-02 transition-colors border-b border-subtle last:border-0 text-left"
                  >
                    <div>
                      <div className="text-sm font-semibold text-primary">
                        {stock.symbol}
                      </div>
                      <div className="text-xs text-secondary">{stock.name}</div>
                    </div>
                    <div className="text-[11px] text-secondary font-medium px-2 py-0.5 border border-default">
                      {stock.exchange}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Scroll hint */}
        <div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
          style={{ opacity: 0, animation: "fadeIn 0.5s ease forwards 2s" }}
        >
          <span className="text-[11px] text-placeholder uppercase tracking-widest">
            스크롤
          </span>
          <div className="w-px h-8 bg-gradient-to-b from-placeholder to-transparent" />
        </div>
      </section>

      {/* ── How It Works ────────────────────────────────────────── */}
      <section className="py-32 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-20 scroll-fade">
            <p className="text-xs font-semibold text-brand uppercase tracking-widest mb-4">
              사용 방법
            </p>
            <h2 className="text-3xl md:text-4xl font-bold leading-tight">
              클릭 한 번으로 시작됩니다
            </h2>
          </div>

          {/* Animated Demo */}
          <div className="scroll-fade mb-20">
            <div
              className="relative mx-auto border border-default bg-surface-02 overflow-hidden"
              style={{ maxWidth: 700, height: 340 }}
            >
              {/* Mock header bar */}
              <div className="flex items-center justify-between px-4 h-10 border-b border-default bg-surface-03">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-[#2e2e2e]" />
                    <div className="w-3 h-3 rounded-full bg-[#2e2e2e]" />
                    <div className="w-3 h-3 rounded-full bg-[#2e2e2e]" />
                  </div>
                  <span className="text-xs text-secondary font-mono">
                    AAPL · 일봉
                  </span>
                </div>
                <div className="flex gap-1">
                  {["일", "주", "월", "년"].map((t) => (
                    <span
                      key={t}
                      className={`text-[10px] px-2 py-0.5 ${t === "일" ? "bg-brand text-white" : "text-secondary"}`}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              {/* Chart area */}
              <div className="relative" style={{ height: 200 }}>
                {/* Grid lines */}
                <svg className="absolute inset-0 w-full h-full" aria-hidden>
                  {[60, 110, 160].map((y) => (
                    <line
                      key={y}
                      x1="0"
                      y1={y}
                      x2="700"
                      y2={y}
                      stroke="rgba(255,255,255,0.04)"
                      strokeWidth="1"
                    />
                  ))}
                  {/* Candles */}
                  {CANDLES.map((c, i) => (
                    <g key={i}>
                      <line
                        x1={c.x + 5}
                        y1={c.yt - 6}
                        x2={c.x + 5}
                        y2={c.yt + c.h + 6}
                        stroke={c.up ? "#10b981" : "#f43f5e"}
                        strokeWidth="1"
                      />
                      <rect
                        x={c.x}
                        y={c.yt}
                        width="10"
                        height={c.h}
                        className={c.selected ? "demo-candle-sel" : undefined}
                        fill={
                          c.selected ? "#f43f5e" : c.up ? "#10b981" : "#f43f5e"
                        }
                      />
                    </g>
                  ))}
                  {/* Event marker on selected candle */}
                  <circle cx="113" cy="47" r="5" fill="#f97316" />
                  <text
                    x="113"
                    y="40"
                    textAnchor="middle"
                    fontSize="7"
                    fill="#f97316"
                    fontWeight="bold"
                  >
                    코로나
                  </text>
                </svg>

                {/* Click ripple */}
                <div
                  className="demo-ripple absolute pointer-events-none"
                  style={{
                    left: 265,
                    top: 70,
                    width: 24,
                    height: 24,
                    marginLeft: -12,
                    marginTop: -12,
                    borderRadius: "50%",
                    border: "2px solid #1a6eff",
                    transformOrigin: "center",
                  }}
                />

                {/* Animated cursor */}
                <div
                  className="demo-cursor absolute pointer-events-none"
                  style={{ left: 90, top: 70, transformOrigin: "4px 4px" }}
                >
                  <svg width="20" height="24" viewBox="0 0 20 24" fill="none">
                    <path
                      d="M4 2L4 18L7.5 14.5L10 20L12 19L9.5 13.5L14.5 13.5L4 2Z"
                      fill="#e5e5e5"
                      stroke="#111"
                      strokeWidth="0.5"
                    />
                  </svg>
                </div>
              </div>

              {/* AI Analysis Panel (slides in) */}
              <div
                className="demo-panel absolute top-10 right-0 bottom-0 w-[42%] bg-surface-03 border-l border-default flex flex-col"
                style={{ transformOrigin: "right center" }}
              >
                <div className="px-3 py-2 border-b border-default flex items-center justify-between">
                  <span className="text-[11px] font-bold text-primary">
                    AI 분석
                  </span>
                  <span className="text-[10px] text-secondary font-mono">
                    2020-01-27
                  </span>
                </div>
                <div className="px-3 py-3 flex flex-col gap-2.5 overflow-hidden">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#dc2626]" />
                    <span className="text-[10px] font-semibold text-[#dc2626] border border-[#dc2626]/30 bg-[#dc2626]/10 px-1.5 py-0.5">
                      부정 영향
                    </span>
                  </div>
                  <p className="text-xs font-bold text-primary leading-snug">
                    코로나 팬데믹 공포로 급락
                  </p>
                  <div className="space-y-1.5">
                    {[
                      { tag: "거시요인", body: "글로벌 이동제한 조치" },
                      { tag: "기업요인", body: "공급망 차질 우려" },
                    ].map((f) => (
                      <div
                        key={f.tag}
                        className="flex items-start gap-2 p-2 bg-surface-02 border border-default"
                      >
                        <span className="w-1 h-1 rounded-full bg-brand mt-1.5 shrink-0" />
                        <div>
                          <span className="text-[9px] font-bold text-brand uppercase tracking-wide block mb-0.5">
                            {f.tag}
                          </span>
                          <span className="text-[10px] text-primary">
                            {f.body}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Instruction overlay at bottom */}
              <div className="absolute bottom-0 inset-x-0 px-4 py-3 border-t border-default bg-surface-02/90 flex items-center gap-2">
                <MousePointer2 className="w-3 h-3 text-brand shrink-0" />
                <span className="text-[11px] text-secondary">
                  차트의 날짜를 클릭하면 AI가 그날의 시장을 분석합니다
                </span>
              </div>
            </div>
          </div>

          {/* Steps */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border border-default">
            {[
              {
                n: "01",
                icon: "🔍",
                title: "종목 검색",
                desc: "국내·해외 주요 종목을 검색하고 선택합니다.",
                delay: "",
              },
              {
                n: "02",
                icon: "📅",
                title: "날짜 클릭",
                desc: "차트에서 궁금한 날짜나 변동점을 클릭합니다.",
                delay: "scroll-fade-delay-1",
              },
              {
                n: "03",
                icon: "🤖",
                title: "AI 분석 확인",
                desc: "AI가 뉴스·경제·정치 이벤트를 종합 분석합니다.",
                delay: "scroll-fade-delay-2",
              },
            ].map((step) => (
              <div
                key={step.n}
                className={`scroll-fade ${step.delay} p-8 border-r border-default last:border-r-0 md:border-r`}
              >
                <div className="text-[10px] font-bold text-brand uppercase tracking-widest mb-4">
                  STEP {step.n}
                </div>
                <div className="text-2xl mb-3">{step.icon}</div>
                <h3 className="text-base font-bold text-primary mb-2">
                  {step.title}
                </h3>
                <p className="text-sm text-secondary leading-relaxed">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── World Events Feature ─────────────────────────────────── */}
      <section className="py-28 px-6 border-t border-default">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <div className="scroll-fade">
                <p className="text-xs font-semibold text-[#f97316] uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Globe2 className="w-3.5 h-3.5" />
                  세계 주요 사건
                </p>
                <h2 className="text-3xl font-bold leading-tight mb-5">
                  역사적 사건들이
                  <br />
                  차트에 새겨집니다
                </h2>
                <p className="text-sm text-secondary leading-relaxed">
                  리먼브라더스 사태, 코로나 팬데믹, 러시아의 우크라이나 침공 등
                  시장을 뒤흔든 17개 세계 사건이 차트 위에 마커로 표시됩니다.
                  마커 위에 마우스를 올리면 사건 설명이, 클릭하면 상세 자료로
                  이동합니다.
                </p>
              </div>
            </div>

            {/* Mini events chart */}
            <div className="scroll-fade scroll-fade-delay-1">
              <div className="bg-surface-02 border border-default p-6">
                <p className="text-[10px] text-secondary font-mono mb-4 uppercase tracking-wider">
                  KOSPI / 2000–2025
                </p>
                <div className="relative" style={{ height: 120 }}>
                  <svg
                    viewBox="0 0 400 120"
                    className="w-full h-full"
                    aria-hidden
                  >
                    {/* Grid */}
                    {[40, 80].map((y) => (
                      <line
                        key={y}
                        x1="0"
                        y1={y}
                        x2="400"
                        y2={y}
                        stroke="rgba(255,255,255,0.04)"
                        strokeWidth="1"
                      />
                    ))}
                    {/* Line chart */}
                    <polyline
                      points="0,80 40,72 80,88 100,100 120,95 160,65 200,50 240,68 280,30 320,42 360,24 400,18"
                      fill="none"
                      stroke="#1a6eff"
                      strokeWidth="1.5"
                    />
                    <polygon
                      points="0,80 40,72 80,88 100,100 120,95 160,65 200,50 240,68 280,30 320,42 360,24 400,18 400,120 0,120"
                      fill="rgba(26,110,255,0.06)"
                    />
                    {/* Event markers */}
                    {WORLD_EVENTS.map((ev) => {
                      const xi = parseFloat(ev.x) * 4;
                      return (
                        <g key={ev.year}>
                          <circle cx={xi} cy={12} r={5} fill={ev.color} />
                          <line
                            x1={xi}
                            y1={18}
                            x2={xi}
                            y2={115}
                            stroke={ev.color}
                            strokeWidth="1"
                            strokeDasharray="3 3"
                            opacity={0.4}
                          />
                          <text
                            x={xi}
                            y={9}
                            textAnchor="middle"
                            fontSize="8"
                            fill={ev.color}
                            fontWeight="bold"
                          >
                            {ev.label}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <span className="w-2 h-2 rounded-full bg-[#f97316]" />
                  <span className="text-[11px] text-secondary">
                    세계 주요 사건 마커
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────── */}
      <section className="py-32 px-6 border-t border-default text-center">
        <div className="max-w-2xl mx-auto scroll-fade">
          <h2 className="text-3xl md:text-4xl font-bold mb-5">
            지금 바로 시작하세요
          </h2>
          <p className="text-sm text-secondary leading-relaxed mb-10">
            별도의 가입 없이, 종목을 선택하고 차트를 클릭하는 것만으로
            <br className="hidden md:block" />
            AI 분석을 즉시 확인할 수 있습니다.
          </p>
          <div ref={null} className="relative w-full max-w-md mx-auto">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-placeholder" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="종목명 또는 심볼 검색..."
                className="w-full pl-10 pr-4 h-12 bg-surface-02 border border-default text-sm text-primary placeholder:text-placeholder focus:border-brand outline-none transition-colors"
              />
            </div>
            {results.length > 0 && (
              <div className="absolute top-full left-0 right-0 bg-surface-03 border border-default z-50 max-h-64 overflow-y-auto">
                {results.map((stock) => (
                  <button
                    key={stock.symbol}
                    onClick={() => onStart(stock)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-surface-02 transition-colors border-b border-subtle last:border-0 text-left"
                  >
                    <div>
                      <div className="text-sm font-semibold text-primary">
                        {stock.symbol}
                      </div>
                      <div className="text-xs text-secondary">{stock.name}</div>
                    </div>
                    <div className="text-[11px] text-secondary font-medium px-2 py-0.5 border border-default">
                      {stock.exchange}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer className="border-t border-default px-8 py-6 flex items-center justify-between">
        <span className="text-xs font-bold text-secondary">ChartStory</span>
        <span className="text-[11px] text-placeholder">
          데이터 제공: 한국투자증권 KIS API
        </span>
      </footer>

      {/* Inline fadeIn keyframe for hero elements */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

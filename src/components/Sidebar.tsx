import { cn } from "@/lib/utils";
import { ExternalLink, Loader2, AlertCircle, Search } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";

interface SidebarProps {
  className?: string;
}

// ── Sentiment config ─────────────────────────────────────────────────────────
const SENTIMENT: Record<string, { label: string; dot: string; tag: string }> = {
  positive: {
    label: "긍정 영향",
    dot: "bg-[#16a34a]",
    tag: "text-[#16a34a] border-[#16a34a]/30 bg-[#16a34a]/10",
  },
  negative: {
    label: "부정 영향",
    dot: "bg-[#dc2626]",
    tag: "text-[#dc2626] border-[#dc2626]/30 bg-[#dc2626]/10",
  },
  neutral: {
    label: "중립",
    dot: "bg-[#6b6b6b]",
    tag: "text-secondary border-default bg-surface-03",
  },
};

// Carbon label-01: 12px, medium weight, uppercase, wide tracking
const SectionLabel = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <p
    className={cn(
      "text-xs font-medium text-secondary uppercase tracking-widest",
      className
    )}
  >
    {children}
  </p>
);

export default function Sidebar({ className }: SidebarProps) {
  const { summary, isLoading, error, selection } = useAppStore();

  const sentiment =
    SENTIMENT[summary?.sentiment ?? "neutral"] ?? SENTIMENT["neutral"];

  return (
    <aside
      className={cn(
        "flex flex-col bg-surface-02 overflow-y-auto border-l border-default",
        className
      )}
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="px-4 py-4 border-b border-default flex items-center justify-between shrink-0">
        <h2 className="text-sm font-semibold text-primary tracking-tight">
          AI 분석
        </h2>
        {isLoading && (
          <span className="text-xs font-medium text-brand flex items-center gap-1.5">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            분석 중
          </span>
        )}
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {/* Loading */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 px-5">
            <Loader2 className="w-5 h-5 animate-spin text-brand" />
            <p className="text-xs text-secondary text-center leading-relaxed">
              뉴스 수집 및 AI 분석 중입니다
            </p>
          </div>
        )}

        {/* Error */}
        {!isLoading && error && (
          <div className="m-4 p-4 border border-[#dc2626]/30 bg-[#dc2626]/5 flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-[#dc2626] shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-[#dc2626]">오류 발생</p>
              <p className="text-xs text-secondary mt-1 leading-relaxed">
                {error}
              </p>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && !summary && (
          <div className="flex flex-col items-center justify-center py-20 px-6 gap-3">
            <div className="w-10 h-10 rounded-full bg-surface-03 border border-default flex items-center justify-center">
              <Search className="w-4 h-4 text-placeholder" />
            </div>
            <p className="text-sm text-secondary text-center leading-relaxed whitespace-pre-line">
              {selection
                ? "해당 날짜의 유의미한 이벤트를 찾을 수 없습니다."
                : "차트에서 날짜를 클릭하면\nAI 분석을 생성합니다."}
            </p>
          </div>
        )}

        {/* ── Summary ───────────────────────────────────────────────────── */}
        {!isLoading && !error && summary && (
          <div className="animate-in fade-in duration-300">
            {/* Sentiment bar */}
            <div className="px-4 py-3 border-b border-default flex items-center justify-between bg-surface-03">
              <div className="flex items-center gap-2">
                <span className={cn("w-2 h-2 rounded-full", sentiment.dot)} />
                <span
                  className={cn(
                    "text-xs font-semibold px-2 py-0.5 border",
                    sentiment.tag
                  )}
                >
                  {sentiment.label}
                </span>
              </div>
              <span className="text-xs text-secondary tabular-nums font-mono">
                {summary.date}
              </span>
            </div>

            <div className="px-4 pt-5 pb-6 space-y-5">
              {/* 핵심 요약 */}
              <div>
                <SectionLabel className="mb-3">핵심 요약</SectionLabel>
                <h3 className="text-[17px] font-bold text-primary leading-snug">
                  {summary.headline}
                </h3>
              </div>

              {/* 주요 원인 — Chips style */}
              {summary.keyFactors && summary.keyFactors.length > 0 && (
                <div>
                  <SectionLabel className="mb-3">주요 원인</SectionLabel>
                  <div className="flex flex-wrap gap-2">
                    {summary.keyFactors.map((factor, i) => {
                      const colonIdx = factor.indexOf(":");
                      const prefix =
                        colonIdx > -1 ? factor.slice(0, colonIdx).trim() : null;
                      const body =
                        colonIdx > -1
                          ? factor.slice(colonIdx + 1).trim()
                          : factor;

                      return (
                        <div
                          key={i}
                          className="flex items-center gap-1.5 px-2.5 py-1 bg-surface-03 border border-default rounded-sm"
                        >
                          {prefix && (
                            <span className="text-[10px] font-bold text-brand uppercase tracking-tight shrink-0">
                              {prefix}
                            </span>
                          )}
                          <span className="text-xs text-primary font-medium">
                            {body}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 상세 분석 */}
              <div>
                <SectionLabel className="mb-3">상세 분석</SectionLabel>
                <p className="text-sm text-primary leading-relaxed">
                  {summary.content}
                </p>
              </div>

              {/* 참고 뉴스 */}
              {summary.sourceLinks && summary.sourceLinks.length > 0 && (
                <div className="pt-4 border-t border-default">
                  <SectionLabel className="mb-3">참고 뉴스</SectionLabel>
                  <ul className="space-y-2">
                    {summary.sourceLinks.slice(0, 5).map((link, idx) => (
                      <li key={idx}>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between px-3 py-2.5 bg-surface-03 border border-default hover:border-brand transition-colors group"
                        >
                          <span className="text-sm text-secondary group-hover:text-primary truncate pr-3 transition-colors leading-snug">
                            {link.title}
                          </span>
                          <ExternalLink className="w-3.5 h-3.5 shrink-0 text-placeholder group-hover:text-brand transition-colors" />
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

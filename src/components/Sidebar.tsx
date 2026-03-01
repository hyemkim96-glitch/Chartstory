import { cn } from "@/lib/utils";
import { ExternalLink, Loader2, AlertCircle, Search } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";

interface SidebarProps {
  className?: string;
}

const sentimentConfig: Record<
  string,
  { label: string; dot: string; badge: string }
> = {
  positive: {
    label: "긍정",
    dot: "bg-[#16a34a]",
    badge: "text-[#16a34a] border-[#16a34a]/30 bg-[#16a34a]/10",
  },
  negative: {
    label: "부정",
    dot: "bg-[#dc2626]",
    badge: "text-[#dc2626] border-[#dc2626]/30 bg-[#dc2626]/10",
  },
  neutral: {
    label: "중립",
    dot: "bg-secondary",
    badge: "text-secondary border-default bg-surface-03",
  },
};

export default function Sidebar({ className }: SidebarProps) {
  const { summary, isLoading, error, selection } = useAppStore();

  const sentiment =
    sentimentConfig[summary?.sentiment ?? "neutral"] ??
    sentimentConfig["neutral"];

  return (
    <aside
      className={cn(
        "flex flex-col bg-surface-02 overflow-y-auto border-l border-default",
        className
      )}
    >
      {/* Header */}
      <div className="px-5 py-5 border-b border-default flex items-center justify-between shrink-0">
        <h2 className="text-base font-bold text-primary tracking-tight">
          AI 분석
        </h2>
        {isLoading && (
          <span className="text-[11px] font-medium text-brand flex items-center gap-1.5">
            <Loader2 className="w-3 h-3 animate-spin" />
            분석 중
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {/* Loading */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 px-5">
            <Loader2 className="w-6 h-6 animate-spin text-brand" />
            <p className="text-xs text-secondary text-center leading-relaxed">
              뉴스 수집 및 AI 분석 중입니다
            </p>
          </div>
        )}

        {/* Error */}
        {!isLoading && error && (
          <div className="m-4 p-4 border border-[#dc2626]/30 bg-[#dc2626]/5 flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-down shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-down">오류 발생</p>
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
            <p className="text-xs text-secondary text-center leading-relaxed">
              {selection
                ? "해당 날짜의 유의미한 이벤트를 찾을 수 없습니다."
                : "차트에서 날짜를 클릭하면\nAI 분석을 생성합니다."}
            </p>
          </div>
        )}

        {/* Summary */}
        {!isLoading && !error && summary && (
          <div className="animate-in fade-in duration-300">
            {/* Sentiment + Date bar */}
            <div className="px-5 py-3 border-b border-default flex items-center justify-between bg-surface-03">
              <div className="flex items-center gap-2">
                <span className={cn("w-2 h-2 rounded-full", sentiment.dot)} />
                <span
                  className={cn(
                    "text-[11px] font-semibold px-2 py-0.5 border",
                    sentiment.badge
                  )}
                >
                  {sentiment.label} 영향
                </span>
              </div>
              <span className="text-[11px] text-secondary tabular-nums font-mono">
                {summary.date}
              </span>
            </div>

            <div className="px-5 pt-5 pb-6 space-y-5">
              {/* Headline */}
              <div>
                <p className="text-[10px] font-bold text-brand uppercase tracking-widest mb-2">
                  핵심 요약
                </p>
                <h3 className="text-lg font-bold text-primary leading-snug">
                  {summary.headline}
                </h3>
              </div>

              {/* Key Factors */}
              {summary.keyFactors && summary.keyFactors.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-secondary uppercase tracking-widest mb-2.5">
                    주요 원인
                  </p>
                  <ul className="space-y-2">
                    {summary.keyFactors.map((factor, i) => {
                      // "기업요인:", "거시요인:", "정치/외부:" 같은 prefix 추출
                      const colonIdx = factor.indexOf(":");
                      const prefix =
                        colonIdx > -1 ? factor.slice(0, colonIdx) : null;
                      const body =
                        colonIdx > -1
                          ? factor.slice(colonIdx + 1).trim()
                          : factor;

                      return (
                        <li
                          key={i}
                          className="flex items-start gap-2.5 p-3 bg-surface-03 border border-default"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-brand mt-1.5 shrink-0" />
                          <div>
                            {prefix && (
                              <span className="text-[10px] font-bold text-brand uppercase tracking-wide mr-1.5">
                                {prefix}
                              </span>
                            )}
                            <span className="text-sm text-primary leading-snug">
                              {body}
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {/* Summary body */}
              <div>
                <p className="text-[10px] font-bold text-secondary uppercase tracking-widest mb-2">
                  상세 분석
                </p>
                <p className="text-sm text-primary leading-relaxed">
                  {summary.content}
                </p>
              </div>

              {/* Source links */}
              {summary.sourceLinks && summary.sourceLinks.length > 0 && (
                <div className="pt-4 border-t border-default space-y-2">
                  <p className="text-[10px] font-bold text-secondary uppercase tracking-widest mb-3">
                    참고 뉴스
                  </p>
                  {summary.sourceLinks.slice(0, 5).map((link, idx) => (
                    <a
                      key={idx}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between px-3 py-2.5 bg-surface-03 border border-default hover:border-brand transition-all group"
                    >
                      <span className="text-xs text-secondary group-hover:text-primary truncate pr-3 transition-colors leading-snug">
                        {link.title}
                      </span>
                      <ExternalLink className="w-3.5 h-3.5 shrink-0 text-placeholder group-hover:text-brand transition-colors" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

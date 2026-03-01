import { cn } from "@/lib/utils";
import { ExternalLink, Loader2, AlertCircle, Search } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";

interface SidebarProps {
  className?: string;
}

const sentimentLabel: Record<string, string> = {
  positive: "긍정",
  negative: "부정",
  neutral: "중립",
};

const sentimentClass: Record<string, string> = {
  positive: "text-up border-[#16a34a]/30 bg-[#16a34a]/10",
  negative: "text-down border-[#dc2626]/30 bg-[#dc2626]/10",
  neutral: "text-secondary border-default bg-surface-03",
};

export default function Sidebar({ className }: SidebarProps) {
  const { summary, isLoading, error, selection } = useAppStore();

  return (
    <aside
      className={cn(
        "flex flex-col gap-0 bg-surface-02 overflow-y-auto border-l border-default",
        className
      )}
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-default flex items-center justify-between shrink-0">
        <h2 className="text-sm font-semibold text-primary">AI 분석</h2>
        {selection && (
          <span className="text-[10px] text-secondary">분석 기간</span>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 p-5 space-y-4">
        {/* Loading */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-[#1A6EFF]" />
            <div className="text-center">
              <p className="text-sm font-medium text-primary">분석 중</p>
              <p className="text-xs text-secondary mt-1">
                뉴스 수집 및 감성 분석 중
              </p>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-4 border border-[#dc2626]/30 bg-[#dc2626]/5 flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-down shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-down">오류 발생</p>
              <p className="text-xs text-secondary mt-1 leading-relaxed">
                {error}
              </p>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && !summary && (
          <div className="flex flex-col items-center justify-center py-16 px-4 gap-4 border border-default border-dashed">
            <Search className="w-6 h-6 text-placeholder" />
            <p className="text-xs text-secondary text-center leading-relaxed">
              {selection
                ? "해당 날짜에서 유의미한 이벤트를 찾을 수 없습니다."
                : "차트에서 날짜를 클릭하면 AI 분석을 생성합니다."}
            </p>
          </div>
        )}

        {/* Summary */}
        {!isLoading && !error && summary && (
          <div className="space-y-4 animate-in fade-in duration-300">
            {/* Sentiment badge + date */}
            <div className="flex items-center justify-between">
              <span
                className={cn(
                  "text-[11px] font-semibold px-2 py-0.5 border",
                  sentimentClass[summary.sentiment] ?? sentimentClass["neutral"]
                )}
              >
                {sentimentLabel[summary.sentiment] ?? "중립"} 영향
              </span>
              <span className="text-[11px] text-secondary tabular-nums">
                {summary.date}
              </span>
            </div>

            {/* Headline */}
            <h3 className="text-sm font-semibold text-primary leading-snug">
              {summary.headline}
            </h3>

            {/* Content — brand left border accent */}
            <p className="text-xs text-secondary leading-relaxed pl-3 border-l-brand">
              {summary.content}
            </p>

            {/* Source links */}
            {summary.sourceLinks && summary.sourceLinks.length > 0 && (
              <div className="pt-4 border-t border-default space-y-2">
                <p className="text-[10px] text-placeholder uppercase tracking-wider">
                  참고 뉴스
                </p>
                {summary.sourceLinks.map((link, idx) => (
                  <a
                    key={idx}
                    href={link.url}
                    target={link.url === "#" ? undefined : "_blank"}
                    rel="noopener noreferrer"
                    onClick={
                      link.url === "#" ? (e) => e.preventDefault() : undefined
                    }
                    className={`flex items-center justify-between px-3 py-2 bg-surface-03 border border-default transition-colors group ${link.url === "#" ? "cursor-default opacity-60" : "hover:border-[#1A6EFF]"}`}
                  >
                    <span className="text-xs text-secondary group-hover:text-primary truncate pr-3 transition-colors">
                      {link.title}
                    </span>
                    {link.url !== "#" && (
                      <ExternalLink className="w-3 h-3 shrink-0 text-placeholder group-hover:text-[#1A6EFF] transition-colors" />
                    )}
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

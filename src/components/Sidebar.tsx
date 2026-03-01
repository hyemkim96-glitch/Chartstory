import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ExternalLink,
  Sparkles,
  Loader2,
  AlertCircle,
  Quote,
  Search,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";

interface SidebarProps {
  className?: string;
}

export default function Sidebar({ className }: SidebarProps) {
  const { summary, isLoading, error, selection } = useAppStore();

  return (
    <aside
      className={cn(
        "p-8 flex flex-col gap-8 bg-black/10 backdrop-blur-3xl overflow-y-auto",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-blue-400" />
          </div>
          <h2 className="text-lg font-bold text-slate-100">AI Narrative</h2>
        </div>
        {selection && (
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-white/5 px-2 py-1 rounded">
            Analysis Period
          </span>
        )}
      </div>

      <div className="space-y-6">
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-4">
            <div className="relative">
              <Loader2 className="w-12 h-12 animate-spin text-blue-500 opacity-80" />
              <div className="absolute inset-0 bg-blue-500 blur-2xl opacity-20" />
            </div>
            <div className="flex flex-col items-center">
              <p className="text-sm font-bold text-slate-300">
                Synthesizing Context
              </p>
              <p className="text-[10px] uppercase tracking-tighter opacity-50">
                Fetching news & weighing sentiment
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="p-5 border border-red-500/20 bg-red-500/5 rounded-2xl text-red-400 flex items-start gap-4 animate-in slide-in-from-right duration-500">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5 text-red-500" />
            </div>
            <div className="text-sm">
              <p className="font-bold text-red-100">Operation interupted</p>
              <p className="opacity-70 mt-1 leading-relaxed">{error}</p>
            </div>
          </div>
        )}

        {!isLoading && !error && !summary && (
          <div className="text-center py-20 px-6 border border-dashed border-white/10 rounded-3xl group">
            <div className="w-16 h-16 rounded-2xl bg-white/5 mx-auto mb-6 flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
              <Search className="w-6 h-6 text-slate-600" />
            </div>
            <p className="text-sm font-medium text-slate-400 leading-relaxed">
              {selection
                ? "Our AI agents couldn't find significant events for this exact interval."
                : "Select a market interval on the chart to generate an AI narrative."}
            </p>
          </div>
        )}

        {!isLoading && !error && summary && (
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
            <Card className="bg-white/5 border-white/10 shadow-2xl rounded-3xl overflow-hidden backdrop-blur-md">
              <div className="h-1.5 w-full bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
              <CardHeader className="p-6 pb-2">
                <div className="flex justify-between items-center mb-4">
                  <Badge
                    variant="outline"
                    className={cn(
                      "rounded-lg px-3 py-1 font-bold text-[10px] uppercase border shadow-sm",
                      summary.sentiment === "positive" &&
                        "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
                      summary.sentiment === "negative" &&
                        "text-rose-400 border-rose-500/30 bg-rose-500/10",
                      summary.sentiment === "neutral" &&
                        "text-sky-400 border-sky-500/30 bg-sky-500/10"
                    )}
                  >
                    {summary.sentiment} Impact
                  </Badge>
                  <span className="text-[10px] font-bold text-slate-500 tracking-wider">
                    {summary.date}
                  </span>
                </div>
                <CardTitle className="text-xl font-bold leading-tight text-white mb-2">
                  {summary.headline}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 pt-0 space-y-6">
                <div className="relative">
                  <Quote className="absolute -top-1 -left-1 w-8 h-8 text-blue-500/10 rotate-180" />
                  <p className="text-[15px] text-slate-300 leading-relaxed relative z-10 pl-4 border-l-2 border-blue-500/20 italic">
                    {summary.content}
                  </p>
                </div>

                {summary.sourceLinks && summary.sourceLinks.length > 0 && (
                  <div className="pt-6 border-t border-white/10">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-1 h-3 bg-blue-500 rounded-full" />
                      <p className="text-[10px] uppercase font-bold text-slate-500 tracking-[0.2em]">
                        Evidence Base
                      </p>
                    </div>
                    <div className="grid gap-2">
                      {summary.sourceLinks.map((link, idx) => (
                        <a
                          key={idx}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/10 hover:border-blue-500/30 transition-all duration-300"
                        >
                          <span className="text-xs text-slate-400 group-hover:text-slate-100 truncate pr-4">
                            {link.title}
                          </span>
                          <ExternalLink className="w-3 h-3 shrink-0 text-slate-600 group-hover:text-blue-400 transition-colors" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </aside>
  );
}

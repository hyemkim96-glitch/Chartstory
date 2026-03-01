import { useState, useEffect, useRef } from "react";
import { Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAppStore } from "@/store/useAppStore";
import { StockService } from "@/services/StockService";
import type { StockMetadata } from "@/types";

export default function Header() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StockMetadata[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const { setStock } = useAppStore();
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (query.trim()) {
        setIsSearching(true);
        try {
          const res = await StockService.searchStocks(query);
          setResults(res);
        } catch (err) {
          console.error(err);
        } finally {
          setIsSearching(false);
        }
      } else {
        setResults([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target as Node)
      ) {
        setResults([]);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (stock: StockMetadata) => {
    setStock(stock);
    setQuery("");
    setResults([]);
  };

  return (
    <header className="h-14 border-b border-default flex items-center justify-between px-6 bg-surface-02 sticky top-0 z-50">
      {/* 로고 */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="w-5 h-5 bg-[#1A6EFF] flex items-center justify-center">
          <span className="text-white text-[10px] font-bold leading-none">
            C
          </span>
        </div>
        <span className="text-sm font-semibold text-primary">Chartstory</span>
        <span className="text-xs text-placeholder">AI 주식 분석</span>
      </div>

      {/* 검색 */}
      <div className="flex-1 max-w-md mx-8 relative" ref={searchRef}>
        <div className="relative">
          {isSearching ? (
            <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary animate-spin" />
          ) : (
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-placeholder" />
          )}
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="종목명 또는 심볼 검색..."
            className="pl-9 h-9 bg-surface-03 border-default rounded-none text-sm text-primary placeholder:text-placeholder focus-visible:border-[#1A6EFF] focus-visible:ring-0 transition-colors"
          />
        </div>

        {results.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-0 bg-surface-03 border border-default z-50">
            {results.map((stock) => (
              <button
                key={stock.symbol}
                onClick={() => handleSelect(stock)}
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

      {/* 유저 아바타 */}
      <div className="w-8 h-8 border border-default flex items-center justify-center text-xs font-semibold text-secondary cursor-pointer hover:border-[#1A6EFF] hover:text-primary transition-colors shrink-0">
        JD
      </div>
    </header>
  );
}

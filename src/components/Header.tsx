import { useState, useEffect, useRef } from "react";
import { Search, Info, Loader2, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
    <header className="h-20 border-b border-white/5 flex items-center justify-between px-8 bg-black/40 backdrop-blur-xl sticky top-0 z-50">
      <div className="flex items-center gap-3 group cursor-pointer">
        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform duration-300">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <div className="flex flex-col">
          <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
            Chartstory
          </h1>
          <span className="text-[10px] text-blue-400 font-bold tracking-widest uppercase opacity-70">
            AI Stock Analysis
          </span>
        </div>
      </div>

      <div className="flex-1 max-w-xl mx-8 relative" ref={searchRef}>
        <div className="relative group">
          {isSearching ? (
            <Loader2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400 animate-spin" />
          ) : (
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
          )}
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search symbol or company name..."
            className="pl-12 h-12 bg-white/5 border-white/10 rounded-2xl focus:bg-white/10 focus:border-blue-500/50 transition-all duration-300 placeholder:text-slate-600"
          />
        </div>

        {results.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-3 glass-dark rounded-2xl shadow-2xl overflow-hidden z-50 border border-white/10 animate-in fade-in zoom-in-95 duration-200">
            {results.map((stock) => (
              <button
                key={stock.symbol}
                onClick={() => handleSelect(stock)}
                className="w-full px-5 py-4 flex items-center justify-between hover:bg-white/5 transition-colors border-b border-white/5 last:border-0 text-left"
              >
                <div>
                  <div className="font-bold text-slate-100">{stock.symbol}</div>
                  <div className="text-xs text-slate-500">{stock.name}</div>
                </div>
                <div className="text-[10px] bg-blue-500/10 text-blue-400 font-bold px-2 py-1 rounded-md uppercase border border-blue-500/20">
                  {stock.exchange}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="text-slate-400 hover:text-white hover:bg-white/5 rounded-full transition-all"
        >
          <Info className="w-5 h-5" />
        </Button>
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 flex items-center justify-center text-xs font-bold shadow-inner cursor-pointer hover:border-blue-500/50 transition-all">
          JD
        </div>
      </div>
    </header>
  );
}

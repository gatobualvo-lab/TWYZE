import React, { useEffect, useRef, useState } from 'react';
import { Search, X, Users, Package, ShoppingCart, FileText, Clock, CornerDownLeft, Loader2 } from 'lucide-react';
import { useUniversalSearch } from '../../hooks/useUniversalSearch';
import { getRecentSearches, saveRecentSearch, SearchResult, SearchResultType } from '../../services/search/searchService';

interface UniversalSearchProps {
  onNavigate: (tab: string) => void;
}

const TYPE_ICON: Record<SearchResultType, React.ComponentType<{ className?: string }>> = {
  customer: Users,
  product: Package,
  sale: ShoppingCart,
  supplier: Users,
  document: FileText,
};

const TYPE_LABEL: Record<SearchResultType, string> = {
  customer: 'Customer',
  product: 'Product',
  sale: 'Sale',
  supplier: 'Supplier',
  document: 'Document',
};

const ResultRow: React.FC<{ result: SearchResult; active: boolean; onClick: () => void }> = ({ result, active, onClick }) => {
  const Icon = TYPE_ICON[result.type];
  return (
    <button
      type="button"
      onClick={onClick}
      data-active={active}
      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left rounded-lg transition-all duration-150 active:scale-[0.98] ${
        active ? 'bg-blue-50' : 'hover:bg-gray-50'
      }`}
    >
      <span className={`flex-shrink-0 h-8 w-8 rounded-lg flex items-center justify-center ${active ? 'bg-blue-100' : 'bg-gray-100'}`}>
        <Icon className={`w-4 h-4 ${active ? 'text-blue-600' : 'text-gray-500'}`} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-gray-900 truncate">{result.title}</span>
        <span className="block text-xs text-gray-400 truncate">
          {TYPE_LABEL[result.type]}
          {result.subtitle ? ` · ${result.subtitle}` : ''}
        </span>
      </span>
      {active && <CornerDownLeft className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />}
    </button>
  );
};

const UniversalSearch: React.FC<UniversalSearchProps> = ({ onNavigate }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [recent, setRecent] = useState<SearchResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const { results, loading } = useUniversalSearch(query);

  const showingRecent = query.trim().length < 2;
  const list = showingRecent ? recent : results;

  useEffect(() => setActiveIndex(0), [query, results.length]);

  useEffect(() => {
    if (open) {
      setRecent(getRecentSearches());
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      setQuery('');
    }
  }, [open]);

  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(o => !o);
      }
    };
    document.addEventListener('keydown', handleGlobalKey);
    return () => document.removeEventListener('keydown', handleGlobalKey);
  }, []);

  const handleSelect = (result: SearchResult) => {
    saveRecentSearch(result);
    onNavigate(result.actionTab);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, list.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const chosen = list[activeIndex];
      if (chosen) handleSelect(chosen);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 h-10 px-3 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition-all duration-150 active:scale-95"
        aria-label="Search"
      >
        <Search className="w-4 h-4" />
        <span className="hidden md:inline text-sm">Search…</span>
        <span className="hidden md:inline text-[10px] font-mono bg-white border border-gray-200 rounded px-1 py-0.5 text-gray-400">
          Ctrl K
        </span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center pt-20 px-4 animate-fade-in" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-lg bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden origin-top animate-scale-in"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
              <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search customers, products, sales, suppliers, documents…"
                className="flex-1 text-sm outline-none placeholder:text-gray-400"
              />
              <button onClick={() => setOpen(false)} className="text-gray-300 hover:text-gray-500 flex-shrink-0 transition-colors" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto p-2">
              {showingRecent && (
                <div className="px-2 py-1.5 flex items-center gap-1.5 text-xs font-medium text-gray-400">
                  <Clock className="w-3 h-3" /> Recent
                </div>
              )}

              {loading && !showingRecent && (
                <div className="px-4 py-6 flex items-center justify-center gap-2 text-sm text-gray-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Searching…
                </div>
              )}

              {!loading && list.length === 0 && (
                <div className="px-4 py-6 text-center text-sm text-gray-400">
                  {showingRecent ? 'Start typing to search your business records.' : 'No matches found.'}
                </div>
              )}

              {!loading &&
                list.map((result, i) => (
                  <ResultRow
                    key={`${result.type}-${result.id}`}
                    result={result}
                    active={i === activeIndex}
                    onClick={() => handleSelect(result)}
                  />
                ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default UniversalSearch;

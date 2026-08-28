import React, { useState } from 'react';
import { Search, X, MapPin, ChevronRight } from 'lucide-react';

export interface SearchResultItem {
  id: string;
  title: string;
  category: string;
  subTitle?: string;
  coords: [number, number];
}

interface SearchResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  searchResults: SearchResultItem[];
  onSelectSearchResult: (result: SearchResultItem) => void;
}

export const SearchResultsModal: React.FC<SearchResultsModalProps> = ({
  isOpen,
  onClose,
  searchQuery,
  onSearchChange,
  searchResults,
  onSelectSearchResult
}) => {
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<'All' | 'Canals' | 'Parcels' | 'Structures' | 'Reports'>('All');

  if (!isOpen || !searchQuery.trim()) return null;

  const filteredResults = searchResults.filter((r) => {
    if (activeCategoryFilter === 'All') return true;
    if (activeCategoryFilter === 'Reports') {
      return (
        r.category === 'Maintenance' ||
        r.category === 'Operations' ||
        r.category === 'Maintenance Reports' ||
        r.category === 'Operational Status Reports'
      );
    }
    return r.category === activeCategoryFilter;
  });

  return (
    <div className="fixed top-16 left-3 sm:top-20 sm:left-4 z-50 w-[94vw] sm:w-[440px] max-w-[460px] bg-slate-900/98 backdrop-blur-2xl border border-cyan-500/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200 pointer-events-auto">
      {/* Standalone Window Title Bar */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-cyan-950/70 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-cyan-500/20 text-cyan-400 rounded-xl border border-cyan-500/30">
            <Search className="w-4.5 h-4.5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white flex items-center gap-2 leading-tight">
              <span>Search Suggestions Window</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                {searchResults.length} matches
              </span>
            </h3>
            <p className="text-[10px] text-slate-400 leading-none mt-0.5">
              Query: &quot;<span className="text-cyan-300 font-semibold">{searchQuery}</span>&quot;
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
          title="Close Search Window"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Window Category Filter Switcher */}
      <div className="px-3.5 py-2 bg-slate-950/80 border-b border-slate-800/80 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        {(['All', 'Canals', 'Parcels', 'Structures', 'Reports'] as const).map((cat) => {
          const count =
            cat === 'All'
              ? searchResults.length
              : searchResults.filter((r) =>
                  cat === 'Reports'
                    ? r.category === 'Maintenance' ||
                      r.category === 'Operations' ||
                      r.category === 'Maintenance Reports' ||
                      r.category === 'Operational Status Reports'
                    : r.category === cat
                ).length;
          const isActive = activeCategoryFilter === cat;

          return (
            <button
              key={cat}
              onClick={() => setActiveCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition whitespace-nowrap flex items-center gap-1.5 border cursor-pointer ${
                isActive
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-sm'
                  : 'bg-slate-800/60 text-slate-400 border-slate-700/60 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <span>{cat}</span>
              <span className="font-mono text-[9px] opacity-80">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Window Scrollable Suggestions List */}
      <div className="p-2 max-h-80 sm:max-h-96 overflow-y-auto space-y-1 divide-y divide-slate-800/50">
        {filteredResults.length === 0 ? (
          <div className="py-8 text-center space-y-2">
            <Search className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-xs font-semibold text-slate-400">No matching search results</p>
            <p className="text-[10px] text-slate-500">
              No features or field reports match &quot;{searchQuery}&quot; under &quot;{activeCategoryFilter}&quot;
            </p>
          </div>
        ) : (
          filteredResults.map((res) => (
            <button
              key={res.id}
              onClick={() => {
                onSelectSearchResult(res);
                onClose();
              }}
              className="w-full text-left p-2.5 hover:bg-slate-800/80 rounded-xl transition flex items-center justify-between gap-3 group cursor-pointer border border-transparent hover:border-cyan-500/30"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="text-xs font-bold text-slate-100 group-hover:text-cyan-300 truncate">
                  {res.title}
                </div>
                {res.subTitle && (
                  <div className="text-[11px] text-slate-400 flex items-center gap-1 truncate">
                    <MapPin className="w-3 h-3 text-cyan-400 shrink-0" />
                    <span className="truncate">{res.subTitle}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={`text-[9px] px-2 py-0.5 rounded-full font-mono font-bold uppercase border ${
                    res.category === 'Canals'
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                      : res.category === 'Parcels'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      : res.category === 'Structures'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      : 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                  }`}
                >
                  {res.category}
                </span>
                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </button>
          ))
        )}
      </div>

      {/* Window Footer */}
      <div className="bg-slate-950/90 px-4 py-2 border-t border-slate-800 text-[10px] text-slate-400 flex items-center justify-between">
        <span>💡 Select a result to fly map &amp; inspect attributes</span>
        <button
          onClick={onClose}
          className="text-cyan-400 hover:underline font-bold cursor-pointer"
        >
          Close Window
        </button>
      </div>
    </div>
  );
};

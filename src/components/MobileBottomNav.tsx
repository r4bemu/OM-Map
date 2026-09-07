import React from 'react';
import { Layers, Plus, FileText, Menu, Filter } from 'lucide-react';

interface MobileBottomNavProps {
  onOpenReportModal: () => void;
  onToggleLayerPanel: () => void;
  isLayerPanelOpen: boolean;
  onOpenReportsSummary: () => void;
  isSummaryModalOpen?: boolean;
  onOpenMenu: () => void;
  isMenuOpen?: boolean;
  onOpenFilter: () => void;
  isFilterActive?: boolean;
  unsyncedCount?: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  onOpenReportModal,
  isLayerPanelOpen,
  onToggleLayerPanel,
  onOpenReportsSummary,
  isSummaryModalOpen = false,
  onOpenMenu,
  isMenuOpen = false,
  onOpenFilter,
  isFilterActive = false,
  unsyncedCount = 0
}) => {
  return (
    <nav
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-xl border-t border-slate-800/90 px-3 pt-1.5 pb-3 pb-[env(safe-area-inset-bottom)] shadow-2xl flex items-center justify-around select-none pointer-events-auto"
    >
      {/* 1. Layers Button */}
      <button
        type="button"
        onClick={onToggleLayerPanel}
        className={`flex flex-col items-center justify-center gap-1 py-1 px-2.5 rounded-xl transition cursor-pointer active:scale-90 ${isLayerPanelOpen ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-200'}`}
        title="Toggle GIS Layers"
      >
        <div className={`p-1 rounded-lg ${isLayerPanelOpen ? 'bg-emerald-500/20' : ''}`}>
          <Layers className="w-5 h-5" />
        </div>
        <span className="text-[10px] font-semibold tracking-tight">Layers</span>
      </button>

      {/* 2. Filter Button */}
      <button
        type="button"
        onClick={onOpenFilter}
        className={`flex flex-col items-center justify-center gap-1 py-1 px-2.5 rounded-xl transition cursor-pointer active:scale-90 relative ${isFilterActive ? 'text-amber-400 font-bold' : 'text-slate-400 hover:text-slate-200'}`}
        title="Filter Location"
      >
        <div className={`p-1 rounded-lg relative ${isFilterActive ? 'bg-amber-500/20' : ''}`}>
          <Filter className="w-5 h-5" />
          {isFilterActive && (
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping absolute -top-0.5 -right-0.5" />
          )}
        </div>
        <span className="text-[10px] font-semibold tracking-tight">Filter</span>
      </button>

      {/* 3. Center Floating Action Button: + New Report */}
      <button
        type="button"
        onClick={onOpenReportModal}
        className="-mt-5 p-3 rounded-2xl bg-gradient-to-tr from-[#166534] to-emerald-500 text-white shadow-xl shadow-emerald-950/60 border-2 border-emerald-400/50 hover:scale-105 active:scale-90 transition cursor-pointer flex flex-col items-center justify-center shrink-0"
        title="Create New Field Report"
      >
        <Plus className="w-6 h-6 text-white stroke-[2.5]" />
        <span className="text-[9px] font-black uppercase tracking-wider mt-0.5">+ Report</span>
      </button>

      {/* 4. Ledger & Summary Button */}
      <button
        type="button"
        onClick={onOpenReportsSummary}
        className={`flex flex-col items-center justify-center gap-1 py-1 px-2.5 rounded-xl transition cursor-pointer active:scale-90 relative ${isSummaryModalOpen ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-200'}`}
        title="View Reports & Ledger"
      >
        <div className={`p-1 rounded-lg relative ${isSummaryModalOpen ? 'bg-emerald-500/20' : ''}`}>
          <FileText className="w-5 h-5" />
          {unsyncedCount > 0 && (
            <span className="px-1 py-0.2 rounded-full bg-amber-500 text-slate-950 text-[8px] font-black absolute -top-1 -right-1 animate-pulse">
              {unsyncedCount}
            </span>
          )}
        </div>
        <span className="text-[10px] font-semibold tracking-tight">Ledger</span>
      </button>

      {/* 5. Menu / Profile Button */}
      <button
        type="button"
        onClick={onOpenMenu}
        className={`flex flex-col items-center justify-center gap-1 py-1 px-2.5 rounded-xl transition cursor-pointer active:scale-90 ${isMenuOpen ? 'text-cyan-400 font-bold' : 'text-slate-400 hover:text-slate-200'}`}
        title="Open System Menu"
      >
        <div className={`p-1 rounded-lg ${isMenuOpen ? 'bg-cyan-500/20' : ''}`}>
          <Menu className="w-5 h-5" />
        </div>
        <span className="text-[10px] font-semibold tracking-tight">Menu</span>
      </button>
    </nav>
  );
};

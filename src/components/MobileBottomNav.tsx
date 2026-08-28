import React from 'react';
import { 
  Layers, 
  FileCheck2, 
  Plus, 
  RefreshCw, 
  Filter
} from 'lucide-react';
import { UserRole } from '../types';

interface MobileBottomNavProps {
  currentRole: UserRole;
  isLayerPanelOpen: boolean;
  onToggleLayerPanel: () => void;
  onOpenReportModal: () => void;
  onOpenReportsSummary?: (tab?: 'ledger' | 'form691' | 'photos') => void;
  onOpenSyncModal: () => void;
  isSyncing: boolean;
  unsyncedCount: number;
  isOffline: boolean;
  onOpenFilterModal: () => void;
  isFilterActive?: boolean;
  isFilterModalOpen?: boolean;
  activeLayerCount: number;
  isMapPickerActive?: boolean;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentRole,
  isLayerPanelOpen,
  onToggleLayerPanel,
  onOpenReportModal,
  onOpenReportsSummary,
  onOpenSyncModal,
  isSyncing,
  unsyncedCount,
  isOffline,
  onOpenFilterModal,
  isFilterActive = false,
  isFilterModalOpen = false,
  activeLayerCount,
  isMapPickerActive = false
}) => {
  if (isMapPickerActive) return null;

  return (
    <nav 
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-slate-950/95 backdrop-blur-xl border-t border-slate-800/90 shadow-2xl px-2 pt-1.5 pb-3 flex items-center justify-around select-none pointer-events-auto"
    >
      {/* 1. Layers Button */}
      <button
        type="button"
        onClick={onToggleLayerPanel}
        className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition cursor-pointer active:scale-95 relative ${
          isLayerPanelOpen
            ? 'text-[#15803d] font-bold'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <div className="relative">
          <Layers className="w-5 h-5" />
          {activeLayerCount > 0 && (
            <span className="absolute -top-1 -right-2 bg-[#15803d] text-white text-[9px] font-bold px-1 rounded-full min-w-[14px] text-center leading-tight">
              {activeLayerCount}
            </span>
          )}
        </div>
        <span className="text-[10px] mt-0.5 font-medium tracking-tight">Layers</span>
      </button>

      {/* 2. View Reports Button */}
      <button
        type="button"
        onClick={() => onOpenReportsSummary?.('ledger')}
        className="flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition cursor-pointer active:scale-95 text-slate-400 hover:text-slate-200"
      >
        <FileCheck2 className="w-5 h-5 text-[#15803d]" />
        <span className="text-[10px] mt-0.5 font-medium tracking-tight">Reports</span>
      </button>

      {/* 3. Center Prominent Action Button (+ Report) */}
      {currentRole !== 'Viewer' ? (
        <button
          type="button"
          onClick={() => onOpenReportModal()}
          className="flex flex-col items-center justify-center -mt-4 group cursor-pointer active:scale-95"
          title="Create New Field Report"
        >
          <div className="w-12 h-12 rounded-full bg-[#15803d] hover:bg-[#16a34a] text-white flex items-center justify-center shadow-lg shadow-[#15803d]/40 border-2 border-slate-950 transition-transform group-hover:scale-105">
            <Plus className="w-6 h-6 stroke-[3]" />
          </div>
          <span className="text-[10px] font-bold text-[#15803d] mt-0.5 tracking-tight">
            + Report
          </span>
        </button>
      ) : (
        <div className="w-10 h-10" />
      )}

      {/* 4. Sync Data Button */}
      <button
        type="button"
        onClick={onOpenSyncModal}
        disabled={isOffline}
        className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition cursor-pointer active:scale-95 relative ${
          unsyncedCount > 0
            ? 'text-amber-400 font-bold animate-pulse'
            : 'text-slate-400 hover:text-slate-200'
        } disabled:opacity-40 disabled:cursor-not-allowed`}
      >
        <div className="relative">
          <RefreshCw className={`w-5 h-5 ${isSyncing ? 'animate-spin text-[#15803d]' : unsyncedCount > 0 ? 'text-amber-400' : 'text-[#15803d]'}`} />
          {unsyncedCount > 0 && (
            <span className="absolute -top-1 -right-2 bg-amber-500 text-slate-950 text-[9px] font-extrabold px-1 rounded-full min-w-[14px] text-center leading-tight">
              {unsyncedCount}
            </span>
          )}
        </div>
        <span className="text-[10px] mt-0.5 font-medium tracking-tight">
          {isSyncing ? 'Syncing' : 'Sync'}
        </span>
      </button>

      {/* 5. Filter Button */}
      <button
        type="button"
        onClick={onOpenFilterModal}
        className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition cursor-pointer active:scale-95 relative ${
          isFilterActive || isFilterModalOpen
            ? 'text-[#15803d] font-bold'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <div className="relative">
          <Filter className={`w-5 h-5 ${isFilterActive ? 'text-[#15803d]' : 'text-slate-400'}`} />
          {isFilterActive && (
            <span className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-[#15803d] animate-ping" />
          )}
        </div>
        <span className="text-[10px] mt-0.5 font-medium tracking-tight">Filter</span>
      </button>
    </nav>
  );
};

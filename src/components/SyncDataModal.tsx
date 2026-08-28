import React from 'react';
import { 
  X, 
  Cloud, 
  RefreshCw, 
  CheckCircle2, 
  CloudDownload, 
  Loader2,
  HardDrive
} from 'lucide-react';
import { AvailableCloudWeek } from '../types';

interface SyncDataModalProps {
  onClose: () => void;
  isSyncing: boolean;
  isOffline: boolean;
  unsyncedCount: number;
  onSyncNow: () => void;
  availableCloudWeeks: AvailableCloudWeek[];
  onDownloadWeek?: (weekKey: string) => Promise<void>;
  onDownloadAllWeeks?: () => Promise<void>;
  isDownloadingWeek?: string | null;
  cachedWeekKeys?: Set<string>;
  cachedReportsCount?: number;
}

export const SyncDataModal: React.FC<SyncDataModalProps> = ({
  onClose,
  isSyncing,
  isOffline,
  unsyncedCount,
  onSyncNow,
  availableCloudWeeks = [],
  onDownloadWeek,
  onDownloadAllWeeks,
  isDownloadingWeek = null,
  cachedWeekKeys = new Set(),
  cachedReportsCount = 0
}) => {

  return (
    <aside 
      className="fixed md:absolute top-16 md:top-20 left-2 right-2 md:right-auto md:left-4 z-40 w-auto md:w-[420px] max-h-[82vh] md:max-h-[560px] bg-slate-900/98 backdrop-blur-xl border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-left-4 text-left pointer-events-auto"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-slate-700/80 shrink-0 bg-slate-800/80">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[#166534]/15 text-[#166534] dark:text-emerald-300 border border-[#166534]/30">
            <Cloud className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-slate-100 font-heading flex items-center gap-1.5 leading-tight">
              <span>Data Sync &amp; Cloud Batches</span>
            </h2>
            <p className="text-[10px] text-slate-400">
              Current &amp; previous week sync automatically on click
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body Content - Responsive Scrollable Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {/* Live 2-Week Window Sync Status Banner */}
        <div className={`p-2.5 rounded-xl border text-xs flex items-center gap-2.5 ${
          isSyncing 
            ? 'bg-[#166534]/20 border-[#166534]/50 text-[#166534] dark:text-emerald-300 shadow-sm' 
            : 'bg-[#166534]/15 border-[#166534]/40 text-[#166534] dark:text-emerald-300'
        }`}>
          {isSyncing ? (
            <>
              <RefreshCw className="w-4 h-4 text-[#166534] dark:text-emerald-400 animate-spin shrink-0" />
              <div className="min-w-0">
                <div className="font-bold text-[11px] text-slate-100">Syncing Current &amp; Previous Week...</div>
                <div className="text-[10px] text-slate-400 truncate">Flushing offline queue and downloading live reports</div>
              </div>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4 text-[#166534] dark:text-emerald-400 shrink-0" />
              <div className="min-w-0">
                <div className="font-bold text-[11px] text-slate-100">Active 2-Week Window Synchronized</div>
                <div className="text-[10px] text-slate-400 truncate">Current &amp; previous week data cached locally</div>
              </div>
            </>
          )}
        </div>

        {/* Quick Action Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onSyncNow()}
            disabled={isSyncing || isOffline}
            className="p-2 bg-[#166534]/15 hover:bg-[#166534]/25 border border-[#166534]/40 rounded-lg text-left transition cursor-pointer disabled:opacity-50 active:scale-95"
          >
            <div className="text-[11px] font-bold text-[#166534] dark:text-emerald-300 flex items-center gap-1">
              <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>Re-Sync 2 Weeks</span>
            </div>
            <div className="text-[9px] text-slate-400 mt-0.5">Current &amp; prev week</div>
          </button>

          {onDownloadAllWeeks && (
            <button
              type="button"
              onClick={async () => {
                await onDownloadAllWeeks();
              }}
              disabled={isSyncing || isOffline || isDownloadingWeek === 'all'}
              className="p-2 bg-[#166534]/15 hover:bg-[#166534]/25 border border-[#166534]/40 rounded-lg text-left transition cursor-pointer disabled:opacity-50 active:scale-95"
            >
              <div className="text-[11px] font-bold text-[#166534] dark:text-emerald-300 flex items-center gap-1">
                {isDownloadingWeek === 'all' ? (
                  <Loader2 className="w-3 h-3 animate-spin text-[#166534]" />
                ) : (
                  <CloudDownload className="w-3 h-3 text-[#166534] dark:text-emerald-400" />
                )}
                <span>Download All</span>
              </div>
              <div className="text-[9px] text-slate-400 mt-0.5">All historical weeks</div>
            </button>
          )}
        </div>

        {/* Available Weeks List */}
        <div className="space-y-1 pt-1">
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider px-1">
            Available Weekly Batches
          </div>

          {availableCloudWeeks.length === 0 ? (
            <div className="p-3 text-center text-xs text-slate-500 italic bg-slate-800/60 rounded-lg border border-slate-700/80">
              No historical weekly batches detected.
            </div>
          ) : (
            availableCloudWeeks.map((w) => {
              const isCached = cachedWeekKeys.has(w.key);
              const isCurrentlyDownloading = isDownloadingWeek === w.key;

              return (
                <div 
                  key={w.key}
                  className={`p-2 rounded-lg border flex items-center justify-between gap-2 transition ${
                    isCached 
                      ? 'bg-slate-800/60 border-slate-700/80' 
                      : 'bg-slate-900 border-slate-700/80 hover:border-emerald-600/40'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-bold text-slate-200">{w.label}</span>
                      {w.isCurrentWeek && (
                        <span className="text-[9px] px-1.5 py-0.2 bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 rounded font-semibold">
                          Current
                        </span>
                      )}
                      {w.isPrevWeek && (
                        <span className="text-[9px] px-1.5 py-0.2 bg-stone-500/20 text-stone-800 dark:text-stone-300 border border-stone-500/30 rounded font-semibold">
                          Prev Week
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                      <span>{w.reportCount} {w.reportCount === 1 ? 'report' : 'reports'}</span>
                      <span>•</span>
                      <span className="font-mono">{w.key}</span>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-1">
                    {isCached ? (
                      <div className="flex items-center gap-1">
                        <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border border-emerald-500/30 rounded text-[10px] font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-700 dark:text-emerald-400" />
                          <span>Cached</span>
                        </span>
                        {onDownloadWeek && (
                          <button
                            type="button"
                            onClick={() => onDownloadWeek(w.key)}
                            disabled={isCurrentlyDownloading || isOffline}
                            className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-100 rounded transition cursor-pointer"
                            title="Re-sync / refresh this week from cloud"
                          >
                            <RefreshCw className={`w-3 h-3 ${isCurrentlyDownloading ? 'animate-spin text-[#166534]' : ''}`} />
                          </button>
                        )}
                      </div>
                    ) : (
                      onDownloadWeek && (
                        <button
                          type="button"
                          onClick={() => onDownloadWeek(w.key)}
                          disabled={isCurrentlyDownloading || isOffline}
                          className="px-2.5 py-1 bg-[#166534] hover:bg-[#15803d] text-white rounded text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer disabled:opacity-50"
                        >
                          {isCurrentlyDownloading ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <CloudDownload className="w-3 h-3" />
                          )}
                          <span>Download</span>
                        </button>
                      )
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Footer Cache Status */}
      <div className="p-2.5 border-t border-slate-700/80 shrink-0 bg-slate-800/80 text-[10px] text-slate-400 flex items-center justify-between">
        <span className="flex items-center gap-1 text-slate-300 font-medium">
          <HardDrive className="w-3.5 h-3.5 text-[#166534] dark:text-emerald-400" />
          <span>{cachedReportsCount} Active Cached Reports</span>
        </span>
        <span className="text-[9px] text-slate-500">Auto-saved to device</span>
      </div>
    </aside>
  );
};

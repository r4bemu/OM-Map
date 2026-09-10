import React, { useState } from 'react';
import { 
  X, 
  Cloud, 
  RefreshCw, 
  CheckCircle2, 
  CloudDownload, 
  Loader2,
  HardDrive,
  AlertTriangle,
  RotateCcw,
  ShieldAlert,
  Calendar
} from 'lucide-react';
import { AvailableCloudWeek } from '../types';
import { isOverhaulAllowedToday } from '../utils/offlineStorage';

interface SyncDataModalProps {
  onClose: () => void;
  isSyncing: boolean;
  isOffline: boolean;
  unsyncedCount: number;
  onSyncNow: () => void;
  onFullOverhaul?: () => Promise<void>;
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
  onFullOverhaul,
  availableCloudWeeks = [],
  onDownloadWeek,
  onDownloadAllWeeks,
  isDownloadingWeek = null,
  cachedWeekKeys = new Set(),
  cachedReportsCount = 0
}) => {
  const [isOverhaulModalOpen, setIsOverhaulModalOpen] = useState<boolean>(false);
  const [isExecutingOverhaul, setIsExecutingOverhaul] = useState<boolean>(false);

  const overhaulStatus = isOverhaulAllowedToday();

  const handleConfirmOverhaul = async () => {
    if (!onFullOverhaul || !overhaulStatus.allowed || isExecutingOverhaul) return;
    try {
      setIsExecutingOverhaul(true);
      await onFullOverhaul();
      setIsOverhaulModalOpen(false);
    } catch (e) {
      console.warn('Overhaul error:', e);
    } finally {
      setIsExecutingOverhaul(false);
    }
  };

  return (
    <>
      <aside 
        className="fixed md:absolute top-16 md:top-20 left-2 right-2 md:right-auto md:left-4 z-40 w-auto md:w-[440px] max-h-[82vh] md:max-h-[580px] bg-slate-900/98 backdrop-blur-xl border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-left-4 text-left pointer-events-auto"
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
                Manifest-validated synchronization &amp; historical archives
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
          {/* Live Sync Status Banner */}
          <div className={`p-2.5 rounded-xl border text-xs flex items-center gap-2.5 ${
            isSyncing 
              ? 'bg-[#166534]/20 border-[#166534]/50 text-[#166534] dark:text-emerald-300 shadow-sm' 
              : 'bg-[#166534]/15 border-[#166534]/40 text-[#166534] dark:text-emerald-300'
          }`}>
            {isSyncing ? (
              <>
                <RefreshCw className="w-4 h-4 text-[#166534] dark:text-emerald-400 animate-spin shrink-0" />
                <div className="min-w-0">
                  <div className="font-bold text-[11px] text-slate-100">Synchronizing Data &amp; Layers...</div>
                  <div className="text-[10px] text-slate-400 truncate">Flushing offline queue and verifying manifest checksums</div>
                </div>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 text-[#166534] dark:text-emerald-400 shrink-0" />
                <div className="min-w-0">
                  <div className="font-bold text-[11px] text-slate-100">Local Database Synchronized</div>
                  <div className="text-[10px] text-slate-400 truncate">Cached locally with instant startup verification</div>
                </div>
              </>
            )}
          </div>

          {/* Dual Sync Action Buttons */}
          <div className="grid grid-cols-2 gap-2">
            {/* Button 1: Smart Sync (Delta Check) */}
            <button
              type="button"
              onClick={() => onSyncNow()}
              disabled={isSyncing || isOffline}
              className="p-2.5 bg-[#166534]/15 hover:bg-[#166534]/25 border border-[#166534]/40 rounded-xl text-left transition cursor-pointer disabled:opacity-50 active:scale-95"
            >
              <div className="text-[11px] font-bold text-[#166534] dark:text-emerald-300 flex items-center gap-1.5">
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>Smart Sync</span>
              </div>
              <div className="text-[9px] text-slate-400 mt-0.5">Quick manifest &amp; delta check</div>
            </button>

            {/* Button 2: Full System Overhaul */}
            <button
              type="button"
              onClick={() => setIsOverhaulModalOpen(true)}
              disabled={isSyncing || isOffline}
              className="p-2.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-xl text-left transition cursor-pointer disabled:opacity-50 active:scale-95"
            >
              <div className="text-[11px] font-bold text-amber-400 flex items-center gap-1.5">
                <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                <span>System Overhaul</span>
              </div>
              <div className="text-[9px] text-slate-400 mt-0.5">Fresh cache reset &amp; re-seed</div>
            </button>
          </div>

          {/* Download All Historical Weeks Action */}
          {onDownloadAllWeeks && (
            <button
              type="button"
              onClick={async () => {
                await onDownloadAllWeeks();
              }}
              disabled={isSyncing || isOffline || isDownloadingWeek === 'all'}
              className="w-full py-2 px-3 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 rounded-xl text-left transition cursor-pointer disabled:opacity-50 flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                {isDownloadingWeek === 'all' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#166534]" />
                ) : (
                  <CloudDownload className="w-3.5 h-3.5 text-[#166534] dark:text-emerald-400" />
                )}
                <div>
                  <div className="text-[11px] font-bold text-slate-200">Download All Historical Batches</div>
                  <div className="text-[9px] text-slate-400">Save all weekly archives to local device memory</div>
                </div>
              </div>
              <span className="text-[10px] text-emerald-400 font-semibold px-2 py-0.5 bg-emerald-500/10 rounded">All Weeks</span>
            </button>
          )}

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
          <span className="text-[9px] text-slate-500">Auto-saved in IndexedDB</span>
        </div>
      </aside>

      {/* Full System Overhaul Confirmation Modal */}
      {isOverhaulModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in"
          onClick={() => setIsOverhaulModalOpen(false)}
        >
          <div 
            className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-5 space-y-4 text-left pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-slate-100 font-heading">Confirm Full System Overhaul</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Wipe local device cache and freshly re-seed all GIS layers and reports from the cloud.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOverhaulModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-100 rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Overhaul Details & Status Box */}
            <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/80 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-300">
                <span className="flex items-center gap-1.5 text-slate-400">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Last Overhaul:</span>
                </span>
                <span className="font-semibold text-slate-200">
                  {overhaulStatus.formattedDate || 'Never executed on this device'}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span className="flex items-center gap-1.5 text-slate-400">
                  <CloudDownload className="w-3.5 h-3.5" />
                  <span>Estimated Download:</span>
                </span>
                <span className="font-semibold text-emerald-400">~10 MB - 12 MB (Full GeoJSON &amp; Reports)</span>
              </div>
            </div>

            {/* Unsynced Reports Warning */}
            {unsyncedCount > 0 && (
              <div className="p-3 bg-rose-500/15 border border-rose-500/40 rounded-xl text-xs text-rose-300 flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Pending Offline Submissions Detected:</span> You have {unsyncedCount} unsynced offline report(s). Please run <strong>Smart Sync</strong> first to upload your pending reports before resetting the local database.
                </div>
              </div>
            )}

            {/* Daily Rate Limit Notice */}
            {!overhaulStatus.allowed && (
              <div className="p-3 bg-amber-500/15 border border-amber-500/30 rounded-xl text-xs text-amber-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Daily Rate Limit Active:</span> A full system overhaul was already performed today at {overhaulStatus.formattedDate}. To conserve bandwidth and server resources, please use <strong>Smart Sync</strong> to fetch updates, or try again tomorrow.
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsOverhaulModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmOverhaul}
                disabled={!overhaulStatus.allowed || isExecutingOverhaul}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-lg shadow-amber-900/30"
              >
                {isExecutingOverhaul ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Resetting &amp; Re-Downloading...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Confirm &amp; Re-Download All</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

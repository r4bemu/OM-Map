import React, { useEffect, useState } from 'react';
import { RefreshCw, Download, CheckCircle2, AlertCircle, Sparkles, X } from 'lucide-react';
import { UpdateStatusPayload } from '../electron';

export const DesktopUpdateModal: React.FC = () => {
  const [isDesktop, setIsDesktop] = useState(false);
  const [appVersion, setAppVersion] = useState<string>('1.0.0');
  const [updateState, setUpdateState] = useState<UpdateStatusPayload | null>(null);
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    if (window.electronAPI?.isDesktopApp) {
      setIsDesktop(true);
      window.electronAPI.getAppVersion().then(v => setAppVersion(v || '1.0.0'));

      const unsubscribe = window.electronAPI.onUpdateStatus((payload) => {
        setUpdateState(payload);
        if (payload.status === 'available' || payload.status === 'downloading' || payload.status === 'downloaded' || payload.status === 'error') {
          setShowToast(true);
        }
      });
      return () => unsubscribe();
    }
  }, []);

  if (!isDesktop || !showToast || !updateState) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] max-w-sm w-full bg-slate-900/95 backdrop-blur-md border border-slate-700 shadow-2xl rounded-2xl p-4 text-white animate-in slide-in-from-bottom-5 duration-300">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {updateState.status === 'downloading' && (
            <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Download className="w-4 h-4 animate-bounce" />
            </div>
          )}
          {updateState.status === 'downloaded' && (
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Sparkles className="w-4 h-4" />
            </div>
          )}
          {updateState.status === 'available' && (
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <RefreshCw className="w-4 h-4 animate-spin" />
            </div>
          )}
          {updateState.status === 'error' && (
            <div className="w-8 h-8 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <AlertCircle className="w-4 h-4" />
            </div>
          )}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Desktop Auto-Update
            </h4>
            <p className="text-sm font-semibold text-white">
              {updateState.status === 'available' && ('New version v' + (updateState.version || '') + ' found')}
              {updateState.status === 'downloading' && ('Downloading update... ' + Math.round(updateState.percent || 0) + '%')}
              {updateState.status === 'downloaded' && ('Update v' + (updateState.version || '') + ' Ready!')}
              {updateState.status === 'error' && 'Update check error'}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowToast(false)}
          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {updateState.status === 'downloading' && (
        <div className="mt-3">
          <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${updateState.percent || 0}%` }}
            />
          </div>
        </div>
      )}

      {updateState.status === 'downloaded' && (
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={() => window.electronAPI?.quitAndInstallUpdate()}
            className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-emerald-900/40 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Restart & Install Now
          </button>
        </div>
      )}
    </div>
  );
};

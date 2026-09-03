import React, { useEffect, useState } from 'react';
import { Sparkles, RefreshCw, X } from 'lucide-react';

export const PwaUpdateToast: React.FC = () => {
  const [newVersionAvailable, setNewVersionAvailable] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(regs => {
        for (let reg of regs) {
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  setNewVersionAvailable(true);
                }
              });
            }
          });
        }
      });

      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    }
  }, []);

  if (!newVersionAvailable) return null;

  return (
    <div className="fixed top-4 inset-x-0 z-50 flex justify-center pointer-events-none px-4 animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="pointer-events-auto bg-slate-900/98 text-white border border-emerald-500/50 p-3 rounded-2xl shadow-2xl shadow-emerald-950/60 backdrop-blur-xl flex items-center gap-3 max-w-md w-full">
        <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0 text-emerald-400">
          <Sparkles className="w-4.5 h-4.5" />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-xs font-bold text-white">New Update Ready</h4>
          <p className="text-[11px] text-slate-300">A fresh version of NIA O&M GIS is available.</p>
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black transition cursor-pointer shrink-0"
        >
          Refresh
        </button>
        <button
          type="button"
          onClick={() => setNewVersionAvailable(false)}
          className="p-1 text-slate-400 hover:text-slate-200 transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
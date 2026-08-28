import React, { useEffect, useRef } from "react";
import { RefreshCw, CloudUpload, DatabaseZap, MapPin, CheckCircle2 } from "lucide-react";

export interface SyncStep {
  id: string;
  label: string;
  sublabel?: string;
  status: "pending" | "active" | "done" | "error";
  progress?: { current: number; total: number };
}

interface SyncOverlayProps {
  isVisible: boolean;
  steps: SyncStep[];
  overallPct: number;
  statusMessage: string;
}

const STEP_ICONS: Record<string, React.FC<{ className?: string; style?: React.CSSProperties }>> = {
  upload:  CloudUpload,
  reports: DatabaseZap,
  weeks:   RefreshCw,
  layers:  MapPin,
  done:    CheckCircle2,
};

const ProgressRing: React.FC<{ pct: number }> = ({ pct }) => {
  const radius = 52;
  const stroke = 5;
  const norm = radius - stroke / 2;
  const circumference = 2 * Math.PI * norm;
  const offset = circumference - (pct / 100) * circumference;
  return (
    <svg width={radius * 2} height={radius * 2} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={radius} cy={radius} r={norm} fill="none" stroke="#1e293b" strokeWidth={stroke} />
      <circle
        cx={radius} cy={radius} r={norm} fill="none"
        stroke="url(#syncGrad)" strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={circumference} strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset 0.45s ease" }}
      />
      <defs>
        <linearGradient id="syncGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#06b6d4" />
          <stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>
      </defs>
    </svg>
  );
};

export const SyncOverlay: React.FC<SyncOverlayProps> = ({ isVisible, steps, overallPct, statusMessage }) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const isLight = typeof document !== 'undefined' && document.documentElement.classList.contains('light');

  useEffect(() => {
    if (!isVisible) return;
    const trap = (e: Event) => { e.stopPropagation(); e.preventDefault(); };
    const el = overlayRef.current;
    if (!el) return;
    el.addEventListener("pointerdown", trap, true);
    el.addEventListener("keydown", trap, true);
    el.addEventListener("wheel", trap, { capture: true, passive: false });
    return () => {
      el.removeEventListener("pointerdown", trap, true);
      el.removeEventListener("keydown", trap, true);
      el.removeEventListener("wheel", trap, true);
    };
  }, [isVisible]);

  if (!isVisible) return null;

  const clampedPct = Math.min(100, Math.max(0, overallPct));

  const radius = 52;
  const stroke = 5;
  const norm = radius - stroke / 2;
  const circumference = 2 * Math.PI * norm;
  const offset = circumference - (clampedPct / 100) * circumference;

  return (
    <div
      ref={overlayRef}
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center select-none ${
        isLight ? 'bg-[#f7f7f4]/95 text-[#1c1917]' : 'bg-[#121214]/92 text-white'
      }`}
      style={{ backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)" }}
      aria-modal="true" role="alertdialog" aria-label="Sync in progress"
    >
      <div className="absolute rounded-full opacity-15 pointer-events-none"
        style={{ 
          width: 260, 
          height: 260, 
          background: isLight 
            ? "radial-gradient(circle, #166534 0%, transparent 70%)" 
            : "radial-gradient(circle, #15803d 0%, transparent 70%)", 
          filter: "blur(40px)" 
        }}
      />

      <div className="relative flex items-center justify-center mb-6">
        <svg width={radius * 2} height={radius * 2} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={radius} cy={radius} r={norm} fill="none" stroke={isLight ? "#e7e5e4" : "#27272a"} strokeWidth={stroke} />
          <circle
            cx={radius} cy={radius} r={norm} fill="none"
            stroke="url(#syncGrad)" strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.45s ease" }}
          />
          <defs>
            <linearGradient id="syncGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={isLight ? "#166534" : "#16a34a"} />
              <stop offset="100%" stopColor={isLight ? "#15803d" : "#22c55e"} />
            </linearGradient>
          </defs>
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <RefreshCw className={`w-7 h-7 mb-0.5 ${isLight ? 'text-[#166534]' : 'text-emerald-400'}`} style={{ animation: "spin 1.6s linear infinite" }} />
          <span className={`font-bold text-xl leading-none tabular-nums ${isLight ? 'text-[#1c1917]' : 'text-white'}`}>{Math.round(clampedPct)}%</span>
        </div>
      </div>

      <p className={`font-bold text-base mb-1 tracking-wide ${isLight ? 'text-[#0c0a09]' : 'text-white'}`}>Syncing Data</p>
      <p className={`text-sm mb-6 max-w-xs text-center font-medium ${isLight ? 'text-[#57534e]' : 'text-slate-300'}`}>
        {statusMessage || "Please wait while data is being synchronized..."}
      </p>

      <div className="flex flex-col gap-2 w-full max-w-xs px-2">
        {steps.map((step) => {
          const Icon = STEP_ICONS[step.id] || RefreshCw;
          const isDone   = step.status === "done";
          const isActive = step.status === "active";
          return (
            <div key={step.id} className={`flex items-start gap-3 rounded-xl px-3 py-2.5 transition-all duration-300 ${
              isLight
                ? isActive
                  ? "bg-emerald-50 border border-emerald-300 shadow-sm"
                  : isDone
                  ? "bg-white border border-stone-200"
                  : "bg-stone-100/60 border border-stone-200/60 opacity-60"
                : isActive
                ? "bg-emerald-500/10 border border-emerald-500/30"
                : isDone
                ? "border border-emerald-500/20 bg-slate-900/40"
                : "bg-slate-800/40 border border-slate-700/30 opacity-50"
            }`}>
              <div className={`mt-0.5 flex-shrink-0 ${
                isDone 
                  ? (isLight ? "text-emerald-700" : "text-emerald-400")
                  : isActive 
                  ? (isLight ? "text-[#166534]" : "text-emerald-400")
                  : (isLight ? "text-stone-400" : "text-slate-500")
              }`}>
                {isDone
                  ? <CheckCircle2 className="w-4 h-4" />
                  : <Icon className="w-4 h-4" style={isActive ? { animation: "spin 1.6s linear infinite" } : undefined} />
                }
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-[12px] font-semibold truncate ${
                    isDone 
                      ? (isLight ? "text-emerald-900" : "text-emerald-300")
                      : isActive 
                      ? (isLight ? "text-[#0c0a09] font-bold" : "text-white")
                      : (isLight ? "text-stone-500" : "text-slate-500")
                  }`}>
                    {step.label}
                  </span>
                  {step.progress && isActive && (
                    <span className={`text-[10px] font-mono whitespace-nowrap flex-shrink-0 font-bold ${
                      isLight ? "text-[#166534]" : "text-emerald-400"
                    }`}>
                      {step.progress.current}/{step.progress.total}
                    </span>
                  )}
                  {isDone && (
                    <span className={`text-[10px] whitespace-nowrap flex-shrink-0 font-bold ${
                      isLight ? "text-emerald-700" : "text-emerald-400"
                    }`}>
                      Done
                    </span>
                  )}
                </div>
                {step.progress && isActive && (
                  <div className={`mt-1.5 h-1.5 rounded-full overflow-hidden ${isLight ? "bg-stone-200" : "bg-slate-700"}`}>
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isLight ? "bg-[#166534]" : "bg-emerald-500"
                      }`}
                      style={{ width: `${step.progress.total > 0 ? (step.progress.current / step.progress.total) * 100 : 0}%` }}
                    />
                  </div>
                )}
                {step.sublabel && isActive && (
                  <p className={`text-[10px] mt-0.5 truncate ${isLight ? "text-stone-600" : "text-slate-400"}`}>{step.sublabel}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className={`mt-6 text-[10px] text-center px-6 ${isLight ? 'text-stone-500' : 'text-slate-500'}`}>
        Do not close this window or navigate away during sync
      </p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

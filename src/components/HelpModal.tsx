import React from 'react';
import { X, HelpCircle, Layers, WifiOff, ShieldCheck, Ruler, Droplets, Upload } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-heading">GIS Platform User Guide</h2>
              <p className="text-xs text-slate-400">Google Maps style GIS explorer, field reporting, &amp; offline desilting sync</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs leading-relaxed text-slate-300">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center gap-2 font-bold text-cyan-400">
                <Upload className="w-4 h-4" />
                <span>Large GIS Data Uploads</span>
              </div>
              <p className="text-slate-400">
                Seamlessly upload zipped <strong className="text-white">KMZ</strong> files (up to 10MB) or raw <strong className="text-white">GeoJSON</strong> vector files (up to 60MB). The app unzips and parses features instantly.
              </p>
            </div>

            <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center gap-2 font-bold text-emerald-400">
                <WifiOff className="w-4 h-4" />
                <span>Offline Field Reporting</span>
              </div>
              <p className="text-slate-400">
                Remote field teams can log desilting work reports and situational land parcel status offline. Reports are stored in IndexedDB and automatically synced once a network connection returns.
              </p>
            </div>

            <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center gap-2 font-bold text-purple-400">
                <ShieldCheck className="w-4 h-4" />
                <span>Role-Based Access (RBAC) &amp; Approvals</span>
              </div>
              <p className="text-slate-400">
                Manage permissions across <strong>Developer</strong> (master control), <strong>RO Admin / Evaluator / Preparer</strong> (Regional Office oversight &amp; packages), <strong>IMO Admin</strong> (IMO approvals &amp; publishing), <strong>NIS In-Charge</strong> (system inspections &amp; pre-approvals), <strong>NIS Preparer</strong> (NIS reporting), <strong>Field Personnel</strong> (field reporting), and <strong>Viewer</strong>.
              </p>
            </div>

            <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center gap-2 font-bold text-amber-400">
                <Ruler className="w-4 h-4" />
                <span>Spatial Measurements</span>
              </div>
              <p className="text-slate-400">
                Measure canal lengths in meters/km, compute farmland area in hectares (ha), drop pin coordinates, and draw buffer radiuses to inspect intersecting GIS features.
              </p>
            </div>
          </div>

          <div className="space-y-2 bg-slate-800/30 p-4 rounded-xl border border-slate-800">
            <h3 className="font-bold text-white uppercase tracking-wider text-[11px] flex items-center gap-2">
              <Droplets className="w-4 h-4 text-cyan-400" />
              <span>Irrigation Canal Desilting Work Workflow</span>
            </h3>
            <ol className="list-decimal list-inside space-y-1.5 text-slate-400 pl-1">
              <li>Use the <strong>Search Bar</strong> or click any canal line on the map to inspect desilting progress %.</li>
              <li>Click <strong>New Report</strong> or <strong>Drop Pin</strong> to log excavating progress (m³ cleared).</li>
              <li>View real-time hydraulic desilting statistics in the <strong>Analytics Dashboard</strong>.</li>
            </ol>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-xl transition"
          >
            Got it, take me to map
          </button>
        </div>
      </div>
    </div>
  );
};

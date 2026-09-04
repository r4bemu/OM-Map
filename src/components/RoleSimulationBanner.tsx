import React from 'react';
import { ShieldAlert, RotateCcw, UserCheck, ArrowRight, Building, MapPin } from 'lucide-react';
import { AuthUser, UserRole } from '../types';

interface RoleSimulationBannerProps {
  authenticatedUser: AuthUser | null;
  activeRole: UserRole;
  activeImo?: string;
  activeNis?: string;
  isSimulating?: boolean;
  onRevertRole: () => void;
  onOpenSwitcher?: () => void;
}

export const RoleSimulationBanner: React.FC<RoleSimulationBannerProps> = ({
  authenticatedUser,
  activeRole,
  activeImo,
  activeNis,
  isSimulating: isSimulatingProp,
  onRevertRole,
  onOpenSwitcher
}) => {
  if (!authenticatedUser) return null;

  // Display if user is Developer, RO Role, IMO Admin, or IMO Evaluator AND actively simulating a role, IMO, or NIS
  const isSimulating = isSimulatingProp !== undefined
    ? isSimulatingProp
    : (authenticatedUser.role === 'Developer' || authenticatedUser.role.startsWith('RO') || authenticatedUser.role === 'IMO Admin' || authenticatedUser.role === 'IMO Evaluator') && 
      (activeRole !== authenticatedUser.role || (activeImo && activeImo !== authenticatedUser.imoOffice) || (activeNis && activeNis !== authenticatedUser.nisBinding));

  if (!isSimulating) return null;

  const getRoleBadgeStyle = (role: UserRole) => {
    switch (role) {
      case 'RO Admin': return 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40 font-bold';
      case 'RO Evaluator': return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
      case 'RO Reviewer': return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
      case 'RO Preparer': return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40';
      case 'IMO Admin': return 'bg-orange-500/20 text-orange-300 border-orange-500/40 font-bold';
      case 'IMO Evaluator': return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'IMO Reviewer': return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';
      case 'IMO Preparer': return 'bg-teal-500/20 text-teal-300 border-teal-500/40';
      case 'Field Personnel': return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      case 'Viewer': return 'bg-slate-500/20 text-slate-300 border-slate-500/40';
      default: return 'bg-rose-500/20 text-rose-300 border-rose-500/40 font-mono';
    }
  };

  return (
    <div className="fixed top-14 left-1/2 -translate-x-1/2 z-40 w-auto max-w-[94vw] bg-slate-900/95 backdrop-blur-xl border border-amber-500/50 shadow-2xl rounded-2xl p-2 sm:px-4 sm:py-2.5 flex items-center gap-3 sm:gap-5 animate-in slide-in-from-top-2 duration-200">
      <div className="flex items-center gap-2.5">
        <div className="p-1.5 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30 shrink-0">
          <ShieldAlert className="w-4 h-4 animate-pulse" />
        </div>
        <div className="text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-slate-400 font-medium">Simulating:</span>
            <span className={`px-2 py-0.5 rounded-full font-bold text-[11px] border ${getRoleBadgeStyle(activeRole)}`}>
              {activeRole}
            </span>
            {activeImo && (
              <span className="text-[10px] text-cyan-300 bg-cyan-950/60 px-2 py-0.5 rounded-md border border-cyan-800/60 font-medium flex items-center gap-1">
                <Building className="w-2.5 h-2.5" />
                <span className="truncate max-w-[150px] sm:max-w-[200px]">{activeImo}</span>
              </span>
            )}
            {activeNis && activeNis !== 'All NIS' && (
              <span className="text-[10px] text-teal-300 bg-teal-950/60 px-2 py-0.5 rounded-md border border-teal-800/60 font-medium flex items-center gap-1">
                <MapPin className="w-2.5 h-2.5" />
                <span>{activeNis}</span>
              </span>
            )}
          </div>
          <p className="text-[10px] text-amber-300/80 hidden md:block mt-0.5">
            Testing permissions, UI visibility, and data boundaries as {activeRole} under {activeNis || activeImo}.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {onOpenSwitcher && (
          <button
            onClick={onOpenSwitcher}
            className="px-2.5 py-1.5 text-xs text-amber-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition cursor-pointer"
            title="Change simulation parameters"
          >
            Edit
          </button>
        )}
        <button
          onClick={onRevertRole}
          className="flex items-center gap-1.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-bold text-xs px-3 py-1.5 rounded-xl shadow-md transition shrink-0 cursor-pointer"
          title="Exit role simulation and return to your master account view"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Exit Simulation</span>
        </button>
      </div>
    </div>
  );
};

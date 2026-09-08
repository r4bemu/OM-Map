import React, { useState, useMemo } from 'react';
import { Sparkles, Search, ChevronRight, Check, User, MapPin, Building2 } from 'lucide-react';
import { AuthUser, UserRole } from '../types';

interface QuickAccountPickerProps {
  users: AuthUser[];
  selectedUser: AuthUser | null;
  onSelectUser: (user: AuthUser, autoSubmit?: boolean) => void;
  isLight: boolean;
}

export const QuickAccountPicker: React.FC<QuickAccountPickerProps> = ({
  users,
  selectedUser,
  onSelectUser,
  isLight,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('All');
  const [selectedImo, setSelectedImo] = useState<string>('All');

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // Role filter
      if (selectedRole !== 'All' && u.role !== selectedRole) return false;

      // IMO filter
      if (selectedImo !== 'All') {
        if (selectedImo === 'MOMARO' && !u.imoOffice?.includes('MOMARO') && !u.imoOffice?.includes('Mindoro Oriental')) return false;
        if (selectedImo === 'Occ. Mindoro' && !u.imoOffice?.includes('Occidental Mindoro')) return false;
        if (selectedImo === 'Palawan' && !u.imoOffice?.includes('Palawan')) return false;
        if (selectedImo === 'Regional' && u.imoOffice !== 'All IMOs' && u.imoOffice !== 'Regional Office IV-B') return false;
      }

      // Text search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          u.name.toLowerCase().includes(q) ||
          u.username.toLowerCase().includes(q) ||
          (u.nisBinding && u.nisBinding.toLowerCase().includes(q)) ||
          (u.imoOffice && u.imoOffice.toLowerCase().includes(q)) ||
          (u.designation && u.designation.toLowerCase().includes(q))
        );
      }

      return true;
    });
  }, [users, selectedRole, selectedImo, searchQuery]);

  const getRoleBadgeClass = (role: UserRole) => {
    if (isLight) {
      switch (role) {
        case 'Developer': return 'bg-rose-100 text-rose-700 border-rose-200';
        case 'RO Admin': return 'bg-orange-100 text-orange-800 border-orange-200';
        case 'RO Evaluator': return 'bg-red-100 text-red-700 border-red-200';
        case 'RO Reviewer': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
        case 'RO Preparer': return 'bg-purple-100 text-purple-700 border-purple-200';
        case 'IMO Admin': return 'bg-amber-100 text-amber-800 border-amber-300';
        case 'IMO Evaluator': return 'bg-amber-100 text-amber-700 border-amber-200';
        case 'IMO Reviewer': return 'bg-cyan-100 text-cyan-800 border-cyan-200';
        case 'IMO Preparer': return 'bg-teal-100 text-teal-800 border-teal-200';
        case 'Field Personnel': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
        case 'Viewer': return 'bg-slate-200 text-slate-700 border-slate-300';
      }
    }
    switch (role) {
      case 'Developer': return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
      case 'RO Admin': return 'bg-orange-500/20 text-orange-300 border-orange-500/30';
      case 'RO Evaluator': return 'bg-red-500/20 text-red-300 border-red-500/30';
      case 'RO Reviewer': return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
      case 'RO Preparer': return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'IMO Admin': return 'bg-amber-500/25 text-amber-300 border-amber-500/40';
      case 'IMO Evaluator': return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'IMO Reviewer': return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30';
      case 'IMO Preparer': return 'bg-teal-500/20 text-teal-300 border-teal-500/30';
      case 'Field Personnel': return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'Viewer': return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
    }
  };

  const ROLE_PILLS = [
    { label: 'All', value: 'All' },
    { label: 'Dev', value: 'Developer' },
    { label: 'RO Admin', value: 'RO Admin' },
    { label: 'RO Eval', value: 'RO Evaluator' },
    { label: 'RO Rev', value: 'RO Reviewer' },
    { label: 'RO Prep', value: 'RO Preparer' },
    { label: 'IMO Admin', value: 'IMO Admin' },
    { label: 'IMO Eval', value: 'IMO Evaluator' },
    { label: 'IMO Rev', value: 'IMO Reviewer' },
    { label: 'IMO Prep', value: 'IMO Preparer' },
    { label: 'Field', value: 'Field Personnel' },
    { label: 'Viewer', value: 'Viewer' }
  ];


  return (
    <div className={`w-full md:w-[440px] p-6 flex flex-col justify-between max-h-[620px] md:max-h-none overflow-hidden transition-colors duration-300 ${
      isLight ? 'bg-slate-100/90' : 'bg-slate-950'
    }`}>
      <div className="flex-1 flex flex-col min-h-0">
        {/* Title Bar */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Sparkles className={`w-4 h-4 ${isLight ? 'text-amber-500' : 'text-amber-400'}`} />
            <h3 className={`text-xs font-bold uppercase tracking-wider ${
              isLight ? 'text-slate-800' : 'text-slate-200'
            }`}>
              Quick Demo Accounts
            </h3>
          </div>
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md border ${
            isLight 
              ? 'bg-[#e6f5ea] text-[#00802b] border-[#009933]/30 font-bold' 
              : 'text-[#009933] bg-[#009933]/15 border-[#009933]/30'
          }`}>
            {users.length} Users
          </span>
        </div>

        <p className={`text-[11px] mb-3 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
          Select any pre-configured personnel below to autofill credentials:
        </p>

        {/* Live Search Input */}
        <div className="relative mb-2.5">
          <Search className={`w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 ${
            isLight ? 'text-slate-400' : 'text-slate-500'
          }`} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, @username, or NIS..."
            className={`w-full text-xs rounded-xl pl-8 pr-3 py-1.5 focus:outline-none transition border ${
              isLight
                ? 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-[#009933]'
                : 'bg-slate-900 border-slate-800 text-white placeholder-slate-500 focus:border-[#009933]'
            }`}
          />
        </div>

        {/* Role Filter Pills */}
        <div className="flex flex-wrap gap-1 mb-2">
          {ROLE_PILLS.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setSelectedRole(r.value)}
              className={`text-[9.5px] px-2 py-0.5 rounded-lg font-medium transition cursor-pointer ${
                selectedRole === r.value
                  ? 'bg-[#009933] text-white font-bold shadow-sm'
                  : (isLight 
                      ? 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300' 
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800')
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* IMO Office Filter Pills */}
        <div className="flex flex-wrap gap-1 mb-3">
          {(['All', 'MOMARO', 'Occ. Mindoro', 'Palawan', 'Regional'] as const).map((imo) => (
            <button
              key={imo}
              type="button"
              onClick={() => setSelectedImo(imo)}
              className={`text-[9.5px] px-2 py-0.5 rounded-md font-medium transition cursor-pointer ${
                selectedImo === imo
                  ? (isLight ? 'bg-slate-800 text-white font-bold' : 'bg-slate-700 text-white font-bold')
                  : (isLight ? 'bg-slate-200/80 text-slate-600 hover:bg-slate-300' : 'bg-slate-900/60 text-slate-500 hover:text-slate-300')
              }`}
            >
              {imo}
            </button>
          ))}
        </div>

        {/* Account List */}
        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar min-h-[220px]">
          {filteredUsers.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-500">
              No accounts matched your filters.
            </div>
          ) : (
            filteredUsers.map((u) => {
              const isSelected = selectedUser?.username === u.username;
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => onSelectUser(u)}
                  className={`w-full text-left p-2.5 rounded-xl border transition flex items-center justify-between gap-2 cursor-pointer group ${
                    isSelected
                      ? (isLight 
                          ? 'bg-[#e6f5ea] border-[#009933] shadow-sm ring-1 ring-[#009933]/30' 
                          : 'bg-[#009933]/15 border-[#009933]/50 shadow-sm')
                      : (isLight 
                          ? 'bg-white border-slate-200 hover:border-[#009933]/40 hover:bg-[#e6f5ea]/30 shadow-sm' 
                          : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-800/50')
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-xs font-bold truncate ${
                        isLight 
                          ? 'text-slate-800 group-hover:text-[#009933]' 
                          : 'text-slate-200 group-hover:text-[#009933]'
                      }`}>
                        {u.name}
                      </span>
                      <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-mono border ${getRoleBadgeClass(u.role)}`}>
                        {u.role}
                      </span>
                    </div>
                    <div className={`text-[10px] flex items-center gap-2 mt-0.5 truncate ${
                      isLight ? 'text-slate-500' : 'text-slate-400'
                    }`}>
                      <span className={`font-mono ${isLight ? 'text-[#00802b] font-semibold' : 'text-[#009933]'}`}>
                        @{u.username}
                      </span>
                      <span>•</span>
                      <span className="truncate">
                        {u.nisBinding || u.imoOffice}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <ChevronRight className={`w-3.5 h-3.5 transition ${
                      isLight 
                        ? 'text-slate-400 group-hover:text-[#009933]' 
                        : 'text-slate-600 group-hover:text-[#009933]'
                    }`} />
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Footer Info */}
      <div className={`mt-3 pt-3 border-t text-[10px] flex items-center justify-between ${
        isLight ? 'border-slate-200 text-slate-500' : 'border-slate-800/80 text-slate-500'
      }`}>
        <span>Master Passcode: <strong className="font-mono text-emerald-600 dark:text-emerald-400">DEV9824X</strong></span>
        <span>Showing {filteredUsers.length} of {users.length}</span>
      </div>
    </div>
  );
};

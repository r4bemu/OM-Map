import React, { useState, useEffect } from 'react';
import { 
  Lock, 
  User, 
  ShieldCheck, 
  KeyRound, 
  ChevronRight, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  CheckCircle2, 
  Sparkles,
  Layers,
  MapPin,
  Sun,
  Moon
} from 'lucide-react';
import { AuthUser, UserRole } from '../types';
import { getAuthUsers, authenticateUser, fetchRemoteAuthUsers } from '../config/authUsers';

interface LoginModalProps {
  isOpen: boolean;
  onLogin: (user: AuthUser) => void;
  theme?: 'dark' | 'light';
  onToggleTheme?: (newTheme: 'dark' | 'light') => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ 
  isOpen, 
  onLogin,
  theme: parentTheme,
  onToggleTheme: parentToggleTheme 
}) => {
  const [username, setUsername] = useState('');
  const [passcode, setPasscode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [selectedQuickRole, setSelectedQuickRole] = useState<string>('All');
  const [isLoading, setIsLoading] = useState(false);
  const [usersList, setUsersList] = useState<AuthUser[]>(() => getAuthUsers());

  // Dark / Light Theme State with persistent device memory (falls back to parent if provided)
  const [localTheme, setLocalTheme] = useState<'dark' | 'light'>(() => {
    try {
      return (localStorage.getItem('nia_login_theme') as 'dark' | 'light') || 
             (localStorage.getItem('nia_app_theme') as 'dark' | 'light') || 
             'dark';
    } catch (_) {
      return 'dark';
    }
  });

  const activeTheme = parentTheme || localTheme;

  const toggleTheme = (newTheme: 'dark' | 'light') => {
    setLocalTheme(newTheme);
    try {
      localStorage.setItem('nia_login_theme', newTheme);
      localStorage.setItem('nia_app_theme', newTheme);
    } catch (_) {}
    if (parentToggleTheme) {
      parentToggleTheme(newTheme);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchRemoteAuthUsers().then(users => {
        setUsersList(users);
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isLight = activeTheme === 'light';
  const allUsers = usersList.length > 0 ? usersList : getAuthUsers();

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!username.trim()) {
      setErrorMsg('Please enter your User ID or Username.');
      return;
    }
    if (!passcode.trim()) {
      setErrorMsg('Please enter your account passcode.');
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      const user = authenticateUser(username, passcode);
      if (user) {
        setIsLoading(false);
        onLogin(user);
      } else {
        setIsLoading(false);
        setErrorMsg('Invalid User ID or Passcode. Please check your credentials.');
      }
    }, 200);
  };

  const handleSelectQuickUser = (user: AuthUser) => {
    setUsername(user.username);
    setPasscode(user.passcode);
    setErrorMsg('');
  };

  const filteredQuickUsers = selectedQuickRole === 'All'
    ? allUsers
    : allUsers.filter(u => u.role === selectedQuickRole);

  const getRoleBadgeColor = (role: UserRole) => {
    if (isLight) {
      switch (role) {
        case 'Developer': return 'bg-rose-100 text-rose-700 border-rose-200';
        case 'RO Admin':
        case 'RO Evaluator':
        case 'IMO Admin': return 'bg-purple-100 text-purple-700 border-purple-200';
        case 'NIS In-Charge':
        case 'NIS Preparer':
        case 'RO Preparer': return 'bg-cyan-100 text-cyan-800 border-cyan-200';
        case 'Field Personnel': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
        case 'Viewer': return 'bg-slate-200 text-slate-700 border-slate-300';
        default: return 'bg-slate-100 text-slate-700 border-slate-200';
      }
    }
    switch (role) {
      case 'Developer': return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
      case 'RO Admin':
      case 'RO Evaluator':
      case 'IMO Admin': return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'NIS In-Charge':
      case 'NIS Preparer':
      case 'RO Preparer': return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30';
      case 'Field Personnel': return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'Viewer': return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
      default: return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
    }
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xl animate-in fade-in overflow-y-auto transition-colors duration-300 ${
      isLight ? 'bg-slate-900/45' : 'bg-slate-950/90'
    }`}>
      <div className={`w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row my-auto transition-colors duration-300 border ${
        isLight ? 'bg-white border-slate-200 text-slate-900 shadow-slate-900/10' : 'bg-slate-900 border-slate-800 text-white'
      }`}>
        
        {/* Left Side: Brand Hero & Login Form */}
        <div className={`flex-1 p-6 sm:p-8 flex flex-col justify-between border-b md:border-b-0 md:border-r transition-colors duration-300 ${
          isLight ? 'border-slate-200 bg-slate-50/70' : 'border-slate-800 bg-slate-900/60'
        }`}>
          <div>
            {/* Top Bar: Header & Theme Switcher */}
            <div className="flex items-start justify-between gap-3 mb-6">
              <div className="flex items-center gap-3">
                <img
                  src="/nia-logo.svg"
                  alt="National Irrigation Administration Logo"
                  className="w-12 h-12 object-contain drop-shadow-md"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-mono font-bold tracking-widest uppercase ${
                      isLight ? 'text-[#15803d]' : 'text-[#15803d]'
                    }`}>
                      REGION IV-B MIMAROPA
                    </span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-mono font-bold border ${
                      isLight 
                        ? 'bg-[#e6f5ea] text-[#16a34a] border-[#15803d]/30' 
                        : 'bg-[#15803d]/20 text-[#15803d] border-[#15803d]/40'
                    }`}>
                      SECURE GATE
                    </span>
                  </div>
                  <h1 className={`text-xl font-bold font-heading ${
                    isLight ? 'text-slate-900' : 'text-white'
                  }`}>
                    NIA O&amp;M GIS Platform
                  </h1>
                </div>
              </div>

              {/* Dark / Light Theme Toggle Switcher */}
              <div className={`flex items-center p-1 rounded-xl border transition-colors ${
                isLight ? 'bg-slate-200/80 border-slate-300' : 'bg-slate-800/90 border-slate-700'
              }`}>
                <button
                  type="button"
                  onClick={() => toggleTheme('light')}
                  title="Switch to Light Theme"
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    isLight
                      ? 'bg-[#15803d] text-white shadow-sm font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Sun className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline text-[10px]">Light</span>
                </button>
                <button
                  type="button"
                  onClick={() => toggleTheme('dark')}
                  title="Switch to Dark Theme"
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    !isLight
                      ? 'bg-[#15803d] text-white shadow-sm border border-[#16a34a] font-bold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Moon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline text-[10px]">Dark</span>
                </button>
              </div>
            </div>

            <div className="mb-6">
              <h2 className={`text-sm font-semibold ${
                isLight ? 'text-slate-800' : 'text-slate-200'
              }`}>
                Authorized Personnel Sign-In
              </h2>
              <p className={`text-xs mt-0.5 ${
                isLight ? 'text-slate-600' : 'text-slate-400'
              }`}>
                Access Operations &amp; Maintenance maps, field reports, and multi-tier approval queues.
              </p>
            </div>

            {/* Error Alert */}
            {errorMsg && (
              <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-2 text-xs text-rose-500 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div>
                <label className={`block text-xs font-semibold mb-1.5 ${
                  isLight ? 'text-slate-700' : 'text-slate-300'
                }`}>
                  User ID / Username
                </label>
                <div className="relative">
                  <User className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${
                    isLight ? 'text-slate-500' : 'text-slate-400'
                  }`} />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. dev_master, admin_momaro, engr_momaro_1"
                    className={`w-full text-xs rounded-xl pl-9 pr-3 py-2.5 focus:outline-none transition border ${
                      isLight 
                        ? 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-[#15803d] focus:ring-1 focus:ring-[#15803d] shadow-sm'
                        : 'bg-slate-800/80 border-slate-700 text-white placeholder-slate-500 focus:border-[#15803d] focus:ring-1 focus:ring-[#15803d]'
                    }`}
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className={`block text-xs font-semibold mb-1.5 ${
                  isLight ? 'text-slate-700' : 'text-slate-300'
                }`}>
                  Account Passcode
                </label>
                <div className="relative">
                  <KeyRound className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${
                    isLight ? 'text-slate-500' : 'text-slate-400'
                  }`} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    placeholder="Enter alphanumeric passcode"
                    className={`w-full text-xs rounded-xl pl-9 pr-10 py-2.5 focus:outline-none transition font-mono border ${
                      isLight 
                        ? 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-[#15803d] focus:ring-1 focus:ring-[#15803d] shadow-sm'
                        : 'bg-slate-800/80 border-slate-700 text-white placeholder-slate-500 focus:border-[#15803d] focus:ring-1 focus:ring-[#15803d]'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className={`absolute right-3 top-1/2 -translate-y-1/2 transition ${
                      isLight ? 'text-slate-400 hover:text-slate-700' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#15803d] hover:bg-[#16a34a] text-white font-bold text-xs py-3 rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer mt-2 disabled:opacity-50 border border-[#16a34a]/50 active:scale-[0.99]"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{isLoading ? 'Verifying Credentials...' : 'Authenticate & Enter Map'}</span>
              </button>
            </form>
          </div>

          <div className={`mt-6 pt-4 border-t flex items-center justify-between text-[10px] ${
            isLight ? 'border-slate-200 text-slate-500' : 'border-slate-800/80 text-slate-500'
          }`}>
            <span>NIA Regional Office IV-B (MIMAROPA)</span>
            <span>{usersList.length} Pre-Configured Accounts</span>
          </div>
        </div>

        {/* Right Side: Quick Account Test Selector (Pre-Configured Accounts) */}
        <div className={`w-full md:w-[380px] p-6 flex flex-col justify-between max-h-[480px] md:max-h-none overflow-hidden transition-colors duration-300 ${
          isLight ? 'bg-slate-100/90' : 'bg-slate-950'
        }`}>
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <Sparkles className={`w-3.5 h-3.5 ${isLight ? 'text-amber-500' : 'text-amber-400'}`} />
                <h3 className={`text-xs font-bold uppercase tracking-wider ${
                  isLight ? 'text-slate-800' : 'text-slate-200'
                }`}>
                  Quick Demo Accounts
                </h3>
              </div>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md border ${
                isLight 
                  ? 'bg-[#e6f5ea] text-[#16a34a] border-[#15803d]/30 font-bold' 
                  : 'text-[#15803d] bg-[#15803d]/15 border-[#15803d]/30'
              }`}>
                {usersList.length} Users
              </span>
            </div>

            <p className={`text-[11px] mb-3 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
              Click any pre-configured user below to instantly load credentials:
            </p>

            {/* Role Filter Pills */}
            <div className="flex flex-wrap gap-1 mb-3">
              {(['All', 'Developer', 'RO Admin', 'RO Evaluator', 'RO Preparer', 'IMO Admin', 'NIS In-Charge', 'NIS Preparer', 'Field Personnel', 'Viewer'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setSelectedQuickRole(r)}
                  className={`text-[10px] px-2 py-1 rounded-lg font-medium transition cursor-pointer ${
                    selectedQuickRole === r
                      ? 'bg-[#15803d] text-white font-bold shadow-sm'
                      : (isLight 
                          ? 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300' 
                          : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800')
                  }`}
                >
                  {r === 'Field Personnel' ? 'Field' : r === 'NIS In-Charge' ? 'NIS Lead' : r === 'NIS Preparer' ? 'NIS Prep' : r === 'RO Evaluator' ? 'RO Eval' : r === 'RO Preparer' ? 'RO Prep' : r}
                </button>
              ))}
            </div>

            {/* Account List */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
              {filteredQuickUsers.map((u) => {
                const isSelected = username === u.username;
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => handleSelectQuickUser(u)}
                    className={`w-full text-left p-2.5 rounded-xl border transition flex items-center justify-between gap-2 cursor-pointer group ${
                      isSelected
                        ? (isLight 
                            ? 'bg-[#e6f5ea] border-[#15803d] shadow-sm ring-1 ring-[#15803d]/30' 
                            : 'bg-[#15803d]/15 border-[#15803d]/50 shadow-sm')
                        : (isLight 
                            ? 'bg-white border-slate-200 hover:border-[#15803d]/40 hover:bg-[#e6f5ea]/30 shadow-sm' 
                            : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-800/50')
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs font-bold truncate ${
                          isLight 
                            ? 'text-slate-800 group-hover:text-[#15803d]' 
                            : 'text-slate-200 group-hover:text-[#15803d]'
                        }`}>
                          {u.name}
                        </span>
                        <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-mono border ${getRoleBadgeColor(u.role)}`}>
                          {u.role}
                        </span>
                      </div>
                      <div className={`text-[10px] flex items-center gap-2 mt-0.5 truncate ${
                        isLight ? 'text-slate-500' : 'text-slate-400'
                      }`}>
                        <span className={`font-mono ${isLight ? 'text-[#16a34a] font-semibold' : 'text-[#15803d]'}`}>
                          @{u.username}
                        </span>
                        <span>•</span>
                        <span className={`truncate ${isLight ? 'text-slate-600' : 'text-slate-500'}`}>
                          {u.nisBinding || u.imoOffice}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className={`w-3.5 h-3.5 transition shrink-0 ${
                      isLight 
                        ? 'text-slate-400 group-hover:text-[#15803d]' 
                        : 'text-slate-600 group-hover:text-[#15803d]'
                    }`} />
                  </button>
                );
              })}
            </div>
          </div>

          <div className={`mt-3 pt-3 border-t text-[10px] text-center ${
            isLight ? 'border-slate-200 text-slate-500' : 'border-slate-800/80 text-slate-500'
          }`}>
            Master Passcode: <span className={`font-mono ${isLight ? 'text-slate-700 font-semibold' : 'text-slate-400'}`}>DEV9824X</span> (Developer)
          </div>
        </div>

      </div>
    </div>
  );
};

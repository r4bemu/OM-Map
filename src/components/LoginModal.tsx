import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Lock, 
  User, 
  ShieldCheck, 
  KeyRound, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  CheckCircle2, 
  Sun, 
  Moon, 
  ArrowRight, 
  HelpCircle, 
  Sparkles,
  Users
} from 'lucide-react';
import { AuthUser, UserRole, AccessRequest } from '../types';
import { 
  getAuthUsers, 
  authenticateUser, 
  fetchRemoteAuthUsers,
  fetchAccessRequestsApi,
  submitAccessRequestApi 
} from '../config/authUsers';
import { triggerGoogleGisSignIn } from '../lib/googleIdentityAuth';
import { QuickAccountPicker } from './QuickAccountPicker';
import { RoleMatrixModal } from './RoleMatrixModal';
import { GoogleAuthDomainModal } from './GoogleAuthDomainModal';
import { GoogleProfileSetupModal, GoogleInitialData } from './GoogleProfileSetupModal';
import { AccessRequestStatusModal } from './AccessRequestStatusModal';
import { AccessRequestManagementModal } from './AccessRequestManagementModal';

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
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const [selectedAccount, setSelectedAccount] = useState<AuthUser | null>(null);
  const [usersList, setUsersList] = useState<AuthUser[]>(() => getAuthUsers());
  const [requests, setRequests] = useState<AccessRequest[]>([]);

  // Modals state
  const [isRoleMatrixOpen, setIsRoleMatrixOpen] = useState(false);
  const [isGoogleDomainModalOpen, setIsGoogleDomainModalOpen] = useState(false);
  const [isGoogleSetupModalOpen, setIsGoogleSetupModalOpen] = useState(false);
  const [googleSetupData, setGoogleSetupData] = useState<GoogleInitialData | null>(null);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [statusModalRequest, setStatusModalRequest] = useState<AccessRequest | null>(null);
  const [isAccessRequestsManagerOpen, setIsAccessRequestsManagerOpen] = useState(false);

  // Dark / Light Theme State with persistent device memory
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

  const loadRequests = useCallback(async () => {
    try {
      const reqs = await fetchAccessRequestsApi();
      setRequests(reqs);
    } catch (e) {
      console.warn('Could not load access requests:', e);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      const users = await fetchRemoteAuthUsers();
      if (users && users.length > 0) {
        setUsersList(users);
      }
    } catch (e) {
      console.warn('Could not load remote users:', e);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadUsers();
      loadRequests();
    }
  }, [isOpen, loadUsers, loadRequests]);

  // Sync selected account when picked from QuickAccountPicker
  const handleSelectAccount = (user: AuthUser, autoSubmit = false) => {
    setSelectedAccount(user);
    setUsername(user.username);
    setPasscode(user.passcode);
    setErrorMsg('');

    if (autoSubmit) {
      setIsLoading(true);
      setTimeout(() => {
        setIsLoading(false);
        onLogin(user);
      }, 150);
    }
  };

  const pendingRequestsCount = useMemo(() => {
    return requests.filter(r => r.status === 'pending').length;
  }, [requests]);

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
      setIsLoading(false);
      if (user) {
        onLogin(user);
      } else {
        setErrorMsg('Invalid User ID or Passcode. Please check your credentials or pick from Quick Accounts.');
      }
    }, 250);
  };

  const handleGoogleSignInClick = async () => {
    setErrorMsg('');
    setIsGoogleLoading(true);
    try {
      // Trigger Native Google Cloud Identity Services (GIS) OAuth Popup
      const googleProfile = await triggerGoogleGisSignIn();
      setIsGoogleLoading(false);

      if (googleProfile && googleProfile.email) {
        const userEmail = googleProfile.email.toLowerCase().trim();
        
        // 1. Check if there is an existing access request for this user
        const existingReq = requests.find(r => r.email?.toLowerCase().trim() === userEmail);

        if (existingReq) {
          if (existingReq.status === 'approved') {
            // User is approved -> Log in directly!
            const approvedUser: AuthUser = {
              id: `usr-gauth-${existingReq.id}`,
              username: userEmail.split('@')[0].replace(/[^a-z0-9_]/g, '_'),
              name: existingReq.fullName,
              role: existingReq.assignedRole || existingReq.requestedRole || 'Field Personnel',
              passcode: 'GOOGLE_AUTH_SSO',
              imoOffice: existingReq.assignedOffice || existingReq.requestedOffice,
              nisBinding: existingReq.assignedNis || (Array.isArray(existingReq.requestedNisList) ? existingReq.requestedNisList.join(', ') : 'All NIS'),
              designation: existingReq.designation,
              contactNumber: existingReq.contactNumber,
              avatar: googleProfile.picture || existingReq.avatar,
              email: userEmail,
              provider: 'google'
            };
            onLogin(approvedUser);
            return;
          } else {
            // Request is Pending or Rejected -> show status modal
            setStatusModalRequest(existingReq);
            setIsStatusModalOpen(true);
            return;
          }
        }

        // 2. Check if email matches one of the pre-configured accounts
        const matchedLocalUser = allUsers.find(u => u.email?.toLowerCase().trim() === userEmail);
        if (matchedLocalUser) {
          onLogin({ ...matchedLocalUser, avatar: googleProfile.picture || matchedLocalUser.avatar, provider: 'google' });
          return;
        }

        // 3. Brand new Google user -> open registration setup modal
        setGoogleSetupData({
          email: googleProfile.email,
          displayName: googleProfile.name || `${googleProfile.given_name || ''} ${googleProfile.family_name || ''}`.trim(),
          photoURL: googleProfile.picture || undefined,
          uid: googleProfile.sub
        });
        setIsGoogleSetupModalOpen(true);
      }
    } catch (err: any) {
      setIsGoogleLoading(false);
      if (err.type === 'popup_closed' || err.error === 'popup_closed_by_user' || err.message?.includes('closed')) {
        return;
      }
      if (err.error === 'idpiframe_initialization_failed' || err.error === 'unauthorized_client' || err.message?.includes('origin') || err.message?.includes('domain')) {
        setIsGoogleDomainModalOpen(true);
        return;
      }
      setIsGoogleDomainModalOpen(true);
    }
  };

  const handleRequestSubmitted = async (requestPayload: Partial<AccessRequest>) => {
    setIsGoogleSetupModalOpen(false);
    setIsLoading(true);
    const res = await submitAccessRequestApi(requestPayload);
    setIsLoading(false);
    if (res.success && res.request) {
      setStatusModalRequest(res.request);
      setIsStatusModalOpen(true);
      loadRequests();
    } else {
      setErrorMsg(res.error || 'Failed to submit registration request.');
    }
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xl animate-in fade-in overflow-y-auto transition-colors duration-300 ${
      isLight ? 'bg-slate-900/45' : 'bg-slate-950/90'
    }`}>
      <div className={`w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row my-auto transition-colors duration-300 border ${
        isLight ? 'bg-white border-slate-200 text-slate-900 shadow-slate-900/10' : 'bg-slate-900 border-slate-800 text-white'
      }`}>
        
        {/* Left Side: Brand Hero & Login Form */}
        <div className={`flex-1 p-6 sm:p-8 flex flex-col justify-between border-b md:border-b-0 md:border-r transition-colors duration-300 ${
          isLight ? 'border-slate-200 bg-slate-50/70' : 'border-slate-800 bg-slate-900/60'
        }`}>
          <div>
            {/* Top Bar: Header & Theme Switcher */}
            <div className="flex items-start justify-between gap-3 mb-6">
              <div className="flex items-center gap-3.5">
                <img
                  src="/nia-logo.svg"
                  alt="National Irrigation Administration Logo"
                  className="w-13 h-13 object-contain drop-shadow-md"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold tracking-widest uppercase text-[#009933]">
                      REGION IV-B MIMAROPA
                    </span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-mono font-bold border ${
                      isLight 
                        ? 'bg-[#e6f5ea] text-[#00802b] border-[#009933]/30' 
                        : 'bg-[#009933]/20 text-[#009933] border-[#009933]/40'
                    }`}>
                      SECURE GATEWAY
                    </span>
                  </div>
                  <h1 className={`text-xl sm:text-2xl font-bold font-heading ${
                    isLight ? 'text-slate-900' : 'text-white'
                  }`}>
                    Maintenance and Status of Irrigation Facilities
                  </h1>
                  <p className="text-[11px] text-slate-500 font-medium">
                    National Irrigation Administration Operations &amp; GIS Gateway
                  </p>
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
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    isLight
                      ? 'bg-[#009933] text-white shadow-sm font-bold'
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
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    !isLight
                      ? 'bg-[#009933] text-white shadow-sm border border-[#00802b] font-bold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Moon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline text-[10px]">Dark</span>
                </button>
              </div>
            </div>

            {/* Intro */}
            <div className="mb-5">
              <h2 className={`text-sm font-bold ${
                isLight ? 'text-slate-800' : 'text-slate-200'
              }`}>
                Authorized Personnel Sign-In
              </h2>
              <p className={`text-xs mt-0.5 ${
                isLight ? 'text-slate-600' : 'text-slate-400'
              }`}>
                Access canal networks, Form 691 reports, AI tools, and 6-tier institutional approval workflows.
              </p>
            </div>

            {/* Error Alert */}
            {errorMsg && (
              <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-2 text-xs text-rose-500 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Google Single Sign-On (SSO) Button */}
            <div className="mb-4">
              <button
                type="button"
                onClick={handleGoogleSignInClick}
                disabled={isGoogleLoading}
                className={`w-full py-2.5 px-4 rounded-xl border font-semibold text-xs transition flex items-center justify-center gap-2.5 cursor-pointer shadow-sm disabled:opacity-50 active:scale-[0.99] ${
                  isLight
                    ? 'bg-white hover:bg-slate-50 border-slate-300 text-slate-800 shadow-slate-900/5'
                    : 'bg-slate-800 hover:bg-slate-750 border-slate-700 text-white'
                }`}
              >
                {/* Google G Logo SVG */}
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.15C3.29 21.43 7.35 24 12 24Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.26C.46 8.16 0 9.97 0 12s.46 3.84 1.26 5.42l4.02-3.15Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.29 2.57 1.26 6.58l4.02 3.15c.95-2.83 3.6-4.98 6.72-4.98Z"
                  />
                </svg>
                <span>{isGoogleLoading ? 'Connecting to Google Account...' : 'Continue with Google Account'}</span>
              </button>

              <div className="flex items-center justify-end mt-1.5">
                <button
                  type="button"
                  onClick={() => setIsGoogleDomainModalOpen(true)}
                  className="text-[10.5px] text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition cursor-pointer flex items-center gap-1"
                >
                  <span>Domain issues or quick email sign-in?</span>
                  <Sparkles className="w-3 h-3 text-amber-500" />
                </button>
              </div>
            </div>

            {/* Divider */}
            <div className="relative flex py-2 items-center mb-3">
              <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
              <span className="flex-shrink mx-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                or sign in with credentials
              </span>
              <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
            </div>

            {/* Credentials Form */}
            <form onSubmit={handleFormSubmit} className="space-y-3.5">
              <div>
                <label className={`block text-xs font-semibold mb-1 ${
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
                    placeholder="e.g. dev_master, ro_evaluator, reviewer_momaro_1"
                    className={`w-full text-xs rounded-xl pl-9 pr-3 py-2.5 focus:outline-none transition border ${
                      isLight 
                        ? 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-[#009933] focus:ring-1 focus:ring-[#009933] shadow-sm'
                        : 'bg-slate-800/80 border-slate-700 text-white placeholder-slate-500 focus:border-[#009933] focus:ring-1 focus:ring-[#009933]'
                    }`}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className={`block text-xs font-semibold ${
                    isLight ? 'text-slate-700' : 'text-slate-300'
                  }`}>
                    Account Passcode
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsRoleMatrixOpen(true)}
                    className="text-[11px] text-[#009933] hover:underline flex items-center gap-1 cursor-pointer font-medium"
                  >
                    <HelpCircle className="w-3 h-3" />
                    <span>6-Tier Rights Matrix</span>
                  </button>
                </div>
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
                        ? 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-[#009933] focus:ring-1 focus:ring-[#009933] shadow-sm'
                        : 'bg-slate-800/80 border-slate-700 text-white placeholder-slate-500 focus:border-[#009933] focus:ring-1 focus:ring-[#009933]'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className={`absolute right-3 top-1/2 -translate-y-1/2 transition cursor-pointer ${
                      isLight ? 'text-slate-400 hover:text-slate-700' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-0.5">
                <label className="flex items-center gap-2 cursor-pointer select-none text-slate-600 dark:text-slate-400">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-[#009933] focus:ring-[#009933] cursor-pointer"
                  />
                  <span className="text-[11px]">Save session on this device</span>
                </label>
              </div>

              {/* Submit Button */}
              <div className="space-y-2 pt-1.5">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-[#009933] hover:bg-[#00802b] text-white font-bold text-xs py-3 rounded-xl shadow-lg shadow-emerald-950/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 border border-[#00802b]/50 active:scale-[0.99]"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{isLoading ? 'Verifying Credentials...' : 'Authenticate & Enter Map'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>

            {/* Administrative Access Request Queue Quick Access Banner */}
            <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsAccessRequestsManagerOpen(true)}
                className={`w-full p-2.5 rounded-2xl border text-xs transition flex items-center justify-between cursor-pointer ${
                  isLight
                    ? 'bg-slate-100 hover:bg-slate-200/80 border-slate-300 text-slate-800'
                    : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700 text-slate-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#009933]" />
                  <span className="font-semibold text-[11.5px]">Access Requests Review Queue</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {pendingRequestsCount > 0 ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500 text-amber-950 font-bold font-mono animate-pulse">
                      {pendingRequestsCount} Pending
                    </span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-mono font-bold">
                      All Reviewed
                    </span>
                  )}
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                </div>
              </button>
            </div>

          </div>

          {/* Footer System Badges */}
          <div className={`mt-6 pt-4 border-t flex flex-wrap items-center justify-between gap-2 text-[10.5px] ${
            isLight ? 'border-slate-200 text-slate-500' : 'border-slate-800/80 text-slate-500'
          }`}>
            <div className="flex items-center gap-2">
              <span>NIA Regional Office IV-B (MIMAROPA)</span>
              <span>•</span>
              <span>ISO 9001:2015</span>
            </div>
            <div className="flex items-center gap-1 text-[#009933] font-semibold">
              <ShieldCheck className="w-3 h-3" />
              <span>6-Tier Institutional RBAC</span>
            </div>
          </div>
        </div>

        {/* Right Side: Quick Account Selector with Full Filtering */}
        <QuickAccountPicker
          users={allUsers}
          selectedUser={selectedAccount}
          onSelectUser={handleSelectAccount}
          isLight={isLight}
        />

      </div>

      {/* 6-Tier Role Matrix Modal */}
      <RoleMatrixModal
        isOpen={isRoleMatrixOpen}
        onClose={() => setIsRoleMatrixOpen(false)}
        isLight={isLight}
      />

      {/* Google Auth Domain Configuration / Instant Sign-In Modal */}
      <GoogleAuthDomainModal
        isOpen={isGoogleDomainModalOpen}
        onClose={() => setIsGoogleDomainModalOpen(false)}
        onOpenProfileSetup={(data) => {
          setGoogleSetupData(data);
          setIsGoogleSetupModalOpen(true);
        }}
        isLight={isLight}
      />

      {/* Google Profile Registration & Contact Setup Modal */}
      <GoogleProfileSetupModal
        isOpen={isGoogleSetupModalOpen}
        onClose={() => setIsGoogleSetupModalOpen(false)}
        initialData={googleSetupData}
        onSubmitRequest={handleRequestSubmitted}
        isLight={isLight}
      />

      {/* Access Request Status Modal (Pending / Rejected / Approved) */}
      <AccessRequestStatusModal
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
        request={statusModalRequest}
        onRefresh={loadRequests}
        onEditDetails={() => {
          if (statusModalRequest) {
            setGoogleSetupData({
              email: statusModalRequest.email,
              displayName: statusModalRequest.fullName,
              photoURL: statusModalRequest.avatar,
              uid: statusModalRequest.uid,
            });
            setIsStatusModalOpen(false);
            setIsGoogleSetupModalOpen(true);
          }
        }}
        isLight={isLight}
      />

      {/* Access Request Management Queue Modal */}
      <AccessRequestManagementModal
        isOpen={isAccessRequestsManagerOpen}
        onClose={() => setIsAccessRequestsManagerOpen(false)}
        currentUser={selectedAccount}
        requests={requests}
        onRefreshRequests={loadRequests}
        isLight={isLight}
      />

    </div>
  );
};

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  Lock, 
  User, 
  ShieldCheck, 
  KeyRound, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  AlertTriangle,
  CheckCircle2, 
  Sun, 
  Moon, 
  ArrowRight
} from 'lucide-react';
import { AuthUser, UserRole, AccessRequest } from '../types';
import { 
  getAuthUsers, 
  authenticateUser, 
  fetchRemoteAuthUsers,
  fetchAccessRequestsApi,
  fetchUserAccessRequestApi,
  submitAccessRequestApi,
  verifyAndConsumeTempPinApi,
  DEVELOPER_EMAIL
} from '../config/authUsers';
import { triggerGoogleGisSignIn } from '../lib/googleIdentityAuth';
import { SignUpModal } from './SignUpModal';
import { ForgotPasswordModal } from './ForgotPasswordModal';
import { ForcePasswordChangeModal } from './ForcePasswordChangeModal';
import { GoogleProfileSetupModal, GoogleInitialData } from './GoogleProfileSetupModal';
import { GoogleAuthDomainModal } from './GoogleAuthDomainModal';
import { AccessRequestStatusModal } from './AccessRequestStatusModal';

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
  const usernameInputRef = useRef<HTMLInputElement>(null);
  const passcodeInputRef = useRef<HTMLInputElement>(null);

  const [username, setUsername] = useState(() => {
    try {
      return localStorage.getItem('nia_remembered_username') || '';
    } catch (_) {
      return '';
    }
  });
  const [passcode, setPasscode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isCapsLockOn, setIsCapsLockOn] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isSignUpModalOpen, setIsSignUpModalOpen] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => {
    try {
      const saved = localStorage.getItem('nia_remember_me_preference');
      return saved !== null ? saved === 'true' : true;
    } catch (_) {
      return true;
    }
  });

  // Autofocus the first empty field when modal opens, without interfering with auto-proceed
  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      if (username.trim()) {
        passcodeInputRef.current?.focus();
      } else {
        usernameInputRef.current?.focus();
      }
    }, 120);

    return () => clearTimeout(timer);
  }, [isOpen]);

  const [usersList, setUsersList] = useState<AuthUser[]>(() => getAuthUsers());
  const [requests, setRequests] = useState<AccessRequest[]>([]);

  const allUsers = useMemo(() => {
    return usersList.length > 0 ? usersList : getAuthUsers();
  }, [usersList]);

  // Modals state
  const [isGoogleSetupModalOpen, setIsGoogleSetupModalOpen] = useState(false);
  const [googleSetupData, setGoogleSetupData] = useState<GoogleInitialData | null>(null);
  const [isGoogleDomainModalOpen, setIsGoogleDomainModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [statusModalRequest, setStatusModalRequest] = useState<AccessRequest | null>(null);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [forcePasswordUser, setForcePasswordUser] = useState<AuthUser | null>(null);
  const [isForcePasswordModalOpen, setIsForcePasswordModalOpen] = useState(false);

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

  const loadRequests = useCallback(async (forceFresh = false) => {
    try {
      const reqs = await fetchAccessRequestsApi(forceFresh);
      setRequests(reqs);
      return reqs;
    } catch (e) {
      console.warn('Could not load access requests:', e);
      return [];
    }
  }, []);

  // Helper to log in a user whose AccessRequest is approved
  const loginApprovedUser = useCallback((approvedReq: AccessRequest, userPicture?: string, provider?: 'google' | 'facebook' | 'local') => {
    const userEmail = (approvedReq.email || '').toLowerCase().trim();
    const effectiveProvider = provider || approvedReq.provider || (approvedReq.username ? 'local' : 'google');
    const uname = approvedReq.username ? approvedReq.username.trim() : (userEmail ? userEmail.split('@')[0].replace(/[^a-z0-9_]/g, '_') : `user_${approvedReq.id}`);
    const approvedUser: AuthUser = {
      id: approvedReq.uid || `usr-${effectiveProvider}-${approvedReq.id}`,
      username: uname,
      name: approvedReq.fullName,
      role: approvedReq.assignedRole || approvedReq.requestedRole || 'Field Personnel',
      passcode: approvedReq.passcode || approvedReq.password || (effectiveProvider === 'google' ? 'GOOGLE_AUTH_SSO' : 'LOCAL_AUTH'),
      imoOffice: approvedReq.assignedOffice || approvedReq.requestedOffice,
      nisBinding: approvedReq.assignedNis || (Array.isArray(approvedReq.requestedNisList) ? approvedReq.requestedNisList.join(', ') : 'All NIS'),
      designation: approvedReq.designation,
      contactNumber: approvedReq.contactNumber,
      avatar: userPicture || approvedReq.avatar,
      email: userEmail,
      provider: effectiveProvider
    };
    setIsStatusModalOpen(false);
    onLogin(approvedUser);
  }, [onLogin]);

  // Live-check approval status on demand directly from Firestore bypassing any cache
  const handleCheckApprovalStatus = useCallback(async () => {
    if (!statusModalRequest || !statusModalRequest.email) return;
    try {
      const [freshReq, reqs] = await Promise.all([
        fetchUserAccessRequestApi(statusModalRequest.email, true),
        loadRequests(true)
      ]);
      const matched = freshReq || reqs.find(r => r.email?.toLowerCase().trim() === statusModalRequest.email.toLowerCase().trim());
      if (matched) {
        setStatusModalRequest(matched);
        if (matched.status === 'approved') {
          loginApprovedUser(matched);
          return;
        }
      }
    } catch (err) {
      console.warn('Error checking approval status:', err);
      throw err;
    }
  }, [statusModalRequest, loadRequests, loginApprovedUser]);

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


  if (!isOpen) return null;

  const isLight = activeTheme === 'light';

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (rememberMe) {
      try {
        localStorage.setItem('nia_remembered_username', username.trim());
        localStorage.setItem('nia_remember_me_preference', 'true');
      } catch (_) {}
    } else {
      try {
        localStorage.removeItem('nia_remembered_username');
        localStorage.setItem('nia_remember_me_preference', 'false');
      } catch (_) {}
    }

    if (!username.trim()) {
      setErrorMsg('Please enter your User ID or Username.');
      return;
    }
    if (!passcode.trim()) {
      setErrorMsg('Please enter your account passcode or password.');
      return;
    }

    setIsLoading(true);

    // 1. Check against active in-memory and local accounts
    const user = authenticateUser(username, passcode);
    if (user) {
      setIsLoading(false);
      onLogin(user);
      return;
    }

    // 2. Check fresh access requests for newly approved or pending accounts
    try {
      const freshReqs = await fetchAccessRequestsApi(true);
      const cleanUname = username.trim().toLowerCase().replace(/^@/, '');
      const cleanPass = passcode.trim();

      // Check approved access request
      const approvedReq = freshReqs.find(r => 
        r.status === 'approved' &&
        (r.username?.toLowerCase() === cleanUname || r.email?.toLowerCase() === cleanUname) &&
        (r.passcode === cleanPass || r.password === cleanPass || r.passcode?.toUpperCase() === cleanPass.toUpperCase())
      );

      if (approvedReq) {
        setIsLoading(false);
        loginApprovedUser(approvedReq, undefined, 'local');
        return;
      }

      // Check pending access request
      const pendingReq = freshReqs.find(r => 
        (r.username?.toLowerCase() === cleanUname || r.email?.toLowerCase() === cleanUname) &&
        r.status === 'pending'
      );

      if (pendingReq) {
        setIsLoading(false);
        setStatusModalRequest(pendingReq);
        setIsStatusModalOpen(true);
        setErrorMsg(`Account request for @${pendingReq.username || cleanUname} is pending review by your Office Administrator.`);
        return;
      }

      // Check rejected request
      const rejectedReq = freshReqs.find(r => 
        (r.username?.toLowerCase() === cleanUname || r.email?.toLowerCase() === cleanUname) &&
        r.status === 'rejected'
      );

      if (rejectedReq) {
        setIsLoading(false);
        setStatusModalRequest(rejectedReq);
        setIsStatusModalOpen(true);
        setErrorMsg(`Account request was declined: ${rejectedReq.rejectionReason || 'Contact your administrator.'}`);
        return;
      }
    } catch (_) {}

    // 3. Check if authenticating via Single-Use Temporary PIN
    try {
      const cleanUname = username.trim().toLowerCase().replace(/^@/, '');
      const cleanPass = passcode.trim();
      const pinResult = await verifyAndConsumeTempPinApi(cleanUname, cleanPass);
      if (pinResult && pinResult.success) {
        setIsLoading(false);
        const targetUser = pinResult.user || allUsers.find(u => (u.username || '').toLowerCase().replace(/^@/, '') === cleanUname);
        if (targetUser) {
          setForcePasswordUser(targetUser);
          setIsForcePasswordModalOpen(true);
          return;
        }
      }
    } catch (pinErr: any) {
      if (pinErr.message && (pinErr.message.includes('already been used') || pinErr.message.includes('inactive'))) {
        setIsLoading(false);
        setErrorMsg(pinErr.message);
        return;
      }
    }

    setIsLoading(false);
    setErrorMsg('Invalid User ID or Password. If you forgot your password, click "Forgot Password" below.');
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

        // 0. Master Developer Override (r4b.emu@gmail.com): Instant access with full administrative authority
        if (userEmail === DEVELOPER_EMAIL.toLowerCase()) {
          const devUser: AuthUser = {
            id: 'usr-dev-01',
            username: 'dev_master',
            name: googleProfile.name || 'Lead Systems Architect (Developer)',
            role: 'Developer',
            passcode: 'GOOGLE_AUTH_SSO',
            imoOffice: 'All IMOs',
            nisBinding: 'All NIS',
            designation: 'Master Systems Administrator - Regional Wide',
            avatar: googleProfile.picture,
            email: userEmail,
            provider: 'google'
          };
          onLogin(devUser);
          return;
        }
        
        // 1. Check if there is an existing access request for this user (fresh fetch from Firestore)
        let userReq = await fetchUserAccessRequestApi(userEmail);
        if (!userReq) {
          userReq = requests.find(r => r.email?.toLowerCase().trim() === userEmail) || null;
        }

        if (userReq) {
          if (userReq.status === 'approved') {
            // User is approved -> Log in directly!
            loginApprovedUser(userReq, googleProfile.picture);
            return;
          } else {
            // Request is Pending or Rejected -> show status modal
            setStatusModalRequest(userReq);
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

  const handleSignUpSubmitted = async (requestPayload: Partial<AccessRequest>) => {
    setIsSignUpModalOpen(false);
    setIsLoading(true);
    const res = await submitAccessRequestApi(requestPayload);
    setIsLoading(false);
    if (res.success && res.request) {
      setStatusModalRequest(res.request);
      setIsStatusModalOpen(true);
      loadRequests(true);
    } else {
      setErrorMsg(res.error || 'Failed to submit registration request.');
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
      <div className={`w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden my-auto transition-colors duration-300 border relative ${
        isLight ? 'bg-white border-slate-200 text-slate-900 shadow-slate-900/10' : 'bg-slate-900 border-slate-800 text-white'
      }`}>
        
        {/* Top-Right Theme Toggle Switcher */}
        <div className="absolute top-4 right-4 sm:top-5 sm:right-6 z-20">
          <div className={`flex items-center p-0.5 rounded-xl border transition-colors shadow-sm ${
            isLight ? 'bg-slate-100/90 border-slate-200' : 'bg-slate-800/90 border-slate-700/80 backdrop-blur-md'
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

        {/* Main Content: Brand Hero, Social Sign-In & Login Form */}
        <div className={`p-6 sm:p-8 flex flex-col justify-between transition-colors duration-300 ${
          isLight ? 'bg-slate-50/70' : 'bg-slate-900/60'
        }`}>
          <div>
            {/* Brand Header */}
            <div className="flex items-center gap-3.5 pr-20 sm:pr-24 mb-7 sm:mb-8">
              <img
                src="/nia-logo.svg"
                alt="National Irrigation Administration Logo"
                className="w-12 h-12 sm:w-14 sm:h-14 object-contain drop-shadow-md shrink-0"
              />
              <div className="min-w-0">
                <span className="block text-[10px] font-mono font-bold tracking-widest uppercase text-[#009933] mb-0.5">
                  REGION IV-B MIMAROPA
                </span>
                <h1 className={`text-base sm:text-lg font-bold font-heading leading-tight tracking-tight ${
                  isLight ? 'text-slate-900' : 'text-white'
                }`}>
                  Maintenance and Status of<br />
                  Irrigation Facilities
                </h1>
              </div>
            </div>

            {/* Error Alert */}
            {errorMsg && (
              <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-2 text-xs text-rose-500 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Single Sign-On (SSO) Google Account Button */}
            <div className="mb-5">
              <button
                type="button"
                onClick={handleGoogleSignInClick}
                disabled={isGoogleLoading}
                className={`w-full py-3 px-4 rounded-xl border font-semibold text-xs sm:text-sm transition flex items-center justify-center gap-2.5 cursor-pointer shadow-sm disabled:opacity-50 active:scale-[0.99] ${
                  isLight
                    ? 'bg-white hover:bg-slate-50 border-slate-300 text-slate-800 shadow-slate-900/5'
                    : 'bg-slate-800 hover:bg-slate-750 border-slate-700 text-white'
                }`}
              >
                {/* Google G Logo SVG */}
                <svg className="w-4.5 h-4.5 shrink-0" viewBox="0 0 24 24">
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
                    ref={usernameInputRef}
                    type="text"
                    autoComplete="username"
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
                <label className={`block text-xs font-semibold mb-1 ${
                  isLight ? 'text-slate-700' : 'text-slate-300'
                }`}>
                  Account Passcode
                </label>
                <div className="relative">
                  <KeyRound className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${
                    isLight ? 'text-slate-500' : 'text-slate-400'
                  }`} />
                  <input
                    ref={passcodeInputRef}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.getModifierState) {
                        setIsCapsLockOn(e.getModifierState('CapsLock'));
                      }
                    }}
                    onKeyUp={(e) => {
                      if (e.getModifierState) {
                        setIsCapsLockOn(e.getModifierState('CapsLock'));
                      }
                    }}
                    onBlur={() => setIsCapsLockOn(false)}
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

                {/* Caps Lock Detection Warning Indicator */}
                {isCapsLockOn && (
                  <div className="flex items-center gap-1.5 mt-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-500 text-[11px] font-semibold animate-in fade-in">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>Caps Lock is ON — passcode is case-sensitive</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between text-xs pt-0.5">
                <label className="flex items-center gap-2 cursor-pointer select-none text-slate-600 dark:text-slate-400">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-[#009933] focus:ring-[#009933] cursor-pointer"
                  />
                  <span className="text-[11px]">Save session</span>
                </label>

                <button
                  type="button"
                  onClick={() => setIsForgotPasswordOpen(true)}
                  className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline font-semibold cursor-pointer"
                >
                  Forgot Password?
                </button>
              </div>

              {/* Submit Button */}
              <div className="space-y-2 pt-1.5">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-[#009933] hover:bg-[#00802b] text-white font-bold text-xs py-3 rounded-xl shadow-lg shadow-emerald-950/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 border border-[#00802b]/50 active:scale-[0.99]"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{isLoading ? 'Verifying Credentials...' : 'Continue Sign in'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                {/* Additional Sign Up Link */}
                <div className="pt-2 text-center text-xs text-slate-500 dark:text-slate-400">
                  <span>New personnel without an account? </span>
                  <button
                    type="button"
                    onClick={() => setIsSignUpModalOpen(true)}
                    className="font-bold text-[#009933] hover:text-[#00802b] hover:underline cursor-pointer"
                  >
                    Sign Up &amp; Request Access
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Compliance & Policy Links */}
          <div className="mt-8 pt-5 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-center gap-3 text-[11px] text-slate-400 dark:text-slate-500">
            <a 
              href="/privacy" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="hover:underline hover:text-emerald-600 dark:hover:text-emerald-400 transition"
            >
              Privacy Policy
            </a>
            <span>•</span>
            <a 
              href="/data-deletion" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="hover:underline hover:text-emerald-600 dark:hover:text-emerald-400 transition"
            >
              User Data Deletion
            </a>
          </div>
        </div>
      </div>

      {/* Personnel Account Sign-Up & Access Request Modal */}
      <SignUpModal
        isOpen={isSignUpModalOpen}
        onClose={() => setIsSignUpModalOpen(false)}
        onSubmitRequest={handleSignUpSubmitted}
        isLight={isLight}
        existingUsers={allUsers}
        existingRequests={requests}
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
        onRefresh={handleCheckApprovalStatus}
        onProceedToApp={() => {
          if (statusModalRequest && statusModalRequest.status === 'approved') {
            loginApprovedUser(statusModalRequest);
          }
        }}
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

      {/* Account Recovery & Temporary PIN Request Modal */}
      <ForgotPasswordModal
        isOpen={isForgotPasswordOpen}
        onClose={() => setIsForgotPasswordOpen(false)}
        onOpenLogin={() => setIsForgotPasswordOpen(false)}
        isLight={isLight}
        existingRequests={requests}
      />

      {/* Force New Permanent Password on Temp PIN Login Modal */}
      <ForcePasswordChangeModal
        isOpen={isForcePasswordModalOpen}
        user={forcePasswordUser}
        onSuccess={(newPass) => {
          setIsForcePasswordModalOpen(false);
          if (forcePasswordUser) {
            const updated = { ...forcePasswordUser, passcode: newPass };
            onLogin(updated);
          }
        }}
        isLight={isLight}
      />

    </div>
  );
};

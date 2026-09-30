import React, { useState } from 'react';
import { 
  X, 
  KeyRound, 
  Search, 
  ShieldAlert, 
  CheckCircle2, 
  AlertCircle, 
  Phone, 
  User, 
  ArrowRight, 
  RotateCcw,
  Building2,
  Lock,
  Send
} from 'lucide-react';
import { AuthUser, AccessRequest, PasswordResetRequest } from '../types';
import { 
  getAuthUsers, 
  maskMobileNumber, 
  maskName, 
  maskUsername, 
  submitPasswordResetRequestApi 
} from '../config/authUsers';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenLogin: () => void;
  isLight: boolean;
  existingRequests?: AccessRequest[];
}

interface TargetAccountInfo {
  id?: string;
  username: string;
  name: string;
  firstName: string;
  lastName: string;
  contactNumber: string;
  office: string;
  designation: string;
  avatar?: string;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({
  isOpen,
  onClose,
  onOpenLogin,
  isLight,
  existingRequests = []
}) => {
  // Step control: 1 = Search Account, 2 = Verify Identity Challenge, 3 = Submitted Confirmation
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Search input
  const [searchQuery, setSearchQuery] = useState('');
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Matched account
  const [targetAccount, setTargetAccount] = useState<TargetAccountInfo | null>(null);

  // Verification challenge inputs
  const [inputUsername, setInputUsername] = useState('');
  const [inputMobile, setInputMobile] = useState('');
  const [inputFirstName, setInputFirstName] = useState('');
  const [inputLastName, setInputLastName] = useState('');
  const [challengeError, setChallengeError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Created request
  const [createdRequest, setCreatedRequest] = useState<PasswordResetRequest | null>(null);

  if (!isOpen) return null;

  // Reset modal state
  const handleResetModal = () => {
    setStep(1);
    setSearchQuery('');
    setSearchError(null);
    setTargetAccount(null);
    setInputUsername('');
    setInputMobile('');
    setInputFirstName('');
    setInputLastName('');
    setChallengeError(null);
    setCreatedRequest(null);
  };

  const handleClose = () => {
    handleResetModal();
    onClose();
  };

  // Step 1: Search for account
  const handleSearchAccount = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchError(null);

    const query = searchQuery.trim().toLowerCase().replace(/^@/, '');
    if (!query) {
      setSearchError('Please enter your username, registered mobile phone, or email.');
      return;
    }

    setIsSearching(true);
    const cleanDigits = query.replace(/\D/g, '');

    // 1. Search in local / persistent users
    const allUsers = getAuthUsers();
    let found = allUsers.find(u => {
      const uName = (u.username || '').toLowerCase().replace(/^@/, '');
      const uEmail = (u.email || '').toLowerCase();
      const uPhone = (u.contactNumber || '').replace(/\D/g, '');
      return (
        uName === query ||
        (cleanDigits.length >= 7 && uPhone.includes(cleanDigits)) ||
        (query.includes('@') && uEmail === query)
      );
    });

    // 2. Search in approved access requests
    let foundReq: AccessRequest | undefined;
    if (!found) {
      foundReq = existingRequests.find(r => {
        if (r.status !== 'approved') return false;
        const rName = (r.username || (r.email ? r.email.split('@')[0] : '')).toLowerCase().replace(/^@/, '');
        const rEmail = (r.email || '').toLowerCase();
        const rPhone = (r.contactNumber || '').replace(/\D/g, '');
        return (
          rName === query ||
          (cleanDigits.length >= 7 && rPhone.includes(cleanDigits)) ||
          (query.includes('@') && rEmail === query)
        );
      });
    }

    setIsSearching(false);

    const matched = found || foundReq;
    if (!matched) {
      setSearchError(`No registered personnel account found matching "${searchQuery}". Please check your username, mobile phone, or email.`);
      return;
    }

    // Determine first and last names
    let fn = (matched as any).firstName || '';
    let ln = (matched as any).lastName || '';
    const full = (matched as any).fullName || (matched as any).name || '';

    if (!fn || !ln) {
      const parts = full.trim().split(/\s+/);
      fn = fn || parts[0] || 'Personnel';
      ln = ln || parts.slice(1).join(' ') || parts[0] || '';
    }

    const contact = (matched as any).contactNumber || '';
    const office = (matched as any).imoOffice || (matched as any).requestedOffice || (matched as any).assignedOffice || 'Regional Office IV-B';
    const designation = (matched as any).designation || 'Personnel';
    const username = (matched as any).username || query;

    setTargetAccount({
      id: matched.id,
      username,
      name: full,
      firstName: fn,
      lastName: ln,
      contactNumber: contact,
      office,
      designation,
      avatar: (matched as any).avatar
    });

    setStep(2);
  };

  // Step 2: Validate challenge fields and submit temporary PIN request
  const handleSubmitChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetAccount) return;
    setChallengeError(null);

    // 1. Username check
    const cleanUname = inputUsername.trim().toLowerCase().replace(/^@/, '');
    const targetUname = targetAccount.username.toLowerCase().replace(/^@/, '');
    if (!cleanUname) {
      setChallengeError('Please complete your Username.');
      return;
    }
    if (cleanUname !== targetUname) {
      setChallengeError('The username entered does not match this account record.');
      return;
    }

    // 2. Mobile Phone check
    const inputDigits = inputMobile.replace(/\D/g, '');
    const targetDigits = targetAccount.contactNumber.replace(/\D/g, '');
    if (!inputDigits || inputDigits.length < 11) {
      setChallengeError('Please enter your complete 11-digit mobile phone number (e.g. 09123456789).');
      return;
    }
    if (inputDigits !== targetDigits) {
      setChallengeError('The mobile phone number entered does not match the registered number on file.');
      return;
    }

    // 3. First Name check
    const cleanFirst = inputFirstName.trim().toLowerCase();
    const targetFirst = targetAccount.firstName.trim().toLowerCase();
    if (!cleanFirst) {
      setChallengeError('Please complete your First Name.');
      return;
    }
    if (cleanFirst !== targetFirst) {
      setChallengeError('The First Name entered does not match our records.');
      return;
    }

    // 4. Last Name check
    const cleanLast = inputLastName.trim().toLowerCase();
    const targetLast = targetAccount.lastName.trim().toLowerCase();
    if (!cleanLast) {
      setChallengeError('Please complete your Last Name.');
      return;
    }
    if (cleanLast !== targetLast) {
      setChallengeError('The Last Name entered does not match our records.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await submitPasswordResetRequestApi({
        username: targetAccount.username,
        mobileNumber: inputDigits,
        firstName: targetAccount.firstName,
        lastName: targetAccount.lastName
      });

      if (res.success && res.request) {
        setCreatedRequest(res.request);
        setStep(3);
      } else {
        setChallengeError(res.message || 'Failed to submit reset request. Please try again.');
      }
    } catch (err: any) {
      setChallengeError(err.message || 'Error communicating with authentication server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-md animate-in fade-in overflow-y-auto ${
      isLight ? 'bg-slate-900/40' : 'bg-black/80'
    }`}>
      <div className={`w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[92vh] my-auto transition-colors duration-200 ${
        isLight 
          ? 'bg-white border-slate-300 text-slate-900 shadow-slate-900/15' 
          : 'bg-[#18181b] border-[#3f3f46] text-[#fafafa]'
      }`}>
        
        {/* Header */}
        <div className={`p-4 sm:p-5 border-b flex items-center justify-between gap-4 ${
          isLight ? 'border-slate-200 bg-slate-50/90' : 'border-[#3f3f46] bg-[#1f1f23]'
        }`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
              isLight ? 'bg-rose-100 text-rose-600 border border-rose-300' : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
            }`}>
              <KeyRound className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className={`text-base sm:text-lg font-bold font-heading tracking-tight ${
                isLight ? 'text-slate-900' : 'text-[#fafafa]'
              }`}>
                Forgot Password &amp; Temporary PIN
              </h2>
              <p className={`text-[11px] truncate ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
                Verify your identity to request a single-use Temporary PIN from Administrators.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className={`p-2 rounded-xl border transition cursor-pointer shrink-0 ${
              isLight 
                ? 'border-slate-300 hover:bg-slate-200 text-slate-600' 
                : 'border-[#3f3f46] bg-[#27272a] hover:bg-[#3f3f46] text-zinc-300 hover:text-white'
            }`}
            title="Close Window"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-4 sm:p-6 overflow-y-auto custom-scrollbar text-xs">

          {/* ============================================================ */}
          {/* STEP 1: LOCATE ACCOUNT                                       */}
          {/* ============================================================ */}
          {step === 1 && (
            <form onSubmit={handleSearchAccount} className="space-y-4">
              <div className={`p-3.5 rounded-xl border flex items-start gap-2.5 ${
                isLight ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-amber-500/10 border-amber-500/20 text-amber-300'
              }`}>
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                <p className="text-[11px] leading-relaxed">
                  Enter your Username, Registered Mobile Number, or Email to find your account and begin the identity verification challenge.
                </p>
              </div>

              {searchError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start gap-2 text-rose-600 dark:text-rose-400 text-xs">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <span>{searchError}</span>
                </div>
              )}

              <div>
                <label className={`block font-semibold mb-1.5 ${isLight ? 'text-slate-700' : 'text-zinc-300'}`}>
                  Account Identifier (Username, Mobile Phone, or Email) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="e.g. @juan_delacruz, 09171234567, or official email"
                    className={`w-full pl-9 pr-3 py-2.5 rounded-xl border text-xs font-mono transition focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                      isLight 
                        ? 'bg-white border-slate-300 text-slate-900' 
                        : 'bg-[#27272a] border-[#3f3f46] text-[#fafafa]'
                    }`}
                    autoFocus
                  />
                  <Search className="w-4 h-4 absolute left-3 top-3 text-zinc-400" />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className={`px-4 py-2 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                    isLight 
                      ? 'border-slate-300 hover:bg-slate-100 text-slate-700' 
                      : 'border-[#3f3f46] bg-[#27272a] hover:bg-[#3f3f46] text-zinc-300'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSearching || !searchQuery.trim()}
                  className="px-5 py-2.5 rounded-xl bg-[#009933] hover:bg-[#00802b] text-white font-bold text-xs flex items-center gap-2 shadow transition cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  <span>{isSearching ? 'Locating Account...' : 'Locate Account'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}

          {/* ============================================================ */}
          {/* STEP 2: VERIFICATION CHALLENGE WITH MASKED PREVIEWS          */}
          {/* ============================================================ */}
          {step === 2 && targetAccount && (
            <form onSubmit={handleSubmitChallenge} className="space-y-4 animate-in fade-in">
              {/* Account Found Header Card */}
              <div className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
                isLight ? 'bg-slate-100/70 border-slate-200' : 'bg-[#27272a] border-[#3f3f46]'
              }`}>
                <div className="flex items-center gap-3 min-w-0">
                  {targetAccount.avatar ? (
                    <img 
                      src={targetAccount.avatar} 
                      alt="Personnel" 
                      className="w-10 h-10 rounded-full object-cover border border-emerald-500 shrink-0" 
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center shrink-0 font-bold">
                      <User className="w-5 h-5" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <span className="text-[10px] font-mono text-emerald-500 font-bold uppercase tracking-wider">
                      Account Matched
                    </span>
                    <h3 className="font-bold text-xs truncate">
                      {targetAccount.office}
                    </h3>
                    <p className={`text-[10px] truncate ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
                      {targetAccount.designation}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className={`p-1.5 rounded-lg border text-[10px] font-semibold transition cursor-pointer flex items-center gap-1 ${
                    isLight ? 'border-slate-300 hover:bg-slate-200' : 'border-[#3f3f46] hover:bg-[#3f3f46]'
                  }`}
                  title="Search another account"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Change</span>
                </button>
              </div>

              {/* Instructions Banner */}
              <div className={`p-3 rounded-xl border text-[11px] leading-relaxed ${
                isLight ? 'bg-amber-50/80 border-amber-200 text-amber-900' : 'bg-amber-500/10 border-amber-500/20 text-amber-300'
              }`}>
                <div className="flex items-center gap-1.5 font-bold mb-1 text-amber-600 dark:text-amber-400">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Complete Masked Details for Verification</span>
                </div>
                <span>
                  To prevent unauthorized resets, complete each required field below to match the masked preview shown in brackets.
                </span>
              </div>

              {challengeError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start gap-2 text-rose-600 dark:text-rose-400 text-xs">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <span>{challengeError}</span>
                </div>
              )}

              {/* CHALLENGE FIELD 1: USERNAME */}
              <div className={`p-3 rounded-xl border space-y-1.5 ${
                isLight ? 'bg-white border-slate-200' : 'bg-[#1f1f23] border-[#3f3f46]'
              }`}>
                <div className="flex items-center justify-between">
                  <label className={`block font-bold text-xs ${isLight ? 'text-slate-800' : 'text-zinc-200'}`}>
                    1. Username <span className="text-rose-500">*</span>
                  </label>
                  <span className="font-mono text-[11px] font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                    Preview: {maskUsername(targetAccount.username)}
                  </span>
                </div>
                <input
                  type="text"
                  value={inputUsername}
                  onChange={(e) => setInputUsername(e.target.value)}
                  placeholder="Complete your full username (e.g. juan_delacruz)"
                  className={`w-full px-3 py-2 rounded-lg border text-xs font-mono transition focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                    isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-[#27272a] border-[#3f3f46] text-[#fafafa]'
                  }`}
                />
              </div>

              {/* CHALLENGE FIELD 2: REGISTERED MOBILE PHONE */}
              <div className={`p-3 rounded-xl border space-y-1.5 ${
                isLight ? 'bg-white border-slate-200' : 'bg-[#1f1f23] border-[#3f3f46]'
              }`}>
                <div className="flex items-center justify-between">
                  <label className={`block font-bold text-xs ${isLight ? 'text-slate-800' : 'text-zinc-200'}`}>
                    2. Registered Mobile Phone <span className="text-rose-500">*</span>
                  </label>
                  <span className="font-mono text-[11px] font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                    Preview: {maskMobileNumber(targetAccount.contactNumber)}
                  </span>
                </div>
                <input
                  type="text"
                  value={inputMobile}
                  onChange={(e) => setInputMobile(e.target.value.replace(/\D/g, '').slice(0, 11))}
                  placeholder="Enter full 11-digit mobile number (e.g. 09123456789)"
                  className={`w-full px-3 py-2 rounded-lg border text-xs font-mono transition focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                    isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-[#27272a] border-[#3f3f46] text-[#fafafa]'
                  }`}
                />
              </div>

              {/* CHALLENGE FIELD 3: FIRST NAME */}
              <div className={`p-3 rounded-xl border space-y-1.5 ${
                isLight ? 'bg-white border-slate-200' : 'bg-[#1f1f23] border-[#3f3f46]'
              }`}>
                <div className="flex items-center justify-between">
                  <label className={`block font-bold text-xs ${isLight ? 'text-slate-800' : 'text-zinc-200'}`}>
                    3. Official First Name <span className="text-rose-500">*</span>
                  </label>
                  <span className="font-mono text-[11px] font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                    Preview: {maskName(targetAccount.firstName)}
                  </span>
                </div>
                <input
                  type="text"
                  value={inputFirstName}
                  onChange={(e) => setInputFirstName(e.target.value)}
                  placeholder="Complete your official First Name"
                  className={`w-full px-3 py-2 rounded-lg border text-xs transition focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                    isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-[#27272a] border-[#3f3f46] text-[#fafafa]'
                  }`}
                />
              </div>

              {/* CHALLENGE FIELD 4: LAST NAME */}
              <div className={`p-3 rounded-xl border space-y-1.5 ${
                isLight ? 'bg-white border-slate-200' : 'bg-[#1f1f23] border-[#3f3f46]'
              }`}>
                <div className="flex items-center justify-between">
                  <label className={`block font-bold text-xs ${isLight ? 'text-slate-800' : 'text-zinc-200'}`}>
                    4. Official Last Name <span className="text-rose-500">*</span>
                  </label>
                  <span className="font-mono text-[11px] font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                    Preview: {maskName(targetAccount.lastName)}
                  </span>
                </div>
                <input
                  type="text"
                  value={inputLastName}
                  onChange={(e) => setInputLastName(e.target.value)}
                  placeholder="Complete your official Last Name"
                  className={`w-full px-3 py-2 rounded-lg border text-xs transition focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                    isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-[#27272a] border-[#3f3f46] text-[#fafafa]'
                  }`}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className={`px-4 py-2 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                    isLight ? 'border-slate-300 hover:bg-slate-100 text-slate-700' : 'border-[#3f3f46] bg-[#27272a] hover:bg-[#3f3f46] text-zinc-300'
                  }`}
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !inputUsername || !inputMobile || !inputFirstName || !inputLastName}
                  className="px-5 py-2.5 rounded-xl bg-[#009933] hover:bg-[#00802b] text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-950/40 transition cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Verifying & Submitting...' : 'Submit Request for Temporary PIN'}</span>
                </button>
              </div>
            </form>
          )}

          {/* ============================================================ */}
          {/* STEP 3: SUBMITTED CONFIRMATION & ALARM NOTIFICATION          */}
          {/* ============================================================ */}
          {step === 3 && (
            <div className="space-y-4 py-2 text-center animate-in fade-in">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 text-emerald-500 border border-emerald-500/40 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <h3 className="font-bold text-base sm:text-lg text-emerald-600 dark:text-emerald-400">
                  Temporary PIN Request Submitted!
                </h3>
                <p className={`text-xs mt-1 max-w-sm mx-auto ${isLight ? 'text-slate-600' : 'text-zinc-300'}`}>
                  Your identity details have been successfully verified against official personnel records.
                </p>
              </div>

              {/* Administrator Alarm Status Box */}
              <div className={`p-4 rounded-xl border text-left space-y-2.5 ${
                isLight ? 'bg-rose-50/70 border-rose-200 text-rose-950' : 'bg-rose-950/20 border-rose-500/30 text-rose-200'
              }`}>
                <div className="flex items-center gap-2">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-600"></span>
                  </span>
                  <span className="font-bold text-xs text-rose-600 dark:text-rose-400 uppercase tracking-wider">
                    Emergency Administrator Alarm Active
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  Your designated <strong>Developer, RO Admin, RO Evaluator, or IMO Admin</strong> has been alerted through a bright red indicator. 
                  They will provide your single-use Temporary PIN to your registered mobile phone via <strong>SMS text message</strong> or <strong>verbal communication</strong>.
                </p>
                <div className="pt-1 text-[11px] font-mono text-zinc-400 border-t border-rose-500/20 flex items-center justify-between">
                  <span>Registered Mobile:</span>
                  <span className="font-bold text-rose-600 dark:text-rose-400">
                    {maskMobileNumber(targetAccount?.contactNumber || '')}
                  </span>
                </div>
              </div>

              {/* Instructions for login */}
              <div className={`p-3 rounded-xl border text-[11px] text-left leading-relaxed ${
                isLight ? 'bg-slate-100 border-slate-200 text-slate-700' : 'bg-[#27272a] border-[#3f3f46] text-zinc-300'
              }`}>
                <div className="flex items-center gap-1.5 font-bold mb-1 text-emerald-600 dark:text-emerald-400">
                  <Lock className="w-3.5 h-3.5" />
                  <span>How to Log In Once You Receive Your Temporary PIN:</span>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-[11px]">
                  <li>Enter your username: <span className="font-mono font-bold">@{targetAccount?.username}</span></li>
                  <li>In the password field, enter the <strong>6-digit Temporary PIN</strong> provided by your Admin.</li>
                  <li>The single-use PIN will be immediately deactivated, and you will be prompted to set your new permanent password.</li>
                </ol>
              </div>

              <div className="pt-2 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    handleClose();
                    onOpenLogin();
                  }}
                  className="w-full py-2.5 rounded-xl bg-[#009933] hover:bg-[#00802b] text-white font-bold text-xs shadow-lg shadow-emerald-950/40 transition cursor-pointer active:scale-95"
                >
                  Return to Sign-In Window
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

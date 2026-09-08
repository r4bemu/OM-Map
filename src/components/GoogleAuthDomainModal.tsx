import React, { useState } from 'react';
import { X, ExternalLink, Copy, Check, ShieldCheck, Sparkles, User, Mail, ArrowRight, Settings2, KeyRound } from 'lucide-react';
import { GoogleInitialData } from './GoogleProfileSetupModal';
import { getStoredGoogleClientId, saveStoredGoogleClientId } from '../lib/googleIdentityAuth';

interface GoogleAuthDomainModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenProfileSetup: (data: GoogleInitialData) => void;
  isLight: boolean;
}

export const GoogleAuthDomainModal: React.FC<GoogleAuthDomainModalProps> = ({
  isOpen,
  onClose,
  onOpenProfileSetup,
  isLight,
}) => {
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const [copied, setCopied] = useState(false);
  const [clientId, setClientId] = useState(() => getStoredGoogleClientId());
  const [isSavedClientId, setIsSavedClientId] = useState(false);

  // Direct Google Email sign-in simulation state
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');

  if (!isOpen) return null;

  const handleCopyOrigin = () => {
    navigator.clipboard.writeText(currentOrigin);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveClientId = (e: React.FormEvent) => {
    e.preventDefault();
    saveStoredGoogleClientId(clientId);
    setIsSavedClientId(true);
    setTimeout(() => setIsSavedClientId(false), 2500);
  };

  const handleContinueToSetup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    onOpenProfileSetup({
      email: email.trim(),
      displayName: displayName.trim() || undefined,
      uid: `local-${Date.now()}`
    });
    onClose();
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xl animate-in fade-in ${
      isLight ? 'bg-slate-900/40' : 'bg-slate-950/80'
    }`}>
      <div className={`w-full max-w-2xl rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-colors duration-300 ${
        isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-white'
      }`}>
        {/* Header */}
        <div className={`p-5 border-b flex items-center justify-between ${
          isLight ? 'border-slate-200 bg-emerald-50/60' : 'border-slate-800 bg-emerald-950/20'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-500 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase text-[#009933]">
                  GOOGLE CLOUD IDENTITY SERVICES (GIS)
                </span>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-mono font-bold">
                  Zero Firebase Required
                </span>
              </div>
              <h2 className="text-base font-bold font-heading">
                Native Google OAuth 2.0 Configuration
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className={`p-2 rounded-xl border transition cursor-pointer ${
              isLight ? 'border-slate-300 hover:bg-slate-200 text-slate-600' : 'border-slate-700 hover:bg-slate-800 text-slate-400'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 custom-scrollbar">
          
          {/* Quick Direct Account Entry */}
          <div className={`p-4 sm:p-5 rounded-2xl border ${
            isLight ? 'bg-emerald-50/50 border-emerald-200' : 'bg-emerald-950/15 border-emerald-500/30'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-emerald-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Option 1: Quick Google Account Direct Entry (Immediate)
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              Enter your Google or institutional email to proceed directly to the registration and role request window:
            </p>

            <form onSubmit={handleContinueToSetup} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Google Account / NIA Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. juan.delacruz@gmail.com or official@nia.gov.ph"
                    className={`w-full text-xs rounded-xl pl-9 pr-3 py-2.5 border transition focus:outline-none ${
                      isLight 
                        ? 'bg-white border-slate-300 text-slate-900 focus:border-[#009933]' 
                        : 'bg-slate-900 border-slate-700 text-white focus:border-[#009933]'
                    }`}
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Full Display Name (Optional)
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Juan D. Dela Cruz"
                    className={`w-full text-xs rounded-xl pl-9 pr-3 py-2.5 border transition focus:outline-none ${
                      isLight 
                        ? 'bg-white border-slate-300 text-slate-900 focus:border-[#009933]' 
                        : 'bg-slate-900 border-slate-700 text-white focus:border-[#009933]'
                    }`}
                  />
                </div>
              </div>

              <div className="pt-1">
                <button
                  type="submit"
                  className="w-full bg-[#009933] hover:bg-[#00802b] text-white font-bold text-xs py-2.5 rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Continue to Name, Contact &amp; NIS Access Setup</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          </div>

          {/* Option 2: Google Cloud Console OAuth 2.0 Setup */}
          <div className={`p-4 rounded-2xl border text-xs space-y-3 ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-800/40 border-slate-700'
          }`}>
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-[#009933]" />
              <h4 className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[11px]">
                Option 2: Google Cloud Console OAuth 2.0 Credentials
              </h4>
            </div>

            <p className="text-slate-500">
              When hosting on Cloud Run or localhost, configure your Google Cloud OAuth Client ID:
            </p>

            <ol className="list-decimal list-inside space-y-1.5 text-slate-600 dark:text-slate-400">
              <li>Open <strong>Google Cloud Console → APIs &amp; Services → Credentials</strong>.</li>
              <li>Create or edit an <strong>OAuth 2.0 Client ID</strong> (Web application).</li>
              <li>
                In <strong>Authorized JavaScript origins</strong>, add:
                <span className="inline-flex items-center gap-1 font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded ml-1">
                  {currentOrigin}
                  <button
                    type="button"
                    onClick={handleCopyOrigin}
                    title="Copy Origin"
                    className="cursor-pointer hover:opacity-75"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-500" />}
                  </button>
                </span>
              </li>
            </ol>

            {/* Custom Client ID Input */}
            <form onSubmit={handleSaveClientId} className="pt-2">
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Active Google Cloud OAuth 2.0 Client ID:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="e.g. 123456789-abc.apps.googleusercontent.com"
                  className={`flex-1 text-[11px] font-mono rounded-xl px-3 py-2 border transition focus:outline-none ${
                    isLight ? 'bg-white border-slate-300' : 'bg-slate-900 border-slate-700'
                  }`}
                />
                <button
                  type="submit"
                  className="px-3 py-2 bg-slate-800 dark:bg-slate-700 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold cursor-pointer"
                >
                  {isSavedClientId ? 'Saved!' : 'Save ID'}
                </button>
              </div>
            </form>

            <div className="pt-1">
              <a
                href="https://console.cloud.google.com/apis/credentials"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-[#009933] hover:underline font-semibold cursor-pointer"
              >
                <span>Open Google Cloud Console Credentials</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className={`p-4 border-t flex items-center justify-end text-xs ${
          isLight ? 'border-slate-200 bg-slate-50' : 'border-slate-800 bg-slate-900'
        }`}>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};


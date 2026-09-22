import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  ShieldCheck, 
  ArrowRight, 
  AlertCircle 
} from 'lucide-react';
import { AccessRequest } from '../types';

export interface GoogleInitialData {
  email?: string;
  displayName?: string;
  photoURL?: string;
  uid?: string;
  provider?: 'google' | 'facebook';
  firstName?: string;
  lastName?: string;
}

interface GoogleProfileSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData: GoogleInitialData | null;
  onSubmitRequest: (requestData: Partial<AccessRequest>) => void;
  isLight: boolean;
}

export const ALL_OFFICES = [
  { label: 'Regional Office (Region IV-B)', value: 'Regional Office IV-B', short: 'Regional Office' },
  { label: 'MOMARO IMO', value: 'Mindoro Oriental-Marinduque-Romblon IMO', short: 'MOMARO IMO' },
  { label: 'Occidental Mindoro IMO', value: 'Occidental Mindoro IMO', short: 'Occ. Mindoro IMO' },
  { label: 'Palawan IMO', value: 'Palawan IMO', short: 'Palawan IMO' },
] as const;

export const GoogleProfileSetupModal: React.FC<GoogleProfileSetupModalProps> = ({
  isOpen,
  onClose,
  initialData,
  onSubmitRequest,
  isLight,
}) => {
  // Email input (editable if provider did not yield email)
  const [emailInput, setEmailInput] = useState(initialData?.email || '');

  // Name parts
  const [firstName, setFirstName] = useState('');
  const [middleInitial, setMiddleInitial] = useState('');
  const [lastName, setLastName] = useState('');
  const [extensionName, setExtensionName] = useState('');

  // Contact Number (Strict 11 Digits, e.g. 09123456789)
  const [contactNumber, setContactNumber] = useState('');
  
  // Official NIA Designation
  const [designation, setDesignation] = useState('');

  // Office Selection (Requires active selection from user)
  const [selectedOffice, setSelectedOffice] = useState<string>('');

  // Parse initial name and email from provider data
  useEffect(() => {
    if (initialData) {
      if (initialData.email) {
        setEmailInput(initialData.email);
      }
      if (initialData.firstName) {
        setFirstName(initialData.firstName);
      }
      if (initialData.lastName) {
        setLastName(initialData.lastName);
      }
      if (!initialData.firstName && !initialData.lastName && initialData.displayName) {
        const parts = initialData.displayName.trim().split(/\s+/);
        if (parts.length === 1) {
          setFirstName(parts[0]);
        } else if (parts.length === 2) {
          setFirstName(parts[0]);
          setLastName(parts[1]);
        } else if (parts.length >= 3) {
          setFirstName(parts[0]);
          if (parts[1].length <= 2) {
            setMiddleInitial(parts[1].replace('.', ''));
            setLastName(parts.slice(2).join(' '));
          } else {
            setFirstName(parts.slice(0, -1).join(' '));
            setLastName(parts[parts.length - 1]);
          }
        }
      }
    }
  }, [initialData]);

  // Computed formatted full name for official institutional reports
  const formattedFullName = useMemo(() => {
    const fn = firstName.trim();
    const mi = middleInitial.trim() ? `${middleInitial.trim().replace('.', '')}.` : '';
    const ln = lastName.trim();
    const ext = extensionName.trim() ? `, ${extensionName.trim()}` : '';

    const nameParts = [fn, mi, ln].filter(Boolean).join(' ');
    if (!nameParts) return initialData?.displayName || initialData?.email || 'Authorized Personnel';
    return `${nameParts}${ext}`;
  }, [firstName, middleInitial, lastName, extensionName, initialData]);

  // Determining which authority reviews this request based on selected office
  const approvingAuthorityLabel = useMemo(() => {
    if (!selectedOffice) {
      return 'Respective Office Administrator & Developer';
    }
    if (selectedOffice === 'Regional Office IV-B' || selectedOffice === 'All IMOs') {
      return 'Developer & Regional Office Admin (RO Admin / RO Evaluator)';
    }
    const shortName = selectedOffice.replace('Mindoro Oriental-Marinduque-Romblon IMO', 'MOMARO IMO');
    return `${shortName} Admin / Evaluator, RO Admin & Developer`;
  }, [selectedOffice]);

  // Handle contact input - strict digits only, max 11 digits
  const handleContactChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const digitsOnly = raw.replace(/\D/g, '').slice(0, 11);
    setContactNumber(digitsOnly);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!initialData) return;

    if (!firstName.trim()) {
      alert('Please enter your First Name.');
      return;
    }

    if (!middleInitial.trim()) {
      alert('Please enter your Middle Initial (M.I.).');
      return;
    }

    if (!lastName.trim()) {
      alert('Please enter your Last Name.');
      return;
    }

    if (contactNumber.length < 11 || !contactNumber.startsWith('09')) {
      alert('Please enter a valid 11-digit mobile number starting with 09 (e.g. 09123456789).');
      return;
    }

    if (!designation.trim()) {
      alert('Please enter your official NIA designation.');
      return;
    }

    if (!selectedOffice) {
      alert('Please select your designated NIA office.');
      return;
    }

    const emailToUse = (emailInput || initialData.email || '').toLowerCase().trim();
    if (!emailToUse || !emailToUse.includes('@')) {
      alert('Please enter a valid official email address.');
      return;
    }

    const requestPayload: Partial<AccessRequest> = {
      email: emailToUse,
      firstName: firstName.trim(),
      middleInitial: middleInitial.trim(),
      lastName: lastName.trim(),
      extensionName: extensionName.trim(),
      fullName: formattedFullName,
      contactNumber: contactNumber.trim(),
      designation: designation.trim(),
      requestedOffice: selectedOffice,
      requestedApps: ['Maintenance and Status of Irrigation Facilities'],
      status: 'pending',
      avatar: initialData.photoURL || undefined,
      uid: initialData.uid,
      provider: initialData.provider || 'google'
    };

    onSubmitRequest(requestPayload);
  };

  if (!isOpen || !initialData) return null;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-md animate-in fade-in overflow-y-auto ${
      isLight ? 'bg-slate-900/40' : 'bg-black/75'
    }`}>
      <div className={`w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[92vh] my-auto transition-colors duration-200 ${
        isLight 
          ? 'bg-white border-slate-300 text-slate-900 shadow-slate-900/15' 
          : 'bg-[#18181b] border-[#3f3f46] text-[#fafafa]'
      }`}>
        
        {/* Header - Government Institutional Header */}
        <div className={`p-4 sm:p-5 border-b flex items-center justify-between gap-4 ${
          isLight 
            ? 'border-slate-200 bg-slate-50/90' 
            : 'border-[#3f3f46] bg-[#1f1f23]'
        }`}>
          <div className="flex items-center gap-3.5 min-w-0">
            {initialData.photoURL ? (
              <img
                src={initialData.photoURL}
                alt={initialData.displayName || initialData.email}
                className="w-11 h-11 rounded-xl object-cover shadow-sm shrink-0"
              />
            ) : (
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold font-mono text-sm shrink-0 ${
                isLight ? 'bg-slate-200 text-slate-700' : 'bg-[#27272a] text-zinc-300'
              }`}>
                NIA
              </div>
            )}
            <div className="min-w-0">
              <h2 className={`text-base sm:text-lg font-bold font-heading tracking-tight ${
                isLight ? 'text-slate-900' : 'text-[#fafafa]'
              }`}>
                Personnel Access Registration &amp; Profile Verification
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className={`p-2 rounded-xl border transition cursor-pointer shrink-0 ${
              isLight 
                ? 'border-slate-300 hover:bg-slate-200 text-slate-600' 
                : 'border-[#3f3f46] bg-[#27272a] hover:bg-[#3f3f46] text-zinc-300 hover:text-white'
            }`}
            title="Close Registration Window"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar text-xs">
          
          {/* Complete Name */}
          <div className="space-y-1.5">
            <label className={`block font-bold uppercase tracking-wider text-xs ${isLight ? 'text-slate-900' : 'text-zinc-100'}`}>
              Complete Name <span className="text-rose-500">*</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
              <div className="sm:col-span-4">
                <label className={`block text-[11px] font-semibold mb-1 ${isLight ? 'text-slate-700' : 'text-zinc-300'}`}>
                  First Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="e.g. Juan"
                  className={`w-full rounded-lg px-3 py-2 border transition focus:outline-none ${
                    isLight 
                      ? 'bg-white border-slate-300 text-slate-900 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 placeholder-slate-400' 
                      : 'bg-[#27272a] border-[#3f3f46] text-[#fafafa] focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 placeholder-zinc-500'
                  }`}
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <label className={`block text-[11px] font-semibold mb-1 ${isLight ? 'text-slate-700' : 'text-zinc-300'}`}>
                  M.I. <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  maxLength={4}
                  value={middleInitial}
                  onChange={(e) => setMiddleInitial(e.target.value)}
                  placeholder="e.g. D."
                  className={`w-full rounded-lg px-2.5 py-2 text-center border transition focus:outline-none ${
                    isLight 
                      ? 'bg-white border-slate-300 text-slate-900 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 placeholder-slate-400' 
                      : 'bg-[#27272a] border-[#3f3f46] text-[#fafafa] focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 placeholder-zinc-500'
                  }`}
                  required
                />
              </div>

              <div className="sm:col-span-4">
                <label className={`block text-[11px] font-semibold mb-1 ${isLight ? 'text-slate-700' : 'text-zinc-300'}`}>
                  Last Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="e.g. Dela Cruz"
                  className={`w-full rounded-lg px-3 py-2 border transition focus:outline-none ${
                    isLight 
                      ? 'bg-white border-slate-300 text-slate-900 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 placeholder-slate-400' 
                      : 'bg-[#27272a] border-[#3f3f46] text-[#fafafa] focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 placeholder-zinc-500'
                  }`}
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <label className={`block text-[11px] font-semibold mb-1 ${isLight ? 'text-slate-600' : 'text-zinc-400'}`}>
                  Ext. (Opt.)
                </label>
                <input
                  type="text"
                  value={extensionName}
                  onChange={(e) => setExtensionName(e.target.value)}
                  placeholder="Jr., III"
                  className={`w-full rounded-lg px-2 py-2 text-center border transition focus:outline-none ${
                    isLight 
                      ? 'bg-white border-slate-300 text-slate-900 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 placeholder-slate-400' 
                      : 'bg-[#27272a] border-[#3f3f46] text-[#fafafa] focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 placeholder-zinc-500'
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Official Email Address */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className={`font-bold uppercase tracking-wider text-xs ${isLight ? 'text-slate-900' : 'text-zinc-100'}`}>
                Official Email Address <span className="text-rose-500">*</span>
              </label>
              {initialData?.email && (
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                  isLight ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40'
                }`}>
                  Verified via {initialData.provider === 'facebook' ? 'Facebook' : 'Google'}
                </span>
              )}
            </div>
            <input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="e.g. yourname.nia@gmail.com"
              disabled={Boolean(initialData?.email)}
              className={`w-full rounded-lg px-3 py-2.5 border transition focus:outline-none ${
                initialData?.email
                  ? (isLight ? 'bg-slate-100 text-slate-600 border-slate-300 cursor-not-allowed font-mono' : 'bg-[#202023] text-zinc-400 border-[#3f3f46] cursor-not-allowed font-mono')
                  : (isLight ? 'bg-white border-slate-300 text-slate-900 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 placeholder-slate-400' : 'bg-[#27272a] border-[#3f3f46] text-[#fafafa] focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 placeholder-zinc-500')
              }`}
              required
            />
          </div>

          {/* Official Mobile Number */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className={`font-bold uppercase tracking-wider text-xs ${isLight ? 'text-slate-900' : 'text-zinc-100'}`}>
                Official Mobile Number <span className="text-rose-500">*</span>
              </label>
              <span className={`text-[10.5px] font-mono font-semibold px-2 py-0.5 rounded border ${
                contactNumber.length === 11 && contactNumber.startsWith('09')
                  ? (isLight ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-emerald-950/60 text-emerald-300 border-emerald-500/50')
                  : (isLight ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-[#27272a] text-zinc-400 border-[#3f3f46]')
              }`}>
                {contactNumber.length}/11 Digits
              </span>
            </div>

            <input
              type="text"
              inputMode="numeric"
              maxLength={11}
              value={contactNumber}
              onChange={handleContactChange}
              placeholder="09123456789"
              className={`w-full rounded-lg px-3 py-2.5 border font-mono text-sm tracking-wider transition focus:outline-none ${
                isLight 
                  ? 'bg-white border-slate-300 text-slate-900 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 placeholder-slate-400' 
                  : 'bg-[#27272a] border-[#3f3f46] text-[#fafafa] focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 placeholder-zinc-500'
              }`}
              required
            />
            <p className={`text-[10.5px] leading-relaxed ${isLight ? 'text-slate-600' : 'text-zinc-400'}`}>
              Format: Exactly 11 digits starting with 09 (e.g. <strong className={`font-mono ${isLight ? 'text-slate-800' : 'text-emerald-400'}`}>09123456789</strong>).
            </p>
          </div>

          {/* Official NIA Designation */}
          <div className="space-y-1.5">
            <label className={`block font-bold uppercase tracking-wider text-xs ${isLight ? 'text-slate-900' : 'text-zinc-100'}`}>
              Official NIA Designation <span className="text-rose-500">*</span>
            </label>

            <input
              type="text"
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              placeholder="e.g. Senior Irrigation Engineer, Principal Engineer A, Water Resource Inspector"
              className={`w-full rounded-lg px-3 py-2.5 border transition focus:outline-none ${
                isLight 
                  ? 'bg-white border-slate-300 text-slate-900 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 placeholder-slate-400' 
                  : 'bg-[#27272a] border-[#3f3f46] text-[#fafafa] focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 placeholder-zinc-500'
              }`}
              required
            />
          </div>

          {/* Designated NIA Office */}
          <div className="space-y-1.5">
            <label className={`block font-bold uppercase tracking-wider text-xs ${isLight ? 'text-slate-900' : 'text-zinc-100'}`}>
              Designated NIA Office <span className="text-rose-500">*</span>
            </label>

            <select
              value={selectedOffice}
              onChange={(e) => setSelectedOffice(e.target.value)}
              required
              className={`w-full rounded-lg px-3 py-2.5 border transition focus:outline-none font-medium ${
                isLight 
                  ? 'bg-white border-slate-300 text-slate-900 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600' 
                  : 'bg-[#27272a] border-[#3f3f46] text-[#fafafa] focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'
              }`}
            >
              <option value="" disabled className={isLight ? 'bg-white text-slate-500' : 'bg-[#27272a] text-zinc-500'}>
                -- Select Your Designated NIA Office * --
              </option>
              {ALL_OFFICES.map((off) => (
                <option 
                  key={off.value} 
                  value={off.value}
                  className={isLight ? 'bg-white text-slate-900' : 'bg-[#27272a] text-[#fafafa]'}
                >
                  {off.label}
                </option>
              ))}
            </select>
          </div>

          {/* Institutional Jurisdiction Notice - Placed after Designated NIA Office and before Submit Button */}
          <div className={`p-3.5 rounded-xl border flex items-start gap-2.5 mt-2 ${
            isLight 
              ? 'bg-amber-50/90 border-amber-300 text-amber-950' 
              : 'bg-amber-950/25 border-amber-500/40 text-amber-200'
          }`}>
            <AlertCircle className={`w-4 h-4 shrink-0 mt-0.5 ${isLight ? 'text-amber-700' : 'text-amber-400'}`} />
            <div className="leading-relaxed">
              <span className={`font-bold ${isLight ? 'text-amber-900' : 'text-amber-300'}`}>Administrative Verification:</span>
              <p className={`text-[11px] mt-0.5 ${isLight ? 'text-amber-950/90' : 'text-zinc-300'}`}>
                Your submitted profile details will be forwarded to{' '}
                <strong className={`underline font-semibold ${isLight ? 'text-amber-950' : 'text-amber-300'}`}>{approvingAuthorityLabel}</strong> for identity verification and role assignment.
              </p>
            </div>
          </div>

          {/* Action Buttons - White dividing line removed */}
          <div className="pt-2 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2.5 rounded-xl border font-semibold transition cursor-pointer ${
                isLight 
                  ? 'border-slate-300 text-slate-700 hover:bg-slate-100' 
                  : 'border-[#3f3f46] bg-[#27272a] text-zinc-300 hover:bg-[#3f3f46] hover:text-white'
              }`}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer border border-emerald-700/60"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Submit Profile &amp; Request Access</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
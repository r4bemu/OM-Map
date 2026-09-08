import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  User, 
  Mail, 
  Phone,
  Building2, 
  ShieldCheck, 
  CheckSquare, 
  Square, 
  Sparkles, 
  ArrowRight, 
  Check, 
  Briefcase,
  AlertCircle,
  Clock,
  Layers,
  CheckCircle2,
  Lock
} from 'lucide-react';
import { AccessRequest } from '../types';

export interface GoogleInitialData {
  email: string;
  displayName?: string;
  photoURL?: string;
  uid?: string;
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

export interface AvailableApp {
  id: string;
  name: string;
  category: string;
  description: string;
  isPrimary?: boolean;
}

export const AVAILABLE_APPLICATIONS: AvailableApp[] = [
  {
    id: 'app-om-map',
    name: 'Maintenance and Status of Irrigation Facilities',
    category: 'GIS & Field Operations',
    description: 'Real-time canal network maps, facility condition monitoring, and spatial operations.',
    isPrimary: true
  },
  {
    id: 'app-interventions',
    name: 'NIA-Assisted Interventions Report Generator',
    category: 'Institutional Development & Reporting',
    description: 'IDU agricultural interventions tracking, matrix calculations, and official PDF/Excel reporting.'
  },
  {
    id: 'app-form-691',
    name: 'Form 691 Operations & Automated Reporting',
    category: 'Institutional Reporting',
    description: 'Monthly irrigation status, crop yield, and official regional report compilation.'
  },
  {
    id: 'app-canal-gis',
    name: 'Canal Networks & Asset Inventory GIS',
    category: 'Engineering & Infrastructure',
    description: 'Spatial inventory of structures, control gates, flumes, and canal sections.'
  },
  {
    id: 'app-idp-portal',
    name: 'Institutional Development Program (IDP) & IA Portal',
    category: 'Institutional Development',
    description: 'Irrigators Association (IA) profiles, federation records, and farmer engagement.'
  },
  {
    id: 'app-heavy-equipment',
    name: 'Equipment & Heavy Machinery Tracking',
    category: 'Asset Management',
    description: 'Backhoe, excavator, and dredger equipment deployment and maintenance logs.'
  }
];

export const GoogleProfileSetupModal: React.FC<GoogleProfileSetupModalProps> = ({
  isOpen,
  onClose,
  initialData,
  onSubmitRequest,
  isLight,
}) => {
  // Name parts
  const [firstName, setFirstName] = useState('');
  const [middleInitial, setMiddleInitial] = useState('');
  const [lastName, setLastName] = useState('');
  const [extensionName, setExtensionName] = useState('');

  // Contact Number (Strict 11 Digits, e.g. 09123456789)
  const [contactNumber, setContactNumber] = useState('');
  
  // Official NIA Designation / Position
  const [designation, setDesignation] = useState('');

  // Office Selection
  const [selectedOffice, setSelectedOffice] = useState<string>('Regional Office IV-B');

  // Applications Access Choice (Default with Primary App checked)
  const [selectedApps, setSelectedApps] = useState<string[]>([
    'Maintenance and Status of Irrigation Facilities'
  ]);
  const [isAllApps, setIsAllApps] = useState(false);

  // Parse initial name from Google displayName
  useEffect(() => {
    if (initialData && initialData.displayName) {
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

  const toggleAppSelection = (appName: string) => {
    if (isAllApps) {
      setIsAllApps(false);
      setSelectedApps(AVAILABLE_APPLICATIONS.map(a => a.name).filter(n => n !== appName));
    } else {
      setSelectedApps(prev => {
        const next = prev.includes(appName) 
          ? prev.filter(n => n !== appName) 
          : [...prev, appName];
        if (next.length === AVAILABLE_APPLICATIONS.length) {
          setIsAllApps(true);
        }
        return next;
      });
    }
  };

  const handleToggleAllApps = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setIsAllApps(checked);
    if (checked) {
      setSelectedApps(AVAILABLE_APPLICATIONS.map(a => a.name));
    } else {
      setSelectedApps(['Maintenance and Status of Irrigation Facilities']);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!initialData) return;

    if (contactNumber.length < 11 || !contactNumber.startsWith('09')) {
      alert('Please enter a valid 11-digit mobile number starting with 09 (e.g. 09123456789).');
      return;
    }

    if (selectedApps.length === 0) {
      alert('Please select at least one application you require access to.');
      return;
    }

    const email = initialData.email.toLowerCase().trim();

    const requestPayload: Partial<AccessRequest> = {
      email: email,
      firstName: firstName.trim(),
      middleInitial: middleInitial.trim(),
      lastName: lastName.trim(),
      extensionName: extensionName.trim(),
      fullName: formattedFullName,
      contactNumber: contactNumber.trim(),
      designation: designation.trim() || 'Authorized NIA Personnel',
      requestedOffice: selectedOffice,
      requestedApps: selectedApps,
      status: 'pending',
      avatar: initialData.photoURL || undefined,
      uid: initialData.uid
    };

    onSubmitRequest(requestPayload);
  };

  if (!isOpen || !initialData) return null;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-md animate-in fade-in overflow-y-auto ${
      isLight ? 'bg-slate-900/40' : 'bg-slate-950/85'
    }`}>
      <div className={`w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[92vh] my-auto transition-colors duration-200 ${
        isLight ? 'bg-white border-slate-300 text-slate-900 shadow-slate-900/15' : 'bg-slate-900 border-slate-800 text-white'
      }`}>
        
        {/* Header - Government Institutional Header */}
        <div className={`p-4 sm:p-5 border-b flex items-center justify-between ${
          isLight ? 'border-slate-200 bg-emerald-50/60' : 'border-slate-800 bg-slate-900/90'
        }`}>
          <div className="flex items-center gap-3">
            {initialData.photoURL ? (
              <img
                src={initialData.photoURL}
                alt={initialData.displayName || initialData.email}
                className="w-10 h-10 rounded-xl object-cover border border-[#009933]/50 shadow-sm shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-700 font-bold font-mono text-xs shrink-0">
                NIA
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#00802b]">
                  NATIONAL IRRIGATION ADMINISTRATION
                </span>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-800 dark:text-amber-300 font-mono font-bold flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" />
                  Approval Workflow
                </span>
              </div>
              <h2 className="text-base font-bold font-heading text-slate-900 dark:text-white">
                Personnel Profile &amp; Jurisdiction Details
              </h2>
              <p className="text-[11px] text-slate-500 truncate max-w-[280px] sm:max-w-md">
                Connected Google ID: <strong className="font-mono text-slate-700 dark:text-slate-300">{initialData.email}</strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className={`p-2 rounded-lg border transition cursor-pointer ${
              isLight ? 'border-slate-300 hover:bg-slate-200 text-slate-600' : 'border-slate-700 hover:bg-slate-800 text-slate-400'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar text-xs">
          
          {/* Institutional Jurisdiction Notice */}
          <div className={`p-3 rounded-xl border flex items-start gap-2.5 ${
            isLight ? 'bg-amber-50/80 border-amber-200 text-amber-900' : 'bg-amber-950/20 border-amber-500/30 text-amber-300'
          }`}>
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-bold">Administrative Verification:</span>
              <p className="text-[11px] opacity-90 mt-0.5">
                Your submitted details and selected applications will be forwarded to{' '}
                <strong className="underline font-semibold">{approvingAuthorityLabel}</strong> for identity verification and role assignment.
              </p>
            </div>
          </div>

          {/* Section 1: Complete Name */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <User className="w-4 h-4 text-[#009933]" />
              <label className="font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                1. Complete Name <span className="text-rose-500">*</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
              <div className="sm:col-span-4">
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  First Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="e.g. Juan"
                  className={`w-full rounded-lg px-3 py-2 border transition focus:outline-none ${
                    isLight 
                      ? 'bg-white border-slate-300 text-slate-900 focus:border-[#009933] focus:ring-1 focus:ring-[#009933]' 
                      : 'bg-slate-800/80 border-slate-700 text-white focus:border-[#009933]'
                  }`}
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  M.I.
                </label>
                <input
                  type="text"
                  maxLength={4}
                  value={middleInitial}
                  onChange={(e) => setMiddleInitial(e.target.value)}
                  placeholder="e.g. D."
                  className={`w-full rounded-lg px-2.5 py-2 text-center border transition focus:outline-none ${
                    isLight 
                      ? 'bg-white border-slate-300 text-slate-900 focus:border-[#009933]' 
                      : 'bg-slate-800/80 border-slate-700 text-white focus:border-[#009933]'
                  }`}
                />
              </div>

              <div className="sm:col-span-4">
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Last Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="e.g. Dela Cruz"
                  className={`w-full rounded-lg px-3 py-2 border transition focus:outline-none ${
                    isLight 
                      ? 'bg-white border-slate-300 text-slate-900 focus:border-[#009933] focus:ring-1 focus:ring-[#009933]' 
                      : 'bg-slate-800/80 border-slate-700 text-white focus:border-[#009933]'
                  }`}
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Ext. (Opt.)
                </label>
                <input
                  type="text"
                  value={extensionName}
                  onChange={(e) => setExtensionName(e.target.value)}
                  placeholder="Jr., III"
                  className={`w-full rounded-lg px-2 py-2 text-center border transition focus:outline-none ${
                    isLight 
                      ? 'bg-white border-slate-300 text-slate-900 focus:border-[#009933]' 
                      : 'bg-slate-800/80 border-slate-700 text-white focus:border-[#009933]'
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Section 2: Clean 11-digit Mobile Number (No spaces, hyphens, or dashes) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Phone className="w-4 h-4 text-[#009933]" />
                <label className="font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  2. Official Mobile Number <span className="text-rose-500">*</span>
                </label>
              </div>
              <span className={`text-[10.5px] font-mono font-semibold px-2 py-0.5 rounded ${
                contactNumber.length === 11 && contactNumber.startsWith('09')
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-slate-100 text-slate-600 border border-slate-200'
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
                  ? 'bg-white border-slate-300 text-slate-900 focus:border-[#009933] focus:ring-1 focus:ring-[#009933]' 
                  : 'bg-slate-800/80 border-slate-700 text-white focus:border-[#009933]'
              }`}
              required
            />
            <p className="text-[10.5px] text-slate-500">
              Format: Exactly 11 digits starting with 09 (e.g. <strong className="font-mono text-slate-700 dark:text-slate-300">09123456789</strong>). Hyphens and spaces are automatically excluded for automated SMS systems.
            </p>
          </div>

          {/* Section 3: Official NIA Designation / Position (Clean Text Input) */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Briefcase className="w-4 h-4 text-[#009933]" />
              <label className="font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                3. Official NIA Designation / Position <span className="text-rose-500">*</span>
              </label>
            </div>

            <input
              type="text"
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              placeholder="e.g. Senior Irrigation Engineer, Principal Engineer A, Water Resource Inspector"
              className={`w-full rounded-lg px-3 py-2.5 border transition focus:outline-none ${
                isLight 
                  ? 'bg-white border-slate-300 text-slate-900 focus:border-[#009933] focus:ring-1 focus:ring-[#009933]' 
                  : 'bg-slate-800/80 border-slate-700 text-white focus:border-[#009933]'
              }`}
              required
            />
          </div>

          {/* Section 4: Designated Office */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-[#009933]" />
              <label className="font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                4. Designated Office <span className="text-rose-500">*</span>
              </label>
            </div>

            <select
              value={selectedOffice}
              onChange={(e) => setSelectedOffice(e.target.value)}
              className={`w-full rounded-lg px-3 py-2.5 border transition focus:outline-none font-medium ${
                isLight 
                  ? 'bg-white border-slate-300 text-slate-900 focus:border-[#009933]' 
                  : 'bg-slate-800/80 border-slate-700 text-white focus:border-[#009933]'
              }`}
            >
              {ALL_OFFICES.map((off) => (
                <option key={off.value} value={off.value}>
                  {off.label}
                </option>
              ))}
            </select>
          </div>

          {/* Section 5: Choice of Applications to have Access with */}
          <div className="space-y-2 pt-1 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-[#009933]" />
                <label className="font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  5. Applications Access Request <span className="text-rose-500">*</span>
                </label>
              </div>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                isLight ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}>
                {selectedApps.length} of {AVAILABLE_APPLICATIONS.length} Apps Selected
              </span>
            </div>

            {/* Master Checkbox */}
            <div className={`p-2.5 rounded-xl border flex items-center justify-between ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-800/40 border-slate-700'
            }`}>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isAllApps}
                  onChange={handleToggleAllApps}
                  className="w-4 h-4 rounded text-[#009933] focus:ring-[#009933] cursor-pointer"
                />
                <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
                  Select All Platform Applications
                </span>
              </label>
              <span className="text-[10.5px] text-slate-500 font-mono">Full Suite Access</span>
            </div>

            {/* Applications List */}
            <div className="space-y-2">
              {AVAILABLE_APPLICATIONS.map((app) => {
                const isSelected = isAllApps || selectedApps.includes(app.name);
                return (
                  <button
                    key={app.id}
                    type="button"
                    onClick={() => toggleAppSelection(app.name)}
                    className={`w-full p-3 rounded-xl border text-left transition flex items-start justify-between gap-3 cursor-pointer ${
                      isSelected
                        ? (isLight 
                            ? 'bg-emerald-50/70 border-emerald-500/60 shadow-sm' 
                            : 'bg-emerald-950/20 border-emerald-500/50')
                        : (isLight 
                            ? 'bg-white border-slate-200 hover:bg-slate-50' 
                            : 'bg-slate-800/40 border-slate-700/80 hover:bg-slate-800')
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`font-bold text-xs ${
                          isSelected 
                            ? (isLight ? 'text-emerald-950' : 'text-emerald-200') 
                            : (isLight ? 'text-slate-800' : 'text-slate-200')
                        }`}>
                          {app.name}
                        </span>
                        {app.isPrimary && (
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded font-bold uppercase bg-[#009933] text-white">
                            Active GIS
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 leading-snug">
                        {app.description}
                      </p>
                    </div>

                    <div className="mt-0.5 shrink-0">
                      {isSelected ? (
                        <div className="w-5 h-5 rounded-md bg-[#009933] flex items-center justify-center text-white shadow-sm">
                          <Check className="w-3.5 h-3.5" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2.5 rounded-xl border font-semibold transition cursor-pointer ${
                isLight ? 'border-slate-300 text-slate-700 hover:bg-slate-100' : 'border-slate-700 text-slate-300 hover:bg-slate-800'
              }`}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="flex-1 bg-[#009933] hover:bg-[#00802b] text-white font-bold py-3 px-4 rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer border border-[#00802b]/60"
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
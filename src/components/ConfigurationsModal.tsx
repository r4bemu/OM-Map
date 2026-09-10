import React, { useState, useEffect } from 'react';
import { 
  X, 
  Settings, 
  Camera, 
  HardDrive, 
  MapPin, 
  Check, 
  RotateCcw, 
  Sliders, 
  Compass, 
  Info,
  Maximize2,
  FileText,
  UserCheck,
  Building2,
  FileSignature,
  Layers,
  Sparkles,
  ShieldCheck,
  User
} from 'lucide-react';
import { 
  AppConfigurations, 
  getSavedConfigurations, 
  saveConfigurations, 
  DEFAULT_CONFIGURATIONS,
  RESOLUTION_CAP_OPTIONS,
  DIMENSION_OPTIONS
} from '../utils/appConfigurations';
import {
  UserSignatoriesProfile,
  getUserSignatories,
  saveUserSignatories,
  resetUserSignatoriesToDefault,
  DEFAULT_WMR_SIGNATORIES,
  DEFAULT_PHOTO_DOC_SIGNATORIES,
  DEFAULT_INSPECTION_SIGNATORIES
} from '../utils/signatoriesConfig';
import { AuthUser, UserRole } from '../types';

interface ConfigurationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: AuthUser | null;
  currentRole?: UserRole;
}

export const ConfigurationsModal: React.FC<ConfigurationsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  currentRole
}) => {
  const [activeMainTab, setActiveMainTab] = useState<'signatories' | 'system'>('signatories');
  const [activeReportTab, setActiveReportTab] = useState<'wmr' | 'photoDoc' | 'inspectionReport'>('wmr');

  const [config, setConfig] = useState<AppConfigurations>(getSavedConfigurations);
  const [signatories, setSignatories] = useState<UserSignatoriesProfile>(() => 
    getUserSignatories(currentUser?.id, currentUser)
  );

  const [savedSuccessNotice, setSavedSuccessNotice] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setConfig(getSavedConfigurations());
      setSignatories(getUserSignatories(currentUser?.id, currentUser));
      setSavedSuccessNotice(null);
    }
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    // 1. Save App System Configurations
    saveConfigurations(config);

    // 2. Save User-Specific Signatories Profile
    const userId = currentUser?.id || 'default_user';
    saveUserSignatories(userId, signatories);

    setSavedSuccessNotice('All configurations and report signatories saved successfully!');
    setTimeout(() => {
      setSavedSuccessNotice(null);
      onClose();
    }, 900);
  };

  const handleResetCurrentTab = () => {
    if (activeMainTab === 'system') {
      setConfig(DEFAULT_CONFIGURATIONS);
      saveConfigurations(DEFAULT_CONFIGURATIONS);
      setSavedSuccessNotice('System photo & map configurations reset to defaults.');
    } else {
      const userId = currentUser?.id || 'default_user';
      const resetProfile = resetUserSignatoriesToDefault(userId, currentUser);
      setSignatories(resetProfile);
      setSavedSuccessNotice('Report signatories reset to institutional standard.');
    }

    setTimeout(() => {
      setSavedSuccessNotice(null);
    }, 1800);
  };

  // Helper updater for nested signatory state
  const updateSignatory = (
    reportType: 'wmr' | 'photoDoc' | 'inspectionReport',
    field: string,
    value: string
  ) => {
    setSignatories(prev => ({
      ...prev,
      [reportType]: {
        ...prev[reportType],
        [field]: value
      }
    }));
  };

  const userNameDisplay = currentUser?.name || currentUser?.username || 'Current User';
  const userRoleDisplay = currentRole || currentUser?.role || 'Field Personnel';

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-slate-900/98 backdrop-blur-2xl border border-slate-700/80 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col my-auto animate-in zoom-in-95 duration-150 text-left max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-3.5 sm:p-4 border-b border-slate-700/80 flex items-center justify-between shrink-0 bg-slate-800/90">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
              <Sliders className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-100 font-heading flex items-center gap-2">
                <span>System Configurations &amp; Signatories</span>
              </h2>
              <p className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                <span>Active Profile:</span>
                <strong className="text-cyan-300 font-semibold">{userNameDisplay}</strong>
                <span className="text-slate-500">•</span>
                <span className="text-slate-300 font-mono text-[10px]">{userRoleDisplay}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main Tab Bar */}
        <div className="flex items-center border-b border-slate-700/80 bg-slate-950/60 px-4 pt-2 gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveMainTab('signatories')}
            className={`flex items-center gap-2 px-3.5 py-2.5 font-bold text-xs rounded-t-xl transition border-b-2 cursor-pointer ${
              activeMainTab === 'signatories'
                ? 'border-cyan-400 text-cyan-300 bg-slate-900/80 shadow-sm'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <FileSignature className="w-4 h-4 text-cyan-400" />
            <span>Report Signatories (Per User)</span>
            <span className="text-[9.5px] px-1.5 py-0.2 rounded-full bg-cyan-500/20 text-cyan-300 font-mono">
              3 Reports
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMainTab('system')}
            className={`flex items-center gap-2 px-3.5 py-2.5 font-bold text-xs rounded-t-xl transition border-b-2 cursor-pointer ${
              activeMainTab === 'system'
                ? 'border-[#166534] text-[#166534] dark:text-emerald-300 bg-slate-900/80 shadow-sm'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <Camera className="w-4 h-4 text-emerald-400" />
            <span>Photo &amp; Map Settings</span>
          </button>
        </div>

        {/* Body Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
          
          {/* Saved Success Notice Banner */}
          {savedSuccessNotice && (
            <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-xs animate-in fade-in">
              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>{savedSuccessNotice}</span>
            </div>
          )}

          {/* =========================================================================
              TAB 1: REPORT SIGNATORIES CONFIGURATION
             ========================================================================= */}
          {activeMainTab === 'signatories' && (
            <div className="space-y-4">
              {/* Report Sub-Tabs Navigation */}
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-1.5 flex flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() => setActiveReportTab('wmr')}
                  className={`flex-1 min-w-[150px] py-2 px-2.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeReportTab === 'wmr'
                      ? 'bg-cyan-600 text-white shadow-md'
                      : 'text-slate-300 hover:bg-slate-700/60 hover:text-white'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>1. Weekly Maint. (Form 691)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveReportTab('photoDoc')}
                  className={`flex-1 min-w-[150px] py-2 px-2.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeReportTab === 'photoDoc'
                      ? 'bg-cyan-600 text-white shadow-md'
                      : 'text-slate-300 hover:bg-slate-700/60 hover:text-white'
                  }`}
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>2. Photo Documentation</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveReportTab('inspectionReport')}
                  className={`flex-1 min-w-[150px] py-2 px-2.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeReportTab === 'inspectionReport'
                      ? 'bg-cyan-600 text-white shadow-md'
                      : 'text-slate-300 hover:bg-slate-700/60 hover:text-white'
                  }`}
                >
                  <FileCheckIcon className="w-3.5 h-3.5" />
                  <span>3. Field Inspection &amp; Ledger</span>
                </button>
              </div>

              {/* Notice Box */}
              <div className="p-3 bg-cyan-950/30 border border-cyan-500/30 rounded-xl text-slate-300 text-[11px] leading-relaxed flex items-start gap-2.5">
                <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  Signatories configured here are saved specifically for <strong className="text-cyan-300">{userNameDisplay}</strong> and will automatically populate PDF exports, weekly Form 691 packages, photo attachments, and single inspection reports without needing to re-type them on every submission.
                </div>
              </div>

              {/* SUB-TAB 1: Weekly Maintenance Report (Form 691) */}
              {activeReportTab === 'wmr' && (
                <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-4 space-y-4 animate-in fade-in duration-150">
                  <div className="border-b border-slate-700/80 pb-2 flex items-center justify-between">
                    <h3 className="font-bold text-slate-100 text-xs uppercase tracking-wider flex items-center gap-2">
                      <FileText className="w-4 h-4 text-cyan-400" />
                      <span>Form 691 Weekly Maintenance Report Signatories</span>
                    </h3>
                    <span className="text-[10px] text-slate-400 font-mono">Landscape Tabular Package</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    {/* Prepared By */}
                    <div className="bg-slate-900/60 border border-slate-700/80 rounded-xl p-3 space-y-2">
                      <label className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider block">
                        1. Prepared By
                      </label>
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-400">Full Name</span>
                        <input
                          type="text"
                          value={signatories.wmr.preparedByName}
                          onChange={(e) => updateSignatory('wmr', 'preparedByName', e.target.value)}
                          placeholder="e.g. Aljohn L. Soco / May Hyacinthe Anne N. Pechon"
                          className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-400 text-white text-xs p-2 rounded-lg focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-400">Official Designation / Title</span>
                        <input
                          type="text"
                          value={signatories.wmr.preparedByTitle}
                          onChange={(e) => updateSignatory('wmr', 'preparedByTitle', e.target.value)}
                          placeholder="e.g. Foreman A / Engineer A / Senior Engineer A"
                          className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-400 text-white text-xs p-2 rounded-lg focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Reviewed By */}
                    <div className="bg-slate-900/60 border border-slate-700/80 rounded-xl p-3 space-y-2">
                      <label className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block">
                        2. Reviewed / Checked By
                      </label>
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-400">Full Name</span>
                        <input
                          type="text"
                          value={signatories.wmr.reviewedByName}
                          onChange={(e) => updateSignatory('wmr', 'reviewedByName', e.target.value)}
                          placeholder="e.g. Daniel Angelo M. Malabanan / Emelito V. Urriquia"
                          className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 text-white text-xs p-2 rounded-lg focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-400">Official Designation / Title</span>
                        <input
                          type="text"
                          value={signatories.wmr.reviewedByTitle}
                          onChange={(e) => updateSignatory('wmr', 'reviewedByTitle', e.target.value)}
                          placeholder="e.g. Principal Engineer A / Senior Engineer A"
                          className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 text-white text-xs p-2 rounded-lg focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Noted By */}
                    <div className="bg-slate-900/60 border border-slate-700/80 rounded-xl p-3 space-y-2">
                      <label className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block">
                        3. Noted / Approved By
                      </label>
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-400">Full Name</span>
                        <input
                          type="text"
                          value={signatories.wmr.notedByName}
                          onChange={(e) => updateSignatory('wmr', 'notedByName', e.target.value)}
                          placeholder="e.g. Maria Victoria O. Malenab / Mary Grace B. Cartagena"
                          className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-400 text-white text-xs p-2 rounded-lg focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-400">Official Designation / Title</span>
                        <input
                          type="text"
                          value={signatories.wmr.notedByTitle}
                          onChange={(e) => updateSignatory('wmr', 'notedByTitle', e.target.value)}
                          placeholder="e.g. Division Manager A / Principal Engineer C"
                          className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-400 text-white text-xs p-2 rounded-lg focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Initials Note & Document / Footnotes Settings */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
                    <div className="bg-slate-900/60 border border-slate-700/80 rounded-xl p-3 space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                        Form Routing Initials
                      </label>
                      <textarea
                        rows={2}
                        value={signatories.wmr.initialsNote || ''}
                        onChange={(e) => updateSignatory('wmr', 'initialsNote', e.target.value)}
                        placeholder="e.g. MLRN -&#10;LMM -"
                        className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-400 text-white text-xs p-2 rounded-lg focus:outline-none font-mono"
                      />
                    </div>

                    <div className="bg-slate-900/60 border border-slate-700/80 rounded-xl p-3 space-y-1.5">
                      <label className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider block">
                        Document / Form No.
                      </label>
                      <input
                        type="text"
                        value={signatories.wmr.documentNo || 'NIA-RO4B-EOD-OPS-INT-Form691 Rev.01'}
                        onChange={(e) => updateSignatory('wmr', 'documentNo', e.target.value)}
                        placeholder="e.g. NIA-RO4B-EOD-OPS-INT-Form691 Rev.01"
                        className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-400 text-white text-xs p-2 rounded-lg focus:outline-none font-mono"
                      />
                    </div>

                    <div className="bg-slate-900/60 border border-slate-700/80 rounded-xl p-3 space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                        Custom Footnote / Memo
                      </label>
                      <input
                        type="text"
                        value={signatories.wmr.customFootnote || ''}
                        onChange={(e) => updateSignatory('wmr', 'customFootnote', e.target.value)}
                        placeholder="Optional footer memo"
                        className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-400 text-white text-xs p-2 rounded-lg focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* SUB-TAB 2: Photo Documentation Report */}
              {activeReportTab === 'photoDoc' && (
                <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-4 space-y-4 animate-in fade-in duration-150">
                  <div className="border-b border-slate-700/80 pb-2 flex items-center justify-between">
                    <h3 className="font-bold text-slate-100 text-xs uppercase tracking-wider flex items-center gap-2">
                      <Camera className="w-4 h-4 text-cyan-400" />
                      <span>Photo Documentation Report Signatories</span>
                    </h3>
                    <span className="text-[10px] text-slate-400 font-mono">Form 691 Photo Attachment</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    {/* Inspected By */}
                    <div className="bg-slate-900/60 border border-slate-700/80 rounded-xl p-3 space-y-2">
                      <label className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider block">
                        1. Inspected / Prepared By
                      </label>
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-400">Full Name</span>
                        <input
                          type="text"
                          value={signatories.photoDoc.preparedByName}
                          onChange={(e) => updateSignatory('photoDoc', 'preparedByName', e.target.value)}
                          placeholder="e.g. Aljohn L. Soco / May Hyacinthe Anne N. Pechon"
                          className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-400 text-white text-xs p-2 rounded-lg focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-400">Designation / Title</span>
                        <input
                          type="text"
                          value={signatories.photoDoc.preparedByTitle}
                          onChange={(e) => updateSignatory('photoDoc', 'preparedByTitle', e.target.value)}
                          placeholder="e.g. Foreman A / Engineer A / Senior Engineer A"
                          className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-400 text-white text-xs p-2 rounded-lg focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Verified By */}
                    <div className="bg-slate-900/60 border border-slate-700/80 rounded-xl p-3 space-y-2">
                      <label className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block">
                        2. Verified / Reviewed By
                      </label>
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-400">Full Name</span>
                        <input
                          type="text"
                          value={signatories.photoDoc.reviewedByName}
                          onChange={(e) => updateSignatory('photoDoc', 'reviewedByName', e.target.value)}
                          placeholder="e.g. Daniel Angelo M. Malabanan / Emelito V. Urriquia"
                          className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 text-white text-xs p-2 rounded-lg focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-400">Designation / Title</span>
                        <input
                          type="text"
                          value={signatories.photoDoc.reviewedByTitle}
                          onChange={(e) => updateSignatory('photoDoc', 'reviewedByTitle', e.target.value)}
                          placeholder="e.g. Principal Engineer A / Senior Engineer A"
                          className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 text-white text-xs p-2 rounded-lg focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Noted By */}
                    <div className="bg-slate-900/60 border border-slate-700/80 rounded-xl p-3 space-y-2">
                      <label className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block">
                        3. Noted / Approved By
                      </label>
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-400">Full Name</span>
                        <input
                          type="text"
                          value={signatories.photoDoc.notedByName}
                          onChange={(e) => updateSignatory('photoDoc', 'notedByName', e.target.value)}
                          placeholder="e.g. Maria Victoria O. Malenab / Mary Grace B. Cartagena"
                          className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-400 text-white text-xs p-2 rounded-lg focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-400">Designation / Title</span>
                        <input
                          type="text"
                          value={signatories.photoDoc.notedByTitle}
                          onChange={(e) => updateSignatory('photoDoc', 'notedByTitle', e.target.value)}
                          placeholder="e.g. Division Manager A / Principal Engineer C"
                          className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-400 text-white text-xs p-2 rounded-lg focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Document No. & Custom Footnote Settings */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                    <div className="bg-slate-900/60 border border-slate-700/80 rounded-xl p-3 space-y-2">
                      <label className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider block">
                        Document / Form No. (Bottom Right Footer)
                      </label>
                      <input
                        type="text"
                        value={signatories.photoDoc.documentNo || 'NIA-RO4B-EOD-OPS-INT-Form691 Rev.01'}
                        onChange={(e) => updateSignatory('photoDoc', 'documentNo', e.target.value)}
                        placeholder="e.g. NIA-RO4B-EOD-OPS-INT-Form691 Rev.01"
                        className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-400 text-white text-xs p-2 rounded-lg focus:outline-none font-mono"
                      />
                      <span className="text-[9.5px] text-slate-400 italic block">
                        Displayed in Calibri, Italic format on the report footer.
                      </span>
                    </div>

                    <div className="bg-slate-900/60 border border-slate-700/80 rounded-xl p-3 space-y-2">
                      <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                        Custom Footnote / Memo (Optional)
                      </label>
                      <input
                        type="text"
                        value={signatories.photoDoc.customFootnote || ''}
                        onChange={(e) => updateSignatory('photoDoc', 'customFootnote', e.target.value)}
                        placeholder="Optional custom text or memo on report footer"
                        className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-400 text-white text-xs p-2 rounded-lg focus:outline-none"
                      />
                      <span className="text-[9.5px] text-slate-400 italic block">
                        Leave empty to display only the Document No. and Page #.
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* SUB-TAB 3: Field Inspection Report (Single & Summary) */}
              {activeReportTab === 'inspectionReport' && (
                <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-4 space-y-4 animate-in fade-in duration-150">
                  <div className="border-b border-slate-700/80 pb-2 flex items-center justify-between">
                    <h3 className="font-bold text-slate-100 text-xs uppercase tracking-wider flex items-center gap-2">
                      <FileCheckIcon className="w-4 h-4 text-cyan-400" />
                      <span>Single Field Inspection &amp; Summary Ledger Signatories</span>
                    </h3>
                    <span className="text-[10px] text-slate-400 font-mono">Portrait A4 Document</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    {/* Submitted By */}
                    <div className="bg-slate-900/60 border border-slate-700/80 rounded-xl p-3 space-y-2">
                      <label className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider block">
                        1. Submitted / Prepared By
                      </label>
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-400">Full Name</span>
                        <input
                          type="text"
                          value={signatories.inspectionReport.preparedByName}
                          onChange={(e) => updateSignatory('inspectionReport', 'preparedByName', e.target.value)}
                          placeholder="e.g. Field Submitter Name"
                          className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-400 text-white text-xs p-2 rounded-lg focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-400">Designation / Role</span>
                        <input
                          type="text"
                          value={signatories.inspectionReport.preparedByTitle}
                          onChange={(e) => updateSignatory('inspectionReport', 'preparedByTitle', e.target.value)}
                          placeholder="e.g. Water Resource Officer / Field Personnel"
                          className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-400 text-white text-xs p-2 rounded-lg focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Verified By */}
                    <div className="bg-slate-900/60 border border-slate-700/80 rounded-xl p-3 space-y-2">
                      <label className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block">
                        2. Verified By (Supervisor)
                      </label>
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-400">Full Name</span>
                        <input
                          type="text"
                          value={signatories.inspectionReport.verifiedByName}
                          onChange={(e) => updateSignatory('inspectionReport', 'verifiedByName', e.target.value)}
                          placeholder="e.g. Aljohn L. Soco / Michelle F. Abila / Ave Jane V. Alvarado"
                          className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 text-white text-xs p-2 rounded-lg focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-400">Designation / Role</span>
                        <input
                          type="text"
                          value={signatories.inspectionReport.verifiedByTitle}
                          onChange={(e) => updateSignatory('inspectionReport', 'verifiedByTitle', e.target.value)}
                          placeholder="e.g. Foreman A / Engineer A / Senior Engineer A"
                          className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 text-white text-xs p-2 rounded-lg focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Approved By */}
                    <div className="bg-slate-900/60 border border-slate-700/80 rounded-xl p-3 space-y-2">
                      <label className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block">
                        3. Approved By
                      </label>
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-400">Full Name</span>
                        <input
                          type="text"
                          value={signatories.inspectionReport.approvedByName}
                          onChange={(e) => updateSignatory('inspectionReport', 'approvedByName', e.target.value)}
                          placeholder="e.g. Daniel Angelo M. Malabanan / Emelito V. Urriquia"
                          className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-400 text-white text-xs p-2 rounded-lg focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-400">Designation / Role</span>
                        <input
                          type="text"
                          value={signatories.inspectionReport.approvedByTitle}
                          onChange={(e) => updateSignatory('inspectionReport', 'approvedByTitle', e.target.value)}
                          placeholder="e.g. Principal Engineer A / Division Manager A"
                          className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-400 text-white text-xs p-2 rounded-lg focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Document No. & Custom Footnote Settings */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                    <div className="bg-slate-900/60 border border-slate-700/80 rounded-xl p-3 space-y-2">
                      <label className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider block">
                        Document / Form No. (Bottom Left Footer)
                      </label>
                      <input
                        type="text"
                        value={signatories.inspectionReport.documentNo || 'NIA-RO4B-EOD-OPS-INT-Form691 Rev.01'}
                        onChange={(e) => updateSignatory('inspectionReport', 'documentNo', e.target.value)}
                        placeholder="e.g. NIA-RO4B-EOD-OPS-INT-Form691 Rev.01"
                        className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-400 text-white text-xs p-2 rounded-lg focus:outline-none font-mono"
                      />
                      <span className="text-[9.5px] text-slate-400 italic block">
                        Displayed in Calibri, Italic format below the Report ID.
                      </span>
                    </div>

                    <div className="bg-slate-900/60 border border-slate-700/80 rounded-xl p-3 space-y-2">
                      <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                        Custom Footnote / Office Memo (Center Footer)
                      </label>
                      <input
                        type="text"
                        value={signatories.inspectionReport.customFootnote || ''}
                        onChange={(e) => updateSignatory('inspectionReport', 'customFootnote', e.target.value)}
                        placeholder="Optional custom text or memo on report footer"
                        className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-400 text-white text-xs p-2 rounded-lg focus:outline-none"
                      />
                      <span className="text-[9.5px] text-slate-400 italic block">
                        Leave empty to display only the Document No. and Page #.
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* =========================================================================
              TAB 2: SYSTEM PHOTO & MAP SETTINGS
             ========================================================================= */}
          {activeMainTab === 'system' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Photo Resolution Cap & Compression */}
              <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-700/80 pb-2">
                  <div className="flex items-center gap-2 text-slate-100 font-bold text-xs uppercase tracking-wider">
                    <Camera className="w-4 h-4 text-emerald-400" />
                    <span>Site Inspection Photo Resolution Cap</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono font-bold">
                    Permanent
                  </span>
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Select the default compression ceiling applied when capturing or uploading field inspection photos for Form 691 reports.
                </p>

                {/* Resolution Cap Radio Stack */}
                <div className="space-y-1.5 pt-1">
                  {RESOLUTION_CAP_OPTIONS.map((opt) => {
                    const isSelected = config.photoResolutionCapBytes === opt.value;
                    return (
                      <label
                        key={opt.value}
                        onClick={() => setConfig(prev => ({ ...prev, photoResolutionCapBytes: opt.value }))}
                        className={`flex items-start gap-2.5 p-2.5 rounded-xl border transition cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-500/15 border-emerald-500/60 ring-1 ring-emerald-500/30'
                            : 'bg-slate-900/60 border-slate-700/80 hover:bg-slate-800/80 hover:border-slate-600'
                        }`}
                      >
                        <input
                          type="radio"
                          name="photoResolutionCap"
                          value={opt.value}
                          checked={isSelected}
                          onChange={() => setConfig(prev => ({ ...prev, photoResolutionCapBytes: opt.value }))}
                          className="mt-0.5 accent-emerald-600 cursor-pointer"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className={`font-bold text-xs ${isSelected ? 'text-emerald-300' : 'text-slate-200'}`}>
                              {opt.label}
                            </span>
                            {opt.value === 300 * 1024 && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold shrink-0">
                                Standard
                              </span>
                            )}
                          </div>
                          <p className="text-[10.5px] text-slate-400 mt-0.5 leading-tight">
                            {opt.desc}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>

                {/* Canvas Dimension Selector */}
                <div className="pt-2 border-t border-slate-700/80 space-y-1">
                  <label className="text-[11px] font-bold text-slate-300 uppercase flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Maximize2 className="w-3.5 h-3.5 text-slate-400" />
                      <span>Maximum Photo Dimensions</span>
                    </span>
                  </label>
                  <select
                    value={config.photoMaxDimensionPx}
                    onChange={(e) => setConfig(prev => ({ ...prev, photoMaxDimensionPx: Number(e.target.value) }))}
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 transition cursor-pointer"
                  >
                    {DIMENSION_OPTIONS.map(d => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Auto GPS Geotagging & Map Preferences */}
              <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-700/80 pb-2">
                  <div className="flex items-center gap-2 text-slate-100 font-bold text-xs uppercase tracking-wider">
                    <Compass className="w-4 h-4 text-emerald-400" />
                    <span>GPS &amp; Map Startup Focus</span>
                  </div>
                </div>

                {/* Auto GPS Extraction Toggle */}
                <div className="flex items-center justify-between p-2.5 bg-slate-900/60 border border-slate-700/80 rounded-xl">
                  <div className="space-y-0.5 pr-2">
                    <div className="font-bold text-xs text-slate-200">Auto-detect GPS from Photo EXIF</div>
                    <div className="text-[10.5px] text-slate-400">
                      Automatically pinpoints canal coordinates and IMO office from photo metadata.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.autoGpsTagging}
                    onChange={(e) => setConfig(prev => ({ ...prev, autoGpsTagging: e.target.checked }))}
                    className="w-4 h-4 accent-emerald-600 cursor-pointer shrink-0"
                  />
                </div>

                {/* Map Default Startup Focus */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300 uppercase block">
                    Map Default Startup View
                  </label>
                  <select
                    value={config.mapDefaultStartupView}
                    onChange={(e) => setConfig(prev => ({ ...prev, mapDefaultStartupView: e.target.value as any }))}
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 transition cursor-pointer"
                  >
                    <option value="user_location">User's GPS / Last Known Location (Fastest reporting start)</option>
                    <option value="all_layers">Full Regional Boundary (Zoom out to all GIS layers)</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3.5 sm:p-4 border-t border-slate-700/80 shrink-0 bg-slate-800/90 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleResetCurrentTab}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-slate-100 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition border border-slate-700 cursor-pointer"
            title="Reset active tab configurations to official standards"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset {activeMainTab === 'signatories' ? 'Signatories' : 'Settings'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-slate-100 rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl text-xs shadow-md border border-cyan-400/50 flex items-center gap-1.5 transition cursor-pointer active:scale-95"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Save Configurations</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

function FileCheckIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg 
      {...props} 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>
      <path d="M14 2v4a2 2 0 0 0 2 2h4"/>
      <path d="m9 15 2 2 4-4"/>
    </svg>
  );
}

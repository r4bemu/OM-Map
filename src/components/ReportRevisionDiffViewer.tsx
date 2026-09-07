import React, { useState, useMemo } from 'react';
import { 
  X, 
  GitCompare, 
  Clock, 
  User, 
  CheckCircle2, 
  ArrowRight, 
  AlertCircle, 
  FileText, 
  MapPin, 
  Ruler, 
  Layers, 
  Camera, 
  RotateCcw, 
  Sparkles, 
  ChevronRight, 
  ShieldCheck,
  Edit3,
  CornerDownLeft,
  Activity
} from 'lucide-react';
import { FieldReport, UserRole, AuthUser, ReportRevision, FieldDiffItem, ApprovalTier } from '../types';
import { 
  getEffectiveReportTier, 
  getTierLabel, 
  getTierBadgeStyle, 
  canUserAdvanceTier, 
  canUserEditReport, 
  computeFieldDiffs,
  ORDERED_APPROVAL_TIERS,
  TIER_CONFIG
} from '../utils/approvalHierarchyEngine';

interface ReportRevisionDiffViewerProps {
  isOpen: boolean;
  onClose: () => void;
  report: FieldReport | null;
  currentRole: UserRole;
  currentUser: AuthUser | null;
  onAdvanceTier?: (report: FieldReport, nextTier: ApprovalTier, comment?: string) => Promise<void> | void;
  onRequestRevision?: (report: FieldReport, reason: string) => Promise<void> | void;
  onEditRevision?: (report: FieldReport, snapshot: Partial<FieldReport>) => void;
}

export const ReportRevisionDiffViewer: React.FC<ReportRevisionDiffViewerProps> = ({
  isOpen,
  onClose,
  report,
  currentRole,
  currentUser,
  onAdvanceTier,
  onRequestRevision,
  onEditRevision
}) => {
  if (!isOpen || !report) return null;

  const effectiveTier = getEffectiveReportTier(report);
  const revisionsList: ReportRevision[] = useMemo(() => {
    if (Array.isArray(report.revisions) && report.revisions.length > 0) {
      return report.revisions;
    }
    // If no revisions exist yet, construct baseline version 1 from current report
    return [{
      revisionNumber: 1,
      createdAt: report.createdAt || new Date().toISOString(),
      createdBy: report.reporterName || 'Field Personnel',
      createdById: report.submittedByUserId,
      createdRole: report.submittedByRole || 'Field Personnel',
      changeSummary: 'Initial field submission',
      snapshot: { ...report }
    }];
  }, [report]);

  const maxRevNumber = revisionsList[revisionsList.length - 1]?.revisionNumber || 1;
  const initialBaseRev = revisionsList.length > 1 ? revisionsList[revisionsList.length - 2].revisionNumber : 1;

  const [revANum, setRevANum] = useState<number>(initialBaseRev);
  const [revBNum, setRevBNum] = useState<number>(maxRevNumber);
  const [activeCategory, setActiveCategory] = useState<'all' | 'location' | 'measurement' | 'status' | 'general' | 'photos'>('all');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showReturnModal, setShowReturnModal] = useState<boolean>(false);
  const [returnReason, setReturnReason] = useState<string>('');

  const revA = useMemo(() => {
    return revisionsList.find(r => r.revisionNumber === revANum) || revisionsList[0];
  }, [revisionsList, revANum]);

  const revB = useMemo(() => {
    return revisionsList.find(r => r.revisionNumber === revBNum) || revisionsList[revisionsList.length - 1];
  }, [revisionsList, revBNum]);

  // Compute field diffs between Revision A and Revision B
  const computedDiffs: FieldDiffItem[] = useMemo(() => {
    if (!revA || !revB) return [];
    if (revA.revisionNumber === revB.revisionNumber) return [];
    return computeFieldDiffs(revA.snapshot, revB.snapshot);
  }, [revA, revB]);

  const filteredDiffs = useMemo(() => {
    if (activeCategory === 'all') return computedDiffs;
    return computedDiffs.filter(d => d.category === activeCategory);
  }, [computedDiffs, activeCategory]);

  const advanceCheck = canUserAdvanceTier(report, currentUser, currentRole);
  const editCheck = canUserEditReport(report, currentUser, currentRole);

  const handleAdvance = async () => {
    if (!advanceCheck.allowed || !advanceCheck.nextTier || !onAdvanceTier) return;
    setIsSubmitting(true);
    try {
      await onAdvanceTier(report, advanceCheck.nextTier, `Approved at ${getTierLabel(effectiveTier)}`);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReturnForRevision = async () => {
    if (!returnReason.trim() || !onRequestRevision) return;
    setIsSubmitting(true);
    try {
      await onRequestRevision(report, returnReason.trim());
      setShowReturnModal(false);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentStageIndex = ORDERED_APPROVAL_TIERS.indexOf(effectiveTier);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md overflow-hidden animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-4 sm:px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-400 shrink-0">
              <GitCompare className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-white truncate">
                  {report.maintenanceActivity || report.title}
                </h2>
                <span className={`text-[11px] px-2.5 py-0.5 rounded-full border ${getTierBadgeStyle(effectiveTier)}`}>
                  {getTierLabel(effectiveTier)}
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                  {revisionsList.length} {revisionsList.length === 1 ? 'Version' : 'Revisions'}
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate mt-0.5 flex items-center gap-1.5">
                <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                <span>{report.canalSegment || report.nisBinding || 'Canal Station'} • {report.imoOffice || 'IMO Office'}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer shrink-0"
            title="Close viewer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 7-Tier Institutional Progress Stepper */}
        <div className="px-4 sm:px-6 py-3 bg-slate-950/60 border-b border-slate-800 overflow-x-auto shrink-0">
          <div className="flex items-center justify-between min-w-[700px] gap-2">
            {ORDERED_APPROVAL_TIERS.map((tier, idx) => {
              const isPast = currentStageIndex > idx;
              const isCurrent = effectiveTier === tier;
              const config = TIER_CONFIG[tier];

              return (
                <React.Fragment key={tier}>
                  <div className="flex flex-col items-center gap-1 shrink-0">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      isPast 
                        ? 'bg-emerald-500 text-white shadow-sm' 
                        : isCurrent 
                          ? 'bg-[#009933] text-white ring-4 ring-[#009933]/30 scale-105' 
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}>
                      {isPast ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                    </div>
                    <span className={`text-[10px] whitespace-nowrap font-medium ${
                      isCurrent ? 'text-white font-bold' : isPast ? 'text-slate-300' : 'text-slate-400'
                    }`}>
                      {config.shortLabel}
                    </span>
                  </div>
                  {idx < ORDERED_APPROVAL_TIERS.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-1 transition-all ${
                      isPast ? 'bg-emerald-500' : 'bg-slate-800'
                    }`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Version Selector Bar */}
        <div className="p-3 sm:p-4 bg-slate-900/90 border-b border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3 shrink-0">
          {/* Baseline Version (A) */}
          <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] uppercase font-bold text-rose-400 tracking-wider flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>Base Version (Old)</span>
              </span>
              <select
                value={revANum}
                onChange={e => setRevANum(Number(e.target.value))}
                className="bg-slate-900 border border-slate-700 text-xs text-white px-2.5 py-1 rounded-lg focus:outline-none focus:border-rose-400 cursor-pointer"
              >
                {revisionsList.map(r => (
                  <option key={r.revisionNumber} value={r.revisionNumber}>
                    Version {r.revisionNumber} ({new Date(r.createdAt).toLocaleDateString()})
                  </option>
                ))}
              </select>
            </div>
            <div className="text-xs text-slate-300 flex items-center justify-between">
              <span className="font-medium text-white">{revA.createdBy} ({revA.createdRole})</span>
              <span className="text-[11px] text-slate-400 font-mono">{new Date(revA.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            {revA.changeSummary && (
              <p className="text-[11px] text-slate-400 italic truncate">"{revA.changeSummary}"</p>
            )}
          </div>

          {/* Revised Version (B) */}
          <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Revised Version (New)</span>
              </span>
              <select
                value={revBNum}
                onChange={e => setRevBNum(Number(e.target.value))}
                className="bg-slate-900 border border-slate-700 text-xs text-white px-2.5 py-1 rounded-lg focus:outline-none focus:border-emerald-400 cursor-pointer"
              >
                {revisionsList.map(r => (
                  <option key={r.revisionNumber} value={r.revisionNumber}>
                    Version {r.revisionNumber} ({new Date(r.createdAt).toLocaleDateString()}) {r.revisionNumber === maxRevNumber ? '(Latest)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="text-xs text-slate-300 flex items-center justify-between">
              <span className="font-medium text-white">{revB.createdBy} ({revB.createdRole})</span>
              <span className="text-[11px] text-slate-400 font-mono">{new Date(revB.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            {revB.changeSummary && (
              <p className="text-[11px] text-slate-400 italic truncate">"{revB.changeSummary}"</p>
            )}
          </div>
        </div>

        {/* Changes Summary Banner & Category Pills */}
        <div className="px-4 py-2.5 bg-slate-950/40 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-teal-400" />
              <span>{computedDiffs.length === 0 ? 'No field differences' : `${computedDiffs.length} Modified Field${computedDiffs.length === 1 ? '' : 's'}`}</span>
            </span>
          </div>

          <div className="flex items-center gap-1 overflow-x-auto text-[11px]">
            {(['all', 'location', 'measurement', 'status', 'general', 'photos'] as const).map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`px-2.5 py-1 rounded-lg capitalize transition cursor-pointer font-medium ${
                  activeCategory === cat 
                    ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40' 
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Diff Comparison Body */}
        <div className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-6 space-y-3">
          {revANum === revBNum ? (
            <div className="p-8 text-center bg-slate-950/50 rounded-xl border border-slate-800 space-y-2">
              <GitCompare className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-sm font-semibold text-white">Comparing Version {revANum} with itself</p>
              <p className="text-xs text-slate-400">Select a different base or revised version from the dropdowns above to view differences.</p>
            </div>
          ) : filteredDiffs.length === 0 ? (
            <div className="p-8 text-center bg-slate-950/50 rounded-xl border border-slate-800 space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
              <p className="text-sm font-semibold text-white">No differences found in this category</p>
              <p className="text-xs text-slate-400">Version {revANum} and Version {revBNum} have identical values for selected fields.</p>
            </div>
          ) : (
            filteredDiffs.map(diff => (
              <div 
                key={diff.fieldName}
                className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2 hover:border-slate-700 transition"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    {diff.category === 'location' && <MapPin className="w-3.5 h-3.5 text-blue-400" />}
                    {diff.category === 'measurement' && <Ruler className="w-3.5 h-3.5 text-amber-400" />}
                    {diff.category === 'status' && <Activity className="w-3.5 h-3.5 text-purple-400" />}
                    {diff.category === 'general' && <FileText className="w-3.5 h-3.5 text-emerald-400" />}
                    {diff.category === 'photos' && <Camera className="w-3.5 h-3.5 text-pink-400" />}
                    <span>{diff.fieldLabel}</span>
                  </span>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                    {diff.category}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {/* Previous Value */}
                  <div className="p-2.5 rounded-lg bg-rose-950/30 border border-rose-900/40 text-rose-200">
                    <span className="text-[10px] uppercase font-bold text-rose-400 block mb-0.5">v{revANum} Value:</span>
                    <span className="line-through font-mono">{String(diff.oldValue || '— (Empty)')}</span>
                  </div>

                  {/* New Revised Value */}
                  <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-900/40 text-emerald-200">
                    <span className="text-[10px] uppercase font-bold text-emerald-400 block mb-0.5">v{revBNum} Revised Value:</span>
                    <span className="font-bold font-mono">{String(diff.newValue || '— (Empty)')}</span>
                  </div>
                </div>
              </div>
            ))
          )}

          {/* Side-by-side Photo Previews (if photo attachments exist) */}
          {((Array.isArray(revA.snapshot.photos) && revA.snapshot.photos.length > 0) || 
            (Array.isArray(revB.snapshot.photos) && revB.snapshot.photos.length > 0)) && (
            <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-3">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-pink-400" />
                <span>Photo Documentation Comparison</span>
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Rev A Photos */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-rose-300">v{revANum} Attachments:</span>
                  <div className="flex gap-2 flex-wrap">
                    {(revA.snapshot.photos || []).map((p, idx) => (
                      <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden border border-slate-700 bg-slate-900 flex items-center justify-center">
                        <img 
                          src={p.url} 
                          alt={p.stage || 'Photo'} 
                          className="w-full h-full object-cover" 
                          onError={(e) => {
                            const target = e.currentTarget;
                            target.style.display = 'none';
                            const parent = target.parentElement;
                            if (parent && !parent.querySelector('.rev-img-fallback')) {
                              const fallback = document.createElement('div');
                              fallback.className = 'rev-img-fallback w-full h-full flex flex-col items-center justify-center text-slate-500 text-[9px] text-center p-1 bg-slate-900';
                              fallback.innerHTML = '<span>📷</span><span class="text-[8px] leading-none text-slate-400">Offline</span>';
                              parent.prepend(fallback);
                            }
                          }}
                        />
                        <span className="absolute bottom-0 inset-x-0 bg-black/70 text-[9px] text-white text-center py-0.5 font-semibold">
                          {p.stage || 'Stage'}
                        </span>
                      </div>
                    ))}
                    {(!revA.snapshot.photos || revA.snapshot.photos.length === 0) && (
                      <span className="text-xs text-slate-500 italic">No photos in v{revANum}</span>
                    )}
                  </div>
                </div>

                {/* Rev B Photos */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-emerald-300">v{revBNum} Attachments:</span>
                  <div className="flex gap-2 flex-wrap">
                    {(revB.snapshot.photos || []).map((p, idx) => (
                      <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden border border-emerald-500/50 bg-slate-900 shadow-md flex items-center justify-center">
                        <img 
                          src={p.url} 
                          alt={p.stage || 'Photo'} 
                          className="w-full h-full object-cover" 
                          onError={(e) => {
                            const target = e.currentTarget;
                            target.style.display = 'none';
                            const parent = target.parentElement;
                            if (parent && !parent.querySelector('.rev-img-fallback')) {
                              const fallback = document.createElement('div');
                              fallback.className = 'rev-img-fallback w-full h-full flex flex-col items-center justify-center text-slate-500 text-[9px] text-center p-1 bg-slate-900';
                              fallback.innerHTML = '<span>📷</span><span class="text-[8px] leading-none text-slate-400">Offline</span>';
                              parent.prepend(fallback);
                            }
                          }}
                        />
                        <span className="absolute bottom-0 inset-x-0 bg-black/70 text-[9px] text-white text-center py-0.5 font-semibold">
                          {p.stage || 'Stage'}
                        </span>
                      </div>
                    ))}
                    {(!revB.snapshot.photos || revB.snapshot.photos.length === 0) && (
                      <span className="text-xs text-slate-500 italic">No photos in v{revBNum}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Action Footer */}
        <div className="px-4 sm:px-6 py-3.5 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-400">
            {advanceCheck.allowed ? (
              <span className="text-emerald-400 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Authorized to advance this report to next institutional stage.</span>
              </span>
            ) : (
              <span>Viewing as <strong>{currentRole}</strong> • {getTierLabel(effectiveTier)}</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {onRequestRevision && effectiveTier !== 'Approved_RO_Evaluator' && currentRole !== 'Viewer' && currentRole !== 'Field Personnel' && (
              <button
                type="button"
                onClick={() => setShowReturnModal(true)}
                disabled={isSubmitting}
                className="px-3 py-1.5 bg-rose-950/60 hover:bg-rose-900/80 text-rose-200 border border-rose-800/60 rounded-xl text-xs font-semibold transition inline-flex items-center gap-1.5 cursor-pointer"
              >
                <CornerDownLeft className="w-3.5 h-3.5" />
                <span>Return for Revision</span>
              </button>
            )}

            {onEditRevision && editCheck.allowed && (
              <button
                type="button"
                onClick={() => {
                  onEditRevision(report, revB.snapshot);
                  onClose();
                }}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 rounded-xl text-xs font-semibold transition inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5 text-cyan-400" />
                <span>{editCheck.mode === 'create_revision' ? 'Create New Revision' : 'Edit Report'}</span>
              </button>
            )}

            {advanceCheck.allowed && (
              <button
                type="button"
                onClick={handleAdvance}
                disabled={isSubmitting}
                className="px-4 py-1.5 bg-[#15803d] hover:bg-[#16a34a] text-white rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5 shadow-lg cursor-pointer disabled:opacity-50"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{advanceCheck.actionLabel || 'Approve & Advance'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>

        {/* Return for Revision Feedback Modal Sub-Overlay */}
        {showReturnModal && (
          <div className="absolute inset-0 bg-black/85 z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 w-full max-w-md space-y-4 shadow-2xl">
              <div className="flex items-center gap-2 text-rose-400">
                <AlertCircle className="w-5 h-5" />
                <h3 className="text-sm font-bold text-white">Return Report for Submitter Revision</h3>
              </div>
              <p className="text-xs text-slate-300">
                Please provide actionable feedback explaining the discrepancies or corrections required by the submitter:
              </p>
              <textarea
                value={returnReason}
                onChange={e => setReturnReason(e.target.value)}
                placeholder="e.g. Please verify the measured canal depth between station 0+150 and 0+450..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-400 h-28 resize-none"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowReturnModal(false)}
                  className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-xl text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleReturnForRevision}
                  disabled={!returnReason.trim() || isSubmitting}
                  className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  Confirm &amp; Return
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

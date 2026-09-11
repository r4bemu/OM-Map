import React, { useEffect, useRef, useState } from 'react';
import { 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  MapPin, 
  User, 
  FileText, 
  Plus, 
  ShieldCheck, 
  Check, 
  Ban, 
  FileCheck2,
  Sparkles,
  Ruler,
  Edit3,
  Camera,
  Eye,
  FileDown,
  Loader2
} from 'lucide-react';
import { FieldReport, UserRole, ApprovalStatus, AuthUser } from '../types';
import { downloadReportPdf } from '../utils/reportPdfBuilder';
import { isSyntheticFeatureId } from '../utils/gisLocationUtils';
import { resolvePhotoAttachmentUrl, handleImageFallback } from '../utils/photoUtils';

interface AttributeInspectorProps {
  authenticatedUser?: AuthUser | null;
  selectedFeatureProps?: any;
  selectedFeatureType?: string;
  selectedReport?: FieldReport;
  coords?: [number, number];
  onClose: () => void;
  onOpenReportForFeature: (canalSegment?: string, parcelId?: string, coords?: [number, number]) => void;
  onEditReport?: (report: FieldReport) => void;
  onOpenReportsSummary?: () => void;
  onViewOfficialReport?: (tab: 'form691' | 'photos', report?: FieldReport) => void;
  onPreviewReportPdf?: (report: FieldReport) => void;
  currentRole: UserRole;
  onApproveReport?: (reportId: string, action: 'pre_approve' | 'final_approve' | 'reject', reason?: string) => void;
  isPickingLocation?: boolean;
}

export function canUserEditReport(user: AuthUser | null | undefined, role: UserRole, report: FieldReport): boolean {
  if (!report) return false;
  const normRole = (user?.role || role);
  if (normRole === 'Viewer' || role === 'Viewer') return false;

  // Master Developer has unrestricted edit authority over all reports
  if (role === 'Developer' || user?.role === 'Developer') return true;

  // Regional Evaluator / Reviewer / Admin (Access to all IMOs) has unrestricted edit authority over reports
  const isRegionalAuthority = (role === 'RO Admin' || role === 'RO Evaluator' || role === 'RO Reviewer' || user?.role === 'RO Admin' || user?.role === 'RO Evaluator' || user?.role === 'RO Reviewer') && 
    (!user?.imoOffice || user.imoOffice === 'All IMOs' || user.imoOffice === 'Regional Office IV-B' || user.imoOffice === 'Regional Office');
  if (isRegionalAuthority) return true;

  // Check IMO Scope for assigned users
  const userImo = (user?.imoOffice || '').toLowerCase();
  const reportImo = (report.imoOffice || '').toLowerCase();
  if (userImo && userImo !== 'all imos' && userImo !== 'regional office iv-b' && userImo !== 'regional office') {
    const matchesImo = reportImo.includes(userImo) || userImo.includes(reportImo);
    if (!matchesImo && reportImo) return false;
  }

  // Check NIS Scope if user has a specific assigned NIS
  const userNis = (user?.nisBinding || '').toLowerCase();
  const reportNis = (report.nisBinding || report.canalSegment || '').toLowerCase();
  if (userNis && userNis !== 'all nis' && userNis !== '') {
    const matchesNis = reportNis.includes(userNis) || userNis.includes(reportNis);
    if (!matchesNis && reportNis) return false;
  }

  const approval = report.approvalStatus || 'Pending_PreApproval';

  // IMO Admin, IMO Evaluator & IMO Reviewer can edit until Approved & Published
  if (role === 'IMO Admin' || role === 'IMO Evaluator' || role === 'IMO Reviewer') {
    return approval !== 'Approved';
  }

  // Preparer roles can edit until preapproved/approved
  if (role === 'IMO Preparer' || role === 'RO Preparer') {
    return approval !== 'Approved';
  }

  // Field Personnel can edit ONLY IF not yet pre-approved
  if (role === 'Field Personnel') {
    return approval === 'Pending_PreApproval' || approval === 'Draft' || approval === 'Rejected' || !report.approvalStatus;
  }

  return false;
}

export const AttributeInspector: React.FC<AttributeInspectorProps> = ({
  authenticatedUser,
  selectedFeatureProps,
  selectedFeatureType,
  selectedReport,
  coords,
  onClose,
  onOpenReportForFeature,
  onEditReport,
  onOpenReportsSummary,
  onViewOfficialReport,
  onPreviewReportPdf,
  currentRole,
  onApproveReport,
  isPickingLocation = false
}) => {
  const inspectorRef = useRef<HTMLElement>(null);
  const [rejectReasonPrompt, setRejectReasonPrompt] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  useEffect(() => {
    if (!selectedFeatureProps && !selectedReport) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedFeatureProps, selectedReport, onClose]);

  if (!selectedFeatureProps && !selectedReport) return null;

  const getFeatureHeadingName = (props: any): string => {
    if (!props) return 'Feature Details';
    const keys = ['Name', 'name', 'NAME', 'remarks', 'Remarks', 'canal_name', 'parcel_name', 'station_name', 'title', 'Title', 'label', 'parcel_id', 'station_code', 'canal_type', 'owner_name', 'lot_code', 'NIS', 'source_layer'];
    for (const k of keys) {
      if (props[k] !== undefined && props[k] !== null && String(props[k]).trim() !== '') {
        const val = String(props[k]).trim();
        if (!isSyntheticFeatureId(val) && val.toLowerCase() !== 'null' && val.toLowerCase() !== 'undefined') {
          return val;
        }
      }
    }
    return 'Feature Details';
  };

  const title = selectedReport
    ? selectedReport.title
    : getFeatureHeadingName(selectedFeatureProps);

  const canalCode = selectedFeatureProps?.canal_code || selectedReport?.canalSegment;
  const parcelId = selectedFeatureProps?.parcel_id || selectedReport?.parcelId;

  // Approval Pipeline State Helpers
  const approvalStatus: ApprovalStatus = selectedReport?.approvalStatus || 'Approved';

  const getApprovalBadge = (status: ApprovalStatus) => {
    switch (status) {
      case 'Pending_PreApproval':
        return {
          label: 'Pending Pre-Approval',
          color: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
          icon: <Clock className="w-3.5 h-3.5 text-amber-400" />,
          desc: 'Awaiting review from O&M Engineer'
        };
      case 'PreApproved':
        return {
          label: 'Pre-Approved (Level 1)',
          color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
          icon: <FileCheck2 className="w-3.5 h-3.5 text-cyan-400" />,
          desc: `Pre-approved by ${selectedReport?.preApprovedBy || 'O&M Engineer'}`
        };
      case 'Approved':
        return {
          label: 'Approved & Published',
          color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />,
          desc: `Final approval by ${selectedReport?.approvedBy || 'Admin'}`
        };
      case 'Rejected':
        return {
          label: 'Rejected / Revision Needed',
          color: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
          icon: <Ban className="w-3.5 h-3.5 text-rose-400" />,
          desc: selectedReport?.rejectionReason || 'Requires revision'
        };
      case 'Draft':
        return {
          label: 'Draft',
          color: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
          icon: <FileText className="w-3.5 h-3.5 text-slate-400" />,
          desc: 'Local unsubmitted draft'
        };
    }
  };

  const badge = getApprovalBadge(approvalStatus);

  // Determine if active user can perform approvals
  const canPreApprove = (currentRole === 'IMO Reviewer' || currentRole === 'IMO Evaluator' || currentRole === 'IMO Admin' || currentRole === 'RO Reviewer' || currentRole === 'RO Evaluator' || currentRole === 'RO Admin' || currentRole === 'Developer') && (approvalStatus === 'Pending_PreApproval' || !selectedReport?.approvalStatus);
  const canFinalApprove = (currentRole === 'RO Admin' || currentRole === 'RO Evaluator' || currentRole === 'IMO Admin' || currentRole === 'IMO Evaluator' || currentRole === 'Developer') && (approvalStatus === 'PreApproved' || approvalStatus === 'Pending_PreApproval' || !selectedReport?.approvalStatus);

  const handlePreApprove = () => {
    if (selectedReport && onApproveReport) {
      onApproveReport(selectedReport.id, 'pre_approve');
    }
  };

  const handleFinalApprove = () => {
    if (selectedReport && onApproveReport) {
      onApproveReport(selectedReport.id, 'final_approve');
    }
  };

  const handleConfirmReject = () => {
    if (selectedReport && onApproveReport) {
      onApproveReport(selectedReport.id, 'reject', rejectReason.trim() || 'Submission requires correction or field re-verification.');
      setRejectReasonPrompt(false);
      setRejectReason('');
    }
  };

  return (
    <aside
      ref={inspectorRef}
      className="fixed sm:absolute bottom-16 sm:bottom-6 left-2 right-2 sm:left-auto sm:right-4 z-30 w-auto sm:w-96 max-h-[70vh] sm:max-h-[calc(100vh-8rem)] bg-slate-900/98 backdrop-blur-xl border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4"
    >
      {/* Mobile Top Drag Indicator */}
      <div className="sm:hidden flex justify-center pt-2 pb-1 bg-slate-900/90">
        <div className="w-10 h-1 rounded-full bg-slate-700" />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 sm:p-4 border-b border-slate-800 bg-slate-900/80">
        <div className="min-w-0 pr-2">
          <span className="text-[10px] uppercase tracking-wider font-bold text-cyan-400">
            {selectedReport ? 'Field Work Report' : selectedFeatureType || 'Spatial Feature'}
          </span>
          <h2 className="text-sm font-bold text-white font-heading break-words leading-tight">{title}</h2>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {/* Field Report Detail View */}
        {selectedReport && (
          <div className="space-y-3">
            
            {/* Two-Tier Approval Pipeline Status Badge */}
            <div className="p-3 rounded-xl border bg-slate-800/60 border-slate-700/60 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Approval Workflow</span>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1.5 ${badge.color}`}>
                  {badge.icon}
                  <span>{badge.label}</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-300">{badge.desc}</p>
            </div>

            {/* Work Status Badge */}
            <div className="flex flex-col gap-1.5 p-2.5 bg-slate-800/40 rounded-xl border border-slate-700/40">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium">Work Execution</span>
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                  selectedReport.status === 'Completed'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : selectedReport.status === 'Suspended'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}>
                  {selectedReport.status}
                </span>
              </div>
              {selectedReport.status === 'Suspended' && selectedReport.suspensionReason && (
                <div className="text-[11px] text-rose-300/90 bg-rose-950/40 p-2 rounded-lg border border-rose-500/30">
                  <span className="font-bold text-rose-400 block text-[9.5px] uppercase tracking-wider">Reason for Suspension:</span>
                  {selectedReport.suspensionReason}
                </div>
              )}
            </div>

            {/* Location & Stationing */}
            {selectedReport.locationName && (
              <div className="flex items-start gap-2 p-2.5 bg-slate-800/40 rounded-xl border border-slate-700/40 text-xs">
                <MapPin className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <span className="block text-[10px] text-slate-400 uppercase font-bold">Location &amp; Stationing</span>
                  <span className="text-slate-200 font-semibold break-words">{selectedReport.locationName}</span>
                  {selectedReport.referenceContext && (
                    <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded text-[9.5px] font-mono bg-cyan-950/60 text-cyan-300 border border-cyan-500/30">
                      🎯 {selectedReport.referenceContext}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* 2-Point Accomplishment Distance */}
            {(selectedReport.segmentDistanceFormatted || (selectedReport.segmentDistanceMeters && selectedReport.segmentDistanceMeters > 0)) && (
              <div className="flex items-center justify-between p-2.5 bg-emerald-950/30 border border-emerald-500/40 rounded-xl text-xs">
                <div className="flex items-center gap-2">
                  <Ruler className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <span className="block text-[10px] text-emerald-400 uppercase font-bold">Accomplishment Distance</span>
                    <span className="text-emerald-200 font-bold font-mono">
                      {selectedReport.segmentDistanceFormatted || `${selectedReport.segmentDistanceMeters?.toLocaleString()} meters`}
                    </span>
                  </div>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30 font-mono">
                  2-Point Segment
                </span>
              </div>
            )}

            {/* Maintenance Activity */}
            {selectedReport.maintenanceActivity && (
              <div className="p-2.5 bg-amber-950/20 border border-amber-500/30 rounded-xl text-xs space-y-1">
                <span className="text-[10px] font-bold text-amber-400 uppercase">Maintenance Activity</span>
                <p className="text-amber-200 font-medium">{selectedReport.maintenanceActivity}</p>
              </div>
            )}

            {/* Performed by (IMO / IA / Others) */}
            {(selectedReport.performedBy || selectedReport.performedByList) && (
              <div className="p-2.5 bg-slate-800/50 border border-slate-700/50 rounded-xl text-xs space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Performed by:</span>
                <p className="font-semibold text-cyan-300">
                  {selectedReport.performedByDetails || (
                    Array.isArray(selectedReport.performedByList)
                      ? selectedReport.performedByList.map(opt => opt === 'IMO' ? `by ${selectedReport.imoOffice || 'IMO'}` : opt === 'IA' ? `by IA: ${selectedReport.performedByIA || 'Irrigators Assn'}` : 'by Others').join(', ')
                      : typeof selectedReport.performedBy === 'string'
                      ? selectedReport.performedBy
                      : 'NIA IMO'
                  )}
                </p>
              </div>
            )}

            {/* Physical Measurements & Calculated Output */}
            {(selectedReport.dimensionDetailsFormatted || selectedReport.calculatedVolumeM3 !== undefined || selectedReport.paintedAreaSqm !== undefined || selectedReport.desiltingVolumeM3) && (
              <div className="p-3 bg-amber-950/20 border border-amber-500/30 rounded-xl text-xs space-y-2">
                <span className="text-[10px] font-bold text-amber-400 uppercase flex items-center gap-1">
                  <Ruler className="w-3.5 h-3.5 text-amber-400" />
                  <span>Physical Measurements &amp; Output</span>
                </span>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  {selectedReport.depthMeters !== undefined && (
                    <div>Depth: <strong className="text-white font-mono">{selectedReport.depthMeters} m</strong></div>
                  )}
                  {selectedReport.widthMeters !== undefined && (
                    <div>Width: <strong className="text-white font-mono">{selectedReport.widthMeters} m</strong></div>
                  )}
                  {selectedReport.sandPileHeightMeters !== undefined && (
                    <div>Sand Pile (H): <strong className="text-cyan-300 font-mono">{selectedReport.sandPileHeightMeters} m</strong></div>
                  )}
                  {selectedReport.paintedAreaSqm !== undefined && (
                    <div>Painting Area: <strong className="text-purple-300 font-mono">{selectedReport.paintedAreaSqm} m²</strong></div>
                  )}
                  {(selectedReport.calculatedVolumeM3 !== undefined || (selectedReport.desiltingVolumeM3 && selectedReport.desiltingVolumeM3 > 0)) && (
                    <div className="col-span-2">Calculated Volume: <strong className="text-amber-300 font-mono text-xs">{(selectedReport.calculatedVolumeM3 || selectedReport.desiltingVolumeM3)?.toLocaleString()} m³</strong></div>
                  )}
                  {selectedReport.dimensionDetailsFormatted && (
                    <div className="col-span-2 text-[10px] text-amber-200/80 font-mono">{selectedReport.dimensionDetailsFormatted}</div>
                  )}
                </div>
              </div>
            )}

            {/* Operational Status Metrics */}
            {selectedReport.operationalState && (
              <div className="p-3 bg-cyan-950/20 border border-cyan-500/30 rounded-xl text-xs space-y-2">
                <span className="text-[10px] font-bold text-cyan-400 uppercase">Operational Metrics</span>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>State: <strong className="text-white">{selectedReport.operationalState}</strong></div>
                  <div>Quality: <strong className="text-white">{selectedReport.waterQuality}</strong></div>
                  {selectedReport.waterLevelMeters !== undefined && (
                    <div>Water Level: <strong className="text-cyan-300 font-mono">{selectedReport.waterLevelMeters} m</strong></div>
                  )}
                  {selectedReport.dischargeFlowM3s !== undefined && (
                    <div>Discharge: <strong className="text-emerald-300 font-mono">{selectedReport.dischargeFlowM3s} m³/s</strong></div>
                  )}
                  {selectedReport.gateOpeningCm !== undefined && (
                    <div>Gate Opening: <strong className="text-amber-300 font-mono">{selectedReport.gateOpeningCm} cm</strong></div>
                  )}
                  {selectedReport.beneficiaryServiceArea && (
                    <div className="col-span-2">Service Area: <strong className="text-slate-200">{selectedReport.beneficiaryServiceArea}</strong></div>
                  )}
                </div>
              </div>
            )}

            {/* Photos Gallery with Before/During/After Tags */}
            {((selectedReport.photos && selectedReport.photos.length > 0) || selectedReport.photoUrl) && (
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Site Inspection Photos</span>
                <div className="grid grid-cols-1 gap-2">
                  {selectedReport.photos && selectedReport.photos.length > 0 ? (
                    selectedReport.photos.map((p, i) => {
                      const resolvedSrc = resolvePhotoAttachmentUrl(p);
                      return (
                        <div key={p.id || i} className="relative rounded-xl overflow-hidden border border-slate-700 bg-slate-950 min-h-[144px] flex items-center justify-center">
                          <img 
                            src={resolvedSrc || undefined} 
                            alt={p.caption || "Inspection site"} 
                            className="w-full h-36 object-cover" 
                            loading="lazy"
                            onLoad={(e) => {
                              const target = e.currentTarget;
                              if (target.naturalWidth <= 10 || target.naturalHeight <= 10) {
                                target.style.display = 'none';
                                const parent = target.parentElement;
                                if (parent && !parent.querySelector('.img-fallback')) {
                                  const fallback = document.createElement('div');
                                  fallback.className = 'img-fallback w-full h-36 flex flex-col items-center justify-center text-slate-500 text-xs p-3 text-center bg-slate-900/90';
                                  fallback.innerHTML = '<span class="text-lg mb-1">📷</span><span>Photo placeholder (No image binary uploaded)</span>';
                                  parent.prepend(fallback);
                                }
                              }
                            }}
                            onError={(e) => handleImageFallback(e, p, 'Inspection photo preview not accessible')}
                          />
                          <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between pointer-events-none">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold shadow-md ${
                              p.stage === 'Before' 
                                ? 'bg-amber-500 text-slate-950 font-black' 
                                : p.stage === 'During'
                                ? 'bg-cyan-500 text-slate-950 font-black'
                                : 'bg-emerald-500 text-slate-950 font-black'
                            }`}>
                              {p.caption || (p.stage ? `${p.stage} #${i + 1}` : 'Inspection')}
                            </span>
                            <span className="text-[9px] bg-slate-900/80 text-slate-300 px-1.5 py-0.5 rounded font-mono">
                              {p.capturedAt || 'Captured'}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="relative rounded-xl overflow-hidden border border-slate-700 bg-slate-950 min-h-[144px] flex items-center justify-center">
                      <img
                        src={resolvePhotoAttachmentUrl({ url: selectedReport.photoUrl, id: selectedReport.id })}
                        alt="Inspection site"
                        className="w-full h-36 object-cover rounded-xl border border-slate-700 shadow-md"
                        onError={(e) => handleImageFallback(e, { url: selectedReport.photoUrl, id: selectedReport.id }, 'Cover photo preview not accessible')}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Reporter Meta */}
            <div className="text-xs space-y-1 text-slate-300">
              <div className="flex items-center gap-1.5 text-slate-400">
                <User className="w-3.5 h-3.5" />
                <span>Reporter: <strong className="text-slate-200">{selectedReport.reporterName}</strong> ({selectedReport.reporterRole})</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-400">
                <Clock className="w-3.5 h-3.5" />
                <span>{new Date(selectedReport.createdAt).toLocaleString()}</span>
              </div>
            </div>

            {/* Remarks / Particulars */}
            <div className="space-y-1 bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Activity Particulars / Remarks</span>
              <p className="text-xs text-slate-200 leading-relaxed">{selectedReport.remarks}</p>
            </div>

            {/* Official Report PDF Actions (Preview & Download) */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <div className="grid grid-cols-2 gap-2">
                {onPreviewReportPdf && (
                  <button
                    type="button"
                    onClick={() => onPreviewReportPdf(selectedReport)}
                    className="p-2.5 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-md shadow-cyan-500/20"
                    title="Preview official PDF report document"
                  >
                    <Eye className="w-3.5 h-3.5 shrink-0" />
                    <span>Preview PDF</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={async () => {
                    setIsDownloadingPdf(true);
                    try {
                      await downloadReportPdf(selectedReport);
                    } catch (err) {
                      console.error('Failed to download report PDF:', err);
                    } finally {
                      setIsDownloadingPdf(false);
                    }
                  }}
                  disabled={isDownloadingPdf}
                  className="p-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-md shadow-emerald-500/20 disabled:opacity-50"
                  title="Download official PDF report document"
                >
                  {isDownloadingPdf ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <FileDown className="w-3.5 h-3.5 shrink-0" />
                      <span>Download PDF</span>
                    </>
                  )}
                </button>
              </div>

              {/* Secondary In-App WMR & Photo Viewers */}
              {onViewOfficialReport && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => onViewOfficialReport('form691', selectedReport)}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 hover:border-emerald-500/60 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-sm"
                    title="Open Official WMR Landscape View"
                  >
                    <FileText className="w-3 h-3 text-emerald-400 shrink-0" />
                    <span>WMR View</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onViewOfficialReport('photos', selectedReport)}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 hover:border-amber-500/60 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-sm"
                    title="Open Photo docs View"
                  >
                    <Camera className="w-3 h-3 text-amber-400 shrink-0" />
                    <span>Photo docs</span>
                  </button>
                </div>
              )}
            </div>

            {/* Rejection Prompt Form */}
            {rejectReasonPrompt && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl space-y-2 animate-in fade-in">
                <span className="text-[10px] font-bold text-rose-300 uppercase">Rejection Reason / Revision Notes</span>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Specify what needs correction..."
                  className="w-full bg-slate-900 border border-slate-700 text-xs text-white p-2 rounded-lg focus:outline-none focus:border-rose-500"
                  rows={2}
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => setRejectReasonPrompt(false)}
                    className="px-2.5 py-1 rounded text-xs text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmReject}
                    className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-lg shadow transition"
                  >
                    Confirm Rejection
                  </button>
                </div>
              </div>
            )}

            {/* TWO-TIER APPROVAL ACTION CONTROLS */}
            {!rejectReasonPrompt && (canPreApprove || canFinalApprove) && (
              <div className="pt-2 border-t border-slate-800 space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  {canPreApprove ? 'Level 1: O&M Engineer Review' : 'Level 2: Final Admin Approval'}
                </span>
                <div className="flex items-center gap-2">
                  {canPreApprove && (
                    <button
                      onClick={handlePreApprove}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-gradient-to-r from-cyan-600 to-teal-500 hover:from-cyan-500 hover:to-teal-400 text-white font-bold text-xs py-2 rounded-xl shadow-md transition cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      <span>Pre-Approve Report</span>
                    </button>
                  )}

                  {canFinalApprove && (
                    <button
                      onClick={handleFinalApprove}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-xs py-2 rounded-xl shadow-md transition cursor-pointer"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>Final Approve &amp; Publish</span>
                    </button>
                  )}

                  <button
                    onClick={() => setRejectReasonPrompt(true)}
                    className="px-3 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-semibold transition cursor-pointer"
                    title="Reject and send back for revision"
                  >
                    <Ban className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

          </div>
        )}

        {/* Feature Property Table View */}
        {selectedFeatureProps && !selectedReport && (
          <div className="space-y-3">
            {/* Desilting Progress Header for Canals */}
            {selectedFeatureProps.completion_pct !== undefined && (
              <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-300 font-semibold">Desilting Completion</span>
                  <span className="font-bold text-emerald-400">{selectedFeatureProps.completion_pct}%</span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-700">
                  <div
                    className="bg-gradient-to-r from-cyan-500 to-emerald-400 h-full"
                    style={{ width: `${selectedFeatureProps.completion_pct}%` }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] text-slate-300 font-mono">
                  <div>Completed: <strong>{selectedFeatureProps.completed_desilting_m3?.toLocaleString()} m³</strong></div>
                  <div>Target: <strong>{selectedFeatureProps.target_desilting_m3?.toLocaleString()} m³</strong></div>
                </div>
              </div>
            )}

            {/* Attributes List Table */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                Feature Attributes
              </span>
              <div className="bg-slate-800/40 rounded-xl border border-slate-800 divide-y divide-slate-800 text-xs">
                {Object.entries(selectedFeatureProps).map(([key, val]) => {
                  if (val === undefined || val === null || typeof val === 'object' || key === 'geometry') return null;
                  const keyLower = key.toLowerCase();

                  if (['name', 'canal_name', 'station_name', 'title', 'parcel_name', 'label'].includes(keyLower)) {
                    return null;
                  }

                  let displayKey = key;
                  let displayVal = String(val).trim();

                  if (displayVal === '' || displayVal === '[blank]' || displayVal.toLowerCase() === 'null') {
                    return null;
                  }

                  if (['area', 'area_ha', 'declared_area', 'shape_area'].includes(keyLower)) {
                    displayKey = 'Area';
                    const numArea = parseFloat(String(val).replace(/,/g, ''));
                    if (!isNaN(numArea) && numArea > 0) {
                      displayVal = `${numArea.toFixed(4)} ha`;
                    } else if (!displayVal.toLowerCase().includes('ha') && !displayVal.toLowerCase().includes('sqm')) {
                      return null;
                    }
                  }

                  return (
                    <div key={key} className="flex justify-between items-start p-2.5 hover:bg-slate-800/60 transition gap-2">
                      <span className="text-slate-400 font-mono text-[11px] shrink-0">{displayKey}</span>
                      <span className="text-slate-200 font-medium text-right break-words max-w-[200px]">
                        {displayVal}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Action Footer */}
      {currentRole !== 'Viewer' && !isPickingLocation && (
        <div className="p-3 border-t border-slate-800 bg-slate-900/90 space-y-2">
          {selectedReport ? (
            canUserEditReport(authenticatedUser, currentRole, selectedReport) && onEditReport ? (
              <button
                onClick={() => onEditReport(selectedReport)}
                className="w-full flex items-center justify-center gap-2 bg-[#15803d] hover:bg-[#16a34a] text-white font-bold text-xs py-2.5 rounded-xl shadow-sm border border-[#16a34a]/50 transition cursor-pointer active:scale-95"
              >
                <Edit3 className="w-4 h-4" />
                <span>Edit Field Report for this Location</span>
              </button>
            ) : (
              <div className="p-2 bg-slate-800/60 rounded-xl border border-slate-700/60 text-center">
                <span className="text-[11px] text-slate-400 font-medium">
                  {selectedReport.approvalStatus === 'Approved'
                    ? '🔒 Report Approved & Published (Read-Only)'
                    : '🔒 Editing locked by approval workflow permissions'}
                </span>
              </div>
            )
          ) : (
            <button
              onClick={() => onOpenReportFeature(canalCode, parcelId, coords)}
              className="w-full flex items-center justify-center gap-2 bg-[#15803d] hover:bg-[#16a34a] text-white font-bold text-xs py-2.5 rounded-xl shadow-sm border border-[#16a34a]/50 transition cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Create Field Report for this Location</span>
            </button>
          )}
        </div>
      )}
    </aside>
  );

  function onOpenReportFeature(cSegment?: string, pId?: string, crds?: [number, number]) {
    onOpenReportForFeature(cSegment, pId, crds);
  }
};

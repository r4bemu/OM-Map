import React, { useState, useMemo } from 'react';
import { 
  Star, 
  MapPin, 
  Eye, 
  GitCompare, 
  ShieldCheck, 
  Edit3, 
  ChevronLeft, 
  ChevronRight, 
  X, 
  Camera, 
  Video,
  CornerDownLeft,
  Calendar,
  Layers
} from 'lucide-react';
import { FieldReport, UserRole, AuthUser, ApprovalTier, PhotoAttachment } from '../types';
import { 
  getEffectiveReportTier, 
  getTierLabel, 
  getTierBadgeStyle, 
  canUserAdvanceTier, 
  canUserEditReport 
} from '../utils/approvalHierarchyEngine';

interface ReportReviewCardProps {
  report: FieldReport;
  summaryMode: 'maintenance' | 'operational';
  currentRole: UserRole;
  currentUser?: AuthUser | null;
  onSelectReportOnMap: (report: FieldReport) => void;
  onPreviewReportPdf?: (report: FieldReport) => void;
  onEditReport?: (report: FieldReport, snapshot?: Partial<FieldReport>) => void;
  onOpenDiffViewer?: (report: FieldReport) => void;
  onAdvanceTier?: (report: FieldReport, nextTier: ApprovalTier, comment?: string) => void;
  onRequestRevision?: (report: FieldReport, reason: string) => void;
}

function formatDateOnly(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateTime(d: Date): string {
  const datePart = formatDateOnly(d);
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${datePart} ${hours}:${mins}`;
}

export function resolveActivityDateRange(report: FieldReport): {
  dateString: string;
  isRange: boolean;
  source: 'metadata' | 'report_created';
} {
  const photoDates: Date[] = [];
  
  if (Array.isArray(report.photos) && report.photos.length > 0) {
    report.photos.forEach(p => {
      if (p.capturedAt) {
        const d = new Date(p.capturedAt);
        if (!isNaN(d.getTime())) {
          photoDates.push(d);
        }
      }
    });
  }

  if (photoDates.length === 0) {
    const fallbackDate = report.createdAt ? new Date(report.createdAt) : new Date();
    const valid = isNaN(fallbackDate.getTime()) ? new Date() : fallbackDate;
    return {
      dateString: formatDateTime(valid),
      isRange: false,
      source: 'report_created'
    };
  }

  photoDates.sort((a, b) => a.getTime() - b.getTime());
  const earliest = photoDates[0];
  const latest = photoDates[photoDates.length - 1];

  const earliestDay = formatDateOnly(earliest);
  const latestDay = formatDateOnly(latest);

  if (earliestDay !== latestDay) {
    return {
      dateString: `${earliestDay} – ${latestDay}`,
      isRange: true,
      source: 'metadata'
    };
  }

  return {
    dateString: formatDateTime(earliest),
    isRange: false,
    source: 'metadata'
  };
}

export function resolveVariationString(report: FieldReport): string {
  const parts: string[] = [];

  // NIS Name
  const nis = report.nisBinding || 'Irrigation System';
  parts.push(nis);

  // Canal / Structure Name
  const canalOrStructure = report.canalSegment || report.structureName || report.locationName || 'Main Canal';
  parts.push(canalOrStructure);

  // Stationing or Coordinates
  let locationDetail = '';
  if (report.dimensionDetailsFormatted) {
    locationDetail = report.dimensionDetailsFormatted;
  } else if (report.locationName && report.locationName !== canalOrStructure) {
    locationDetail = report.locationName;
  } else if (typeof report.lat === 'number' && typeof report.lng === 'number' && !isNaN(report.lat)) {
    locationDetail = `${report.lat.toFixed(4)}°, ${report.lng.toFixed(4)}°`;
  }

  const base = parts.join(' • ');
  return locationDetail ? `${base} (${locationDetail})` : base;
}

function getInitials(name: string): string {
  if (!name) return 'FP';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getStatusBadgeStyle(status?: string): string {
  switch (status) {
    case 'Completed':
      return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
    case 'Suspended':
      return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
    case 'Inspection Required':
      return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    case 'Delayed':
      return 'bg-orange-500/20 text-orange-300 border-orange-500/40';
    case 'In Progress':
    default:
      return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';
  }
}

export const ReportReviewCard: React.FC<ReportReviewCardProps> = ({
  report,
  summaryMode,
  currentRole,
  currentUser,
  onSelectReportOnMap,
  onPreviewReportPdf,
  onEditReport,
  onOpenDiffViewer,
  onAdvanceTier,
  onRequestRevision
}) => {
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);

  const effectiveTier = getEffectiveReportTier(report);
  const advanceAction = canUserAdvanceTier(report, currentUser || null, currentRole);
  const canEdit = canUserEditReport(report, currentUser || null, currentRole);
  const activityDate = useMemo(() => resolveActivityDateRange(report), [report]);
  const variationText = useMemo(() => resolveVariationString(report), [report]);

  const allPhotos = useMemo<PhotoAttachment[]>(() => {
    if (Array.isArray(report.photos) && report.photos.length > 0) {
      return report.photos;
    }
    if (report.photoUrl) {
      return [{
        id: 'legacy-photo-attachment',
        url: report.photoUrl,
        stage: 'During',
        caption: report.title,
        capturedAt: report.createdAt
      }];
    }
    return [];
  }, [report.photos, report.photoUrl, report.title, report.createdAt]);

  // Extract seller's response equivalent: latest comment, evaluator notes, or revision reason
  const institutionalResponse = useMemo(() => {
    if (report.suspensionReason) {
      return {
        title: 'Suspension Justification / Notes:',
        text: report.suspensionReason,
        author: report.reporterName,
        timestamp: ''
      };
    }
    if (report.rejectionReason) {
      return {
        title: 'Returned for Revision Remarks:',
        text: report.rejectionReason,
        author: report.verifierName || 'Reviewing Officer',
        timestamp: ''
      };
    }
    if (Array.isArray(report.tierHistory) && report.tierHistory.length > 0) {
      const lastWithComments = [...report.tierHistory].reverse().find(h => h.comments && h.comments.trim().length > 0);
      if (lastWithComments) {
        return {
          title: 'Reviewing Officer Response:',
          text: lastWithComments.comments!,
          author: `${lastWithComments.actorName} (${lastWithComments.actorRole})`,
          timestamp: lastWithComments.timestamp ? new Date(lastWithComments.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''
        };
      }
    }
    return null;
  }, [report.suspensionReason, report.rejectionReason, report.tierHistory, report.reporterName, report.verifierName]);

  return (
    <div className="p-4 sm:p-5 bg-slate-900/90 hover:bg-slate-900 border border-slate-800/90 rounded-2xl transition shadow-sm space-y-3.5">
      {/* 1. Header Row: Customer/Reporter Profile + Rating Category & Work Status */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 border border-slate-600 flex items-center justify-center font-bold text-slate-200 text-xs shrink-0 shadow-inner">
            {getInitials(report.reporterName || 'FP')}
          </div>

          {/* Reporter Details & Category */}
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs sm:text-sm font-bold text-white">
                {report.reporterName || 'Field Personnel'}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-300 font-medium">
                {report.imoOffice || 'IMO Office'}
              </span>
              {report.reporterDesignation && (
                <span className="text-[10px] text-slate-400 font-medium hidden sm:inline">
                  • {report.reporterDesignation}
                </span>
              )}
            </div>

            {/* Shopee-style 5 Stars + Activity Category */}
            <div className="flex items-center gap-1.5 mt-1">
              <div className="flex items-center gap-0.5 text-[#ee4d2d]">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-3.5 h-3.5 fill-[#ee4d2d]" />
                ))}
              </div>
              <span className="text-xs font-semibold text-emerald-400 ml-1">
                {report.maintenanceActivity || report.title || report.operationalState || 'Accomplishment'}
              </span>
            </div>
          </div>
        </div>

        {/* Work Status Badge + Revision Tag */}
        <div className="shrink-0 flex items-center gap-1.5">
          <span className={`text-[10px] sm:text-[11px] px-2.5 py-0.5 rounded-full font-bold border ${getStatusBadgeStyle(report.status)}`}>
            {report.status || 'In Progress'}
          </span>
          {report.revisions && report.revisions.length > 1 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-teal-950 text-teal-300 border border-teal-700 font-mono font-bold">
              v{report.revisions.length}
            </span>
          )}
        </div>
      </div>

      {/* 2. Review Date & Variation Line */}
      <div className="text-[11px] text-slate-400 font-normal flex items-center gap-2 flex-wrap">
        <span className="text-slate-300 font-mono">{activityDate.dateString}</span>
        <span className="text-slate-600">|</span>
        <span className="text-slate-300">
          Variation: <strong className="text-slate-200 font-normal">{variationText}</strong>
        </span>
      </div>

      {/* 3. Review Body Message & Technical Specifications (Shopee Quality & Performance style) */}
      <div className="space-y-2 text-xs">
        {/* Technical Particulars Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] bg-slate-950/50 p-2.5 rounded-xl border border-slate-800/80">
          {summaryMode === 'maintenance' ? (
            <>
              <div className="flex items-baseline gap-1.5">
                <span className="text-slate-400">Accomplishment:</span>
                <span className="text-emerald-300 font-mono font-semibold">
                  {report.segmentDistanceFormatted || (report.segmentDistanceMeters && report.segmentDistanceMeters > 0 ? `${report.segmentDistanceMeters >= 1000 ? `${(report.segmentDistanceMeters / 1000).toFixed(2)} km` : `${report.segmentDistanceMeters.toLocaleString()} m`}` : 'Point Structure')}
                </span>
              </div>
              {(report.calculatedVolumeM3 || report.desiltingVolumeM3) ? (
                <div className="flex items-baseline gap-1.5">
                  <span className="text-slate-400">Calculated Volume:</span>
                  <span className="text-amber-300 font-mono font-semibold">
                    {(report.calculatedVolumeM3 || report.desiltingVolumeM3)?.toLocaleString()} m³
                  </span>
                </div>
              ) : report.paintedAreaSqm ? (
                <div className="flex items-baseline gap-1.5">
                  <span className="text-slate-400">Painted Area:</span>
                  <span className="text-purple-300 font-mono font-semibold">
                    {report.paintedAreaSqm.toLocaleString()} m²
                  </span>
                </div>
              ) : null}
              <div className="flex items-baseline gap-1.5">
                <span className="text-slate-400">Workforce / Performed By:</span>
                <span className="text-cyan-300 font-medium">
                  {report.performedByIA ? `IA (${report.performedByIA})` : (Array.isArray(report.performedBy) ? report.performedBy.join(', ') : (report.performedBy || 'NIA / In-House'))}
                </span>
              </div>
              {report.dimensionDetailsFormatted && (
                <div className="flex items-baseline gap-1.5 sm:col-span-2 truncate">
                  <span className="text-slate-400">Dimension Specs:</span>
                  <span className="text-slate-200 font-mono text-[10px]">
                    {report.dimensionDetailsFormatted}
                  </span>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex items-baseline gap-1.5">
                <span className="text-slate-400">Operational State:</span>
                <span className="text-cyan-300 font-semibold">{report.operationalState || 'Fully Operational'}</span>
              </div>
              {typeof report.dischargeFlowM3s === 'number' && report.dischargeFlowM3s > 0 && (
                <div className="flex items-baseline gap-1.5">
                  <span className="text-slate-400">Discharge Flow:</span>
                  <span className="text-cyan-300 font-mono font-semibold">{report.dischargeFlowM3s} m³/s</span>
                </div>
              )}
              {typeof report.waterLevelMeters === 'number' && report.waterLevelMeters > 0 && (
                <div className="flex items-baseline gap-1.5">
                  <span className="text-slate-400">Water Level:</span>
                  <span className="text-blue-300 font-mono font-semibold">{report.waterLevelMeters} m</span>
                </div>
              )}
              {typeof report.gateOpeningCm === 'number' && report.gateOpeningCm > 0 && (
                <div className="flex items-baseline gap-1.5">
                  <span className="text-slate-400">Gate Opening:</span>
                  <span className="text-purple-300 font-mono font-semibold">{report.gateOpeningCm} cm</span>
                </div>
              )}
              {report.waterQuality && (
                <div className="flex items-baseline gap-1.5 sm:col-span-2">
                  <span className="text-slate-400">Water Quality:</span>
                  <span className="text-slate-200">{report.waterQuality}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Remarks / Activity Particulars */}
        {report.remarks && (
          <p className="text-xs text-slate-200 leading-relaxed pt-0.5">
            {report.remarks}
          </p>
        )}
      </div>

      {/* 4. Documented Photos & 1-Click Interactive Inline Viewer */}
      {allPhotos.length > 0 && (
        <div className="space-y-2 pt-1">
          {/* Square Thumbnail Row */}
          <div className="flex items-center gap-2 overflow-x-auto py-1">
            {allPhotos.map((photo, idx) => {
              const isSelected = selectedPhotoIndex === idx;
              return (
                <button
                  key={photo.id || idx}
                  type="button"
                  onClick={() => setSelectedPhotoIndex(isSelected ? null : idx)}
                  className={`w-18 h-18 sm:w-20 sm:h-20 rounded-lg overflow-hidden bg-slate-950 border relative shrink-0 transition cursor-pointer group ${
                    isSelected 
                      ? 'border-2 border-[#ee4d2d] ring-2 ring-[#ee4d2d]/40 shadow-md scale-[1.02]' 
                      : 'border-slate-700 hover:border-slate-500 hover:opacity-90'
                  }`}
                  title={photo.caption || `Click to view photo ${idx + 1}`}
                >
                  <img
                    src={photo.url || photo.dataUrl || photo.sourceDataUrl}
                    alt={photo.caption || `Photo ${idx + 1}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  {photo.stage && (
                    <span className={`absolute bottom-0 inset-x-0 text-[8px] font-bold text-center py-0.5 uppercase tracking-wider backdrop-blur-sm ${
                      photo.stage === 'Before' 
                        ? 'bg-amber-950/80 text-amber-300' 
                        : photo.stage === 'During' 
                          ? 'bg-blue-950/80 text-blue-300' 
                          : 'bg-emerald-950/80 text-emerald-300'
                    }`}>
                      {photo.stage}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Shopee-style Inline Enlarged Image Box */}
          {selectedPhotoIndex !== null && allPhotos[selectedPhotoIndex] && (
            <div className="relative mt-2 rounded-xl overflow-hidden bg-slate-950 border border-slate-700/80 shadow-2xl transition-all">
              {/* Image Screen */}
              <div className="relative min-h-[220px] max-h-[460px] flex items-center justify-center bg-black/90 p-1">
                <img
                  src={allPhotos[selectedPhotoIndex].url || allPhotos[selectedPhotoIndex].dataUrl || allPhotos[selectedPhotoIndex].sourceDataUrl}
                  alt={allPhotos[selectedPhotoIndex].caption || 'Enlarged photo evidence'}
                  className="max-h-[440px] w-auto max-w-full object-contain rounded-lg select-none"
                />

                {/* Left Carousel Arrow */}
                {allPhotos.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPhotoIndex((selectedPhotoIndex - 1 + allPhotos.length) % allPhotos.length);
                    }}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 hover:bg-white text-slate-900 flex items-center justify-center shadow-lg transition active:scale-95 cursor-pointer z-10"
                    title="Previous photo"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                )}

                {/* Right Carousel Arrow */}
                {allPhotos.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPhotoIndex((selectedPhotoIndex + 1) % allPhotos.length);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 hover:bg-white text-slate-900 flex items-center justify-center shadow-lg transition active:scale-95 cursor-pointer z-10"
                    title="Next photo"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                )}

                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => setSelectedPhotoIndex(null)}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 hover:bg-black text-white transition active:scale-95 cursor-pointer z-10"
                  title="Close enlarged view"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Caption & Metadata Bar */}
              <div className="p-2.5 bg-slate-900/95 border-t border-slate-800 flex items-center justify-between text-xs text-slate-300 gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  {allPhotos[selectedPhotoIndex].stage && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      allPhotos[selectedPhotoIndex].stage === 'Before'
                        ? 'bg-amber-950/60 text-amber-300 border-amber-500/40'
                        : allPhotos[selectedPhotoIndex].stage === 'During'
                          ? 'bg-blue-950/60 text-blue-300 border-blue-500/40'
                          : 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40'
                    }`}>
                      {allPhotos[selectedPhotoIndex].stage} Stage
                    </span>
                  )}
                  <span className="text-slate-400 font-mono text-[11px]">
                    Photo {selectedPhotoIndex + 1} of {allPhotos.length}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono">
                  {allPhotos[selectedPhotoIndex].capturedAt && (
                    <span>
                      {new Date(allPhotos[selectedPhotoIndex].capturedAt!).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  )}
                  {allPhotos[selectedPhotoIndex].lat && allPhotos[selectedPhotoIndex].lng && (
                    <span>
                      {allPhotos[selectedPhotoIndex].lat!.toFixed(5)}°, {allPhotos[selectedPhotoIndex].lng!.toFixed(5)}°
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. Reviewing Officer Response (Shopee Seller's Response style) */}
      {institutionalResponse && (
        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-xs space-y-1">
          <div className="text-[11px] font-bold text-slate-300">
            {institutionalResponse.title}
          </div>
          <p className="text-slate-300 leading-relaxed">
            {institutionalResponse.text}
          </p>
          {institutionalResponse.author && (
            <div className="text-[10px] text-slate-500 font-mono pt-0.5">
              — {institutionalResponse.author} {institutionalResponse.timestamp ? `(${institutionalResponse.timestamp})` : ''}
            </div>
          )}
        </div>
      )}

      {/* 6. Action Toolbar & Approval Hierarchy Tier */}
      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2 flex-wrap">
        {/* Tier Stage Badge */}
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] px-2.5 py-1 rounded-full border font-semibold ${getTierBadgeStyle(effectiveTier)}`}>
            {getTierLabel(effectiveTier)}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5">
          {/* Diff Viewer */}
          {onOpenDiffViewer && (
            <button
              type="button"
              onClick={() => onOpenDiffViewer(report)}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-teal-300 border border-teal-500/30 hover:border-teal-400 rounded-lg text-xs font-semibold transition inline-flex items-center gap-1 cursor-pointer shadow-sm active:scale-95"
              title="Open Visual Revision Diff Viewer"
            >
              <GitCompare className="w-3.5 h-3.5 text-teal-400" />
              <span className="hidden sm:inline">Diff</span>
            </button>
          )}

          {/* Advance Tier */}
          {advanceAction.allowed && advanceAction.nextTier && onAdvanceTier && (
            <button
              type="button"
              onClick={() => onAdvanceTier(report, advanceAction.nextTier!, `Approved by ${currentRole}`)}
              className="px-2.5 py-1.5 bg-[#15803d]/20 hover:bg-[#15803d]/40 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-semibold transition inline-flex items-center gap-1 cursor-pointer shadow-sm active:scale-95"
              title={advanceAction.actionLabel || 'Advance to next stage'}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Advance</span>
            </button>
          )}

          {/* PDF Preview */}
          {onPreviewReportPdf && (
            <button
              type="button"
              onClick={() => onPreviewReportPdf(report)}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 hover:border-slate-500 rounded-lg text-xs font-semibold transition inline-flex items-center gap-1 cursor-pointer shadow-sm active:scale-95"
              title="Preview official PDF report"
            >
              <Eye className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">PDF</span>
            </button>
          )}

          {/* Edit Report */}
          {canEdit && onEditReport && (
            <button
              type="button"
              onClick={() => onEditReport(report)}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 hover:border-amber-400 rounded-lg text-xs font-semibold transition inline-flex items-center gap-1 cursor-pointer shadow-sm active:scale-95"
              title="Edit report details"
            >
              <Edit3 className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Edit</span>
            </button>
          )}

          {/* Map Pin */}
          <button
            type="button"
            onClick={() => onSelectReportOnMap(report)}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 rounded-lg text-xs font-semibold transition inline-flex items-center gap-1 cursor-pointer shadow-sm active:scale-95"
            title="View location on map"
          >
            <MapPin className="w-3.5 h-3.5 text-emerald-400" />
            <span>Map</span>
          </button>
        </div>
      </div>
    </div>
  );
};

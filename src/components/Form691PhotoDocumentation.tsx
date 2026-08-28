import React, { useState, useMemo, useEffect } from 'react';
import { 
  Printer, 
  Download, 
  Calendar, 
  Camera, 
  ChevronDown, 
  MapPin, 
  Clock, 
  Compass, 
  Layers, 
  FileText,
  Image as ImageIcon,
  FileDown,
  Loader2
} from 'lucide-react';
import { FieldReport, PhotoAttachment, AuthUser, UserRole } from '../types';
import { downloadPhotoDocsPdf } from '../utils/reportPdfBuilder';
import { getAvailableWeeksFromReports, isReportInWeek, FridayWeekInfo } from '../utils/weekUtils';
import { formatReportId } from '../utils/reportIdGenerator';

interface Form691PhotoDocumentationProps {
  reports: FieldReport[];
  initialWeekKey?: string;
  currentUser?: AuthUser | null;
  activeImo?: string;
  activeNis?: string;
  currentRole?: UserRole;
}

export const Form691PhotoDocumentation: React.FC<Form691PhotoDocumentationProps> = ({
  reports,
  initialWeekKey,
  currentUser,
  activeImo,
  activeNis,
  currentRole
}) => {
  // Determine user's role and assigned scope
  const userAssignedImo = currentUser?.imoOffice || activeImo;
  const userAssignedNis = currentUser?.nisBinding || activeNis;
  const isRegionalRole = !userAssignedImo || userAssignedImo === 'All IMOs' || userAssignedImo === 'Regional Office IV-B' || ['Regional Director', 'Analyst', 'Admin', 'Developer'].includes(currentUser?.role || currentRole || '');

  const [selectedImo, setSelectedImo] = useState<string>(() => {
    if (isRegionalRole) return activeImo && activeImo !== 'All IMOs' ? activeImo : 'All';
    return userAssignedImo || 'MOMARO';
  });

  const [selectedNis, setSelectedNis] = useState<string>(() => {
    if (userAssignedNis && userAssignedNis !== 'All' && userAssignedNis !== 'All NIS') return userAssignedNis;
    return 'All';
  });

  // Keep state synchronized with current user role and scoping props
  useEffect(() => {
    if (isRegionalRole) {
      if (activeImo && activeImo !== 'All IMOs') {
        setSelectedImo(activeImo);
      }
      if (activeNis && activeNis !== 'All NIS' && activeNis !== 'All') {
        setSelectedNis(activeNis);
      }
    } else {
      if (userAssignedImo) {
        setSelectedImo(userAssignedImo);
      }
      if (userAssignedNis && userAssignedNis !== 'All' && userAssignedNis !== 'All NIS') {
        setSelectedNis(userAssignedNis);
      }
    }
  }, [currentUser, activeImo, activeNis, isRegionalRole, userAssignedImo, userAssignedNis]);

  // Available weeks (Friday-ending NIA work weeks)
  const availableWeeks = useMemo(() => {
    return getAvailableWeeksFromReports(reports);
  }, [reports]);

  const [selectedWeekKey, setSelectedWeekKey] = useState<string>(
    initialWeekKey || (availableWeeks[0] ? availableWeeks[0].key : '')
  );

  const selectedWeekObj = useMemo(() => {
    return availableWeeks.find(w => w.key === selectedWeekKey) || availableWeeks[0];
  }, [availableWeeks, selectedWeekKey]);

  // Distinct IMO options
  const imoOptions = useMemo(() => {
    const set = new Set<string>();
    reports.forEach(r => {
      if (r.imoOffice) set.add(r.imoOffice);
    });
    return ['All', ...Array.from(set)];
  }, [reports]);

  // Distinct NIS options for chosen IMO
  const nisOptions = useMemo(() => {
    const set = new Set<string>();
    reports.forEach(r => {
      if (selectedImo !== 'All' && r.imoOffice && !r.imoOffice.toLowerCase().includes(selectedImo.toLowerCase())) return;
      if (r.nisBinding) set.add(r.nisBinding);
    });
    return ['All', ...Array.from(set)];
  }, [reports, selectedImo]);

  // Filter reports with photos matching selected week, IMO, and NIS
  const photoReports = useMemo(() => {
    return reports.filter(r => {
      if (!r) return false;
      const hasPhotos = (Array.isArray(r.photos) && r.photos.length > 0) || r.photoUrl;
      if (!hasPhotos) return false;

      const matchesWeek = isReportInWeek(r, selectedWeekKey);
      
      // IMO match
      let matchesImo = true;
      if (selectedImo !== 'All' && selectedImo !== 'All IMOs') {
        const repImo = (r.imoOffice || '').toLowerCase();
        const sLower = selectedImo.toLowerCase();
        const isMOMARO = (str: string) => str.includes('momaro') || str.includes('oriental');
        const isOccidental = (str: string) => str.includes('occidental');
        const isPalawan = (str: string) => str.includes('palawan');
        if (isMOMARO(sLower) && isMOMARO(repImo)) matchesImo = true;
        else if (isOccidental(sLower) && isOccidental(repImo)) matchesImo = true;
        else if (isPalawan(sLower) && isPalawan(repImo)) matchesImo = true;
        else matchesImo = repImo.includes(sLower) || sLower.includes(repImo);
      }

      // NIS match
      let matchesNis = true;
      if (selectedNis !== 'All' && selectedNis !== 'All NIS') {
        const repNis = (r.nisBinding || '').toLowerCase();
        const repLoc = (r.locationName || '').toLowerCase();
        const repCanal = (r.canalSegment || '').toLowerCase();
        const nLower = selectedNis.toLowerCase();
        matchesNis = repNis.includes(nLower) || repLoc.includes(nLower) || repCanal.includes(nLower);
      }

      return matchesWeek && matchesImo && matchesNis;
    });
  }, [reports, selectedWeekKey, selectedImo, selectedNis]);

  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const handleDownloadPDF = async () => {
    setIsDownloadingPdf(true);
    try {
      await downloadPhotoDocsPdf(reports, selectedWeekObj, selectedImo, selectedNis);
    } catch (err) {
      console.error('Failed to generate Photo docs PDF:', err);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      {/* Portrait Print & Page Styling */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait !important;
            margin: 8mm 8mm !important;
          }
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #photo-docs-printable-container {
            width: 100% !important;
            min-width: 100% !important;
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
        }
      `}</style>

      {/* Top Toolbar (Screen Only) */}
      <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-2xl flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Week Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-300">Period:</span>
            <select
              value={selectedWeekKey}
              onChange={(e) => setSelectedWeekKey(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-white text-xs px-3 py-1.5 rounded-xl font-bold focus:border-cyan-500 focus:outline-none"
            >
              {availableWeeks.map(w => (
                <option key={w.key} value={w.key}>{w.label}</option>
              ))}
            </select>
          </div>

          {/* IMO & NIS Filters */}
          {isRegionalRole ? (
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-400">IMO:</span>
                <select
                  value={selectedImo}
                  onChange={(e) => {
                    setSelectedImo(e.target.value);
                    setSelectedNis('All');
                  }}
                  className="bg-slate-900 border border-slate-700 text-cyan-300 text-xs px-2.5 py-1.5 rounded-xl font-semibold focus:border-cyan-500 focus:outline-none"
                >
                  {imoOptions.map(imo => (
                    <option key={imo} value={imo}>{imo === 'All' ? 'All IMO Offices' : imo}</option>
                  ))}
                </select>
              </div>

              {selectedImo !== 'All' && nisOptions.length > 1 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-400">NIS:</span>
                  <select
                    value={selectedNis}
                    onChange={(e) => setSelectedNis(e.target.value)}
                    className="bg-slate-900 border border-slate-700 text-emerald-300 text-xs px-2.5 py-1.5 rounded-xl font-semibold focus:border-emerald-500 focus:outline-none"
                  >
                    {nisOptions.map(nis => (
                      <option key={nis} value={nis}>{nis === 'All' ? 'All NIS Systems' : nis}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          ) : (
            <div className="px-3 py-1 bg-cyan-950/40 border border-cyan-500/30 rounded-xl flex items-center gap-2">
              <span className="text-[11px] text-cyan-400 font-mono font-bold">🔒 {selectedImo}</span>
              {selectedNis !== 'All' && (
                <span className="text-[11px] text-emerald-400 font-mono font-bold">• {selectedNis}</span>
              )}
            </div>
          )}

          <span className="text-xs text-slate-400 font-mono">
            {photoReports.length} {photoReports.length === 1 ? 'Entry' : 'Entries'} with Photos
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Download Photo Docs (PDF) */}
          <button
            type="button"
            onClick={handleDownloadPDF}
            disabled={isDownloadingPdf}
            className="px-3.5 py-1.5 bg-[#009933] hover:bg-[#00802b] text-white rounded-xl text-xs font-bold shadow-sm border border-[#00802b]/50 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95"
            title="Download true vector PDF file of Photo Documentation"
          >
            {isDownloadingPdf ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Generating PDF...</span>
              </>
            ) : (
              <>
                <FileDown className="w-3.5 h-3.5" />
                <span>Download Photo docs (PDF)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PHOTO DOCUMENTATION CONTAINER (PORTRAIT DOCUMENT PAGES)                   */}
      {/* ========================================================================= */}
      {photoReports.length === 0 ? (
        <div className="p-12 text-center bg-slate-950/60 rounded-2xl border border-slate-800 space-y-3 print:hidden">
          <Camera className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-sm font-bold text-slate-300">No Photo Documentation Recorded For This Week</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Attach Before, During, or After photos when creating or editing Field Maintenance Reports to automatically generate official photo documentation sheets.
          </p>
        </div>
      ) : (
        <div id="photo-docs-printable-container" className="space-y-8 print:space-y-0">
          {photoReports.map((report, reportIdx) => {
            const rawPhotos: PhotoAttachment[] = Array.isArray(report.photos) && report.photos.length > 0
              ? report.photos
              : (report.photoUrl ? [{ id: 'p1', url: report.photoUrl, stage: 'During' }] : []);

            // Bottom particulars box — 2-row clean format (removed redundant canal distance line)
            const activityCategory = (report.maintenanceActivity || report.reportType || 'Canal Maintenance').toUpperCase();
            const remarksLine = report.remarks || `${report.maintenanceActivity || 'Maintenance activity'} undertaken by NIA O&M Personnel.`;

            // Split into pages of up to 6 photos per page (2x3 or 2x2 grid with zero wasted space)
            const photoPages: PhotoAttachment[][] = [];
            for (let i = 0; i < rawPhotos.length; i += 6) {
              photoPages.push(rawPhotos.slice(i, i + 6));
            }
            if (photoPages.length === 0) {
              photoPages.push([]);
            }

            return photoPages.map((pagePhotos, pageIdx) => (
              <div 
                key={`${report.id}-page-${pageIdx}`}
                className="bg-white text-black p-6 sm:p-10 rounded-xl shadow-2xl overflow-hidden print:p-0 print:shadow-none print:m-0 font-sans border border-slate-300 print:border-none max-w-4xl mx-auto print:page-break-after-always flex flex-col justify-between min-h-[950px] print:min-h-screen"
                style={{ pageBreakAfter: 'always' }}
              >
                {/* 1. Official Header */}
                <div className="flex items-start justify-between pb-3 border-b-2 border-slate-800 shrink-0">
                  <div className="flex items-center gap-3">
                    <img 
                      src="/header-2025-left.png" 
                      alt="Office of the President & NIA Official Seal" 
                      className="h-14 w-auto object-contain shrink-0"
                      onError={(e) => { (e.target as HTMLImageElement).src = '/asd.ico.png'; }}
                    />
                    <div className="text-left space-y-0.5 pl-1">
                      <div className="text-[10.5px] font-bold text-slate-900 font-cambria">Republic of the Philippines</div>
                      <div className="text-[10px] font-normal tracking-wide uppercase text-slate-800 font-cambria">OFFICE OF THE PRESIDENT</div>
                      <div className="text-xs sm:text-sm font-bold text-slate-950 uppercase tracking-wide font-trajan">NATIONAL IRRIGATION ADMINISTRATION</div>
                      <div className="text-[10.5px] font-bold text-slate-700 uppercase tracking-wide font-trajan">REGIONAL OFFICE NO. IV-B (MIMAROPA)</div>
                    </div>
                  </div>

                  {/* Right Header Logo (Bagong Pilipinas) */}
                  <div className="text-right flex flex-col items-end shrink-0">
                    <img 
                      src="/header-2026-right.png" 
                      alt="Bagong Pilipinas" 
                      className="h-14 w-auto object-contain shrink-0"
                    />
                  </div>
                </div>

                {/* 2. IMO & NIS Identification Banner Box (Top of First Page of Entry) */}
                {pageIdx === 0 && (
                  <div className="my-3 p-2 text-center border-2 border-black bg-white shrink-0">
                    <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-black">
                      {report.imoOffice || 'MINDORO ORIENTAL-MARINDUQUE-ROMBLON IMO'}
                    </h2>
                    <h3 className="text-xs font-bold uppercase text-slate-800">
                      {report.nisBinding || 'BACO-BUCAYAO RIS'}
                    </h3>
                    <div className="text-[10px] font-semibold text-slate-700">
                      {selectedWeekObj.label}
                    </div>
                  </div>
                )}

                {/* 3. Photos Side-by-Side 4:3 Gallery Layout (Up to 6 photos per page) */}
                <div className="flex-1 my-3 grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-center justify-center">
                  {pagePhotos.map((photo, pIdx) => {
                    const capturedDateStr = photo.capturedAt 
                      ? new Date(photo.capturedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                      : new Date().toLocaleDateString('en-US');

                    const latStr = photo.lat !== undefined ? photo.lat.toFixed(6) : (report.lat ? report.lat.toFixed(6) : '');
                    const lngStr = photo.lng !== undefined ? photo.lng.toFixed(6) : (report.lng ? report.lng.toFixed(6) : '');

                    const stageUpper = (photo.stage || 'Photo').toUpperCase();

                    return (
                      <div key={photo.id || pIdx} className="relative border-2 border-black rounded-lg overflow-hidden bg-slate-100 aspect-[4/3] w-full shadow-sm flex items-center justify-center">
                        <img 
                          src={photo.url} 
                          alt="Maintenance Site Photo" 
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.currentTarget;
                            target.style.display = 'none';
                            const parent = target.parentElement;
                            if (parent && !parent.querySelector('.img-doc-fallback')) {
                              const fallback = document.createElement('div');
                              fallback.className = 'img-doc-fallback w-full h-full flex flex-col items-center justify-center text-slate-400 text-[11px] p-4 text-center bg-slate-100 font-sans';
                              fallback.innerHTML = '<span class="text-xl mb-1">📷</span><span class="font-semibold text-slate-600">[Photo Attachment Offline / Pending Cloud Sync]</span>';
                              parent.prepend(fallback);
                            }
                          }}
                        />

                        {/* Stage Badge on Top Left Corner of Photo (Wrapped on top of photo) */}
                        <div className={`absolute top-2 left-2 px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shadow-md text-white border ${
                          stageUpper === 'BEFORE' 
                            ? 'bg-blue-600/95 border-blue-400' 
                            : stageUpper === 'AFTER'
                            ? 'bg-emerald-600/95 border-emerald-400'
                            : 'bg-amber-500/95 border-amber-300'
                        }`}>
                          {photo.stage || 'Photo'}
                        </div>

                        {/* Photo Caption Strip on Bottom Left */}
                        {photo.caption && !photo.caption.startsWith('Before #') && !photo.caption.startsWith('During #') && !photo.caption.startsWith('After #') && (
                          <div className="absolute bottom-2 left-2 max-w-[55%] bg-black/60 text-white px-2 py-1 rounded text-[8.5px] leading-snug border border-white/20 shadow-sm backdrop-blur-xs">
                            <span className="font-semibold text-slate-100 line-clamp-2">{photo.caption}</span>
                          </div>
                        )}

                        {/* Date & Location Label on Bottom Right (Auto-sized, tight-fitting box) */}
                        {(() => {
                          const canalName = (photo.canalSegment || report.canalSegment || '').trim();
                          const locName = (photo.locationName || report.locationName || report.nisBinding || '').trim();
                          let canalLocationLine = '';
                          if (canalName && locName && !canalName.toLowerCase().includes(locName.toLowerCase())) {
                            canalLocationLine = `${canalName} (${locName})`;
                          } else {
                            canalLocationLine = canalName || locName || 'Irrigation System';
                          }

                          return (
                            <div className="absolute bottom-2 right-2 bg-black/35 text-white px-2 py-1 rounded text-[8.5px] font-mono leading-tight space-y-0.5 border border-white/20 shadow-sm backdrop-blur-xs w-fit max-w-[85%]">
                              <div className="font-bold text-amber-300 flex items-center gap-1 whitespace-nowrap">
                                <Clock className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                                <span>{capturedDateStr}</span>
                              </div>
                              {latStr && lngStr && (
                                <div className="flex items-center gap-1 text-slate-100 whitespace-nowrap">
                                  <MapPin className="w-2.5 h-2.5 text-cyan-300 shrink-0" />
                                  <span>{latStr}°N, {lngStr}°E</span>
                                </div>
                              )}
                              {canalLocationLine && (
                                <div className="text-[7.5px] text-slate-200 truncate whitespace-nowrap max-w-[220px]">
                                  {canalLocationLine}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })}
                </div>

                {/* 4. Description & Particulars Box — 2-Row Format (Row 2 removed) */}
                <div className="my-2.5 p-2.5 text-center border-2 border-black bg-white shrink-0 space-y-1">
                  <div className="text-xs sm:text-sm font-black uppercase tracking-wider text-black">
                    {activityCategory}
                  </div>
                  <p className="text-[11px] sm:text-xs text-slate-800 leading-snug font-medium">
                    {remarksLine}
                  </p>
                </div>

                {/* 5. Document Bottom Footer */}
                <div className="border-t border-black pt-1.5 mt-2 flex items-center justify-between text-[9px] text-slate-800 shrink-0">
                  <span className="font-bold font-mono text-black">{formatReportId(report.id, report.revisionNumber)}</span>
                  <span className="text-[8.5px] italic font-sans text-slate-600">NIA-RO4B-EOD-OPS-INT-Form691 Rev.01</span>
                </div>
              </div>
            ));
          })}
        </div>
      )}
    </div>
  );
};

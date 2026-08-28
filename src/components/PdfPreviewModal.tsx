import React, { useEffect, useState, useRef, useCallback } from 'react';
import { 
  X, 
  Download, 
  Printer, 
  FileText, 
  Loader2, 
  CheckCircle2, 
  FileDown,
  Settings,
  FileSignature
} from 'lucide-react';
import { FieldReport } from '../types';
import { buildReportPdfBlob, downloadReportPdf } from '../utils/reportPdfBuilder';
import { formatReportId } from '../utils/reportIdGenerator';
import { jsPDF } from 'jspdf';

interface PdfPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  report?: FieldReport | null;
  pdfBlob?: Blob | null;
  pdfUrl?: string | null;
  title?: string;
  fileName?: string;
  onOpenConfigurations?: () => void;
}

export const PdfPreviewModal: React.FC<PdfPreviewModalProps> = ({
  isOpen,
  onClose,
  report,
  pdfBlob: directBlob,
  pdfUrl: directUrl,
  title: directTitle,
  fileName: directFileName,
  onOpenConfigurations
}) => {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfDoc, setPdfDoc] = useState<jsPDF | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Listen for live signatories updates from Configurations Modal
  useEffect(() => {
    const handleSignatoriesUpdated = () => {
      setRefreshKey(prev => prev + 1);
    };
    window.addEventListener('ommap_signatories_updated', handleSignatoriesUpdated);
    return () => {
      window.removeEventListener('ommap_signatories_updated', handleSignatoriesUpdated);
    };
  }, []);

  useEffect(() => {
    let activeCreatedUrl: string | null = null;

    async function loadPdf() {
      if (!isOpen) {
        setPdfUrl(null);
        setPdfDoc(null);
        return;
      }

      if (directUrl) {
        setPdfUrl(directUrl);
        setIsLoading(false);
        return;
      }

      if (report) {
        setIsLoading(true);
        try {
          const { url, doc } = await buildReportPdfBlob(report);
          activeCreatedUrl = url;
          setPdfUrl(url);
          setPdfDoc(doc);
        } catch (err) {
          console.error('Failed to generate PDF preview:', err);
        } finally {
          setIsLoading(false);
        }
      }
    }

    loadPdf();

    return () => {
      if (activeCreatedUrl) {
        URL.revokeObjectURL(activeCreatedUrl);
      }
    };
  }, [isOpen, report, directUrl, refreshKey]);

  if (!isOpen || (!report && !directUrl && !directBlob)) return null;

  const fileName = directFileName || (report ? `Report_${formatReportId(report.id, report.revisionNumber).replace(/[^a-zA-Z0-9._-]/g, '_')}.pdf` : 'Document.pdf');
  const title = directTitle || (report ? `PDF Preview: ${formatReportId(report.id, report.revisionNumber)}` : 'PDF Document Preview');

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      if (directBlob) {
        const url = URL.createObjectURL(directBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else if (pdfDoc) {
        pdfDoc.save(fileName);
      } else if (report) {
        await downloadReportPdf(report);
      } else if (pdfUrl) {
        const a = document.createElement('a');
        a.href = pdfUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (err) {
      console.error('Download failed:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePrint = () => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      try {
        iframeRef.current.contentWindow.print();
      } catch (e) {
        window.open(pdfUrl || '', '_blank');
      }
    } else if (pdfUrl) {
      window.open(pdfUrl, '_blank');
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[120] flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="w-full max-w-5xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col h-[90vh] max-h-[92vh] overflow-hidden relative z-10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header Bar */}
        <div className="p-3.5 sm:p-4 border-b border-slate-800 bg-slate-900/95 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-bold text-white font-heading truncate">
                  {title}
                </h3>
                {report && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                    {(report.approvalStatus || 'Draft').replace('_', ' ')}
                  </span>
                )}
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate">
                National Irrigation Administration • {report?.imoOffice || 'Regional Office IV-B (MIMAROPA)'} {report?.title ? `• ${report.title}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Direct Download Button */}
            <button
              type="button"
              onClick={handleDownload}
              disabled={isLoading || isDownloading}
              className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-lg shadow-emerald-500/20 transition cursor-pointer disabled:opacity-50"
              title="Download PDF file directly"
            >
              {isDownloading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <FileDown className="w-3.5 h-3.5" />
                  <span>Download PDF</span>
                </>
              )}
            </button>

            {/* Print Button */}
            <button
              type="button"
              onClick={handlePrint}
              disabled={isLoading || !pdfUrl}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 rounded-xl text-xs font-semibold px-3 py-2 transition cursor-pointer disabled:opacity-50"
              title="Print document"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Print</span>
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 transition cursor-pointer"
              title="Close Preview"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body: Embedded PDF Iframe / Loading State */}
        <div className="flex-1 bg-slate-950 p-2 sm:p-4 overflow-hidden relative flex flex-col items-center justify-center">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
              <Loader2 className="w-10 h-10 text-emerald-400 animate-spin" />
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-200">Building Official PDF Document...</h4>
                <p className="text-xs text-slate-400 max-w-sm">
                  Formatting technical accomplishment tables, embedding GPS photo logs, and stamping official NIA signatories.
                </p>
              </div>
            </div>
          ) : pdfUrl ? (
            <div className="w-full h-full flex flex-col bg-white rounded-xl shadow-inner overflow-hidden border border-slate-800">
              <iframe
                ref={iframeRef}
                src={pdfUrl}
                title={`PDF Document Preview: ${fileName}`}
                className="w-full h-full border-none"
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 p-8 text-center text-slate-400">
              <FileText className="w-10 h-10 text-slate-600" />
              <p className="text-xs">Unable to load document preview. You can still download the report directly.</p>
              <button
                type="button"
                onClick={handleDownload}
                className="mt-2 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold"
              >
                Download PDF
              </button>
            </div>
          )}
        </div>

        {/* Modal Footer Bar: Quick Link to Configure Signatories, Designation & Footnotes */}
        <div className="p-2.5 sm:p-3 bg-slate-900/95 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-cyan-400 shrink-0" />
            <span className="text-slate-300 font-medium">Need to update signatories, designations, or document footnotes?</span>
          </div>
          {onOpenConfigurations && (
            <button
              type="button"
              onClick={onOpenConfigurations}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-cyan-950/60 text-cyan-300 hover:text-cyan-200 border border-cyan-500/40 hover:border-cyan-400 rounded-lg font-bold text-xs transition cursor-pointer shadow-sm active:scale-95"
            >
              <FileSignature className="w-3.5 h-3.5 text-cyan-400" />
              <span>Configure Signatories &amp; Footnotes</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { 
  X, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Edit3, 
  LogOut 
} from 'lucide-react';
import { AccessRequest } from '../types';

interface AccessRequestStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: AccessRequest | null;
  onRefresh: () => void;
  onEditDetails: () => void;
  isLight: boolean;
}

export const AccessRequestStatusModal: React.FC<AccessRequestStatusModalProps> = ({
  isOpen,
  onClose,
  request,
  onRefresh,
  onEditDetails,
  isLight,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  if (!isOpen || !request) return null;

  const isPending = request.status === 'pending';
  const isRejected = request.status === 'rejected';
  const isApproved = request.status === 'approved';

  const handleRefreshClick = () => {
    setIsRefreshing(true);
    onRefresh();
    setTimeout(() => setIsRefreshing(false), 600);
  };

  const getApprovingBodyText = (office?: string) => {
    if (!office || office === 'Regional Office IV-B' || office === 'All IMOs') {
      return 'Developer & Regional Office Administrator (RO Admin / RO Evaluator)';
    }
    const imoShort = office.replace('Mindoro Oriental-Marinduque-Romblon IMO', 'MOMARO IMO');
    return `${imoShort} Administrator (IMO Admin / IMO Evaluator), RO Admin & Developer`;
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-md animate-in fade-in overflow-y-auto ${
      isLight ? 'bg-slate-900/40' : 'bg-black/75'
    }`}>
      <div className={`w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] my-auto transition-colors duration-200 ${
        isLight 
          ? 'bg-white border-slate-300 text-slate-900 shadow-slate-900/15' 
          : 'bg-[#18181b] border-[#3f3f46] text-[#fafafa]'
      }`}>
        
        {/* Header */}
        <div className={`p-4 sm:p-5 border-b flex items-center justify-between gap-4 ${
          isLight 
            ? 'border-slate-200 bg-slate-50/90' 
            : 'border-[#3f3f46] bg-[#1f1f23]'
        }`}>
          <div className="flex items-center gap-3.5 min-w-0">
            {request.avatar ? (
              <img
                src={request.avatar}
                alt={request.fullName}
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
                Account Status Details
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
            title="Close Status Window"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto custom-scrollbar">
          
          {/* Status Indicator Card */}
          <div className={`p-4 rounded-xl border flex items-start gap-3.5 ${
            isPending
              ? (isLight ? 'bg-amber-50/90 border-amber-300 text-amber-950' : 'bg-amber-950/25 border-amber-500/40 text-amber-200')
              : isRejected
              ? (isLight ? 'bg-rose-50/90 border-rose-300 text-rose-950' : 'bg-rose-950/25 border-rose-500/40 text-rose-200')
              : (isLight ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950' : 'bg-emerald-950/25 border-emerald-500/40 text-emerald-200')
          }`}>
            <div className="mt-0.5 shrink-0">
              {isPending && <Clock className="w-5 h-5 text-amber-500 animate-pulse" />}
              {isRejected && <XCircle className="w-5 h-5 text-rose-500" />}
              {isApproved && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <h3 className={`font-bold text-sm ${
                  isLight 
                    ? (isPending ? 'text-amber-950' : isRejected ? 'text-rose-950' : 'text-emerald-950')
                    : (isPending ? 'text-amber-200' : isRejected ? 'text-rose-200' : 'text-emerald-200')
                }`}>
                  {isPending && 'Pending Administrative Approval'}
                  {isRejected && 'Access Request Declined'}
                  {isApproved && 'Access Granted & Approved!'}
                </h3>
                <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full font-bold uppercase border shrink-0 ${
                  isPending
                    ? (isLight ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-amber-500/20 text-amber-300 border-amber-500/40')
                    : isRejected
                    ? (isLight ? 'bg-rose-100 text-rose-800 border-rose-300' : 'bg-rose-500/20 text-rose-300 border-rose-500/40')
                    : (isLight ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40')
                }`}>
                  {request.status}
                </span>
              </div>
              <p className={`text-xs mt-1.5 leading-relaxed ${isLight ? 'text-amber-950/90' : 'text-zinc-300'}`}>
                {isPending && (
                  <>
                    Your registration details have been received and are awaiting verification by{' '}
                    <strong className={`font-semibold ${isLight ? 'text-amber-950' : 'text-amber-300'}`}>
                      {getApprovingBodyText(request.requestedOffice)}
                    </strong>. Once approved and your role is assigned, you will be able to log in directly.
                  </>
                )}
                {isRejected && (
                  <>
                    Your access request could not be approved at this time.{' '}
                    {request.rejectionReason && (
                      <span className={`block mt-1.5 p-2 rounded-lg border font-medium text-[11px] ${
                        isLight ? 'bg-rose-100/70 border-rose-200 text-rose-900' : 'bg-rose-500/10 border-rose-500/20 text-rose-200'
                      }`}>
                        Reason: {request.rejectionReason}
                      </span>
                    )}
                  </>
                )}
                {isApproved && (
                  <>
                    Congratulations! Your account has been approved by{' '}
                    <strong className={`font-semibold ${isLight ? 'text-emerald-950' : 'text-emerald-300'}`}>
                      {request.reviewedBy || 'Administrator'}
                    </strong> with role{' '}
                    <strong className={`font-semibold ${isLight ? 'text-emerald-950' : 'text-emerald-300'}`}>
                      {request.assignedRole}
                    </strong>.
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Submitted Information Summary */}
          <div className={`p-4 rounded-xl border text-xs space-y-3 ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#27272a] border-[#3f3f46]'
          }`}>
            <div className={`flex items-center justify-between text-[11px] font-mono uppercase font-bold border-b pb-2 ${
              isLight ? 'text-slate-500 border-slate-200' : 'text-zinc-400 border-[#3f3f46]'
            }`}>
              <span>Submitted Registration Profile</span>
              <span>Req ID: {request.id ? request.id.slice(0, 14) : 'N/A'}</span>
            </div>

            <div className="flex items-center justify-between gap-4">
              <span className={isLight ? 'text-slate-500 font-medium' : 'text-zinc-400 font-medium'}>
                Full Name:
              </span>
              <span className={`font-semibold text-right truncate max-w-[240px] ${
                isLight ? 'text-slate-900' : 'text-zinc-100'
              }`}>
                {request.fullName}
              </span>
            </div>

            <div className="flex items-center justify-between gap-4">
              <span className={isLight ? 'text-slate-500 font-medium' : 'text-zinc-400 font-medium'}>
                Official Mobile Number:
              </span>
              <span className={`font-mono font-semibold ${
                isLight ? 'text-emerald-700' : 'text-emerald-400'
              }`}>
                {request.contactNumber || 'Not provided'}
              </span>
            </div>

            <div className="flex items-center justify-between gap-4">
              <span className={isLight ? 'text-slate-500 font-medium' : 'text-zinc-400 font-medium'}>
                Official NIA Designation:
              </span>
              <span className={`font-semibold text-right truncate max-w-[240px] ${
                isLight ? 'text-slate-900' : 'text-zinc-100'
              }`}>
                {request.designation}
              </span>
            </div>

            <div className="flex items-center justify-between gap-4">
              <span className={isLight ? 'text-slate-500 font-medium' : 'text-zinc-400 font-medium'}>
                Designated NIA Office:
              </span>
              <span className={`font-semibold text-right ${
                isLight ? 'text-slate-900' : 'text-zinc-100'
              }`}>
                {request.requestedOffice}
              </span>
            </div>

            <div className={`pt-1 text-[10px] font-mono text-right ${
              isLight ? 'text-slate-400' : 'text-zinc-500'
            }`}>
              Submitted: {new Date(request.submittedAt).toLocaleString()}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
            <button
              type="button"
              onClick={handleRefreshClick}
              disabled={isRefreshing}
              className={`flex-1 py-2.5 px-4 rounded-xl border text-xs font-semibold transition flex items-center justify-center gap-2 cursor-pointer ${
                isLight 
                  ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800' 
                  : 'bg-[#27272a] hover:bg-[#3f3f46] border-[#3f3f46] text-[#fafafa]'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-500' : ''}`} />
              <span>{isRefreshing ? 'Checking Server...' : 'Check Approval Status'}</span>
            </button>

            {isRejected && (
              <button
                type="button"
                onClick={onEditDetails}
                className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition flex items-center justify-center gap-2 cursor-pointer shadow-sm border border-emerald-700/60"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Update Details &amp; Re-Submit</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className={`py-2.5 px-4 rounded-xl border text-xs font-semibold transition flex items-center justify-center gap-2 cursor-pointer ${
                isLight 
                  ? 'border-slate-300 hover:bg-slate-100 text-slate-700' 
                  : 'border-[#3f3f46] bg-[#27272a] hover:bg-[#3f3f46] text-zinc-300 hover:text-white'
              }`}
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Back to Portal</span>
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};

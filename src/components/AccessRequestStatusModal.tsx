import React, { useState } from 'react';
import { 
  X, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  XCircle, 
  User, 
  Phone, 
  Building2, 
  ShieldCheck, 
  MapPin, 
  RefreshCw, 
  Edit3, 
  LogOut,
  Sparkles,
  Info,
  Layers
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
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xl animate-in fade-in overflow-y-auto ${
      isLight ? 'bg-slate-900/50' : 'bg-slate-950/85'
    }`}>
      <div className={`w-full max-w-lg rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] my-auto transition-colors duration-300 ${
        isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-white'
      }`}>
        
        {/* Header */}
        <div className={`p-5 border-b flex items-center justify-between ${
          isLight ? 'border-slate-200 bg-slate-50' : 'border-slate-800 bg-slate-900/90'
        }`}>
          <div className="flex items-center gap-3">
            {request.avatar ? (
              <img
                src={request.avatar}
                alt={request.fullName}
                className="w-11 h-11 rounded-2xl object-cover border-2 border-emerald-500 shadow-sm shrink-0"
              />
            ) : (
              <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-600 font-bold font-mono text-sm shrink-0">
                NIA
              </div>
            )}
            <div>
              <span className="text-[10px] font-mono font-bold uppercase text-[#009933]">
                APPLICATION ACCESS REQUEST
              </span>
              <h2 className="text-base font-bold font-heading">
                Account Status Details
              </h2>
              <p className="text-[11px] text-slate-500 truncate max-w-[260px] sm:max-w-xs">
                {request.email}
              </p>
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

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto custom-scrollbar">
          
          {/* Status Indicator Card */}
          <div className={`p-4 rounded-2xl border flex items-start gap-3.5 ${
            isPending
              ? (isLight ? 'bg-amber-50/80 border-amber-300 text-amber-950' : 'bg-amber-950/30 border-amber-500/40 text-amber-200')
              : isRejected
              ? (isLight ? 'bg-rose-50 border-rose-300 text-rose-950' : 'bg-rose-950/30 border-rose-500/40 text-rose-200')
              : (isLight ? 'bg-emerald-50 border-emerald-300 text-emerald-950' : 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200')
          }`}>
            <div className="mt-0.5 shrink-0">
              {isPending && <Clock className="w-6 h-6 text-amber-600 animate-pulse" />}
              {isRejected && <XCircle className="w-6 h-6 text-rose-600" />}
              {isApproved && <CheckCircle2 className="w-6 h-6 text-emerald-600" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm">
                  {isPending && 'Pending Administrative Approval'}
                  {isRejected && 'Access Request Declined'}
                  {isApproved && 'Access Granted & Approved!'}
                </h3>
                <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full font-bold uppercase border ${
                  isPending
                    ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40'
                    : isRejected
                    ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/40'
                    : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40'
                }`}>
                  {request.status}
                </span>
              </div>
              <p className="text-xs mt-1 opacity-90 leading-relaxed">
                {isPending && (
                  <>
                    Your registration details have been received and are awaiting verification by{' '}
                    <strong>{getApprovingBodyText(request.requestedOffice)}</strong>. Once approved and your role is assigned, you will be able to log in directly.
                  </>
                )}
                {isRejected && (
                  <>
                    Your access request could not be approved at this time.{' '}
                    {request.rejectionReason && (
                      <span className="block mt-1 p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 font-medium text-[11px]">
                        Reason: {request.rejectionReason}
                      </span>
                    )}
                  </>
                )}
                {isApproved && (
                  <>
                    Congratulations! Your account has been approved by <strong>{request.reviewedBy || 'Administrator'}</strong> with role <strong>{request.assignedRole}</strong>.
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Submitted Information Summary */}
          <div className={`p-4 rounded-2xl border text-xs space-y-2.5 ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-800/60 border-slate-700/80'
          }`}>
            <div className="flex items-center justify-between text-[11px] font-mono uppercase text-slate-500 font-bold border-b pb-1.5 dark:border-slate-700">
              <span>Submitted Registration Profile</span>
              <span>Req ID: {request.id.slice(0, 14)}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-[#009933]" />
                Full Name:
              </span>
              <span className="font-semibold text-right truncate max-w-[200px]">{request.fullName}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-[#009933]" />
                Contact Number:
              </span>
              <span className="font-mono font-semibold text-[#009933]">{request.contactNumber || 'Not provided'}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#009933]" />
                NIA Designation:
              </span>
              <span className="font-semibold text-right truncate max-w-[200px]">{request.designation}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-[#009933]" />
                Designated Office:
              </span>
              <span className="font-semibold text-right">{request.requestedOffice}</span>
            </div>

            <div className="flex items-start justify-between">
              <span className="text-slate-500 flex items-center gap-1.5 shrink-0">
                <Layers className="w-3.5 h-3.5 text-[#009933]" />
                Requested Applications:
              </span>
              <div className="text-right space-y-1 max-w-[240px]">
                {Array.isArray(request.requestedApps) && request.requestedApps.length > 0 ? (
                  request.requestedApps.map(app => (
                    <span key={app} className="inline-block text-[10.5px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 font-semibold border border-emerald-500/20 mr-1 mb-1">
                      {app}
                    </span>
                  ))
                ) : (
                  <span className="inline-block text-[10.5px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 font-semibold border border-emerald-500/20">
                    Maintenance and Status of Irrigation Facilities
                  </span>
                )}
              </div>
            </div>

            <div className="pt-1 text-[10px] text-slate-500 font-mono text-right">
              Submitted: {new Date(request.submittedAt).toLocaleString()}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
            <button
              type="button"
              onClick={handleRefreshClick}
              disabled={isRefreshing}
              className={`flex-1 py-3 px-4 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                isLight ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800' : 'bg-slate-800 hover:bg-slate-750 border-slate-700 text-white'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#009933]' : ''}`} />
              <span>{isRefreshing ? 'Checking Server...' : 'Check Approval Status'}</span>
            </button>

            {isRejected && (
              <button
                type="button"
                onClick={onEditDetails}
                className="py-3 px-4 rounded-xl bg-[#009933] hover:bg-[#00802b] text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Update Details &amp; Re-Submit</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className={`py-3 px-4 rounded-xl border text-xs font-semibold transition flex items-center justify-center gap-2 cursor-pointer ${
                isLight ? 'border-slate-300 hover:bg-slate-100 text-slate-600' : 'border-slate-700 hover:bg-slate-800 text-slate-300'
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

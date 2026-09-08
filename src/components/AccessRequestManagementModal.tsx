import React, { useState, useMemo } from 'react';
import { 
  X, 
  Users, 
  ShieldCheck, 
  Check, 
  XCircle, 
  Clock, 
  Search, 
  Filter, 
  Phone, 
  Mail, 
  Building2, 
  MapPin, 
  Briefcase, 
  Copy, 
  CheckCircle2, 
  AlertTriangle, 
  ChevronRight, 
  Edit3, 
  Trash2, 
  Sparkles,
  RefreshCw,
  ExternalLink,
  Layers
} from 'lucide-react';
import { AccessRequest, AuthUser, UserRole } from '../types';
import { 
  IMO_NIS_MAPPING, 
  CANONICAL_IMO_OFFICES, 
  isMasterAdmin, 
  isRegionalAdmin, 
  isImoAdmin,
  getAdminJurisdictionLabel,
  approveAccessRequestApi,
  rejectAccessRequestApi,
  revokeAccessRequestApi
} from '../config/authUsers';

interface AccessRequestManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AuthUser | null;
  requests: AccessRequest[];
  onRefreshRequests: () => void;
  isLight: boolean;
}

export const AccessRequestManagementModal: React.FC<AccessRequestManagementModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  requests,
  onRefreshRequests,
  isLight,
}) => {
  const [selectedOfficeFilter, setSelectedOfficeFilter] = useState<string>('All');
  const [statusTab, setStatusTab] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedPhoneId, setCopiedPhoneId] = useState<string | null>(null);

  // Per-request editing state for role and NIS assignment
  const [assignedRoles, setAssignedRoles] = useState<Record<string, UserRole>>({});
  const [assignedNisMap, setAssignedNisMap] = useState<Record<string, string>>({});
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  const isDev = isMasterAdmin(currentUser);
  const isRO = isRegionalAdmin(currentUser);
  const isIMO = isImoAdmin(currentUser);

  // Determine allowed office filters based on admin role
  const availableOffices = useMemo(() => {
    if (isDev || isRO) {
      return ['All', 'Regional Office IV-B', 'Mindoro Oriental-Marinduque-Romblon IMO', 'Occidental Mindoro IMO', 'Palawan IMO'];
    }
    if (currentUser?.imoOffice) {
      return [currentUser.imoOffice];
    }
    return ['All'];
  }, [isDev, isRO, currentUser]);

  // Filter requests based on admin jurisdiction + user filters
  const filteredRequests = useMemo(() => {
    return requests.filter(req => {
      // 1. Jurisdiction check
      if (isIMO && currentUser?.imoOffice) {
        const reqOffice = (req.requestedOffice || '').toLowerCase();
        const adminOffice = currentUser.imoOffice.toLowerCase();
        if (!reqOffice.includes(adminOffice) && !adminOffice.includes(reqOffice)) {
          return false;
        }
      }

      // 2. Status tab filter
      if (statusTab !== 'all' && req.status !== statusTab) {
        return false;
      }

      // 3. Office dropdown filter
      if (selectedOfficeFilter !== 'All' && req.requestedOffice !== selectedOfficeFilter) {
        return false;
      }

      // 4. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = req.fullName?.toLowerCase().includes(q);
        const matchEmail = req.email?.toLowerCase().includes(q);
        const matchPhone = req.contactNumber?.toLowerCase().includes(q);
        const matchDesig = req.designation?.toLowerCase().includes(q);
        if (!matchName && !matchEmail && !matchPhone && !matchDesig) {
          return false;
        }
      }

      return true;
    });
  }, [requests, isIMO, currentUser, statusTab, selectedOfficeFilter, searchQuery]);

  if (!isOpen) return null;

  // Counts
  const pendingCount = requests.filter(r => {
    if (isIMO && currentUser?.imoOffice) {
      const reqOffice = (r.requestedOffice || '').toLowerCase();
      const adminOffice = currentUser.imoOffice.toLowerCase();
      return r.status === 'pending' && (reqOffice.includes(adminOffice) || adminOffice.includes(reqOffice));
    }
    return r.status === 'pending';
  }).length;

  const approvedCount = requests.filter(r => {
    if (isIMO && currentUser?.imoOffice) {
      const reqOffice = (r.requestedOffice || '').toLowerCase();
      const adminOffice = currentUser.imoOffice.toLowerCase();
      return r.status === 'approved' && (reqOffice.includes(adminOffice) || adminOffice.includes(reqOffice));
    }
    return r.status === 'approved';
  }).length;

  const handleCopyPhone = (id: string, phone: string) => {
    navigator.clipboard.writeText(phone);
    setCopiedPhoneId(id);
    setTimeout(() => setCopiedPhoneId(null), 2000);
  };

  const handleApprove = async (req: AccessRequest) => {
    setIsSubmittingAction(true);
    const assignedRole = assignedRoles[req.id] || req.requestedRole || 'IMO Reviewer';
    const assignedNis = assignedNisMap[req.id] || (Array.isArray(req.requestedNisList) ? req.requestedNisList.join(', ') : 'All NIS');

    await approveAccessRequestApi(req.id, {
      assignedRole: assignedRole,
      assignedOffice: req.requestedOffice,
      assignedNis: assignedNis,
      reviewerName: currentUser?.name || 'Authorized Administrator',
      reviewerRole: currentUser?.role || 'RO Admin',
    });

    setIsSubmittingAction(false);
    onRefreshRequests();
  };

  const handleReject = async (reqId: string) => {
    setIsSubmittingAction(true);
    await rejectAccessRequestApi(reqId, {
      rejectionReason: rejectReason.trim() || 'Jurisdiction or credential verification incomplete.',
      reviewerName: currentUser?.name || 'Authorized Administrator',
      reviewerRole: currentUser?.role || 'RO Admin',
    });

    setRejectingId(null);
    setRejectReason('');
    setIsSubmittingAction(false);
    onRefreshRequests();
  };

  const handleRevoke = async (reqId: string) => {
    if (window.confirm('Are you sure you want to suspend/revoke access for this user?')) {
      setIsSubmittingAction(true);
      await revokeAccessRequestApi(reqId);
      setIsSubmittingAction(false);
      onRefreshRequests();
    }
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 backdrop-blur-xl animate-in fade-in overflow-y-auto ${
      isLight ? 'bg-slate-900/50' : 'bg-slate-950/85'
    }`}>
      <div className={`w-full max-w-4xl rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[92vh] my-auto transition-colors duration-300 ${
        isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-white'
      }`}>
        
        {/* Header */}
        <div className={`p-5 border-b flex items-center justify-between ${
          isLight ? 'border-slate-200 bg-slate-50' : 'border-slate-800 bg-slate-900/90'
        }`}>
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-600 shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase text-[#009933]">
                  ADMINISTRATIVE ACCESS GATEWAY
                </span>
                <span className="text-[9px] px-2 py-0.2 rounded-full font-mono bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-500/30">
                  {currentUser?.role || 'Administrator'}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold font-heading">
                Personnel Access Requests &amp; Role Management
              </h2>
              <p className="text-[11px] text-slate-500 truncate max-w-xs sm:max-w-md">
                Jurisdiction: <strong className="text-emerald-600 dark:text-emerald-400">{getAdminJurisdictionLabel(currentUser)}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRefreshRequests}
              className={`p-2 rounded-xl border transition cursor-pointer ${
                isLight ? 'border-slate-300 hover:bg-slate-200 text-slate-600' : 'border-slate-700 hover:bg-slate-800 text-slate-400'
              }`}
              title="Refresh Requests"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
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
        </div>

        {/* Toolbar & Filter Bar */}
        <div className={`p-4 border-b space-y-3 ${
          isLight ? 'border-slate-200 bg-slate-50/50' : 'border-slate-800 bg-slate-850/50'
        }`}>
          {/* Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-200/60 dark:bg-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setStatusTab('pending')}
                className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  statusTab === 'pending'
                    ? 'bg-[#009933] text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Pending Review</span>
                {pendingCount > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white text-emerald-800 font-mono font-bold">
                    {pendingCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setStatusTab('approved')}
                className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  statusTab === 'approved'
                    ? 'bg-[#009933] text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Approved Users</span>
                {approvedCount > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-mono font-bold">
                    {approvedCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setStatusTab('all')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                  statusTab === 'all'
                    ? 'bg-[#009933] text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                All Records
              </button>
            </div>

            {/* Jurisdiction Notice */}
            <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>
                {isDev && 'Master Authority: Grants RO and IMO permissions'}
                {isRO && 'Regional Authority: Reviews RO and all IMO applicants'}
                {isIMO && `IMO Authority: Reviews applicants for ${currentUser?.imoOffice?.replace(' IMO', '')}`}
              </span>
            </div>
          </div>

          {/* Search & Office Filter */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
            <div className="sm:col-span-7 relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by Name, Email, Contact Number, or Designation..."
                className={`w-full text-xs rounded-xl pl-9 pr-3 py-2 border transition focus:outline-none ${
                  isLight ? 'bg-white border-slate-300 focus:border-[#009933]' : 'bg-slate-800 border-slate-700 focus:border-[#009933]'
                }`}
              />
            </div>

            <div className="sm:col-span-5">
              <select
                value={selectedOfficeFilter}
                onChange={(e) => setSelectedOfficeFilter(e.target.value)}
                disabled={availableOffices.length === 1}
                className={`w-full text-xs rounded-xl px-3 py-2 border transition focus:outline-none ${
                  isLight ? 'bg-white border-slate-300 focus:border-[#009933]' : 'bg-slate-800 border-slate-700 focus:border-[#009933]'
                }`}
              >
                {availableOffices.map((off) => (
                  <option key={off} value={off}>
                    {off === 'All' ? '?? Filter by Office (All Offices)' : off}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Requests List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 custom-scrollbar">
          {filteredRequests.length === 0 ? (
            <div className={`p-10 rounded-2xl border text-center ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-800/30 border-slate-800'
            }`}>
              <Users className="w-10 h-10 mx-auto text-slate-400 mb-2 opacity-60" />
              <h3 className="font-bold text-sm">No Access Requests Found</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {statusTab === 'pending'
                  ? 'There are currently no pending access requests requiring your jurisdictional review.'
                  : 'No records matching your search and filter criteria.'}
              </p>
            </div>
          ) : (
            filteredRequests.map((req) => {
              const currentAssignedRole = assignedRoles[req.id] || req.assignedRole || req.requestedRole || 'IMO Reviewer';
              const isPending = req.status === 'pending';
              const isApproved = req.status === 'approved';
              const isRejected = req.status === 'rejected';

              return (
                <div
                  key={req.id}
                  className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                    isPending
                      ? (isLight ? 'bg-white border-amber-300 shadow-sm' : 'bg-slate-850 border-amber-500/40')
                      : isApproved
                      ? (isLight ? 'bg-white border-emerald-300' : 'bg-slate-850 border-emerald-500/40')
                      : (isLight ? 'bg-slate-50 border-slate-200 opacity-75' : 'bg-slate-900 border-slate-800 opacity-75')
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    
                    {/* User Profile Info */}
                    <div className="flex items-start gap-3 min-w-0">
                      {req.avatar ? (
                        <img
                          src={req.avatar}
                          alt={req.fullName}
                          className="w-12 h-12 rounded-2xl object-cover border-2 border-emerald-500/40 shadow-sm shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-600 font-bold font-mono text-sm shrink-0">
                          {req.firstName[0]}{req.lastName[0]}
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-sm truncate">{req.fullName}</h3>
                          <span className={`text-[9px] font-mono px-2 py-0.2 rounded-full font-bold uppercase border ${
                            isPending
                              ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40'
                              : isApproved
                              ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40'
                              : 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/40'
                          }`}>
                            {req.status}
                          </span>
                        </div>

                        {/* Contact & Email Badges */}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mt-1">
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                            <a href={`mailto:${req.email}`} className="hover:underline text-emerald-600 dark:text-emerald-400">
                              {req.email}
                            </a>
                          </span>

                          <span className="flex items-center gap-1 font-mono">
                            <Phone className="w-3 h-3 text-[#009933] shrink-0" />
                            <strong className="text-slate-700 dark:text-slate-300">{req.contactNumber}</strong>
                            <button
                              type="button"
                              onClick={() => handleCopyPhone(req.id, req.contactNumber)}
                              className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition cursor-pointer"
                              title="Copy Contact Number"
                            >
                              {copiedPhoneId === req.id ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3 text-slate-400" />
                              )}
                            </button>
                          </span>
                        </div>

                        {/* Designation & Office */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 mt-2 text-xs">
                          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                            <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">Designation: <strong>{req.designation}</strong></span>
                          </div>
                          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">Office: <strong>{req.requestedOffice}</strong></span>
                          </div>
                        </div>

                        {/* Requested Applications */}
                        <div className="flex items-start gap-1.5 mt-2 text-xs text-slate-600 dark:text-slate-400">
                          <Layers className="w-3.5 h-3.5 text-[#009933] shrink-0 mt-0.5" />
                          <div>
                            <span className="text-slate-500 font-medium">Requested Apps: </span>
                            <div className="inline-flex flex-wrap gap-1 mt-0.5">
                              {Array.isArray(req.requestedApps) && req.requestedApps.length > 0 ? (
                                req.requestedApps.map(app => (
                                  <span key={app} className="text-[10.5px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 font-semibold border border-emerald-300 dark:border-emerald-700">
                                    {app}
                                  </span>
                                ))
                              ) : (
                                <span className="text-[10.5px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 font-semibold border border-emerald-300 dark:border-emerald-700">
                                  Maintenance and Status of Irrigation Facilities
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {isApproved && req.reviewedBy && (
                          <div className="mt-2 text-[11px] p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300">
                            Approved by: <strong>{req.reviewedBy}</strong> ({req.reviewedByRole}) on {new Date(req.reviewedAt || '').toLocaleDateString()}
                            <span className="block font-medium mt-0.5">
                              Assigned Role: <strong>{req.assignedRole}</strong> � NIS: <strong>{req.assignedNis || 'All NIS'}</strong>
                            </span>
                          </div>
                        )}

                        {isRejected && req.rejectionReason && (
                          <div className="mt-2 text-[11px] p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-800 dark:text-rose-300">
                            Declined: {req.rejectionReason} (by {req.reviewedBy})
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Admin Action Box */}
                    <div className="sm:w-64 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 sm:border-l border-slate-200 dark:border-slate-700 sm:pl-4 space-y-2.5">
                      {isPending ? (
                        <>
                          <div>
                            <label className="block text-[10px] font-mono uppercase font-bold text-slate-500 mb-1">
                              Assign Official Role:
                            </label>
                            <select
                              value={currentAssignedRole}
                              onChange={(e) => setAssignedRoles(prev => ({ ...prev, [req.id]: e.target.value as UserRole }))}
                              className={`w-full text-xs rounded-xl px-2.5 py-1.5 border font-semibold transition focus:outline-none ${
                                isLight ? 'bg-white border-slate-300 text-slate-800' : 'bg-slate-800 border-slate-700 text-white'
                              }`}
                            >
                              <option value="IMO Reviewer">IMO Reviewer (Supervising Engr)</option>
                              <option value="IMO Preparer">IMO Preparer (Report Preparer)</option>
                              <option value="Field Personnel">Field Personnel (Inspector)</option>
                              <option value="RO Reviewer">RO Reviewer (Quality Review)</option>
                              <option value="RO Preparer">RO Preparer (Regional Preparer)</option>
                              <option value="RO Evaluator">RO Evaluator (Division Manager)</option>
                              <option value="IMO Evaluator">IMO Evaluator (IMO Manager)</option>
                              <option value="Viewer">Viewer (IA / Public)</option>
                            </select>
                          </div>

                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleApprove(req)}
                              disabled={isSubmittingAction}
                              className="flex-1 bg-[#009933] hover:bg-[#00802b] text-white text-xs font-bold py-2 px-3 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Grant Access</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setRejectingId(rejectingId === req.id ? null : req.id)}
                              className={`px-2.5 py-2 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                                isLight ? 'border-rose-300 hover:bg-rose-50 text-rose-700' : 'border-rose-500/50 hover:bg-rose-950/30 text-rose-300'
                              }`}
                              title="Decline Request"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </div>

                          {rejectingId === req.id && (
                            <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/30 space-y-1.5 animate-in fade-in">
                              <input
                                type="text"
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                placeholder="Reason for decline..."
                                className="w-full text-[11px] p-1.5 rounded-lg border border-rose-300 dark:border-rose-800 bg-white dark:bg-slate-900 focus:outline-none"
                              />
                              <div className="flex justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setRejectingId(null)}
                                  className="text-[10px] px-2 py-0.5 rounded border text-slate-500"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleReject(req.id)}
                                  className="text-[10px] px-2 py-0.5 rounded bg-rose-600 text-white font-bold"
                                >
                                  Confirm Decline
                                </button>
                              </div>
                            </div>
                          )}
                        </>
                      ) : isApproved ? (
                        <div className="space-y-2">
                          <button
                            type="button"
                            onClick={() => handleRevoke(req.id)}
                            className="w-full py-1.5 px-3 rounded-xl border border-rose-400 text-rose-600 dark:text-rose-400 text-xs font-semibold hover:bg-rose-50 dark:hover:bg-rose-950/30 transition flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Revoke Access</span>
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleApprove(req)}
                          className="w-full py-1.5 px-3 rounded-xl border border-emerald-400 text-emerald-600 dark:text-emerald-400 text-xs font-semibold hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Re-Approve Access</span>
                        </button>
                      )}
                    </div>

                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className={`p-4 border-t flex flex-col sm:flex-row items-center justify-between gap-3 text-xs ${
          isLight ? 'border-slate-200 bg-slate-50' : 'border-slate-800 bg-slate-900'
        }`}>
          <span className="text-slate-500">
            Total {filteredRequests.length} access request records in your jurisdictional queue.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 font-semibold transition cursor-pointer"
          >
            Close Management Window
          </button>
        </div>

      </div>
    </div>
  );
};

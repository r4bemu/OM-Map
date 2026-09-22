import React, { useState, useMemo } from 'react';
import { 
  X, 
  Users, 
  ShieldCheck, 
  Check, 
  XCircle, 
  Clock, 
  Phone, 
  Mail, 
  Building2, 
  Briefcase, 
  Copy, 
  CheckCircle2, 
  AlertTriangle, 
  Edit3, 
  Trash2, 
  RefreshCw
} from 'lucide-react';
import { AccessRequest, AuthUser, UserRole } from '../types';
import { 
  CANONICAL_IMO_OFFICES, 
  isMasterAdmin, 
  isRegionalAdmin, 
  isImoAdmin,
  canUserManageRequests,
  getNisOptionsForImo,
  getAdminJurisdictionLabel,
  isRequestInAdminJurisdiction,
  approveAccessRequestApi,
  rejectAccessRequestApi,
  revokeAccessRequestApi,
  updateAccessRequestApi
} from '../config/authUsers';

interface AccessRequestManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AuthUser | null;
  requests: AccessRequest[];
  onRefreshRequests: () => void;
  isLight: boolean;
}

// Role hierarchy tiers for ceiling checks (higher number = higher authority)
const ROLE_HIERARCHY: Record<string, number> = {
  'Developer': 100,
  'RO Admin': 80,
  'RO Evaluator': 70,
  'RO Reviewer': 60,
  'RO Preparer': 50,
  'IMO Admin': 40,
  'IMO Evaluator': 30,
  'IMO Reviewer': 25,
  'IMO Preparer': 20,
  'Field Personnel': 15,
  'Viewer': 10,
};

const RO_OFFICIAL_ROLES: { value: UserRole; label: string; minTier: number }[] = [
  { value: 'Developer', label: 'Developer (Master Architect)', minTier: 100 },
  { value: 'RO Admin', label: 'RO Admin (Regional Office Gatekeeper)', minTier: 80 },
  { value: 'RO Evaluator', label: 'RO Evaluator (Division Manager)', minTier: 70 },
  { value: 'RO Reviewer', label: 'RO Reviewer (Quality Review)', minTier: 60 },
  { value: 'RO Preparer', label: 'RO Preparer (Regional Preparer)', minTier: 50 },
  { value: 'Viewer', label: 'Viewer (IA / Public Observer)', minTier: 10 },
];

const IMO_OFFICIAL_ROLES: { value: UserRole; label: string; minTier: number }[] = [
  { value: 'IMO Admin', label: 'IMO Admin (Office Gatekeeper)', minTier: 40 },
  { value: 'IMO Evaluator', label: 'IMO Evaluator (IMO Manager)', minTier: 30 },
  { value: 'IMO Reviewer', label: 'IMO Reviewer (Supervising Engr)', minTier: 25 },
  { value: 'IMO Preparer', label: 'IMO Preparer (Report Preparer)', minTier: 20 },
  { value: 'Field Personnel', label: 'Field Personnel (Inspector)', minTier: 15 },
  { value: 'Viewer', label: 'Viewer (IA / Public Observer)', minTier: 10 },
];

/**
 * Dynamic role choices based on the target Office and Approver's hierarchy tier:
 * - Regional Office: Developer, RO Roles, Viewer (IMO roles & Field Personnel excluded)
 * - IMO Offices: IMO Roles, Field Personnel, Viewer (Developer & RO roles excluded)
 * - Approver cannot assign any role above their own level of access
 */
export function getAvailableRolesForRequest(currentUser: AuthUser | null, req: AccessRequest): { value: UserRole; label: string }[] {
  const approverRole = currentUser?.role || 'Viewer';
  const approverTier = ROLE_HIERARCHY[approverRole] ?? 10;
  const targetOffice = req.requestedOffice || req.assignedOffice || 'Regional Office IV-B';
  const isROOffice = targetOffice.toLowerCase().includes('regional') || targetOffice === 'All IMOs' || targetOffice === 'All';

  if (isROOffice) {
    return RO_OFFICIAL_ROLES.filter(r => approverTier >= r.minTier).map(r => ({ value: r.value, label: r.label }));
  } else {
    return IMO_OFFICIAL_ROLES.filter(r => approverTier >= r.minTier).map(r => ({ value: r.value, label: r.label }));
  }
}

export const AccessRequestManagementModal: React.FC<AccessRequestManagementModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  requests,
  onRefreshRequests,
  isLight,
}) => {
  const isDev = isMasterAdmin(currentUser);
  const isRO = isRegionalAdmin(currentUser);
  const isIMO = isImoAdmin(currentUser);
  const isAdmin = canUserManageRequests(currentUser);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefreshRequests();
    } finally {
      setTimeout(() => setIsRefreshing(false), 600);
    }
  };

  const [statusTab, setStatusTab] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [copiedPhoneId, setCopiedPhoneId] = useState<string | null>(null);
  const [copiedEmailId, setCopiedEmailId] = useState<string | null>(null);

  // Per-request editing state for role and NIS assignment
  const [assignedRoles, setAssignedRoles] = useState<Record<string, UserRole>>({});
  const [assignedNisMap, setAssignedNisMap] = useState<Record<string, string>>({});
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Inline editing state for Name, Designation, and Office (Comments 7, 8, 9)
  const [editingTarget, setEditingTarget] = useState<{
    reqId: string;
    field: 'name' | 'designation' | 'office';
    value: string;
  } | null>(null);
  const [isUpdatingField, setIsUpdatingField] = useState(false);

  const handleCopyPhone = (id: string, phone: string) => {
    navigator.clipboard.writeText(phone);
    setCopiedPhoneId(id);
    setTimeout(() => setCopiedPhoneId(null), 2000);
  };

  const handleCopyEmail = (id: string, email: string) => {
    navigator.clipboard.writeText(email);
    setCopiedEmailId(id);
    setTimeout(() => setCopiedEmailId(null), 2000);
  };

  const handleStartEdit = (reqId: string, field: 'name' | 'designation' | 'office', currentValue: string) => {
    setEditingTarget({ reqId, field, value: currentValue });
  };

  const handleCancelEdit = () => {
    setEditingTarget(null);
  };

  const handleSaveEdit = async (req: AccessRequest) => {
    if (!editingTarget || editingTarget.reqId !== req.id) return;
    const { field, value } = editingTarget;
    const trimmed = value.trim();

    if (field === 'name') {
      if (!trimmed || trimmed === req.fullName) {
        setEditingTarget(null);
        return;
      }
      const confirmed = window.confirm(
        "Editing the applicant's official name will update their account and notify the applicant upon granting access. Proceed?"
      );
      if (!confirmed) return;

      setIsUpdatingField(true);
      const res = await updateAccessRequestApi(req.id, {
        fullName: trimmed,
        reviewerRole: currentUser?.role,
        reviewerName: currentUser?.name,
      });
      setIsUpdatingField(false);
      setEditingTarget(null);
      if (res.error) {
        setActionError(res.error);
      } else {
        onRefreshRequests();
      }
    } else if (field === 'designation') {
      if (!trimmed || trimmed === req.designation) {
        setEditingTarget(null);
        return;
      }
      const confirmed = window.confirm(
        "Editing the applicant's designation will update their account and notify the applicant upon granting access. Proceed?"
      );
      if (!confirmed) return;

      setIsUpdatingField(true);
      const res = await updateAccessRequestApi(req.id, {
        designation: trimmed,
        reviewerRole: currentUser?.role,
        reviewerName: currentUser?.name,
      });
      setIsUpdatingField(false);
      setEditingTarget(null);
      if (res.error) {
        setActionError(res.error);
      } else {
        onRefreshRequests();
      }
    } else if (field === 'office') {
      if (!trimmed || trimmed === (req.requestedOffice || req.assignedOffice)) {
        setEditingTarget(null);
        return;
      }
      const confirmed = window.confirm(
        "Editing the applicant's office assignment will update their jurisdiction and notify the applicant upon granting access. Proceed?"
      );
      if (!confirmed) return;

      setIsUpdatingField(true);
      const res = await updateAccessRequestApi(req.id, {
        requestedOffice: trimmed,
        reviewerRole: currentUser?.role,
        reviewerName: currentUser?.name,
      });
      setIsUpdatingField(false);
      setEditingTarget(null);
      if (res.error) {
        setActionError(res.error);
      } else {
        // Reset previously selected role for this request so it re-evaluates under the new office
        setAssignedRoles(prev => {
          const next = { ...prev };
          delete next[req.id];
          return next;
        });
        onRefreshRequests();
      }
    }
  };

  // Filter requests based on admin jurisdiction + status tab (Comments 10 & 11)
  const filteredRequests = useMemo(() => {
    return requests.filter(req => {
      // 1. Jurisdiction check
      if (!isRequestInAdminJurisdiction(currentUser, req)) {
        return false;
      }

      // 2. Status tab filter
      if (statusTab !== 'all' && req.status !== statusTab) {
        return false;
      }

      return true;
    });
  }, [requests, currentUser, statusTab]);

  if (!isOpen) return null;

  if (!isAdmin) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xl bg-slate-950/80">
        <div className="bg-slate-900 border border-rose-500/40 rounded-3xl p-6 text-center max-w-md text-white shadow-2xl animate-in fade-in">
          <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
          <h3 className="text-base font-bold">Administrative Access Restricted</h3>
          <p className="text-xs text-slate-400 mt-2">
            The Access Requests Review Queue is strictly restricted to Regional / IMO Office Administrators and the Master Developer.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-5 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-xs font-bold rounded-xl border border-slate-700 cursor-pointer"
          >
            Close Window
          </button>
        </div>
      </div>
    );
  }

  // Counts strictly scoped to jurisdiction
  const pendingCount = requests.filter(r => r.status === 'pending' && isRequestInAdminJurisdiction(currentUser, r)).length;
  const approvedCount = requests.filter(r => r.status === 'approved' && isRequestInAdminJurisdiction(currentUser, r)).length;

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return 'Not recorded';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return `${d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
    } catch (_) {
      return dateStr;
    }
  };

  const getUserInitials = (req: AccessRequest) => {
    if (req.firstName && req.lastName) {
      return `${req.firstName.charAt(0)}${req.lastName.charAt(0)}`.toUpperCase();
    }
    if (req.fullName) {
      const cleaned = req.fullName.replace(/\([^)]*\)/g, '').trim();
      const parts = cleaned.split(/\s+/).filter(p => /^[a-zA-Z]/.test(p));
      if (parts.length >= 2) {
        return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
      }
      if (parts.length === 1 && parts[0].length > 0) {
        return parts[0].slice(0, 2).toUpperCase();
      }
    }
    if (req.email) {
      return req.email.slice(0, 2).toUpperCase();
    }
    return 'NIA';
  };

  const handleApprove = async (req: AccessRequest) => {
    setActionError(null);
    // Safety check: ensure Admin only approves within their designated jurisdiction
    if (!isRequestInAdminJurisdiction(currentUser, req)) {
      setActionError(`Access Denied: You are only authorized to grant access within ${currentUser?.imoOffice || 'your assigned office jurisdiction'}.`);
      return;
    }

    setIsSubmittingAction(true);
    const availableRoles = getAvailableRolesForRequest(currentUser, req);
    const defaultRoleForApprover: UserRole = availableRoles[0]?.value || (isIMO ? 'IMO Reviewer' : 'RO Reviewer');
    const assignedRole = assignedRoles[req.id] || 
      (availableRoles.some(r => r.value === req.assignedRole) ? req.assignedRole : undefined) ||
      (availableRoles.some(r => r.value === req.requestedRole) ? req.requestedRole : undefined) ||
      defaultRoleForApprover;

    const assignedOffice = req.assignedOffice || req.requestedOffice || (isIMO && currentUser?.imoOffice ? currentUser.imoOffice : 'Regional Office IV-B');
    const assignedNis = assignedNisMap[req.id] || req.assignedNis || (Array.isArray(req.requestedNisList) ? req.requestedNisList.join(', ') : 'All NIS');

    const res = await approveAccessRequestApi(req.id, {
      assignedRole: assignedRole,
      assignedOffice: assignedOffice,
      assignedNis: assignedNis,
      reviewerName: currentUser?.name || 'Authorized Administrator',
      reviewerRole: currentUser?.role || 'RO Admin',
    });

    setIsSubmittingAction(false);
    if (res.error) {
      setActionError(res.error);
    } else {
      onRefreshRequests();
    }
  };

  const handleReject = async (reqId: string) => {
    setActionError(null);
    const targetReq = requests.find(r => r.id === reqId);
    if (!targetReq || !isRequestInAdminJurisdiction(currentUser, targetReq)) {
      setActionError(`Access Denied: You are only authorized to decline requests within ${currentUser?.imoOffice || 'your assigned office jurisdiction'}.`);
      return;
    }

    setIsSubmittingAction(true);
    const res = await rejectAccessRequestApi(reqId, {
      rejectionReason: rejectReason.trim() || 'Jurisdiction or credential verification incomplete.',
      reviewerName: currentUser?.name || 'Authorized Administrator',
      reviewerRole: currentUser?.role || 'RO Admin',
    });

    setRejectingId(null);
    setRejectReason('');
    setIsSubmittingAction(false);
    if (res.error) {
      setActionError(res.error);
    } else {
      onRefreshRequests();
    }
  };

  const handleRevoke = async (reqId: string) => {
    setActionError(null);
    const targetReq = requests.find(r => r.id === reqId);
    if (!targetReq || !isRequestInAdminJurisdiction(currentUser, targetReq)) {
      setActionError(`Access Denied: You are only authorized to revoke access within ${currentUser?.imoOffice || 'your assigned office jurisdiction'}.`);
      return;
    }

    if (window.confirm('Are you sure you want to suspend/revoke access for this user?')) {
      setIsSubmittingAction(true);
      const res = await revokeAccessRequestApi(reqId);
      setIsSubmittingAction(false);
      if (res.error) {
        setActionError(res.error);
      } else {
        onRefreshRequests();
      }
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
              {/* Removed "Developer" badge & "ADMINISTRATIVE ACCESS CONTROL" heading (Comments 1 & 3) */}
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
              onClick={handleRefresh}
              disabled={isRefreshing}
              className={`p-2 rounded-xl border transition cursor-pointer ${
                isLight ? 'border-slate-300 hover:bg-slate-200 text-slate-600' : 'border-slate-700 hover:bg-slate-800 text-slate-400'
              }`}
              title="Refresh Requests"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
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

        {/* Toolbar Bar */}
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
          </div>
        </div>

        {/* Action Error Alert */}
        {actionError && (
          <div className="mx-4 sm:mx-5 mt-3 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{actionError}</span>
            </div>
            <button
              type="button"
              onClick={() => setActionError(null)}
              className="p-1 hover:bg-rose-500/20 rounded text-rose-500 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

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
                  : 'No records matching the selected status tab.'}
              </p>
            </div>
          ) : (
            filteredRequests.map((req) => {
              const availableRoles = getAvailableRolesForRequest(currentUser, req);
              const currentAssignedRole = assignedRoles[req.id] || 
                (availableRoles.some(r => r.value === req.assignedRole) ? req.assignedRole : undefined) ||
                (availableRoles.some(r => r.value === req.requestedRole) ? req.requestedRole : undefined) ||
                availableRoles[0]?.value || 
                'Viewer';

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
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      {req.avatar ? (
                        <img
                          src={req.avatar}
                          alt={req.fullName || 'User avatar'}
                          className="w-12 h-12 rounded-2xl object-cover border-2 border-emerald-500/40 shadow-sm shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-600 font-bold font-mono text-sm shrink-0">
                          {getUserInitials(req)}
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        {/* Requestor Name & Edit Trigger (Comment 7) & Removed "Pending" Badge (Comment 2) */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {editingTarget?.reqId === req.id && editingTarget.field === 'name' ? (
                            <div className="flex items-center gap-1.5 py-0.5">
                              <input
                                type="text"
                                value={editingTarget.value}
                                onChange={(e) => setEditingTarget({ ...editingTarget, value: e.target.value })}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveEdit(req);
                                  if (e.key === 'Escape') handleCancelEdit();
                                }}
                                autoFocus
                                className={`text-xs px-2 py-1 rounded-lg border font-bold ${
                                  isLight ? 'bg-white border-emerald-500 text-slate-800' : 'bg-slate-800 border-emerald-500 text-white'
                                } focus:outline-none`}
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveEdit(req)}
                                disabled={isUpdatingField}
                                className="p-1 rounded-md bg-[#009933] text-white hover:bg-[#00802b] transition cursor-pointer"
                                title="Save Name"
                              >
                                <Check className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={handleCancelEdit}
                                disabled={isUpdatingField}
                                className="p-1 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 transition cursor-pointer"
                                title="Cancel"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <h3 className="font-bold text-sm truncate">{req.fullName || req.email || 'Personnel'}</h3>
                              {isPending && (
                                <button
                                  type="button"
                                  onClick={() => handleStartEdit(req.id, 'name', req.fullName || '')}
                                  className="p-0.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition cursor-pointer rounded"
                                  title="Edit Requestor Name"
                                >
                                  <Edit3 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          )}

                          {/* Only show badge if NOT pending (Comment 2: Pending badge removed) */}
                          {!isPending && (
                            <span className={`text-[9px] font-mono px-2 py-0.2 rounded-full font-bold uppercase border ${
                              isApproved
                                ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40'
                                : 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/40'
                            }`}>
                              {req.status}
                            </span>
                          )}
                        </div>

                        {/* Contact & Professional Details - Clean Vertically Stacked Rows */}
                        <div className="space-y-1.5 mt-2 text-xs">
                          {/* Row 1: Email Address with Quick Copy */}
                          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 min-w-0">
                            <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <a href={`mailto:${req.email}`} className="hover:underline text-emerald-600 dark:text-emerald-400 truncate">
                              {req.email}
                            </a>
                            {req.email && (
                              <button
                                type="button"
                                onClick={() => handleCopyEmail(req.id, req.email)}
                                className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition cursor-pointer shrink-0"
                                title="Copy Email Address"
                              >
                                {copiedEmailId === req.id ? (
                                  <Check className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3 h-3 text-slate-400" />
                                )}
                              </button>
                            )}
                          </div>

                          {/* Row 2: Contact Number (Relocated onto its own next row below email) */}
                          <div className="flex items-center gap-1.5 font-mono text-slate-600 dark:text-slate-400 min-w-0">
                            <Phone className="w-3.5 h-3.5 text-[#009933] shrink-0" />
                            <strong className="text-slate-700 dark:text-slate-300 truncate">
                              {req.contactNumber || 'Not provided'}
                            </strong>
                            {req.contactNumber && (
                              <button
                                type="button"
                                onClick={() => handleCopyPhone(req.id, req.contactNumber)}
                                className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition cursor-pointer shrink-0"
                                title="Copy Contact Number"
                              >
                                {copiedPhoneId === req.id ? (
                                  <Check className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3 h-3 text-slate-400" />
                                )}
                              </button>
                            )}
                          </div>

                          {/* Row 3: Designation with Inline Editing */}
                          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 min-w-0">
                            <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            {editingTarget?.reqId === req.id && editingTarget.field === 'designation' ? (
                              <div className="flex items-center gap-1 py-0.5 flex-1 min-w-0">
                                <input
                                  type="text"
                                  value={editingTarget.value}
                                  onChange={(e) => setEditingTarget({ ...editingTarget, value: e.target.value })}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveEdit(req);
                                    if (e.key === 'Escape') handleCancelEdit();
                                  }}
                                  autoFocus
                                  className={`text-xs px-2 py-0.5 rounded-lg border flex-1 min-w-0 ${
                                    isLight ? 'bg-white border-emerald-500 text-slate-800' : 'bg-slate-800 border-emerald-500 text-white'
                                  } focus:outline-none`}
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSaveEdit(req)}
                                  disabled={isUpdatingField}
                                  className="p-1 rounded-md bg-[#009933] text-white hover:bg-[#00802b] transition cursor-pointer shrink-0"
                                  title="Save Designation"
                                >
                                  <Check className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={handleCancelEdit}
                                  disabled={isUpdatingField}
                                  className="p-1 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 transition cursor-pointer shrink-0"
                                  title="Cancel"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 truncate">
                                <span className="truncate">Designation: <strong>{req.designation || 'Personnel'}</strong></span>
                                {isPending && (
                                  <button
                                    type="button"
                                    onClick={() => handleStartEdit(req.id, 'designation', req.designation || '')}
                                    className="p-0.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition cursor-pointer rounded shrink-0"
                                    title="Edit Designation"
                                  >
                                    <Edit3 className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Row 4: Office Assignment with Inline Editing (Relocated onto its own next row below designation) */}
                          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 min-w-0">
                            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            {editingTarget?.reqId === req.id && editingTarget.field === 'office' ? (
                              <div className="flex items-center gap-1 py-0.5 flex-1 min-w-0">
                                <select
                                  value={editingTarget.value}
                                  onChange={(e) => setEditingTarget({ ...editingTarget, value: e.target.value })}
                                  autoFocus
                                  className={`text-xs px-2 py-0.5 rounded-lg border flex-1 min-w-0 ${
                                    isLight ? 'bg-white border-emerald-500 text-slate-800' : 'bg-slate-800 border-emerald-500 text-white'
                                  } focus:outline-none`}
                                >
                                  <option value="Regional Office IV-B">Regional Office IV-B</option>
                                  <option value="Mindoro Oriental-Marinduque-Romblon IMO">Mindoro Oriental-Marinduque-Romblon IMO</option>
                                  <option value="Occidental Mindoro IMO">Occidental Mindoro IMO</option>
                                  <option value="Palawan IMO">Palawan IMO</option>
                                </select>
                                <button
                                  type="button"
                                  onClick={() => handleSaveEdit(req)}
                                  disabled={isUpdatingField}
                                  className="p-1 rounded-md bg-[#009933] text-white hover:bg-[#00802b] transition cursor-pointer shrink-0"
                                  title="Save Office"
                                >
                                  <Check className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={handleCancelEdit}
                                  disabled={isUpdatingField}
                                  className="p-1 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 transition cursor-pointer shrink-0"
                                  title="Cancel"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 truncate">
                                <span className="truncate">Office: <strong>{req.requestedOffice || 'Regional Office IV-B'}</strong></span>
                                {isPending && (isDev || isRO) && (
                                  <button
                                    type="button"
                                    onClick={() => handleStartEdit(req.id, 'office', req.requestedOffice || 'Regional Office IV-B')}
                                    className="p-0.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition cursor-pointer rounded shrink-0"
                                    title="Edit Office Assignment (Regional Authority Only)"
                                  >
                                    <Edit3 className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Note: "Requested Apps" row completely removed per Comment 5 */}

                        {isRejected && req.rejectionReason && (
                          <div className="mt-2 text-[11px] p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-800 dark:text-rose-300">
                            Declined: {req.rejectionReason} (by {req.reviewedBy})
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Admin Action Box (Comment 4: Dynamic Office-Scoped & Hierarchy-Bounded Roles) */}
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
                              {availableRoles.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-[10px] font-mono uppercase font-bold text-slate-500 mb-1">
                              Assign NIS System Scope:
                            </label>
                            <select
                              value={assignedNisMap[req.id] || req.assignedNis || (Array.isArray(req.requestedNisList) && req.requestedNisList.length ? req.requestedNisList[0] : 'All NIS')}
                              onChange={(e) => setAssignedNisMap(prev => ({ ...prev, [req.id]: e.target.value }))}
                              className={`w-full text-xs rounded-xl px-2.5 py-1.5 border font-semibold transition focus:outline-none ${
                                isLight ? 'bg-white border-slate-300 text-slate-800' : 'bg-slate-800 border-slate-700 text-white'
                              }`}
                            >
                              {getNisOptionsForImo(req.requestedOffice || currentUser?.imoOffice).map(nis => (
                                <option key={nis} value={nis}>{nis}</option>
                              ))}
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
                        <div className="space-y-2.5">
                          <button
                            type="button"
                            onClick={() => handleRevoke(req.id)}
                            className="w-full py-1.5 px-3 rounded-xl border border-rose-400 text-rose-600 dark:text-rose-400 text-xs font-semibold hover:bg-rose-50 dark:hover:bg-rose-950/30 transition flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Revoke Access</span>
                          </button>

                          <div className={`space-y-1 text-[11px] leading-snug pt-0.5 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                            <div className="truncate">
                              <span className="text-slate-500">Approved by:</span>{' '}
                              <strong className={isLight ? 'text-slate-800' : 'text-slate-200'}>{req.reviewedBy || 'Administrator'}</strong>
                              {req.reviewedByRole && <span className="text-slate-500 text-[10px] ml-1">({req.reviewedByRole})</span>}
                            </div>
                            <div className="truncate">
                              <span className="text-slate-500">Assigned role:</span>{' '}
                              <strong className={isLight ? 'text-emerald-700 font-bold' : 'text-emerald-400 font-bold'}>{req.assignedRole || 'Authorized Personnel'}</strong>
                            </div>
                            {req.assignedNis && (
                              <div className="truncate">
                                <span className="text-slate-500">NIS:</span>{' '}
                                <strong className={isLight ? 'text-slate-700' : 'text-slate-300'}>{req.assignedNis}</strong>
                              </div>
                            )}
                            <div className="flex items-center gap-1.5 text-[10.5px] text-slate-500 pt-0.5">
                              <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>Granted: <strong className={isLight ? 'text-slate-700' : 'text-slate-300'}>{formatDateTime(req.reviewedAt || req.submittedAt)}</strong></span>
                            </div>
                          </div>
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

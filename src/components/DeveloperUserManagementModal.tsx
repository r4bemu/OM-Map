import React, { useState, useEffect } from 'react';
import { 
  X, 
  Search, 
  ShieldCheck, 
  KeyRound, 
  Edit2, 
  Save, 
  RotateCcw, 
  UserCheck, 
  Building, 
  MapPin, 
  Check, 
  AlertTriangle,
  Users,
  UserPlus,
  Trash2,
  Lock,
  Sparkles,
  Mail,
  Clock,
  UserX,
  ShieldAlert,
  CheckCircle2
} from 'lucide-react';
import { AuthUser, UserRole } from '../types';
import { 
  getAuthUsers, 
  fetchRemoteAuthUsers,
  updateUserPasscode, 
  updateUserScope, 
  createNewUserAccount,
  deleteUserAccount,
  resetAuthUsersToDefault,
  CANONICAL_IMO_OFFICES,
  getNisOptionsForImo,
  getPendingGoogleAdmissions,
  admitGoogleUser,
  rejectPendingGoogleAdmission
} from '../config/authUsers';

interface DeveloperUserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AuthUser | null;
  onUserUpdated?: () => void;
}

function getShortImoName(imo: string): string {
  if (!imo) return 'Regional';
  if (imo.includes('MOMARO') || imo.includes('Mindoro Oriental')) return 'MOMARO';
  if (imo.includes('Occidental')) return 'Occ. Mindoro';
  if (imo.includes('Palawan')) return 'Palawan';
  return 'Regional';
}

function generateDefaultTitle(role: UserRole, imo: string, nis: string, count: number): { name: string; username: string; designation: string } {
  const shortImo = getShortImoName(imo);
  const numStr = String(count + 1).padStart(2, '0');
  const safeImoKey = shortImo.toLowerCase().replace(/[^a-z0-9]/g, '');

  switch (role) {
    case 'RO Admin':
      return {
        name: 'Regional Executive Administrator',
        username: 'ro_admin',
        designation: 'Regional Office Executive Admin & Access Gatekeeper'
      };
    case 'RO Evaluator':
      return {
        name: 'Division Manager (Regional Office)',
        username: 'ro_evaluator',
        designation: 'Regional Office Division Manager & Evaluator'
      };
    case 'RO Reviewer':
      return {
        name: 'Regional Report Reviewer',
        username: 'ro_reviewer',
        designation: 'Regional O&M Report Reviewer'
      };
    case 'RO Preparer':
      return {
        name: 'Regional Report Preparer',
        username: 'ro_preparer',
        designation: 'Regional O&M Report Preparer'
      };
    case 'IMO Admin':
      return {
        name: `IMO Administrator (${shortImo} IMO)`,
        username: `admin_${safeImoKey}`,
        designation: `${shortImo} IMO Administrator & Access Gatekeeper`
      };
    case 'IMO Evaluator':
      return {
        name: `Division Manager (${shortImo} IMO)`,
        username: `evaluator_${safeImoKey}`,
        designation: `${shortImo} IMO Division Manager & Evaluator`
      };
    case 'IMO Reviewer':
      return {
        name: `IMO Reviewer ${shortImo} ${numStr}`,
        username: `reviewer_${safeImoKey}_${numStr}`,
        designation: `Principal IMO Reviewer - ${nis}`
      };
    case 'IMO Preparer':
      return {
        name: `IMO Preparer ${shortImo} ${numStr}`,
        username: `prep_${safeImoKey}_${numStr}`,
        designation: `IMO Report Preparer - ${nis}`
      };
    case 'Field Personnel':
      return {
        name: `Field Personnel ${shortImo} ${numStr}`,
        username: `field_${safeImoKey}_${numStr}`,
        designation: `Water Resource Officer - ${nis}`
      };
    case 'Viewer':
      return {
        name: `Viewer (${shortImo})`,
        username: `viewer_${safeImoKey}`,
        designation: `${shortImo} Public Auditor / Viewer`
      };
    case 'Developer':
    default:
      return {
        name: `Systems Architect (${shortImo})`,
        username: `dev_${safeImoKey}`,
        designation: 'Master GIS Administrator'
      };
  }
}

export const DeveloperUserManagementModal: React.FC<DeveloperUserManagementModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUserUpdated
}) => {
  const [activeTab, setActiveTab] = useState<'registered' | 'pending_google'>('registered');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('All');
  const [selectedImoFilter, setSelectedImoFilter] = useState<string>('All');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [usersVersion, setUsersVersion] = useState(0);
  
  // Edit Form State
  const [editPasscode, setEditPasscode] = useState('');
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('Field Personnel');
  const [editImo, setEditImo] = useState('');
  const [editNis, setEditNis] = useState('');
  const [editDesignation, setEditDesignation] = useState('');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Role Access Levels
  const isDeveloper = currentUser?.role === 'Developer';
  const isRoAdmin = currentUser?.role === 'RO Admin';
  const isImoAdmin = currentUser?.role === 'IMO Admin';
  const isAdmin = isDeveloper || isRoAdmin || isImoAdmin;

  // Available roles to assign based on admin tier
  const availableRolesForAdmin: UserRole[] = isDeveloper
    ? ['Developer', 'RO Admin', 'RO Evaluator', 'RO Reviewer', 'RO Preparer', 'IMO Admin', 'IMO Evaluator', 'IMO Reviewer', 'IMO Preparer', 'Field Personnel', 'Viewer']
    : isRoAdmin
    ? ['RO Admin', 'RO Evaluator', 'RO Reviewer', 'RO Preparer', 'IMO Admin', 'IMO Evaluator', 'IMO Reviewer', 'IMO Preparer', 'Field Personnel', 'Viewer']
    : ['IMO Admin', 'IMO Evaluator', 'IMO Reviewer', 'IMO Preparer', 'Field Personnel', 'Viewer'];

  // Allowed IMO options based on admin scope
  const availableImoOptions = isImoAdmin && currentUser?.imoOffice
    ? [currentUser.imoOffice]
    : CANONICAL_IMO_OFFICES;

  const defaultImoSelection = isImoAdmin && currentUser?.imoOffice
    ? currentUser.imoOffice
    : CANONICAL_IMO_OFFICES[0];

  // Create User Form State
  const [isCreatingNewUser, setIsCreatingNewUser] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newRole, setNewRole] = useState<UserRole>(isImoAdmin ? 'IMO Preparer' : 'Field Personnel');
  const [newImo, setNewImo] = useState<string>(defaultImoSelection);
  const [newNis, setNewNis] = useState<string>('Baco-Bucayao RIS');
  const [newPasscode, setNewPasscode] = useState('');
  const [newDesignation, setNewDesignation] = useState('');
  const [isSubmittingNew, setIsSubmittingNew] = useState(false);

  // Pending Google Admissions Inline Assignment State
  const [admitRoleMap, setAdmitRoleMap] = useState<Record<string, UserRole>>({});
  const [admitImoMap, setAdmitImoMap] = useState<Record<string, string>>({});
  const [admitNisMap, setAdmitNisMap] = useState<Record<string, string>>({});
  const [admitDesignationMap, setAdmitDesignationMap] = useState<Record<string, string>>({});
  const [isAdmittingId, setIsAdmittingId] = useState<string | null>(null);

  // Sync users with server whenever modal opens
  useEffect(() => {
    if (isOpen && isAdmin) {
      fetchRemoteAuthUsers().then(() => {
        setUsersVersion(v => v + 1);
      });
    }
  }, [isOpen, isAdmin]);

  // Keep NIS synchronized with selected IMO in Create Form (Lock to All NIS when All IMOs selected)
  useEffect(() => {
    if (newImo === 'All IMOs') {
      setNewNis('All NIS');
    } else {
      const validNisOptions = getNisOptionsForImo(newImo);
      if (!validNisOptions.includes(newNis) || newNis === 'All NIS') {
        setNewNis(validNisOptions[0] || 'All NIS');
      }
    }
  }, [newImo]);

  // Keep NIS synchronized with selected IMO in Edit Form (Lock to All NIS when All IMOs selected)
  useEffect(() => {
    if (editImo === 'All IMOs') {
      setEditNis('All NIS');
    } else if (editImo) {
      const validNisOptions = getNisOptionsForImo(editImo);
      if (!validNisOptions.includes(editNis) || editNis === 'All NIS') {
        setEditNis(validNisOptions[0] || 'All NIS');
      }
    }
  }, [editImo]);

  if (!isOpen || !currentUser || !isAdmin) return null;

  const users = getAuthUsers();
  const pendingUsers = getPendingGoogleAdmissions();

  // Scoped users list for IMO Admin (or full list for RO Admin / Developer)
  const scopedUsers = users.filter(u => {
    if (isImoAdmin && currentUser?.imoOffice) {
      return u.imoOffice === currentUser.imoOffice || u.role === 'Developer';
    }
    return true;
  });

  const filteredUsers = scopedUsers.filter(u => {
    if (selectedRoleFilter !== 'All' && u.role !== selectedRoleFilter) return false;
    if (selectedImoFilter !== 'All' && !u.imoOffice.includes(selectedImoFilter) && u.imoOffice !== 'All IMOs') return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return u.name.toLowerCase().includes(q) ||
             u.username.toLowerCase().includes(q) ||
             u.passcode.toLowerCase().includes(q) ||
             (u.nisBinding && u.nisBinding.toLowerCase().includes(q)) ||
             (u.email && u.email.toLowerCase().includes(q));
    }
    return true;
  });

  const handleStartEdit = (user: AuthUser) => {
    if (isImoAdmin && (user.role === 'Developer' || user.role.startsWith('RO'))) {
      setErrorMessage('IMO Administrators cannot modify Regional or Developer accounts.');
      return;
    }
    setEditingUserId(user.id);
    setEditPasscode(user.passcode);
    setEditName(user.name);
    setEditRole(user.role);
    setEditImo(user.imoOffice);
    setEditNis(user.imoOffice === 'All IMOs' ? 'All NIS' : (user.nisBinding || 'All NIS'));
    setEditDesignation(user.designation || '');
    setSaveSuccessMsg('');
    setErrorMessage('');
  };

  const handleSaveEdit = async (userId: string) => {
    if (!editPasscode.trim() || !editName.trim()) {
      setErrorMessage('Name and passcode cannot be blank.');
      return;
    }

    try {
      const effectiveNis = editImo === 'All IMOs' ? 'All NIS' : editNis;
      await updateUserPasscode(userId, editPasscode);
      await updateUserScope(userId, {
        name: editName.trim(),
        role: editRole,
        imoOffice: editImo,
        nisBinding: effectiveNis,
        designation: editDesignation.trim() || `${editRole} - ${effectiveNis}`
      });

      setEditingUserId(null);
      setUsersVersion(v => v + 1);
      setSaveSuccessMsg(`Updated account credentials for ${editName} (${editPasscode})`);
      setTimeout(() => setSaveSuccessMsg(''), 3500);
      onUserUpdated?.();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to update user.');
    }
  };

  const handleGeneratePasscode = () => {
    const prefix = newRole === 'RO Admin' ? 'ROA' : newRole === 'RO Evaluator' ? 'ROE' : newRole === 'RO Reviewer' ? 'ROR' : newRole === 'RO Preparer' ? 'ROP' : newRole === 'IMO Admin' ? 'ADM' : newRole === 'IMO Evaluator' ? 'IOE' : newRole === 'IMO Reviewer' ? 'IOR' : newRole === 'IMO Preparer' ? 'IOP' : newRole === 'Field Personnel' ? 'FLD' : newRole === 'Viewer' ? 'VIEW' : 'DEV';
    const rand = Math.floor(1000 + Math.random() * 9000);
    const suffix = newImo.includes('MOMARO') ? 'M' : newImo.includes('Occidental') ? 'O' : newImo.includes('Palawan') ? 'P' : 'R';
    setNewPasscode(`${prefix}${rand}${suffix}`);
  };

  const handleAutoSuggestFields = (role: UserRole = newRole, imo: string = newImo, nis: string = newNis) => {
    const count = users.filter(u => u.role === role && u.imoOffice === imo).length;
    const effNis = imo === 'All IMOs' ? 'All NIS' : nis;
    const suggested = generateDefaultTitle(role, imo, effNis, count);
    setNewName(suggested.name);
    setNewUsername(suggested.username);
    setNewDesignation(suggested.designation);
  };

  const handleCreateNewUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newUsername.trim() || !newPasscode.trim()) {
      setErrorMessage('Please fill in all required fields (Name, Username, Passcode).');
      return;
    }

    setIsSubmittingNew(true);
    setErrorMessage('');

    try {
      const cleanUsername = newUsername.trim().replace(/^@/, '').toLowerCase();
      const effectiveNis = newImo === 'All IMOs' ? 'All NIS' : newNis;
      const res = await createNewUserAccount({
        username: cleanUsername,
        name: newName.trim(),
        role: newRole,
        passcode: newPasscode.trim().toUpperCase(),
        imoOffice: newImo,
        nisBinding: effectiveNis,
        designation: newDesignation.trim() || undefined
      });

      if (res && res.id) {
        setSaveSuccessMsg(`Successfully created account @${res.username} for ${res.name} (${res.role})!`);
        setIsCreatingNewUser(false);
        setNewName('');
        setNewUsername('');
        setNewPasscode('');
        setNewDesignation('');
        setUsersVersion(v => v + 1);
        setTimeout(() => setSaveSuccessMsg(''), 4000);
        onUserUpdated?.();
      } else {
        setErrorMessage('Failed to create user account.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error creating user account.');
    } finally {
      setIsSubmittingNew(false);
    }
  };

  const handleDeleteUser = async (user: AuthUser) => {
    if (user.role === 'Developer') {
      alert('Developer accounts cannot be deleted.');
      return;
    }

    if (isImoAdmin && user.role.startsWith('RO')) {
      alert('IMO Administrators cannot delete Regional or Developer accounts.');
      return;
    }

    if (window.confirm(`Are you sure you want to permanently delete account @${user.username} (${user.name})?`)) {
      try {
        await deleteUserAccount(user.id);
        setUsersVersion(v => v + 1);
        setSaveSuccessMsg(`Account @${user.username} deleted.`);
        setTimeout(() => setSaveSuccessMsg(''), 3000);
        onUserUpdated?.();
      } catch (err: any) {
        setErrorMessage(err?.message || 'Failed to delete account.');
      }
    }
  };

  const handleResetDefaults = async () => {
    if (!isDeveloper) {
      alert('Only Developer account can perform a full factory reset.');
      return;
    }
    if (window.confirm('Reset all accounts to default factory state? Custom added accounts will be restored.')) {
      await resetAuthUsersToDefault();
      setUsersVersion(v => v + 1);
      setSaveSuccessMsg('All accounts have been reset to factory defaults.');
      setTimeout(() => setSaveSuccessMsg(''), 3500);
      onUserUpdated?.();
    }
  };

  const handleAdmitUser = async (pendingUser: AuthUser) => {
    const role = admitRoleMap[pendingUser.id] || (isImoAdmin ? 'IMO Preparer' : 'Field Personnel');
    const imo = isImoAdmin && currentUser?.imoOffice ? currentUser.imoOffice : (admitImoMap[pendingUser.id] || defaultImoSelection);
    const validNis = getNisOptionsForImo(imo);
    const nis = imo === 'All IMOs' ? 'All NIS' : (admitNisMap[pendingUser.id] || validNis[0] || 'All NIS');
    const designation = admitDesignationMap[pendingUser.id] || `${role} - ${nis}`;

    setIsAdmittingId(pendingUser.id);
    try {
      await admitGoogleUser(pendingUser.id, {
        role,
        imoOffice: imo,
        nisBinding: nis,
        designation
      });
      setUsersVersion(v => v + 1);
      setSaveSuccessMsg(`Admitted ${pendingUser.name} (${pendingUser.email || pendingUser.username}) as ${role} for ${imo}!`);
      setTimeout(() => setSaveSuccessMsg(''), 4500);
      onUserUpdated?.();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to admit user.');
    } finally {
      setIsAdmittingId(null);
    }
  };

  const handleRejectUser = async (pendingUser: AuthUser) => {
    if (window.confirm(`Reject admission request for ${pendingUser.name} (${pendingUser.email || pendingUser.username})?`)) {
      try {
        await rejectPendingGoogleAdmission(pendingUser.id);
        setUsersVersion(v => v + 1);
        setSaveSuccessMsg(`Rejected admission request for ${pendingUser.name}.`);
        setTimeout(() => setSaveSuccessMsg(''), 3000);
        onUserUpdated?.();
      } catch (err: any) {
        setErrorMessage(err?.message || 'Failed to reject user.');
      }
    }
  };

  const getRoleBadgeStyle = (role: UserRole) => {
    switch (role) {
      case 'Developer': return 'bg-rose-500/20 text-rose-300 border-rose-500/30 font-mono';
      case 'RO Admin': return 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30 font-bold';
      case 'RO Evaluator': return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'RO Reviewer': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'RO Preparer': return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
      case 'IMO Admin': return 'bg-orange-500/20 text-orange-300 border-orange-500/30 font-bold';
      case 'IMO Evaluator': return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'IMO Reviewer': return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30';
      case 'IMO Preparer': return 'bg-teal-500/20 text-teal-300 border-teal-500/30';
      case 'Field Personnel': return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'Viewer': return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
      default: return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  const getModalTitleInfo = () => {
    if (isDeveloper) {
      return {
        title: 'Developer Account & Gatekeeper Control',
        badge: 'MASTER CONTROL',
        subtitle: 'Manage credentials, RBAC permissions, and Google account admissions across NIA Region IV-B.'
      };
    }
    if (isRoAdmin) {
      return {
        title: 'Regional Office Access & Gatekeeper Control',
        badge: 'REGIONAL ADMIN',
        subtitle: 'Manage personnel credentials, RBAC roles, and Google admissions across Region IV-B.'
      };
    }
    return {
      title: `${currentUser?.imoOffice ? getShortImoName(currentUser.imoOffice) + ' IMO' : 'IMO'} Access & Gatekeeper Control`,
      badge: 'IMO ADMIN',
      subtitle: `Manage personnel credentials and Google admissions for ${currentUser?.imoOffice || 'assigned IMO'}.`
    };
  };

  const headerInfo = getModalTitleInfo();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-xl animate-in fade-in overflow-y-auto">
      <div className="w-full max-w-6xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] my-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-slate-900/90 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border shadow-inner ${
              isDeveloper 
                ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' 
                : isRoAdmin
                ? 'bg-fuchsia-500/20 text-fuchsia-400 border-fuchsia-500/30'
                : 'bg-orange-500/20 text-orange-400 border-orange-500/30'
            }`}>
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white font-heading">
                  {headerInfo.title}
                </h2>
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                  isDeveloper 
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' 
                    : isRoAdmin
                    ? 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30'
                    : 'bg-orange-500/20 text-orange-300 border-orange-500/30'
                }`}>
                  {headerInfo.badge}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {headerInfo.subtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const nextOpen = !isCreatingNewUser;
                setIsCreatingNewUser(nextOpen);
                if (nextOpen) {
                  if (!newPasscode) handleGeneratePasscode();
                  if (!newName) handleAutoSuggestFields(newRole, newImo, newNis);
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#15803d] hover:bg-[#16a34a] text-white shadow-sm transition cursor-pointer border border-[#16a34a]/50 active:scale-95"
              title="Create a new user account"
            >
              <UserPlus className="w-4 h-4" />
              <span>{isCreatingNewUser ? 'Hide Form' : 'Create New Account'}</span>
            </button>

            {isDeveloper && (
              <button
                onClick={handleResetDefaults}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer"
                title="Reset accounts to default passcodes and scopes"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Reset Defaults</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation Bar */}
        <div className="flex items-center gap-2 px-5 pt-3 border-b border-slate-800 bg-slate-900/90">
          <button
            type="button"
            onClick={() => setActiveTab('registered')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold border-b-2 transition cursor-pointer ${
              activeTab === 'registered'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Registered Personnel</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
              {filteredUsers.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('pending_google')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold border-b-2 transition cursor-pointer ${
              activeTab === 'pending_google'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Mail className="w-4 h-4" />
            <span>Pending Google Admissions</span>
            {pendingUsers.length > 0 ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                {pendingUsers.length} PENDING
              </span>
            ) : (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-400 border border-slate-700">
                0
              </span>
            )}
          </button>
        </div>

        {/* Success Alert Banner */}
        {saveSuccessMsg && (
          <div className="bg-emerald-500/15 border-b border-emerald-500/30 px-4 py-2.5 flex items-center gap-2 text-xs text-emerald-300 animate-in fade-in">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-semibold">{saveSuccessMsg}</span>
          </div>
        )}

        {/* Error Alert Banner */}
        {errorMessage && (
          <div className="bg-rose-500/15 border-b border-rose-500/30 px-4 py-2.5 flex items-center gap-2 text-xs text-rose-300 animate-in fade-in">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* CREATE NEW ACCOUNT FORM CARD */}
        {isCreatingNewUser && (
          <div className="p-4 bg-slate-950/80 border-b border-emerald-500/30 animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1 bg-emerald-500/20 rounded text-emerald-400">
                  <UserPlus className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-bold text-emerald-300 uppercase font-mono tracking-wider">
                  Create New User Account (Persisted to Server Database)
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleAutoSuggestFields(newRole, newImo, newNis)}
                  className="text-[11px] text-teal-300 hover:text-teal-200 flex items-center gap-1 font-mono cursor-pointer"
                >
                  <Sparkles className="w-3 h-3" /> Auto-Fill Systematic Title
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreatingNewUser(false)}
                  className="text-slate-400 hover:text-white text-xs cursor-pointer ml-2"
                >
                  ✕ Cancel
                </button>
              </div>
            </div>

            <form onSubmit={handleCreateNewUser} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                
                {/* Full Name */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Full Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Field Officer MOMARO 16"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Username */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Username <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-mono">@</span>
                    <input
                      type="text"
                      required
                      placeholder="field_momaro_16"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value.replace(/\s+/g, '_'))}
                      className="w-full bg-slate-900 border border-slate-700 text-white text-xs font-mono rounded-lg pl-7 pr-3 py-2 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Role */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Role &amp; Permissions <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={newRole}
                    onChange={(e) => {
                      const role = e.target.value as UserRole;
                      setNewRole(role);
                      const targetImo = role.startsWith('RO') ? 'All IMOs' : newImo;
                      const targetNis = role.startsWith('RO') ? 'All NIS' : newNis;
                      setNewImo(targetImo);
                      setNewNis(targetNis);
                      handleGeneratePasscode();
                      handleAutoSuggestFields(role, targetImo, targetNis);
                    }}
                    className="w-full bg-slate-900 border border-slate-700 text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    {availableRolesForAdmin.map(role => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </div>

                {/* Passcode */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-slate-300">
                      Passcode <span className="text-rose-400">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleGeneratePasscode}
                      className="text-[10px] text-cyan-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3" /> Auto-Gen
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="e.g. FLD8816M"
                    value={newPasscode}
                    onChange={(e) => setNewPasscode(e.target.value.toUpperCase())}
                    className="w-full bg-slate-900 border border-amber-500/60 text-amber-300 font-mono text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-amber-400"
                  />
                </div>

                {/* IMO Office Dropdown */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    IMO Office Access <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={newImo}
                    disabled={isImoAdmin}
                    onChange={(e) => {
                      const imo = e.target.value;
                      setNewImo(imo);
                      const targetNis = imo === 'All IMOs' ? 'All NIS' : (getNisOptionsForImo(imo)[0] || 'All NIS');
                      setNewNis(targetNis);
                      handleAutoSuggestFields(newRole, imo, targetNis);
                    }}
                    className={`w-full border text-xs rounded-lg px-3 py-2 ${
                      isImoAdmin 
                        ? 'bg-slate-950 border-slate-800 text-slate-400 cursor-not-allowed'
                        : 'bg-slate-900 border-slate-700 text-white focus:outline-none focus:border-emerald-500 cursor-pointer'
                    }`}
                  >
                    {availableImoOptions.map(imo => (
                      <option key={imo} value={imo}>{imo}</option>
                    ))}
                  </select>
                </div>

                {/* NIS Scope Dropdown */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-slate-300">
                      NIS System Scope <span className="text-rose-400">*</span>
                    </label>
                    {newImo === 'All IMOs' && (
                      <span className="text-[10px] text-amber-400 font-mono flex items-center gap-0.5">
                        <Lock className="w-2.5 h-2.5" /> Locked (All IMOs)
                      </span>
                    )}
                  </div>
                  <select
                    value={newImo === 'All IMOs' ? 'All NIS' : newNis}
                    disabled={newImo === 'All IMOs'}
                    onChange={(e) => {
                      const nis = e.target.value;
                      setNewNis(nis);
                      handleAutoSuggestFields(newRole, newImo, nis);
                    }}
                    className={`w-full border text-xs rounded-lg px-3 py-2 transition ${
                      newImo === 'All IMOs'
                        ? 'bg-slate-950/80 border-slate-800 text-slate-500 cursor-not-allowed font-mono'
                        : 'bg-slate-900 border-slate-700 text-white focus:outline-none focus:border-emerald-500 cursor-pointer'
                    }`}
                  >
                    {newImo === 'All IMOs' ? (
                      <option value="All NIS">All NIS (Regional Wide)</option>
                    ) : (
                      getNisOptionsForImo(newImo).map(nis => (
                        <option key={nis} value={nis}>{nis}</option>
                      ))
                    )}
                  </select>
                </div>

                {/* Designation */}
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Official Designation / Title
                  </label>
                  <input
                    type="text"
                    placeholder={`e.g. ${newRole} - ${newNis}`}
                    value={newDesignation}
                    onChange={(e) => setNewDesignation(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreatingNewUser(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingNew}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-md transition cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSubmittingNew ? 'Saving Account...' : 'Save & Persist Account'}</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TAB 1: REGISTERED PERSONNEL VIEW */}
        {activeTab === 'registered' && (
          <>
            {/* Filters & Search Toolbar */}
            <div className="p-4 border-b border-slate-800 bg-slate-900/60 flex flex-wrap items-center justify-between gap-3">
              {/* Search Input */}
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by name, username, passcode, NIS, or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-white text-xs rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition placeholder-slate-500"
                />
              </div>

              {/* Role & IMO Filters */}
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={selectedRoleFilter}
                  onChange={(e) => setSelectedRoleFilter(e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-cyan-500 cursor-pointer"
                >
                  <option value="All">All Roles ({filteredUsers.length})</option>
                  <option value="Developer">Developer</option>
                  <option value="RO Admin">RO Admin</option>
                  <option value="RO Evaluator">RO Evaluator</option>
                  <option value="RO Reviewer">RO Reviewer</option>
                  <option value="RO Preparer">RO Preparer</option>
                  <option value="IMO Admin">IMO Admin</option>
                  <option value="IMO Evaluator">IMO Evaluator</option>
                  <option value="IMO Reviewer">IMO Reviewer</option>
                  <option value="IMO Preparer">IMO Preparer</option>
                  <option value="Field Personnel">Field Personnel</option>
                  <option value="Viewer">Viewer</option>
                </select>

                <select
                  value={selectedImoFilter}
                  onChange={(e) => setSelectedImoFilter(e.target.value)}
                  disabled={isImoAdmin}
                  className={`border text-xs rounded-lg px-2.5 py-1.5 ${
                    isImoAdmin 
                      ? 'bg-slate-950 border-slate-800 text-slate-400 cursor-not-allowed'
                      : 'bg-slate-800 border-slate-700 text-slate-200 focus:outline-none focus:border-cyan-500 cursor-pointer'
                  }`}
                >
                  <option value="All">All IMOs / Regional</option>
                  {CANONICAL_IMO_OFFICES.map(imo => (
                    <option key={imo} value={imo}>{imo}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Users Table */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] font-mono tracking-wider bg-slate-950/40">
                      <th className="py-2.5 px-3">User &amp; Designation</th>
                      <th className="py-2.5 px-3">Role</th>
                      <th className="py-2.5 px-3">Username / Email</th>
                      <th className="py-2.5 px-3">Passcode / Auth</th>
                      <th className="py-2.5 px-3">IMO Office Access</th>
                      <th className="py-2.5 px-3">NIS Binding / Scope</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredUsers.map((u) => {
                      const isEditing = editingUserId === u.id;

                      return (
                        <tr key={u.id} className="hover:bg-slate-800/40 transition">
                          {/* Name & Designation */}
                          <td className="py-3 px-3">
                            {isEditing ? (
                              <div className="space-y-1">
                                <input
                                  type="text"
                                  value={editName}
                                  onChange={(e) => setEditName(e.target.value)}
                                  className="bg-slate-800 border border-cyan-500 text-white text-xs px-2 py-1 rounded w-full"
                                  placeholder="Full Name"
                                />
                                <input
                                  type="text"
                                  value={editDesignation}
                                  onChange={(e) => setEditDesignation(e.target.value)}
                                  className="bg-slate-800 border border-slate-700 text-slate-300 text-[10px] px-2 py-0.5 rounded w-full"
                                  placeholder="Official Designation"
                                />
                              </div>
                            ) : (
                              <div>
                                <div className="font-bold text-white flex items-center gap-1.5">
                                  <span>{u.name}</span>
                                  {u.googleId && (
                                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                      Google
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-slate-400">{u.designation || u.id}</span>
                              </div>
                            )}
                          </td>

                          {/* Role */}
                          <td className="py-3 px-3">
                            {isEditing ? (
                              <select
                                value={editRole}
                                onChange={(e) => setEditRole(e.target.value as UserRole)}
                                className="bg-slate-800 border border-cyan-500 text-white text-xs px-2 py-1 rounded cursor-pointer"
                              >
                                {availableRolesForAdmin.map(role => (
                                  <option key={role} value={role}>{role}</option>
                                ))}
                              </select>
                            ) : (
                              <span className={`text-[9px] px-2 py-0.5 rounded-full font-mono border ${getRoleBadgeStyle(u.role)}`}>
                                {u.role}
                              </span>
                            )}
                          </td>

                          {/* Username */}
                          <td className="py-3 px-3 font-mono text-cyan-400">
                            <div>@{u.username}</div>
                            {u.email && (
                              <div className="text-[10px] text-slate-400 font-sans">{u.email}</div>
                            )}
                          </td>

                          {/* Passcode */}
                          <td className="py-3 px-3">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editPasscode}
                                onChange={(e) => setEditPasscode(e.target.value)}
                                className="bg-slate-800 border border-cyan-500 text-amber-300 font-mono text-xs px-2 py-1 rounded w-28"
                              />
                            ) : (
                              <span className="font-mono text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                                {u.passcode}
                              </span>
                            )}
                          </td>

                          {/* IMO Dropdown */}
                          <td className="py-3 px-3 text-slate-300">
                            {isEditing ? (
                              <select
                                value={editImo}
                                disabled={isImoAdmin}
                                onChange={(e) => {
                                  const imo = e.target.value;
                                  setEditImo(imo);
                                  if (imo === 'All IMOs') {
                                    setEditNis('All NIS');
                                  }
                                }}
                                className="bg-slate-800 border border-cyan-500 text-white text-xs px-2 py-1 rounded w-full cursor-pointer"
                              >
                                {availableImoOptions.map(imo => (
                                  <option key={imo} value={imo}>{imo}</option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-[11px] truncate max-w-[180px] block">
                                {u.imoOffice}
                              </span>
                            )}
                          </td>

                          {/* NIS Binding Dropdown */}
                          <td className="py-3 px-3 text-slate-400">
                            {isEditing ? (
                              <div className="space-y-0.5">
                                <select
                                  value={editImo === 'All IMOs' ? 'All NIS' : editNis}
                                  disabled={editImo === 'All IMOs'}
                                  onChange={(e) => setEditNis(e.target.value)}
                                  className={`text-xs px-2 py-1 rounded w-full border ${
                                    editImo === 'All IMOs'
                                      ? 'bg-slate-950 border-slate-800 text-slate-500 cursor-not-allowed font-mono'
                                      : 'bg-slate-800 border-cyan-500 text-white cursor-pointer'
                                  }`}
                                >
                                  {editImo === 'All IMOs' ? (
                                    <option value="All NIS">All NIS (Locked)</option>
                                  ) : (
                                    getNisOptionsForImo(editImo).map(nis => (
                                      <option key={nis} value={nis}>{nis}</option>
                                    ))
                                  )}
                                </select>
                                {editImo === 'All IMOs' && (
                                  <span className="text-[9px] text-amber-400/80 font-mono block">
                                    Automatically locked to All NIS
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-[11px] font-mono text-teal-300">
                                {u.nisBinding || '—'}
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-3 text-right">
                            {isEditing ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleSaveEdit(u.id)}
                                  className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded transition cursor-pointer shadow"
                                  title="Save Changes"
                                >
                                  <Save className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingUserId(null)}
                                  className="p-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition cursor-pointer"
                                  title="Cancel"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleStartEdit(u)}
                                  className="p-1.5 text-slate-400 hover:text-cyan-300 hover:bg-slate-800 rounded transition cursor-pointer"
                                  title="Edit Credentials & Scope"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>

                                {u.role !== 'Developer' && !(isImoAdmin && u.role.startsWith('RO')) && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteUser(u)}
                                    className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded transition cursor-pointer"
                                    title="Delete Account"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* TAB 2: PENDING GOOGLE ADMISSIONS VIEW */}
        {activeTab === 'pending_google' && (
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  <strong>Google Account Admission Gate:</strong> Newly registered Google accounts require an Admin or Developer to designate an Institutional Role and IMO office before they can access the GIS platform.
                </span>
              </div>
              <span className="font-mono font-bold bg-amber-500/20 px-2 py-0.5 rounded text-[11px] shrink-0">
                {pendingUsers.length} Pending Requests
              </span>
            </div>

            {pendingUsers.length === 0 ? (
              <div className="py-16 text-center text-slate-500 flex flex-col items-center justify-center">
                <CheckCircle2 className="w-12 h-12 text-emerald-500/40 mb-3" />
                <h4 className="text-sm font-bold text-slate-300">All Google Accounts Admitted</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-md">
                  There are currently no pending Google account admission requests. When new personnel sign in with Google, their requests will appear here for review and role assignment.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingUsers.map((pending) => {
                  const assignedRole = admitRoleMap[pending.id] || (isImoAdmin ? 'IMO Preparer' : 'Field Personnel');
                  const assignedImo = isImoAdmin && currentUser?.imoOffice ? currentUser.imoOffice : (admitImoMap[pending.id] || defaultImoSelection);
                  const validNisList = getNisOptionsForImo(assignedImo);
                  const assignedNis = assignedImo === 'All IMOs' ? 'All NIS' : (admitNisMap[pending.id] || validNisList[0] || 'All NIS');
                  const assignedDesignation = admitDesignationMap[pending.id] || `${assignedRole} - ${assignedNis}`;
                  const isAdmitting = isAdmittingId === pending.id;

                  return (
                    <div 
                      key={pending.id} 
                      className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl hover:border-amber-500/40 transition flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4"
                    >
                      {/* User Profile Info */}
                      <div className="flex items-center gap-3 min-w-[220px]">
                        {pending.avatar ? (
                          <img 
                            src={pending.avatar} 
                            alt={pending.name} 
                            className="w-10 h-10 rounded-full border border-slate-700 object-cover" 
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center justify-center font-bold text-sm">
                            {pending.name.charAt(0)}
                          </div>
                        )}
                        <div>
                          <div className="font-bold text-white text-xs flex items-center gap-2">
                            <span>{pending.name}</span>
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              Pending
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                            {pending.email}
                          </div>
                          <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3" />
                            <span>Requested: {new Date(pending.createdAt || '').toLocaleString()}</span>
                          </div>
                        </div>
                      </div>

                      {/* Inline Assignment Controls */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 flex-1 w-full">
                        {/* Assign Role */}
                        <div>
                          <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                            Assign Role:
                          </label>
                          <select
                            value={assignedRole}
                            onChange={(e) => {
                              const newR = e.target.value as UserRole;
                              setAdmitRoleMap(prev => ({ ...prev, [pending.id]: newR }));
                              const nextImo = newR.startsWith('RO') ? 'All IMOs' : assignedImo;
                              setAdmitImoMap(prev => ({ ...prev, [pending.id]: nextImo }));
                              setAdmitDesignationMap(prev => ({ ...prev, [pending.id]: `${newR} - ${assignedNis}` }));
                            }}
                            className="w-full bg-slate-900 border border-slate-700 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-amber-500"
                          >
                            {availableRolesForAdmin.map(role => (
                              <option key={role} value={role}>{role}</option>
                            ))}
                          </select>
                        </div>

                        {/* Assign IMO Office */}
                        <div>
                          <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                            Assign IMO:
                          </label>
                          <select
                            value={assignedImo}
                            disabled={isImoAdmin}
                            onChange={(e) => {
                              const nextImo = e.target.value;
                              setAdmitImoMap(prev => ({ ...prev, [pending.id]: nextImo }));
                              const nextNis = nextImo === 'All IMOs' ? 'All NIS' : (getNisOptionsForImo(nextImo)[0] || 'All NIS');
                              setAdmitNisMap(prev => ({ ...prev, [pending.id]: nextNis }));
                              setAdmitDesignationMap(prev => ({ ...prev, [pending.id]: `${assignedRole} - ${nextNis}` }));
                            }}
                            className={`w-full border text-xs rounded-lg px-2 py-1.5 ${
                              isImoAdmin
                                ? 'bg-slate-950 border-slate-800 text-slate-400 cursor-not-allowed'
                                : 'bg-slate-900 border-slate-700 text-white focus:outline-none focus:border-amber-500'
                            }`}
                          >
                            {availableImoOptions.map(imo => (
                              <option key={imo} value={imo}>{imo}</option>
                            ))}
                          </select>
                        </div>

                        {/* Assign NIS */}
                        <div>
                          <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                            NIS Scope:
                          </label>
                          <select
                            value={assignedImo === 'All IMOs' ? 'All NIS' : assignedNis}
                            disabled={assignedImo === 'All IMOs'}
                            onChange={(e) => {
                              const nextNis = e.target.value;
                              setAdmitNisMap(prev => ({ ...prev, [pending.id]: nextNis }));
                              setAdmitDesignationMap(prev => ({ ...prev, [pending.id]: `${assignedRole} - ${nextNis}` }));
                            }}
                            className={`w-full border text-xs rounded-lg px-2 py-1.5 ${
                              assignedImo === 'All IMOs'
                                ? 'bg-slate-950 border-slate-800 text-slate-500 cursor-not-allowed font-mono'
                                : 'bg-slate-900 border-slate-700 text-white focus:outline-none focus:border-amber-500'
                            }`}
                          >
                            {assignedImo === 'All IMOs' ? (
                              <option value="All NIS">All NIS (Locked)</option>
                            ) : (
                              validNisList.map(nis => (
                                <option key={nis} value={nis}>{nis}</option>
                              ))
                            )}
                          </select>
                        </div>

                        {/* Title / Designation */}
                        <div>
                          <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                            Title / Designation:
                          </label>
                          <input
                            type="text"
                            value={assignedDesignation}
                            onChange={(e) => {
                              const nextDes = e.target.value;
                              setAdmitDesignationMap(prev => ({ ...prev, [pending.id]: nextDes }));
                            }}
                            className="w-full bg-slate-900 border border-slate-700 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-amber-500"
                            placeholder="Designation"
                          />
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          disabled={isAdmitting}
                          onClick={() => handleAdmitUser(pending)}
                          className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md transition cursor-pointer disabled:opacity-50 active:scale-95"
                          title="Admit user and grant app access with specified role"
                        >
                          <Check className="w-4 h-4" />
                          <span>{isAdmitting ? 'Admitting...' : 'Admit & Grant Access'}</span>
                        </button>

                        <button
                          type="button"
                          disabled={isAdmitting}
                          onClick={() => handleRejectUser(pending)}
                          className="p-2 bg-slate-800 hover:bg-rose-900/60 text-slate-400 hover:text-rose-300 border border-slate-700 rounded-xl transition cursor-pointer"
                          title="Reject admission request"
                        >
                          <UserX className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Footer Summary */}
        <div className="p-3 sm:p-4 border-t border-slate-800 bg-slate-900/90 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-cyan-400 font-bold">{filteredUsers.length}</span>
            <span>registered accounts ({users.length} total across Region IV-B)</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] flex-wrap">
            <span className="flex items-center gap-1 text-slate-400">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span> {users.filter(u => u.role === 'Developer').length} Dev
            </span>
            <span className="flex items-center gap-1 text-slate-400">
              <span className="w-2 h-2 rounded-full bg-fuchsia-500"></span> {users.filter(u => u.role === 'RO Admin').length} RO Admin
            </span>
            <span className="flex items-center gap-1 text-slate-400">
              <span className="w-2 h-2 rounded-full bg-purple-500"></span> {users.filter(u => u.role === 'RO Evaluator').length} RO Evaluators
            </span>
            <span className="flex items-center gap-1 text-slate-400">
              <span className="w-2 h-2 rounded-full bg-orange-500"></span> {users.filter(u => u.role === 'IMO Admin').length} IMO Admin
            </span>
            <span className="flex items-center gap-1 text-slate-400">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span> {users.filter(u => u.role === 'IMO Evaluator').length} IMO Evaluators
            </span>
            <span className="flex items-center gap-1 text-slate-400">
              <span className="w-2 h-2 rounded-full bg-cyan-500"></span> {users.filter(u => u.role === 'IMO Reviewer').length} IMO Reviewers
            </span>
            <span className="flex items-center gap-1 text-slate-400">
              <span className="w-2 h-2 rounded-full bg-teal-500"></span> {users.filter(u => u.role === 'IMO Preparer').length} IMO Preparers
            </span>
            <span className="flex items-center gap-1 text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span> {users.filter(u => u.role === 'Field Personnel').length} Field
            </span>
            <span className="flex items-center gap-1 text-slate-400">
              <span className="w-2 h-2 rounded-full bg-slate-500"></span> {users.filter(u => u.role === 'Viewer').length} Viewers
            </span>
          </div>
        </div>

      </div>
    </div>
  );
};

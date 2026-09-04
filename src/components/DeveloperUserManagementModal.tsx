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
  Sparkles
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
  getNisOptionsForImo
} from '../config/authUsers';

interface DeveloperUserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AuthUser | null;
  onUserUpdated?: () => void;
}

function getShortImoName(imo: string): string {
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

  // Create User Form State (Developer Exclusive)
  const [isCreatingNewUser, setIsCreatingNewUser] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('Field Personnel');
  const [newImo, setNewImo] = useState<string>(CANONICAL_IMO_OFFICES[0]); // Default to MOMARO IMO
  const [newNis, setNewNis] = useState<string>('Baco-Bucayao RIS');
  const [newPasscode, setNewPasscode] = useState('');
  const [newDesignation, setNewDesignation] = useState('');
  const [isSubmittingNew, setIsSubmittingNew] = useState(false);

  // Sync users with server whenever modal opens
  useEffect(() => {
    if (isOpen && currentUser?.role === 'Developer') {
      fetchRemoteAuthUsers().then(() => {
        setUsersVersion(v => v + 1);
      });
    }
  }, [isOpen, currentUser]);

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

  if (!isOpen || !currentUser || currentUser.role !== 'Developer') return null;

  const users = getAuthUsers();

  const filteredUsers = users.filter(u => {
    if (selectedRoleFilter !== 'All' && u.role !== selectedRoleFilter) return false;
    if (selectedImoFilter !== 'All' && !u.imoOffice.includes(selectedImoFilter) && u.imoOffice !== 'All IMOs') return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return u.name.toLowerCase().includes(q) ||
             u.username.toLowerCase().includes(q) ||
             u.passcode.toLowerCase().includes(q) ||
             (u.nisBinding && u.nisBinding.toLowerCase().includes(q));
    }
    return true;
  });

  const handleStartEdit = (user: AuthUser) => {
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
    const prefix = newRole === 'RO Evaluator' ? 'ROE' : newRole === 'RO Reviewer' ? 'ROR' : newRole === 'RO Preparer' ? 'ROP' : newRole === 'IMO Evaluator' ? 'IOE' : newRole === 'IMO Reviewer' ? 'IOR' : newRole === 'IMO Preparer' ? 'IOP' : newRole === 'Field Personnel' ? 'FLD' : newRole === 'Viewer' ? 'VIEW' : 'DEV';
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
    if (window.confirm('Reset all accounts to default factory state? Custom added accounts will be restored.')) {
      await resetAuthUsersToDefault();
      setUsersVersion(v => v + 1);
      setSaveSuccessMsg('All accounts have been reset to factory defaults.');
      setTimeout(() => setSaveSuccessMsg(''), 3500);
      onUserUpdated?.();
    }
  };

  const getRoleBadgeStyle = (role: UserRole) => {
    switch (role) {
      case 'Developer': return 'bg-rose-500/20 text-rose-300 border-rose-500/30 font-mono';
      case 'RO Evaluator': return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'RO Reviewer': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'RO Preparer': return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
      case 'IMO Evaluator': return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'IMO Reviewer': return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30';
      case 'IMO Preparer': return 'bg-teal-500/20 text-teal-300 border-teal-500/30';
      case 'Field Personnel': return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'Viewer': return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
      default: return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-xl animate-in fade-in overflow-y-auto">
      <div className="w-full max-w-6xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] my-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-slate-900/90 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/30 shadow-inner">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white font-heading">
                  Developer Account Management
                </h2>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  MASTER CONTROL
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Manage credentials, RBAC permissions, and IMO/NIS bindings across NIA Region IV-B accounts.
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

            <button
              onClick={handleResetDefaults}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer"
              title="Reset accounts to default passcodes and scopes"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reset Defaults</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
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

        {/* CREATE NEW ACCOUNT FORM CARD (Developer Exclusive) */}
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
                    <option value="RO Evaluator">RO Evaluator (Regional Division Manager &amp; Final Approval)</option>
                    <option value="RO Reviewer">RO Reviewer (Regional Report Reviewer &amp; Verification)</option>
                    <option value="RO Preparer">RO Preparer (Regional Package Preparer &amp; Consolidation)</option>
                    <option value="IMO Evaluator">IMO Evaluator (IMO Division Manager &amp; Approvals)</option>
                    <option value="IMO Reviewer">IMO Reviewer (IMO System Reviewer &amp; O&amp;M Engineer)</option>
                    <option value="IMO Preparer">IMO Preparer (IMO Report Preparer &amp; Accomplishments)</option>
                    <option value="Field Personnel">Field Personnel (Submit Field Reports)</option>
                    <option value="Viewer">Viewer (Read-Only Public Audit)</option>
                    <option value="Developer">Developer (Master Systems Administrator)</option>
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

                {/* IMO Office Dropdown (Strict without Regional Office IV-B) */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    IMO Office Access <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={newImo}
                    onChange={(e) => {
                      const imo = e.target.value;
                      setNewImo(imo);
                      const targetNis = imo === 'All IMOs' ? 'All NIS' : (getNisOptionsForImo(imo)[0] || 'All NIS');
                      setNewNis(targetNis);
                      handleAutoSuggestFields(newRole, imo, targetNis);
                    }}
                    className="w-full bg-slate-900 border border-slate-700 text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    {CANONICAL_IMO_OFFICES.map(imo => (
                      <option key={imo} value={imo}>{imo}</option>
                    ))}
                  </select>
                </div>

                {/* NIS Scope Dropdown (Locked & disabled when All IMOs is selected) */}
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

        {/* Filters & Search Toolbar */}
        <div className="p-4 border-b border-slate-800 bg-slate-900/60 flex flex-wrap items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, username, passcode, or NIS..."
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
              <option value="All">All Roles ({users.length})</option>
              <option value="Developer">Developer</option>
              <option value="RO Evaluator">RO Evaluator</option>
              <option value="RO Reviewer">RO Reviewer</option>
              <option value="RO Preparer">RO Preparer</option>
              <option value="IMO Evaluator">IMO Evaluator</option>
              <option value="IMO Reviewer">IMO Reviewer</option>
              <option value="IMO Preparer">IMO Preparer</option>
              <option value="Field Personnel">Field Personnel</option>
              <option value="Viewer">Viewer</option>
            </select>

            <select
              value={selectedImoFilter}
              onChange={(e) => setSelectedImoFilter(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-cyan-500 cursor-pointer"
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
                  <th className="py-2.5 px-3">Username</th>
                  <th className="py-2.5 px-3">Passcode</th>
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
                            <option value="RO Evaluator">RO Evaluator</option>
                            <option value="RO Reviewer">RO Reviewer</option>
                            <option value="RO Preparer">RO Preparer</option>
                            <option value="IMO Evaluator">IMO Evaluator</option>
                            <option value="IMO Reviewer">IMO Reviewer</option>
                            <option value="IMO Preparer">IMO Preparer</option>
                            <option value="Field Personnel">Field Personnel</option>
                            <option value="Viewer">Viewer</option>
                            <option value="Developer">Developer</option>
                          </select>
                        ) : (
                          <span className={`text-[9px] px-2 py-0.5 rounded-full font-mono border ${getRoleBadgeStyle(u.role)}`}>
                            {u.role}
                          </span>
                        )}
                      </td>

                      {/* Username */}
                      <td className="py-3 px-3 font-mono text-cyan-400">
                        @{u.username}
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

                      {/* IMO Dropdown (Without Regional Office IV-B) */}
                      <td className="py-3 px-3 text-slate-300">
                        {isEditing ? (
                          <select
                            value={editImo}
                            onChange={(e) => {
                              const imo = e.target.value;
                              setEditImo(imo);
                              if (imo === 'All IMOs') {
                                setEditNis('All NIS');
                              }
                            }}
                            className="bg-slate-800 border border-cyan-500 text-white text-xs px-2 py-1 rounded w-full cursor-pointer"
                          >
                            {CANONICAL_IMO_OFFICES.map(imo => (
                              <option key={imo} value={imo}>{imo}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-[11px] truncate max-w-[180px] block">
                            {u.imoOffice}
                          </span>
                        )}
                      </td>

                      {/* NIS Binding Dropdown (Locked if All IMOs is selected) */}
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

                            {u.role !== 'Developer' && (
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

        {/* Footer Summary */}
        <div className="p-3 sm:p-4 border-t border-slate-800 bg-slate-900/90 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-cyan-400 font-bold">{filteredUsers.length}</span>
            <span>accounts showing ({users.length} total)</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] flex-wrap">
            <span className="flex items-center gap-1 text-slate-400">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span> {users.filter(u => u.role === 'Developer').length} Dev
            </span>
            <span className="flex items-center gap-1 text-slate-400">
              <span className="w-2 h-2 rounded-full bg-purple-500"></span> {users.filter(u => u.role.startsWith('RO')).length} Regional Office
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
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span> {users.filter(u => u.role === 'Field Personnel').length} Field Personnel
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

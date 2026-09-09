import React, { useState, useRef, useEffect } from 'react';
import { 
  Layers, 
  FileText, 
  RefreshCw, 
  HelpCircle,
  Plus,
  Filter,
  LogOut,
  ShieldCheck,
  User,
  Sliders,
  ChevronDown,
  Building,
  RotateCcw,
  Check,
  Menu,
  X,
  Wifi,
  WifiOff,
  Sun,
  Moon,
  MapPin,
  Download,
  Smartphone,
  ExternalLink,
  FileSpreadsheet,
  Globe
} from 'lucide-react';
import { UserRole, GISLayer, FieldReport, AuthUser, AvailableCloudWeek } from '../types';
import { canUserManageRequests } from '../config/authUsers';

interface NavbarProps {
  authenticatedUser: AuthUser | null;
  activeRole: UserRole;
  activeImo?: string;
  activeNis?: string;
  simulatedRole?: UserRole | null;
  simulatedImo?: string | null;
  simulatedNis?: string | null;
  onSimulateContext?: (role: UserRole | null, imo: string | null, nis: string | null) => void;
  onRoleChange: (role: UserRole) => void;
  isOffline: boolean;
  onToggleOfflineMode: () => void;
  unsyncedCount: number;
  onSyncNow: () => void;
  isSyncing: boolean;
  onOpenSyncModal?: () => void;
  isSyncDataModalOpen?: boolean;
  onOpenUpload?: () => void;
  onOpenReportModal: (type?: 'maintenance' | 'operational') => void;
  onOpenReportsSummary?: (tab?: 'ledger' | 'form691' | 'photos') => void;
  availableCloudWeeks?: AvailableCloudWeek[];
  onDownloadWeek?: (weekKey: string) => Promise<void>;
  onDownloadAllWeeks?: () => Promise<void>;
  isDownloadingWeek?: string | null;
  cachedReportsCount?: number;
  cachedWeekKeys?: Set<string>;
  onToggleLayerPanel: () => void;
  isLayerPanelOpen: boolean;
  onOpenFilterModal: () => void;
  isFilterModalOpen?: boolean;
  isFilterActive?: boolean;
  onOpenHelp: () => void;
  onOpenConfigurations?: () => void;
  onOpenDevPanel?: () => void;
  onOpenAccessRequests?: () => void;
  pendingRequestsCount?: number;
  onOpenRoleMatrix?: () => void;
  onLogout?: () => void;
  isMapPickerActive?: boolean;
  currentTheme?: 'dark' | 'light';
  onToggleTheme?: (theme: 'dark' | 'light') => void;
  isMenuOpen?: boolean;
  onToggleMenu?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  authenticatedUser,
  activeRole,
  activeImo,
  activeNis,
  simulatedRole,
  simulatedImo,
  simulatedNis,
  onSimulateContext,
  onRoleChange,
  isOffline,
  onToggleOfflineMode,
  unsyncedCount,
  onSyncNow,
  isSyncing,
  onOpenSyncModal,
  isSyncDataModalOpen = false,
  onOpenReportModal,
  onOpenReportsSummary,
  onToggleLayerPanel,
  isLayerPanelOpen,
  onOpenFilterModal,
  isFilterActive = false,
  onOpenHelp,
  onOpenConfigurations,
  onOpenDevPanel,
  onOpenAccessRequests,
  pendingRequestsCount = 0,
  onOpenRoleMatrix,
  onLogout,
  isMapPickerActive = false,
  currentTheme = 'dark',
  onToggleTheme,
  isMenuOpen,
  onToggleMenu
}) => {
  const [internalHamburgerOpen, setInternalHamburgerOpen] = useState(false);
  const isHamburgerOpen = isMenuOpen !== undefined ? isMenuOpen : internalHamburgerOpen;
  const toggleHamburger = () => {
    if (onToggleMenu) {
      onToggleMenu();
    } else {
      setInternalHamburgerOpen(prev => !prev);
    }
  };
  const closeHamburger = () => {
    if (isMenuOpen !== undefined) {
      if (isMenuOpen && onToggleMenu) onToggleMenu();
    } else {
      setInternalHamburgerOpen(false);
    }
  };
  const [isSimulatorExpanded, setIsSimulatorExpanded] = useState(false);
  const hamburgerRef = useRef<HTMLDivElement>(null);

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState<boolean>(() => {
    try {
      return window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
    } catch (_) {
      return false;
    }
  });

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallPwa = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else {
      alert('To install this app on your device:\n\n• Chrome / Edge (Desktop): Click the Install icon (⤓) in the address bar.\n• Android Chrome: Tap Menu (⋮) → "Install app" or "Add to Home Screen".\n• iPhone / iPad (Safari): Tap Share (⬆) → "Add to Home Screen".');
    }
  };

  // Close hamburger menu on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (hamburgerRef.current && !hamburgerRef.current.contains(event.target as Node)) {
        closeHamburger();
      }
    };
    if (isHamburgerOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isHamburgerOpen]);

  // Role Definitions (Institutional Multi-Tier Architecture)
  const allRoles: { role: UserRole; label: string; desc: string; badgeColor: string }[] = [
    { role: 'Developer', label: 'Developer', desc: 'Master developer control, user management & unrestricted scope', badgeColor: 'bg-rose-500/15 text-rose-800 dark:text-rose-300 border-rose-500/30 font-mono' },
    { role: 'RO Admin', label: 'RO Admin', desc: 'Regional Executive Administrator, user admissions & gatekeeper access', badgeColor: 'bg-fuchsia-500/15 text-fuchsia-800 dark:text-fuchsia-300 border-fuchsia-500/30 font-bold' },
    { role: 'RO Evaluator', label: 'RO Evaluator', desc: 'Regional Division Manager, final regional approval & unrestricted scope', badgeColor: 'bg-purple-500/15 text-purple-800 dark:text-purple-300 border-purple-500/30' },
    { role: 'RO Reviewer', label: 'RO Reviewer', desc: 'Reviews submitted field reports, verifies regional compliance & data accuracy', badgeColor: 'bg-blue-500/15 text-blue-800 dark:text-blue-300 border-blue-500/30' },
    { role: 'RO Preparer', label: 'RO Preparer', desc: 'Prepares regional packages, consolidates regional reports & tracks deadlines', badgeColor: 'bg-indigo-500/15 text-indigo-800 dark:text-indigo-300 border-indigo-500/30' },
    { role: 'IMO Admin', label: 'IMO Admin', desc: 'IMO Administrator, IMO user admissions & gatekeeper access', badgeColor: 'bg-orange-500/15 text-orange-800 dark:text-orange-300 border-orange-500/30 font-bold' },
    { role: 'IMO Evaluator', label: 'IMO Evaluator', desc: 'IMO Division management, final approvals & forwarding authority', badgeColor: 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30' },
    { role: 'IMO Reviewer', label: 'IMO Reviewer', desc: 'IMO System reviewer & O&M engineer, reviews & endorses field submissions', badgeColor: 'bg-cyan-500/15 text-cyan-800 dark:text-cyan-300 border-cyan-500/30' },
    { role: 'IMO Preparer', label: 'IMO Preparer', desc: 'IMO-level report preparer for system accomplishments & maintenance logs', badgeColor: 'bg-teal-500/15 text-teal-800 dark:text-teal-300 border-teal-500/30' },
    { role: 'Field Personnel', label: 'Field Personnel', desc: 'Submits field maintenance/operational reports (Pending Approval)', badgeColor: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30' },
    { role: 'Viewer', label: 'Viewer', desc: 'Read-only inspection of approved layers & records', badgeColor: 'bg-slate-500/15 text-slate-800 dark:text-slate-300 border-slate-500/30' }
  ];

  const IMO_OPTIONS = [
    'All IMOs',
    'Occidental Mindoro IMO',
    'Oriental Mindoro IMO',
    'Palawan IMO',
    'Regional Office IV-B'
  ];

  const NIS_OPTIONS_BY_IMO: Record<string, string[]> = {
    'Occidental Mindoro IMO': [
      'All NIS',
      'Batang-Batang RIS',
      'Bucayao RIS',
      'Caguray RIS',
      'Lumintao RIS',
      'Mamburao RIS',
      'Mapang RIS',
      'Mongpong RIS',
      'Pagbahan RIS',
      'Pitogo RIS',
      'Rizal RIS'
    ],
    'Oriental Mindoro IMO': [
      'All NIS',
      'Alag RIS',
      'Baco RIS',
      'Bansud RIS',
      'Bongabong RIS',
      'Calapan RIS',
      'Mag-asawang Tubig RIS',
      'Pula RIS',
      'San Agustin RIS'
    ],
    'Palawan IMO': [
      'All NIS',
      'Malatgao RIS',
      'Batang-Batang RIS (Palawan)',
      'Ibato-Iraan RIS',
      'Tigman-Inagawan RIS'
    ]
  };

  const isPrivilegedUser = 
    authenticatedUser?.role === 'Developer' || 
    authenticatedUser?.role === 'RO Admin' ||
    authenticatedUser?.role === 'RO Evaluator' || 
    authenticatedUser?.role === 'RO Reviewer' || 
    authenticatedUser?.role === 'RO Preparer' || 
    authenticatedUser?.role === 'IMO Admin' ||
    authenticatedUser?.role === 'IMO Evaluator';
  
  const availableSimulationRoles = authenticatedUser?.role === 'Developer'
    ? allRoles
    : authenticatedUser?.role === 'RO Admin'
    ? allRoles.filter(r => r.role !== 'Developer')
    : authenticatedUser?.role === 'RO Evaluator'
    ? allRoles.filter(r => r.role !== 'Developer' && r.role !== 'RO Admin')
    : (authenticatedUser?.role === 'RO Reviewer' || authenticatedUser?.role === 'RO Preparer')
    ? allRoles.filter(r => r.role !== 'Developer' && r.role !== 'RO Admin' && r.role !== 'RO Evaluator')
    : authenticatedUser?.role === 'IMO Admin'
    ? allRoles.filter(r => !r.role.startsWith('RO') && r.role !== 'Developer')
    : allRoles.filter(r => !r.role.startsWith('RO') && r.role !== 'Developer' && r.role !== 'IMO Admin');

  const currentRoleObj = allRoles.find(r => r.role === activeRole) || allRoles[0];
  const isSimulating = Boolean(simulatedRole || (simulatedImo && simulatedImo !== authenticatedUser?.imoOffice) || (simulatedNis && simulatedNis !== authenticatedUser?.nisBinding));

  if (isMapPickerActive) return null;

  return (
    <header className="absolute top-2 left-2 right-2 sm:top-3 sm:left-3 sm:right-3 z-30 flex flex-wrap items-center justify-between gap-2 sm:gap-3 pointer-events-none pt-[env(safe-area-inset-top)]">
      {/* Connected Header Bar: Brand Logo & Title + Main Action Buttons */}
      <div className="flex items-center gap-1.5 sm:gap-2 pointer-events-auto bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-xl p-1 sm:p-1.5 shadow-2xl max-w-full overflow-x-auto custom-scrollbar">
        {/* Brand Logo & Heading Window */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 px-2 py-1 sm:px-3 sm:py-1.5 border-r border-slate-700/80 shrink-0">
          <img
            src="/nia-logo.svg"
            alt="National Irrigation Administration (NIA) Logo"
            className="w-6 h-6 sm:w-8 sm:h-8 object-contain shrink-0 drop-shadow-md"
            referrerPolicy="no-referrer"
          />
          <div>
            <h1 className="text-[11px] sm:text-sm font-bold tracking-tight text-slate-100 font-heading whitespace-nowrap leading-none">
              NIA R4B O&amp;M GIS
            </h1>
            <p className="text-[8px] sm:text-[10px] text-slate-400 font-medium whitespace-nowrap mt-0.5 leading-none hidden min-[360px]:block">
              Field Data Crowdsourcing
            </p>
          </div>
        </div>

        {/* 1. Create Report Button (Prominent Action Button - Hidden for Viewer) */}
        {activeRole !== 'Viewer' && (
          <button
            onClick={() => onOpenReportModal()}
            className="flex items-center gap-1 sm:gap-1.5 bg-[#166534] hover:bg-[#15803d] text-white font-bold text-xs px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-lg shadow-md hover:shadow-lg transition cursor-pointer active:scale-95 shrink-0"
            title="Create Field Maintenance or Operational Status Report"
          >
            <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="whitespace-nowrap">Create Report</span>
          </button>
        )}

        {/* 2. View Reports Button (Matching Layer & Filter Button Appearance) */}
        {onOpenReportsSummary && (
          <button
            onClick={() => onOpenReportsSummary('ledger')}
            className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs font-semibold transition border shrink-0 cursor-pointer active:scale-95 bg-slate-800/80 text-slate-300 border-slate-700/80 hover:bg-slate-700 hover:text-slate-100"
            title="View Accomplishment Reports Summary, Form 691 & Photo Docs"
          >
            <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#166534] dark:text-emerald-400 shrink-0" />
            <span className="whitespace-nowrap">View Reports</span>
          </button>
        )}

        {/* 3. Sync data Button (Opens Sync Data & Cloud Batches Window) */}
        <button
          onClick={onOpenSyncModal || onSyncNow}
          className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs font-semibold transition border shrink-0 cursor-pointer active:scale-95 ${
            isSyncDataModalOpen
              ? 'bg-emerald-600/20 text-[#166534] dark:text-emerald-300 border-emerald-600/40 shadow-sm font-bold'
              : unsyncedCount > 0
              ? 'bg-amber-600 hover:bg-amber-500 text-white border-amber-500/80 shadow-md shadow-amber-600/30 animate-pulse font-bold'
              : 'bg-slate-800/80 text-slate-300 border-slate-700/80 hover:bg-slate-700 hover:text-slate-100'
          }`}
          title={
            isOffline 
              ? 'Offline Mode Active (Open to view cached data)' 
              : unsyncedCount > 0 
              ? `${unsyncedCount} offline report(s) queued. Click to open sync controls.` 
              : 'Manage Data Synchronization & Weekly Batches'
          }
        >
          <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#166534] dark:text-emerald-400 shrink-0 ${isSyncing ? 'animate-spin' : ''}`} />
          <span className="whitespace-nowrap">
            {isSyncing ? 'Syncing...' : unsyncedCount > 0 ? `Sync data (${unsyncedCount})` : 'Sync data'}
          </span>
        </button>

        {/* 4. Layers Button */}
        <button
          onClick={onToggleLayerPanel}
          className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs font-semibold transition border shrink-0 cursor-pointer active:scale-95 ${
            isLayerPanelOpen
              ? 'bg-emerald-600/20 text-[#166534] dark:text-emerald-300 border-emerald-600/40 shadow-sm font-bold'
              : 'bg-slate-800/80 text-slate-300 border-slate-700/80 hover:bg-slate-700 hover:text-slate-100'
          }`}
          title="Toggle GIS Layers Management Drawer"
        >
          <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#166534] dark:text-emerald-400 shrink-0" />
          <span className="whitespace-nowrap">Layers</span>
        </button>

        {/* 5. Filter Button */}
        <button
          onClick={onOpenFilterModal}
          className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs font-semibold transition border relative shrink-0 cursor-pointer active:scale-95 ${
            isFilterActive
              ? 'bg-[#166534] text-white border-[#15803d] shadow-md font-bold'
              : 'bg-slate-800/80 text-slate-300 border-slate-700/80 hover:bg-slate-700 hover:text-slate-100'
          }`}
          title="Filter Layers & Reports by Location (IMO, NIS, Province, Municipality, Barangay)"
        >
          <Filter className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 ${isFilterActive ? 'text-white' : 'text-[#166534] dark:text-emerald-400'}`} />
          <span className="whitespace-nowrap">Filter</span>
          {isFilterActive && (
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping absolute -top-0.5 -right-0.5" />
          )}
        </button>
      </div>

      {/* Hamburger Menu Trigger Button & Slide-down Drawer (Right Side) */}
      <div className="relative pointer-events-auto shrink-0" ref={hamburgerRef}>
        <button
          onClick={toggleHamburger}
          className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-xs font-bold transition border shadow-2xl cursor-pointer active:scale-95 ${
            isHamburgerOpen || isSimulating
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-amber-500/10'
              : 'bg-slate-900/90 text-slate-200 border-slate-800 hover:bg-slate-800 hover:text-white'
          }`}
          title="Open Menu & System Controls"
        >
          {isHamburgerOpen ? (
            <X className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
          ) : (
            <Menu className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400" />
          )}
          <span className="hidden sm:inline">Menu</span>
          {isSimulating && (
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          )}
        </button>

        {/* Floating Hamburger Popover Drawer */}
        {isHamburgerOpen && (
          <div className="absolute top-full right-0 mt-2 w-80 max-w-[94vw] bg-slate-900/98 backdrop-blur-2xl border border-slate-700/90 rounded-2xl shadow-2xl p-3.5 z-50 animate-in fade-in zoom-in-95 duration-150 max-h-[85vh] overflow-y-auto custom-scrollbar flex flex-col gap-3">
            {/* 1. User Profile Card */}
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-600/15 border border-emerald-600/30 text-[#166534] dark:text-emerald-300 flex items-center justify-center text-xs font-black shrink-0">
                  {authenticatedUser?.name ? authenticatedUser.name.charAt(0) : 'U'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-slate-100 truncate leading-tight">
                    {authenticatedUser?.name || 'User Profile'}
                  </div>
                  <div className="text-[10px] text-[#166534] dark:text-emerald-400 font-mono mt-0.5 truncate">
                    @{authenticatedUser?.username || 'user'}
                  </div>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${currentRoleObj.badgeColor}`}>
                  {activeRole}
                </span>
              </div>
              <div className="mt-2 pt-2 border-t border-slate-700/80 text-[10px] text-slate-400 flex items-center gap-1.5">
                <Building className="w-3 h-3 text-[#166534] dark:text-emerald-400 shrink-0" />
                <span className="truncate">{authenticatedUser?.nisBinding || authenticatedUser?.imoOffice || 'Regional Office IV-B'}</span>
              </div>
            </div>

            {/* 1.5. NIA Unified App Switcher */}
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-2.5 space-y-2">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <span className="flex items-center gap-1 text-emerald-400">
                  <Layers className="w-3 h-3" />
                  <span>NIA R4B App Hub</span>
                </span>
                <span className="text-[9px] font-mono text-slate-400">Live Linked</span>
              </div>

              <div className="space-y-1.5">
                <a
                  href="https://nia4b-intervention-137196978824.asia-southeast1.run.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-2 rounded-lg bg-slate-900/90 hover:bg-slate-850 border border-slate-700 hover:border-emerald-500/50 transition text-xs group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-slate-200 font-semibold truncate group-hover:text-emerald-300">
                        Interventions Report Generator
                      </div>
                      <div className="text-[9.5px] text-slate-400 truncate">IDU Matrix &amp; PDF/Excel</div>
                    </div>
                  </div>
                  <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-emerald-400 shrink-0" />
                </a>

                <a
                  href="https://nia4b-oie-login-518397636928.asia-southeast1.run.app/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-2 rounded-lg bg-slate-900/90 hover:bg-slate-850 border border-slate-700 hover:border-emerald-500/50 transition text-xs group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Globe className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-slate-200 font-semibold truncate group-hover:text-cyan-300">
                        Central Login Portal
                      </div>
                      <div className="text-[9.5px] text-slate-400 truncate">SSO Gateway &amp; User Directory</div>
                    </div>
                  </div>
                  <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-cyan-400 shrink-0" />
                </a>
              </div>
            </div>

            {/* PWA 1-Click Install Button */}
            {!isStandalone && (
              <button
                type="button"
                onClick={() => {
                  closeHamburger();
                  handleInstallPwa();
                }}
                className="w-full flex items-center justify-between px-3 py-2.5 bg-gradient-to-r from-emerald-600/30 to-teal-600/30 hover:from-emerald-600/40 hover:to-teal-600/40 text-emerald-200 border border-emerald-500/50 rounded-xl transition cursor-pointer text-xs font-bold shadow-lg shadow-emerald-950/40 active:scale-95"
              >
                <div className="flex items-center gap-2">
                  <Download className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div className="text-left">
                    <div className="font-bold text-white">📲 Install App on Device</div>
                    <div className="text-[10px] text-emerald-300 font-normal">Offline-ready • Auto-updating</div>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[10px] font-black uppercase tracking-wider">
                  Install
                </span>
              </button>
            )}

            {/* 2. Privileged Role & Location Simulator */}
            {isPrivilegedUser && (
              <div className="bg-slate-800/80 border border-amber-500/30 rounded-xl p-3">
                <button
                  type="button"
                  onClick={() => setIsSimulatorExpanded(prev => !prev)}
                  className="w-full flex items-center justify-between text-left cursor-pointer"
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Role &amp; Location Simulator</span>
                  </div>
                  <ChevronDown className={`w-3.5 h-3.5 text-amber-600 dark:text-amber-400 transition-transform duration-200 ${isSimulatorExpanded ? 'rotate-180' : ''}`} />
                </button>

                {isSimulatorExpanded && (
                  <div className="mt-3 pt-2.5 border-t border-slate-700/80 space-y-3">
                    {/* Role Selection */}
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1 block">
                        Simulate Role:
                      </label>
                      <select
                        value={activeRole}
                        onChange={(e) => {
                          const newRole = e.target.value as UserRole;
                          onRoleChange(newRole);
                          if (onSimulateContext) {
                            onSimulateContext(newRole, activeImo || null, activeNis || null);
                          }
                        }}
                        className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-500 font-medium"
                      >
                        {availableSimulationRoles.map(r => (
                          <option key={r.role} value={r.role}>{r.label} — {r.desc.slice(0, 32)}...</option>
                        ))}
                      </select>
                    </div>

                    {/* IMO Selection */}
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1 block">
                        Simulate IMO Jurisdiction:
                      </label>
                      <select
                        value={activeImo || 'All IMOs'}
                        onChange={(e) => {
                          const newImo = e.target.value;
                          if (onSimulateContext) {
                            onSimulateContext(activeRole, newImo === 'All IMOs' ? null : newImo, 'All NIS');
                          }
                        }}
                        className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-emerald-500 font-medium"
                      >
                        {IMO_OPTIONS.map(imo => (
                          <option key={imo} value={imo}>{imo}</option>
                        ))}
                      </select>
                    </div>

                    {/* NIS Selection */}
                    {activeImo && activeImo !== 'All IMOs' && NIS_OPTIONS_BY_IMO[activeImo] && (
                      <div>
                        <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1 block">
                          Simulate NIS System:
                        </label>
                        <select
                          value={activeNis || 'All NIS'}
                          onChange={(e) => {
                            const newNis = e.target.value;
                            if (onSimulateContext) {
                              onSimulateContext(activeRole, activeImo, newNis === 'All NIS' ? null : newNis);
                            }
                          }}
                          className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-teal-500 font-medium"
                        >
                          {NIS_OPTIONS_BY_IMO[activeImo].map(nis => (
                            <option key={nis} value={nis}>{nis}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Reset Button */}
                    {isSimulating && (
                      <button
                        onClick={() => {
                          if (onSimulateContext) {
                            onSimulateContext(null, null, null);
                          }
                        }}
                        className="w-full py-1.5 px-2 bg-rose-500/15 hover:bg-rose-500/25 text-rose-800 dark:text-rose-300 border border-rose-500/30 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Reset Simulation to Default</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 3. Offline Mode Simulator Toggle */}
            <div className="flex items-center justify-between bg-slate-800/80 border border-slate-700/80 rounded-xl p-2.5 px-3">
              <div className="flex items-center gap-2">
                {isOffline ? (
                  <WifiOff className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                ) : (
                  <Wifi className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                )}
                <div>
                  <div className="text-xs font-bold text-slate-100 leading-none">Network State</div>
                  <div className="text-[10px] text-slate-400 mt-0.5 leading-none">
                    {isOffline ? 'Simulated Offline Mode' : 'Online Connection Active'}
                  </div>
                </div>
              </div>
              <button
                onClick={onToggleOfflineMode}
                className={`text-xs font-bold px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                  isOffline
                    ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                    : 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                }`}
              >
                {isOffline ? 'Go Online' : 'Go Offline'}
              </button>
            </div>

            {/* 4. Theme Mode Switcher */}
            {onToggleTheme && (
              <div className="flex items-center justify-between bg-slate-800/80 border border-slate-700/80 rounded-xl p-2.5 px-3">
                <div className="flex items-center gap-2">
                  {currentTheme === 'dark' ? (
                    <Moon className="w-4 h-4 text-indigo-400" />
                  ) : (
                    <Sun className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                  )}
                  <div>
                    <div className="text-xs font-bold text-slate-100 leading-none">Interface Theme</div>
                    <div className="text-[10px] text-slate-400 mt-0.5 leading-none">
                      {currentTheme === 'dark' ? 'Titanium Charcoal (Dark)' : 'Sandstone & Forest (Light)'}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => onToggleTheme(currentTheme === 'dark' ? 'light' : 'dark')}
                  className="text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer"
                >
                  Switch to {currentTheme === 'dark' ? 'Light' : 'Dark'}
                </button>
              </div>
            )}

            {/* 5. System Configurations & Photo Settings */}
            {onOpenConfigurations && (
              <button
                onClick={() => {
                  closeHamburger();
                  onOpenConfigurations();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-slate-700/80 rounded-xl transition cursor-pointer text-xs font-semibold"
              >
                <Sliders className="w-4 h-4 text-[#166534] dark:text-emerald-400 shrink-0" />
                <span>Configurations &amp; Photo Settings</span>
              </button>
            )}

            {/* 6. Account & Access Gatekeeper Management */}
            {(authenticatedUser?.role === 'Developer' || authenticatedUser?.role === 'RO Admin' || authenticatedUser?.role === 'IMO Admin') && onOpenDevPanel && (
              <button
                onClick={() => {
                  closeHamburger();
                  onOpenDevPanel();
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl transition cursor-pointer text-xs font-bold border ${
                  authenticatedUser?.role === 'Developer'
                    ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-800 dark:text-rose-300 border-rose-500/30'
                    : authenticatedUser?.role === 'RO Admin'
                    ? 'bg-fuchsia-500/10 hover:bg-fuchsia-500/20 text-fuchsia-800 dark:text-fuchsia-300 border-fuchsia-500/30'
                    : 'bg-orange-500/10 hover:bg-orange-500/20 text-orange-800 dark:text-orange-300 border-orange-500/30'
                }`}
              >
                <ShieldCheck className={`w-4 h-4 shrink-0 ${
                  authenticatedUser?.role === 'Developer'
                    ? 'text-rose-600 dark:text-rose-400'
                    : authenticatedUser?.role === 'RO Admin'
                    ? 'text-fuchsia-600 dark:text-fuchsia-400'
                    : 'text-orange-600 dark:text-orange-400'
                }`} />
                <span>
                  {authenticatedUser?.role === 'Developer'
                    ? 'Manage Accounts & Admissions'
                    : authenticatedUser?.role === 'RO Admin'
                    ? 'Manage Regional Accounts & Admissions'
                    : 'Manage IMO Accounts & Admissions'}
                </span>
              </button>
            )}

            {/* 6.5 Access Requests Review Queue - Only for Developer, RO Admin, IMO Admin */}
            {canUserManageRequests(authenticatedUser) && onOpenAccessRequests && (
              <button
                onClick={() => {
                  closeHamburger();
                  onOpenAccessRequests();
                }}
                className="w-full flex items-center justify-between px-3 py-2 bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-slate-700/80 rounded-xl transition cursor-pointer text-xs font-semibold"
              >
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#009933] shrink-0" />
                  <span>Access Requests Review Queue</span>
                </div>
                {pendingRequestsCount && pendingRequestsCount > 0 ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500 text-amber-950 font-bold font-mono animate-pulse">
                    {pendingRequestsCount} Pending
                  </span>
                ) : (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono text-[9px]">
                    All Done
                  </span>
                )}
              </button>
            )}

            {/* 6.6 6-Tier Institutional Rights Matrix */}
            {onOpenRoleMatrix && (
              <button
                onClick={() => {
                  closeHamburger();
                  onOpenRoleMatrix();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-slate-700/80 rounded-xl transition cursor-pointer text-xs font-semibold"
              >
                <HelpCircle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>6-Tier Institutional RBAC Matrix</span>
              </button>
            )}

            {/* 7. Help & Documentation */}
            <button
              onClick={() => {
                closeHamburger();
                onOpenHelp();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-slate-700/80 rounded-xl transition cursor-pointer text-xs font-semibold"
            >
              <HelpCircle className="w-4 h-4 text-[#166534] dark:text-emerald-400 shrink-0" />
              <span>Help &amp; System Documentation</span>
            </button>

            {/* 7. Sign Out Button */}
            {onLogout && (
              <button
                onClick={() => {
                  closeHamburger();
                  onLogout();
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-rose-500/15 hover:bg-rose-500/25 text-rose-800 dark:text-rose-300 border border-rose-500/30 rounded-xl transition cursor-pointer text-xs font-bold mt-1"
              >
                <LogOut className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                <span>Sign Out</span>
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
};

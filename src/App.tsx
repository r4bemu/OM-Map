import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  UserRole, 
  BasemapType, 
  GISLayer, 
  FieldReport,
  LocationFilter,
  AuthUser,
  ReportTimeScope,
  AvailableCloudWeek,
  AccessRequest
} from './types';
import { INITIAL_GIS_LAYERS, INITIAL_FIELD_REPORTS } from './data/sampleLayers';
import { 
  getOfflineReports, 
  saveOfflineReports,
  getCachedReportsDB,
  saveCachedReportsDB,
  getDownloadedWeekKeys,
  markWeekDownloaded,
  markWeeksDownloaded,
  addOfflineReport, 
  markReportsSynced,
  getCachedLayers, 
  saveCachedLayers, 
  getCachedLayersDB,
  saveCachedLayersDB,
  syncOfflineQueueToServer,
  isMockLayer,
  getManifestMetadataDB,
  saveManifestMetadataDB,
  deleteCachedReportDB,
  clearAllLocalDataDB,
  clearAllLayersDB,
  setLastOverhaulTimestamp
} from './utils/offlineStorage';
import { getIsoWeekInfo, getAvailableWeeksFromReports, isReportInWeek } from './utils/weekUtils';
import { parseGISFile } from './utils/kmzParser';
import { getAccessToken, uploadMaintenanceReportToDrive } from './lib/googleDriveService';
import { getSavedAuthSession, saveAuthSession, clearAuthSession, fetchRemoteAuthUsers, getAuthUsers, fetchAccessRequestsApi, canUserManageRequests, isImoScopedRole, matchesImoOffice } from './config/authUsers';
import { MOCK_FIELD_REPORTS_2026 } from './data/mockFieldReports2026';
import { 
  MAINTENANCE_ACTIVITY_CONFIG, 
  OPERATIONAL_STATE_CONFIG, 
  getActivityColor, 
  STRUCTURE_BLUE_COLOR 
} from './utils/activityColors';
import { 
  classifyVectorItem, 
  sanitizeLayerToBlueHierarchy, 
  BLUE_PALETTE 
} from './utils/canalLayerClassifier';

import { Navbar } from './components/Navbar';
import { MobileBottomNav } from './components/MobileBottomNav';
import { MapContainer } from './components/MapContainer';
import { LayerPanel } from './components/LayerPanel';
import { AttributeInspector } from './components/AttributeInspector';
import { UploadModal } from './components/UploadModal';
import { FieldReportModal } from './components/FieldReportModal';
import { HelpModal } from './components/HelpModal';
import { LocationFilterModal } from './components/LocationFilterModal';
import { SearchResultsModal } from './components/SearchResultsModal';
import { 
  CheckCircle2, 
  Loader2, 
  X, 
  HardDrive, 
  Cloud, 
  CloudUpload 
} from 'lucide-react';
import { LoginModal } from './components/LoginModal';
import { DeveloperUserManagementModal } from './components/DeveloperUserManagementModal';
import { RoleMatrixModal } from './components/RoleMatrixModal';
import { AccessRequestManagementModal } from './components/AccessRequestManagementModal';
import { RoleSimulationBanner } from './components/RoleSimulationBanner';
import { ReportsSummaryModal } from './components/ReportsSummaryModal';
import { PdfPreviewModal } from './components/PdfPreviewModal';
import { SyncDataModal } from './components/SyncDataModal';
import { ConfigurationsModal } from './components/ConfigurationsModal';
import { SyncOverlay, SyncStep } from './components/SyncOverlay';
import { useMobileBackStack, WindowId } from './hooks/useMobileBackStack';
import { PwaUpdateToast } from './components/PwaUpdateToast';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';

function deduplicateItems<T extends { id: string }>(items: T[]): T[] {
  if (!Array.isArray(items)) return [];
  const map = new Map<string, T>();
  for (const item of items) {
    if (item && item.id) {
      map.set(item.id, item);
    }
  }
  return Array.from(map.values());
}

export default function App() {
  // Authentication & RBAC State (with Downstream IMO & NIS Scope Simulation)
  const [authenticatedUser, setAuthenticatedUser] = useState<AuthUser | null>(() => getSavedAuthSession());
  const [simulatedRole, setSimulatedRole] = useState<UserRole | null>(null);
  const [simulatedImo, setSimulatedImo] = useState<string | null>(null);
  const [simulatedNis, setSimulatedNis] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const activeRole: UserRole = simulatedRole || authenticatedUser?.role || 'Viewer';
  const activeImo: string = simulatedImo || authenticatedUser?.imoOffice || 'All IMOs';
  const activeNis: string = simulatedNis || authenticatedUser?.nisBinding || 'All NIS';
  const isSimulating = Boolean(simulatedRole || (simulatedImo && simulatedImo !== authenticatedUser?.imoOffice) || (simulatedNis && simulatedNis !== authenticatedUser?.nisBinding));

  // Global Light / Dark Theme State (persisted in localStorage & synchronized across Login and App)
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      return (localStorage.getItem('nia_login_theme') as 'dark' | 'light') || 
             (localStorage.getItem('nia_app_theme') as 'dark' | 'light') || 
             'dark';
    } catch (_) {
      return 'dark';
    }
  });

  const toggleTheme = useCallback((newTheme: 'dark' | 'light') => {
    setTheme(newTheme);
    try {
      localStorage.setItem('nia_login_theme', newTheme);
      localStorage.setItem('nia_app_theme', newTheme);
    } catch (_) {}
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.remove('dark');
      root.classList.add('light');
      document.body.classList.remove('bg-slate-950', 'bg-slate-900', 'text-slate-100');
      document.body.classList.add('bg-slate-100', 'text-slate-900');
    } else {
      root.classList.remove('light');
      root.classList.add('dark');
      document.body.classList.remove('bg-slate-100', 'text-slate-900');
      document.body.classList.add('bg-slate-950', 'text-slate-100');
    }
  }, [theme]);

  // Sync users with backend on initial load to ensure live credentials
  useEffect(() => {
    fetchRemoteAuthUsers().then(users => {
      const current = getSavedAuthSession();
      if (current) {
        const live = users.find(u => u.id === current.id || u.username.toLowerCase() === current.username.toLowerCase());
        if (live) {
          setAuthenticatedUser(live);
          saveAuthSession(live);
        }
      }
    });
  }, []);

  const [isDevPanelOpen, setIsDevPanelOpen] = useState(false);

  // App State (Instantly seeded from local storage on frame 0)
  const [layers, setLayersState] = useState<GISLayer[]>(() => {
    try {
      const cached = getCachedLayers();
      if (Array.isArray(cached) && cached.length > 0) {
        return cached.filter(l => !isMockLayer(l) && (l as any).geometryType !== 'Polygon' && (l as any).category !== 'Parcels');
      }
    } catch (_) {}
    return [];
  });
  const [fieldReports, setFieldReportsState] = useState<FieldReport[]>(() => {
    try {
      const cached = getOfflineReports();
      if (Array.isArray(cached) && cached.length > 0) {
        return cached.filter(r => !r.id?.startsWith('mock-') && r.id !== 'report-1' && !(r as any).isMock);
      }
    } catch (_) {}
    return [];
  });

  const setLayers = useCallback((action: React.SetStateAction<GISLayer[]>) => {
    setLayersState(prev => {
      const next = typeof action === 'function' ? action(prev) : action;
      return deduplicateItems(next);
    });
  }, []);

  const setFieldReports = useCallback((action: React.SetStateAction<FieldReport[]>) => {
    setFieldReportsState(prev => {
      const next = typeof action === 'function' ? action(prev) : action;
      return deduplicateItems(next);
    });
  }, []);

  const [basemap, setBasemap] = useState<BasemapType>('satellite');
  const [isOffline, setIsOffline] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Sync progress steps for the overlay
  const INITIAL_SYNC_STEPS: SyncStep[] = [
    { id: 'upload',  label: 'Uploading Offline Reports',      status: 'pending' },
    { id: 'reports', label: 'Fetching Latest Field Reports',  status: 'pending' },
    { id: 'weeks',   label: 'Refreshing Cloud Week Index',    status: 'pending' },
    { id: 'layers',  label: 'Syncing GIS Layers from Drive',  status: 'pending' },
  ];
  const [syncSteps, setSyncSteps] = useState<SyncStep[]>(INITIAL_SYNC_STEPS);
  const [syncStatusMessage, setSyncStatusMessage] = useState('');

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchTargetCoords, setSearchTargetCoords] = useState<[number, number] | undefined>(undefined);

  // Selection
  const [selectedFeatureProps, setSelectedFeatureProps] = useState<any>(null);
  const [selectedFeatureType, setSelectedFeatureType] = useState<string>('');
  const [selectedReport, setSelectedReport] = useState<FieldReport | undefined>(undefined);
  const [selectedCoords, setSelectedCoords] = useState<[number, number] | undefined>(undefined);

  // Modals & Panels
  const [isLayerPanelOpen, setIsLayerPanelOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<FieldReport | null>(null);
  // Map Picker State
  const [isMapPickerActive, setIsMapPickerActive] = useState(false);
  const [mapPickerMode, setMapPickerMode] = useState<'single' | 'double'>('single');
  const [mapPickerReportType, setMapPickerReportType] = useState<'maintenance' | 'operational'>('maintenance');

  // Prefill params for report modal
  const [reportPrefill, setReportPrefill] = useState<{
    lat?: number;
    lng?: number;
    lat2?: number;
    lng2?: number;
    canalSegment?: string;
    parcelId?: string;
    reportType?: 'maintenance' | 'operational';
  }>({});
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [summaryModalInitialTab, setSummaryModalInitialTab] = useState<'ledger' | 'form691' | 'photos'>('ledger');
  const [availableCloudWeeks, setAvailableCloudWeeks] = useState<AvailableCloudWeek[]>([]);
  const [isDownloadingWeek, setIsDownloadingWeek] = useState<string | null>(null);
  const [previewingPdfReport, setPreviewingPdfReport] = useState<FieldReport | null>(null);
  const [isPdfPreviewOpen, setIsPdfPreviewOpen] = useState(false);

  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isConfigurationsModalOpen, setIsConfigurationsModalOpen] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isSyncDataModalOpen, setIsSyncDataModalOpen] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isAccessRequestsModalOpen, setIsAccessRequestsModalOpen] = useState(false);
  const [isRoleMatrixModalOpen, setIsRoleMatrixModalOpen] = useState(false);
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);

  const loadAccessRequests = useCallback(async () => {
    try {
      const data = await fetchAccessRequestsApi();
      setAccessRequests(data);
    } catch (e) {
      console.warn('Could not load access requests:', e);
    }
  }, []);

  useEffect(() => {
    loadAccessRequests();
    const interval = setInterval(loadAccessRequests, 30000);
    return () => clearInterval(interval);
  }, [loadAccessRequests]);

  const pendingAccessRequestsCount = useMemo(() => {
    if (!authenticatedUser || !canUserManageRequests(authenticatedUser)) return 0;
    if (authenticatedUser.role === 'Developer' || authenticatedUser.role === 'RO Admin') {
      return accessRequests.filter(r => r.status === 'pending').length;
    }
    // IMO Admin: only pending requests within their designated IMO office
    const adminOffice = (authenticatedUser.imoOffice || '').toLowerCase();
    return accessRequests.filter(r => {
      const reqOffice = (r.requestedOffice || '').toLowerCase();
      return r.status === 'pending' && (reqOffice.includes(adminOffice) || adminOffice.includes(reqOffice));
    }).length;
  }, [accessRequests, authenticatedUser]);

  // Option 3: Android Native Double-Back-to-Exit Toast State
  const [showExitToast, setShowExitToast] = useState(false);
  const lastBackPressTimeRef = useRef<number>(0);
  const exitToastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Helper to ensure mutually exclusive window activations
  const closeAllModals = useCallback(() => {
    setIsReportModalOpen(false);
    setIsSummaryModalOpen(false);
    setIsLayerPanelOpen(false);
    setIsFilterModalOpen(false);
    setIsSyncDataModalOpen(false);
    setIsUploadOpen(false);
    setIsConfigurationsModalOpen(false);
    setIsDevPanelOpen(false);
    setIsHelpOpen(false);
    setIsSearchModalOpen(false);
    setIsPdfPreviewOpen(false);
    setIsAccessRequestsModalOpen(false);
    setIsRoleMatrixModalOpen(false);
    setPreviewingPdfReport(null);
    setSelectedFeatureProps(null);
    setSelectedReport(undefined);
    setIsMenuOpen(false);
  }, []);

  const handleOpenPdfPreview = useCallback((report: FieldReport) => {
    closeAllModals();
    setPreviewingPdfReport(report);
    setIsPdfPreviewOpen(true);
  }, [closeAllModals]);

  // Handle closing windows in LIFO order
  const handleCloseWindow = useCallback((windowId: WindowId) => {
    switch (windowId) {
      case 'location_picker':
        setIsMapPickerActive(false);
        setIsReportModalOpen(true);
        break;
      case 'pdf_preview':
        setIsPdfPreviewOpen(false);
        setPreviewingPdfReport(null);
        break;
      case 'field_report':
        setIsReportModalOpen(false);
        setIsMapPickerActive(false);
        setEditingReport(null);
        break;
      case 'reports_summary':
        setIsSummaryModalOpen(false);
        break;
      case 'layer_panel':
        setIsLayerPanelOpen(false);
        break;
      case 'location_filter':
        setIsFilterModalOpen(false);
        break;
      case 'sync_modal':
        setIsSyncDataModalOpen(false);
        break;
      case 'upload_modal':
        setIsUploadOpen(false);
        break;
      case 'attribute_inspector':
        setSelectedFeatureProps(null);
        setSelectedReport(undefined);
        setSelectedCoords(undefined);
        break;
      case 'dev_panel':
        setIsDevPanelOpen(false);
        break;
      case 'help_modal':
        setIsHelpOpen(false);
        break;
    }
  }, []);

  // Option 3: Base Map Back Press Handler (Double-Back-to-Exit)
  const handleExitAppRequested = useCallback(() => {
    const now = Date.now();
    const timeDiff = now - lastBackPressTimeRef.current;

    if (timeDiff < 2000) {
      // 2nd Back press within 2 seconds -> Exit application
      if (exitToastTimeoutRef.current) clearTimeout(exitToastTimeoutRef.current);
      setShowExitToast(false);
      if (Capacitor.isNativePlatform()) {
        CapApp.exitApp();
      } else {
        window.history.back();
      }
    } else {
      // 1st Back press -> Show Android Toast and start 2-second window
      lastBackPressTimeRef.current = now;
      setShowExitToast(true);

      // Re-arm history trap so the 2nd press can be evaluated
      try {
        window.history.pushState({ app: 'nia_gis_trap', depth: 1 }, '');
      } catch (_) {}

      if (exitToastTimeoutRef.current) clearTimeout(exitToastTimeoutRef.current);
      exitToastTimeoutRef.current = setTimeout(() => {
        setShowExitToast(false);
        lastBackPressTimeRef.current = 0; // Reset after 2s
      }, 2000);
    }
  }, []);

  const { pushWindow, removeWindow } = useMobileBackStack({
    onCloseWindow: handleCloseWindow,
    onExitAppRequested: handleExitAppRequested
  });

  // Configure Android Native Status Bar & Hardware Back Button Lifecycle
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    // Apply dark navy background with light icons/text to match application palette
    try {
      StatusBar.setStyle({ style: Style.Dark });
      StatusBar.setBackgroundColor({ color: '#0f172a' });
    } catch (e) {
      console.warn('Native StatusBar configuration error:', e);
    }

    // Android Hardware Back Button Listener via Capacitor App Plugin
    const backListenerPromise = CapApp.addListener('backButton', () => {
      // If any modal, drawer, picker, or inspector is active, close the topmost window via browser history stack
      if (
        isReportModalOpen ||
        isMapPickerActive ||
        isLayerPanelOpen ||
        isSummaryModalOpen ||
        isFilterModalOpen ||
        isSyncDataModalOpen ||
        isUploadOpen ||
        isPdfPreviewOpen ||
        isConfigurationsModalOpen ||
        isSearchModalOpen ||
        isDevPanelOpen ||
        isHelpOpen ||
        isMenuOpen ||
        selectedFeatureProps ||
        selectedReport
      ) {
        window.history.back();
      } else {
        // Base Map: Double-back-to-exit
        handleExitAppRequested();
      }
    });

    return () => {
      backListenerPromise.then(l => l.remove()).catch(() => {});
    };
  }, [
    isReportModalOpen,
    isMapPickerActive,
    isLayerPanelOpen,
    isSummaryModalOpen,
    isFilterModalOpen,
    isSyncDataModalOpen,
    isUploadOpen,
    isPdfPreviewOpen,
    isConfigurationsModalOpen,
    isSearchModalOpen,
    isDevPanelOpen,
    isHelpOpen,
    isMenuOpen,
    selectedFeatureProps,
    selectedReport,
    handleExitAppRequested
  ]);

  // Synchronize active windows with the Mobile LIFO Back Stack
  useEffect(() => {
    if (isMapPickerActive) {
      pushWindow('field_report');
      pushWindow('location_picker');
    } else {
      removeWindow('location_picker');
    }
  }, [isMapPickerActive, pushWindow, removeWindow]);

  useEffect(() => {
    if (isReportModalOpen && !isMapPickerActive) {
      pushWindow('field_report');
    } else if (!isReportModalOpen && !isMapPickerActive) {
      removeWindow('field_report');
    }
  }, [isReportModalOpen, isMapPickerActive, pushWindow, removeWindow]);

  useEffect(() => {
    if (isLayerPanelOpen) pushWindow('layer_panel');
    else removeWindow('layer_panel');
  }, [isLayerPanelOpen, pushWindow, removeWindow]);

  useEffect(() => {
    if (isFilterModalOpen) pushWindow('location_filter');
    else removeWindow('location_filter');
  }, [isFilterModalOpen, pushWindow, removeWindow]);

  useEffect(() => {
    if (isSummaryModalOpen) pushWindow('reports_summary');
    else removeWindow('reports_summary');
  }, [isSummaryModalOpen, pushWindow, removeWindow]);

  useEffect(() => {
    if (isSyncDataModalOpen) pushWindow('sync_modal');
    else removeWindow('sync_modal');
  }, [isSyncDataModalOpen, pushWindow, removeWindow]);

  useEffect(() => {
    if (isUploadOpen) pushWindow('upload_modal');
    else removeWindow('upload_modal');
  }, [isUploadOpen, pushWindow, removeWindow]);

  useEffect(() => {
    if (isPdfPreviewOpen) pushWindow('pdf_preview');
    else removeWindow('pdf_preview');
  }, [isPdfPreviewOpen, pushWindow, removeWindow]);

  useEffect(() => {
    if (selectedFeatureProps || selectedReport) pushWindow('attribute_inspector');
    else removeWindow('attribute_inspector');
  }, [selectedFeatureProps, selectedReport, pushWindow, removeWindow]);

  useEffect(() => {
    if (isDevPanelOpen) pushWindow('dev_panel');
    else removeWindow('dev_panel');
  }, [isDevPanelOpen, pushWindow, removeWindow]);

  useEffect(() => {
    if (isHelpOpen) pushWindow('help_modal');
    else removeWindow('help_modal');
  }, [isHelpOpen, pushWindow, removeWindow]);

  // Location Filter State
  const [locationFilter, setLocationFilter] = useState<LocationFilter>({
    imo: 'All IMOs',
    nis: 'All NIS',
    province: 'All Provinces',
    activityCategory: 'All Activities'
  });

  // Strict IMO Scoping Resolution
  const isImoScoped = useMemo(() => {
    if (isImoScopedRole(activeRole)) return true;
    if (authenticatedUser?.imoOffice && authenticatedUser.imoOffice !== 'All IMOs' && authenticatedUser.imoOffice !== 'Regional Office IV-B' && !simulatedRole) {
      return true;
    }
    return false;
  }, [activeRole, authenticatedUser, simulatedRole]);

  const userAssignedImo = useMemo(() => {
    if (simulatedImo) return simulatedImo;
    if (authenticatedUser?.imoOffice && authenticatedUser.imoOffice !== 'All IMOs' && authenticatedUser.imoOffice !== 'Regional Office IV-B') {
      return authenticatedUser.imoOffice;
    }
    return 'All IMOs';
  }, [simulatedImo, authenticatedUser]);

  const effectiveImo = useMemo(() => {
    if (isImoScoped && userAssignedImo !== 'All IMOs') {
      return userAssignedImo;
    }
    return locationFilter.imo !== 'All IMOs' ? locationFilter.imo : (activeImo !== 'All IMOs' ? activeImo : 'All IMOs');
  }, [isImoScoped, userAssignedImo, locationFilter.imo, activeImo]);

  // Keep locationFilter synchronized to user's assigned IMO when scoped
  useEffect(() => {
    if (isImoScoped && userAssignedImo !== 'All IMOs') {
      if (locationFilter.imo !== userAssignedImo) {
        setLocationFilter(prev => ({
          ...prev,
          imo: userAssignedImo
        }));
      }
    }
  }, [isImoScoped, userAssignedImo, locationFilter.imo]);

  // Google Drive Submission / Saved Toast Notification State
  const [driveToast, setDriveToast] = useState<{
    id: string;
    type: 'submitting' | 'success' | 'warning' | 'error';
    title: string;
    message: string;
    reportTitle?: string;
  } | null>(null);

  const isFilterActive = useMemo(() => {
    return Boolean(
      (locationFilter.imo && locationFilter.imo !== 'All IMOs') ||
      (locationFilter.nis && locationFilter.nis !== 'All NIS') ||
      (locationFilter.province && locationFilter.province !== 'All Provinces') ||
      (locationFilter.activityCategory && locationFilter.activityCategory !== 'All Activities')
    );
  }, [locationFilter]);

  const [isSyncingDrive, setIsSyncingDrive] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number } | null>(null);

  // Auto Sync GIS Layers from Google Drive IMO Folders with RBAC (Cache-First Zero-Byte Fast Fetching)
  const syncIMOFolderLayers = useCallback(async (role: UserRole, targetImo?: string) => {
    if (!authenticatedUser) return;
    setIsSyncingDrive(true);
    setSyncProgress(null);
    try {
      const imoToFetch = (isImoScoped && userAssignedImo !== 'All IMOs')
        ? userAssignedImo
        : (targetImo || effectiveImo);
      const res = await fetch(`/api/drive/imo-layers?role=${encodeURIComponent(role)}&imo=${encodeURIComponent(imoToFetch)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.layers && Array.isArray(data.layers)) {
          const driveLayers: GISLayer[] = data.layers;
          setSyncProgress({ current: 0, total: driveLayers.length });

          // Filter out parcel files before downloading/parsing to maximize speed and memory savings
          const nonParcelDriveLayers = driveLayers.filter(dl => {
            const nameLower = (dl.name || '').toLowerCase();
            return !nameLower.includes('parcel') && !nameLower.includes('land_parcel') && !nameLower.includes('lot');
          });

          // 1. Check existing IndexedDB cached layers first
          const rawCached = await getCachedLayersDB();
          const cachedMap = new Map<string, GISLayer>();
          if (rawCached && Array.isArray(rawCached)) {
            rawCached.forEach(l => {
              if (l.driveFileId) cachedMap.set(l.driveFileId, l);
              if (l.id) cachedMap.set(l.id, l);
            });
          }

          const getShortImoName = (imoName?: string): string => {
            if (!imoName) return '';
            const lower = imoName.toLowerCase();
            if (lower.includes('momaro') || lower.includes('oriental') || lower.includes('marinduque') || lower.includes('romblon')) {
              return 'MOMARO IMO';
            }
            if (lower.includes('occidental') || lower.includes('omimo')) {
              return 'OMIMO';
            }
            if (lower.includes('palawan') || lower.includes('pimo') || lower.includes('palimo')) {
              return 'PALIMO';
            }
            return imoName;
          };

          const resolveLayerDetails = (dlItem: GISLayer) => {
            const classification = classifyVectorItem(
              dlItem.name || dlItem.fileName || (dlItem as any).fileName,
              dlItem.category,
              dlItem.subCategory,
              dlItem.data?.features?.[0]?.properties,
              dlItem.geometryType
            );

            const subCat = classification.hierarchyType;
            const parentCat: 'Structures' | 'Canals' = classification.isStructure ? 'Structures' : 'Canals';
            const fixedColor = classification.color;

            const shortImo = getShortImoName(dlItem.imoOffice);
            const resolvedName = shortImo ? `${shortImo} - ${subCat}` : `${subCat}`;
            return { subCat, parentCat, fixedColor, resolvedName };
          };

          let completedCount = 0;
          let downloadedCount = 0;

          await Promise.all(
            nonParcelDriveLayers.map(async (dl) => {
              const details = resolveLayerDetails(dl);

              // Fast Path: Check if layer is already parsed and stored in IndexedDB with identical driveModifiedTime
              const cached = (dl.driveFileId ? cachedMap.get(dl.driveFileId) : null) || cachedMap.get(dl.id);
              const isMatch = Boolean(
                cached &&
                cached.data &&
                Array.isArray(cached.data.features) &&
                cached.data.features.length > 0 &&
                (dl.driveModifiedTime && cached.driveModifiedTime ? cached.driveModifiedTime === dl.driveModifiedTime : true)
              );

              if (isMatch && cached) {
                // INSTANT 0ms ZERO-BYTE CACHE HIT: Reuse already parsed GeoJSON
                dl.data = cached.data;
                dl.featureCount = cached.featureCount || cached.data.features.length;
                dl.geometryType = cached.geometryType;
                dl.category = details.parentCat;
                dl.subCategory = details.subCat;
                dl.name = details.resolvedName;
                dl.visible = cached.visible !== undefined ? cached.visible : dl.visible;
                dl.opacity = cached.opacity !== undefined ? cached.opacity : dl.opacity;
                dl.color = details.fixedColor;
                dl.driveModifiedTime = cached.driveModifiedTime || dl.driveModifiedTime;
              } else if (dl.driveFileId && (!dl.data || !dl.data.features || dl.data.features.length === 0)) {
                // Cache Miss or Newer Version: Download & Parse
                downloadedCount++;
                try {
                  const fileRes = await fetch(`/api/drive/file/${dl.driveFileId}`);
                  if (fileRes.ok) {
                    const arrayBuffer = await fileRes.arrayBuffer();
                    const fileObj = new File([arrayBuffer], (dl as any).fileName || dl.name || `${dl.id}.geojson`);
                    const parsed = await parseGISFile(fileObj);

                    // Skip polygons completely
                    if (parsed.geometryType === 'Polygon') {
                      return;
                    }

                    dl.data = parsed.geoJsonData;
                    dl.featureCount = parsed.featureCount;
                    dl.geometryType = parsed.geometryType as any;

                    const updatedDetails = resolveLayerDetails(dl);
                    dl.category = updatedDetails.parentCat;
                    dl.subCategory = updatedDetails.subCat;
                    dl.name = updatedDetails.resolvedName;
                    dl.color = updatedDetails.fixedColor;
                  }
                } catch (pErr) {
                  console.warn(`Failed to parse Drive file content for ${dl.name}:`, pErr);
                }
              }
              completedCount++;
              setSyncProgress({ current: completedCount, total: nonParcelDriveLayers.length });
            })
          );

          if (downloadedCount > 0) {
            console.log(`📥 Downloaded & parsed ${downloadedCount} updated GIS layer(s) from Drive.`);
          } else {
            console.log(`⚡ Instant Layer Sync: All ${nonParcelDriveLayers.length} GIS layers verified fresh from IndexedDB.`);
          }

          setLayers(prev => {
            const validLayers = nonParcelDriveLayers.filter(
              l => l.data && Array.isArray(l.data.features) && l.data.features.length > 0 && l.geometryType !== ('Polygon' as any)
            );
            if (validLayers.length === 0) {
              return prev.filter(l => l.geometryType !== ('Polygon' as any) && (l as any).category !== 'Parcels');
            }

            const cleanPrev = prev.filter(l => l.geometryType !== ('Polygon' as any) && (l as any).category !== 'Parcels');
            const existingMap = new Map(cleanPrev.map(l => [l.id, l]));
            for (const dl of validLayers) {
              existingMap.set(dl.id, dl);
            }
            let merged: GISLayer[] = Array.from(existingMap.values()) as GISLayer[];
            if (isImoScoped && imoToFetch !== 'All IMOs') {
              merged = merged.filter(l => !l.imoOffice || matchesImoOffice(l.imoOffice, imoToFetch));
            }
            saveCachedLayersDB(merged).catch(() => {});
            return merged;
          });
        }
      }
    } catch (err) {
      console.warn('Failed to sync IMO Drive layers:', err);
    } finally {
      setIsSyncingDrive(false);
      setSyncProgress(null);
    }
  }, [authenticatedUser, setLayers, isImoScoped, userAssignedImo, effectiveImo]);


  // 1. Scoped Instant Hydration & Micro-Manifest Caching (Runs strictly after user is authenticated)
  useEffect(() => {
    if (!authenticatedUser) return;
    let isCancelled = false;

    async function loadData() {
      const targetImo = effectiveImo;

      // STEP 1: INSTANT LOCAL HYDRATION (0ms - 15ms)
      // Read local IndexedDB layers and reports immediately so map and UI render with zero blocking!
      let localLayers: GISLayer[] | null = null;
      let localReports: FieldReport[] | null = null;

      try {
        const rawCachedLayers = await getCachedLayersDB();
        if (rawCachedLayers && rawCachedLayers.length > 0) {
          localLayers = rawCachedLayers.filter(l => {
            if (isMockLayer(l) || l.geometryType === ('Polygon' as any) || (l as any).category === 'Parcels') return false;
            if (isImoScoped && targetImo !== 'All IMOs') {
              return !l.imoOffice || matchesImoOffice(l.imoOffice, targetImo);
            }
            return true;
          });
          if (localLayers.length > 0 && !isCancelled) {
            setLayers(localLayers);
          }
        }
      } catch (e) {
        console.warn('Initial layers hydration notice:', e);
      }

      try {
        const rawCachedReports = await getCachedReportsDB();
        const initialReports = (rawCachedReports && rawCachedReports.length > 0) ? rawCachedReports : getOfflineReports();
        if (initialReports && initialReports.length > 0) {
          let cleanReports = initialReports.filter(r => !r.id?.startsWith('mock-') && r.id !== 'report-1' && !(r as any).isMock);
          if (isImoScoped && targetImo !== 'All IMOs') {
            cleanReports = cleanReports.filter(r => !r.imoOffice || matchesImoOffice(r.imoOffice, targetImo));
          }
          localReports = cleanReports;
          if (!isCancelled) {
            setFieldReports(cleanReports);
          }
        }
      } catch (e) {
        console.warn('Initial reports hydration notice:', e);
      }

      if (isOfflineRef.current) return;

      // STEP 2: MICRO-MANIFEST INTEGRITY CHECK (Parallel, ~1.5 KB payload)
      try {
        const cachedMeta = await getManifestMetadataDB('master_manifest');
        const [layerManifestRes, reportManifestRes, availableWeeksRes] = await Promise.allSettled([
          fetch(`/api/layers/manifest?imo=${encodeURIComponent(targetImo)}`),
          fetch(`/api/reports/manifest?role=${encodeURIComponent(activeRole)}&imo=${encodeURIComponent(targetImo)}`),
          fetch(`/api/reports/available-weeks?role=${encodeURIComponent(activeRole)}&imo=${encodeURIComponent(targetImo)}`)
        ]);

        if (availableWeeksRes.status === 'fulfilled' && availableWeeksRes.value.ok) {
          const wData = await availableWeeksRes.value.json();
          if (Array.isArray(wData.weeks) && !isCancelled) {
            setAvailableCloudWeeks(wData.weeks);
          }
        }

        const layerManifest = (layerManifestRes.status === 'fulfilled' && layerManifestRes.value.ok)
          ? await layerManifestRes.value.json()
          : null;
        const reportManifest = (reportManifestRes.status === 'fulfilled' && reportManifestRes.value.ok)
          ? await reportManifestRes.value.json()
          : null;

        // Check if GIS layers require download
        const layersNeedSync = !localLayers || localLayers.length === 0 || !cachedMeta?.layerChecksum || cachedMeta.layerChecksum !== layerManifest?.checksum;
        if (layersNeedSync) {
          try {
            const res = await fetch(`/api/layers?role=${encodeURIComponent(activeRole)}&imo=${encodeURIComponent(targetImo)}`);
            if (res.ok) {
              const data = await res.json();
              if (Array.isArray(data.layers) && data.layers.length > 0 && !isCancelled) {
                const clean = data.layers.filter((l: any) => !isMockLayer(l) && l.geometryType !== 'Polygon' && l.category !== 'Parcels');
                setLayers(clean);
                await saveCachedLayersDB(clean);
              }
            }
          } catch (lErr) {
            console.warn('Background layers fetch notice:', lErr);
          }
        }

        // Check if Field Reports require download
        const isHighTierRole = ['Developer', 'RO Admin', 'RO Evaluator', 'RO Reviewer', 'RO Preparer', 'IMO Admin', 'IMO Head', 'IMO Evaluator'].includes(activeRole);
        const syncTimeScope = isHighTierRole ? 'all' : 'current_and_prev_week';

        const reportsNeedSync = !localReports || localReports.length === 0 || !cachedMeta?.reportChecksum || cachedMeta.reportChecksum !== reportManifest?.checksum;
        if (reportsNeedSync) {
          try {
            const res = await fetch(`/api/reports?role=${encodeURIComponent(activeRole)}&imo=${encodeURIComponent(targetImo)}&timeScope=${syncTimeScope}`);
            if (res.ok) {
              const data = await res.json();
              if (Array.isArray(data.reports) && !isCancelled) {
                setFieldReports(prev => {
                  let combined = deduplicateItems([...data.reports, ...prev]);
                  if (isImoScoped && targetImo !== 'All IMOs') {
                    combined = combined.filter(r => !r.imoOffice || matchesImoOffice(r.imoOffice, targetImo));
                  }
                  saveOfflineReports(combined);
                  saveCachedReportsDB(combined);
                  return combined;
                });
              }
            }
          } catch (rErr) {
            console.warn('Background reports fetch notice:', rErr);
          }
        }

        // Save updated manifest checksums in IndexedDB
        if (layerManifest && reportManifest) {
          await saveManifestMetadataDB('master_manifest', {
            layerChecksum: layerManifest.checksum,
            reportChecksum: reportManifest.checksum,
            lastSync: new Date().toISOString()
          });
        }
      } catch (err) {
        console.warn('Background manifest validation notice:', err);
      }
    }

    loadData();

    return () => {
      isCancelled = true;
    };
  }, [authenticatedUser?.id, activeRole, effectiveImo, isImoScoped, setFieldReports, setLayers]);

  // Fetch available report weeks for the user's IMO & role scope
  const fetchAvailableCloudWeeks = useCallback(async (role: UserRole, targetImo?: string) => {
    try {
      const imoToFetch = targetImo || effectiveImo;
      const res = await fetch(`/api/reports/available-weeks?role=${encodeURIComponent(role)}&imo=${encodeURIComponent(imoToFetch)}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.weeks)) {
          setAvailableCloudWeeks(data.weeks);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch available cloud weeks:', err);
    }
  }, [effectiveImo]);

  // Download a specific weekly batch into local cache
  const handleDownloadWeek = useCallback(async (weekKey: string) => {
    if (isOffline) return;
    try {
      setIsDownloadingWeek(weekKey);
      const res = await fetch(`/api/reports?role=${encodeURIComponent(activeRole)}&imo=${encodeURIComponent(effectiveImo)}&weekKey=${encodeURIComponent(weekKey)}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.reports)) {
          setFieldReports(prev => {
            let combined = deduplicateItems([...prev, ...data.reports]);
            if (isImoScoped && effectiveImo !== 'All IMOs') {
              combined = combined.filter(r => !r.imoOffice || matchesImoOffice(r.imoOffice, effectiveImo));
            }
            saveOfflineReports(combined);
            return combined;
          });
          markWeekDownloaded(weekKey);
        }
      }
      await fetchAvailableCloudWeeks(activeRole, effectiveImo);
    } catch (err) {
      console.error('Failed to download weekly batch:', err);
    } finally {
      setIsDownloadingWeek(null);
    }
  }, [activeRole, isOffline, effectiveImo, isImoScoped, fetchAvailableCloudWeeks, setFieldReports]);

  // Download all available historical weeks into local cache
  const handleDownloadAllWeeks = useCallback(async () => {
    if (isOffline) return;
    try {
      setIsDownloadingWeek('all');
      const res = await fetch(`/api/reports?role=${encodeURIComponent(activeRole)}&imo=${encodeURIComponent(effectiveImo)}&timeScope=all`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.reports)) {
          setFieldReports(prev => {
            let combined = deduplicateItems([...prev, ...data.reports]);
            if (isImoScoped && effectiveImo !== 'All IMOs') {
              combined = combined.filter(r => !r.imoOffice || matchesImoOffice(r.imoOffice, effectiveImo));
            }
            saveOfflineReports(combined);
            return combined;
          });
          if (availableCloudWeeks.length > 0) {
            markWeeksDownloaded(availableCloudWeeks.map(w => w.key));
          }
        }
      }
      await fetchAvailableCloudWeeks(activeRole, effectiveImo);
    } catch (err) {
      console.error('Failed to download all weekly batches:', err);
    } finally {
      setIsDownloadingWeek(null);
    }
  }, [activeRole, availableCloudWeeks, isOffline, effectiveImo, isImoScoped, fetchAvailableCloudWeeks, setFieldReports]);

  // Ensure Maintenance Activity Category Vector Layers & Operational Status Reports layer categories exist in GIS Layers state
  useEffect(() => {
    const maintReports = fieldReports.filter(r => (r.categoryMode === 'maintenance' || r.reportType === 'maintenance'));
    const operReports = fieldReports.filter(r => (r.categoryMode === 'operational' || r.reportType === 'operational'));

    setLayers(prevLayers => {
      // 1. Remove legacy weekly layers and enforce Blue color hierarchy for Canals & Structures
      const cleanedPrev = prevLayers
        .filter(l => !l.id.startsWith('layer-maintenance-week-'))
        .map(l => {
          if (l.category === 'Canals' || l.category === 'Structures' || l.geometryType === 'LineString' || l.geometryType === 'Point' || (!l.id.startsWith('layer-activity-') && !l.id.startsWith('layer-operational-') && !l.id.startsWith('layer-field-reports'))) {
            return sanitizeLayerToBlueHierarchy(l);
          }
          return l;
        });

      const existingLayerMap = new Map<string, GISLayer>(cleanedPrev.map(l => [l.id, l]));

      // 2. Generate / update distinct layers for each Maintenance Activity Category
      const maintenanceLayers: GISLayer[] = [];
      Object.entries(MAINTENANCE_ACTIVITY_CONFIG).forEach(([actName, cfg]) => {
        const matchingReports = maintReports.filter(r => {
          const rAct = r.maintenanceActivity || r.title || '';
          return rAct === actName || rAct.toLowerCase() === actName.toLowerCase();
        });
        const existing = existingLayerMap.get(cfg.id);

        maintenanceLayers.push({
          id: cfg.id,
          name: cfg.label,
          category: 'Maintenance',
          subCategory: 'Maintenance Reports',
          visible: existing ? existing.visible : true,
          color: existing?.color || cfg.color,
          opacity: existing?.opacity ?? 0.9,
          data: null,
          featureCount: matchingReports.length,
          geometryType: 'Mixed',
          uploadedAt: existing?.uploadedAt || new Date().toISOString(),
          isDefault: true
        });
        existingLayerMap.set(cfg.id, maintenanceLayers[maintenanceLayers.length - 1]);
      });

      // 3. Generate / update distinct layers for each Operational Facility State
      const operationalLayers: GISLayer[] = [];
      Object.entries(OPERATIONAL_STATE_CONFIG).forEach(([stateName, cfg]) => {
        const matchingReports = operReports.filter(r => {
          const rState = r.operationalState || '';
          return rState === stateName || rState.toLowerCase() === stateName.toLowerCase();
        });
        const existing = existingLayerMap.get(cfg.id);

        operationalLayers.push({
          id: cfg.id,
          name: cfg.label,
          category: 'Operations',
          subCategory: 'Operational Status Reports',
          visible: existing ? existing.visible : true,
          color: existing?.color || cfg.color,
          opacity: existing?.opacity ?? 0.9,
          data: null,
          featureCount: matchingReports.length,
          geometryType: 'Mixed',
          uploadedAt: existing?.uploadedAt || new Date().toISOString(),
          isDefault: true
        });
        existingLayerMap.set(cfg.id, operationalLayers[operationalLayers.length - 1]);
      });

      // Retain all non-report GIS layers (Canals, Structures, uploaded Shapefiles/KMZ)
      const baseGisLayers = cleanedPrev.filter(
        l => !l.id.startsWith('layer-activity-') && !l.id.startsWith('layer-operational-') && l.id !== 'layer-reports-maintenance' && l.id !== 'layer-reports-operational'
      );

      return [...maintenanceLayers, ...operationalLayers, ...baseGisLayers];
    });
  }, [fieldReports, setLayers]);

  // Online / Offline Connectivity Listeners
  useEffect(() => {
    const handleOnline = async () => {
      setIsOffline(false);
      try {
        setIsSyncing(true);
        const result = await syncOfflineQueueToServer();
        if (result.syncedCount > 0) {
          const res = await fetch(`/api/reports?role=${encodeURIComponent(activeRole)}&imo=${encodeURIComponent(effectiveImo)}`);
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data.reports)) {
              setFieldReports(prev => {
                let combined = deduplicateItems([...prev, ...data.reports]);
                if (isImoScoped && effectiveImo !== 'All IMOs') {
                  combined = combined.filter(r => !r.imoOffice || matchesImoOffice(r.imoOffice, effectiveImo));
                }
                saveOfflineReports(combined);
                return combined;
              });
            }
          }
        }
      } catch (err) {
        console.error('Failed to sync offline reports', err);
      } finally {
        setIsSyncing(false);
      }
    };

    const handleOffline = () => {
      setIsOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [activeRole, effectiveImo, isImoScoped, setFieldReports]);

  // Relaxed 30-Minute Automatic Background Sync (Runs strictly when user is authenticated)
  useEffect(() => {
    let isCancelled = false;

    const performBackgroundSync = async () => {
      if (!authenticatedUser || isOffline) return;
      try {
        const targetImo = effectiveImo;

        // 1. Fetch latest field reports for 2-week operational window
        const res = await fetch(`/api/reports?role=${encodeURIComponent(activeRole)}&imo=${encodeURIComponent(targetImo)}&timeScope=current_and_prev_week`);
        if (res.ok && !isCancelled) {
          const data = await res.json();
          if (Array.isArray(data.reports)) {
            setFieldReports(prev => {
              let combined = deduplicateItems([...data.reports, ...prev]);
              if (isImoScoped && targetImo !== 'All IMOs') {
                combined = combined.filter(r => !r.imoOffice || matchesImoOffice(r.imoOffice, targetImo));
              }
              saveOfflineReports(combined);
              return combined;
            });
          }
        }

        // 2. Quiet background check for GIS layer updates (only every 30 minutes)
        if (!isCancelled) {
          syncIMOFolderLayers(activeRole, targetImo);
        }
      } catch (err) {
        // Ignore network glitches in quiet background poll
      }
    };

    // 30 Minutes Interval = 1,800,000 ms (Zero UI thrashing, zero lag)
    const intervalId = setInterval(performBackgroundSync, 30 * 60 * 1000);

    return () => {
      isCancelled = true;
      clearInterval(intervalId);
    };
  }, [authenticatedUser, activeRole, effectiveImo, isImoScoped, isOffline, setFieldReports, syncIMOFolderLayers]);

  // Stable Refs for Active Context to guarantee zero sync cancellation on re-renders
  const activeRoleRef = useRef(activeRole);
  activeRoleRef.current = activeRole;
  const imoFilterRef = useRef(locationFilter.imo);
  imoFilterRef.current = locationFilter.imo;
  const isOfflineRef = useRef(isOffline);
  isOfflineRef.current = isOffline;

  // Manual & Automated Full Sync (Scoped to authenticated user's assigned IMO & Role)
  const performFullSync = useCallback(async (customRole?: UserRole, customImo?: string, timeScope: 'current_and_prev_week' | 'all' = 'current_and_prev_week') => {
    if (isOfflineRef.current) return;

    const setStep = (id: string, status: SyncStep['status'], progress?: SyncStep['progress']) =>
      setSyncSteps(prev => prev.map(s => s.id === id ? { ...s, status, progress } : s));

    try {
      setIsSyncing(true);
      setSyncSteps(INITIAL_SYNC_STEPS);

      const curRole = customRole || activeRoleRef.current;
      const curImo = customImo || (isImoScoped && userAssignedImo !== 'All IMOs' ? userAssignedImo : (imoFilterRef.current && imoFilterRef.current !== 'All IMOs' ? imoFilterRef.current : (authenticatedUser?.imoOffice && authenticatedUser.imoOffice !== 'All IMOs' && authenticatedUser.imoOffice !== 'Regional Office IV-B' ? authenticatedUser.imoOffice : 'All IMOs')));

      // FAST 3-TRACK PARALLEL SYNC PIPELINE
      setSyncStatusMessage(`Synchronizing data in parallel for ${curImo}...`);

      // Track 1 — Flush offline outbox queue concurrently
      const track1 = (async () => {
        setStep('upload', 'active');
        try {
          const driveToken = getAccessToken();
          await syncOfflineQueueToServer(driveToken);
        } catch (e) {
          console.warn('Track 1 (Upload) notice:', e);
        } finally {
          setStep('upload', 'done');
        }
      })();

      // Track 2 — Fetch latest reports & refresh cloud weeks index in parallel
      const track2 = (async () => {
        setStep('reports', 'active');
        setStep('weeks', 'active');
        try {
          const driveToken = getAccessToken();
          const headers: Record<string, string> = {};
          if (driveToken) headers['x-google-drive-token'] = driveToken;

          const [driveSyncRes, repRes, weeksRes] = await Promise.allSettled([
            fetch(`/api/drive/sync-reports?imo=${encodeURIComponent(curImo)}`, { method: 'POST', headers }).catch(() => {}),
            fetch(`/api/reports?role=${encodeURIComponent(curRole)}&imo=${encodeURIComponent(curImo)}&timeScope=${timeScope}`, { headers }),
            fetchAvailableCloudWeeks(curRole, curImo)
          ]);

          if (repRes.status === 'fulfilled' && repRes.value && repRes.value.ok) {
            const data = await repRes.value.json();
            if (Array.isArray(data.reports)) {
              setFieldReports(prev => {
                let combined = deduplicateItems([...data.reports, ...prev]);
                if (isImoScoped && curImo !== 'All IMOs') {
                  combined = combined.filter(r => !r.imoOffice || matchesImoOffice(r.imoOffice, curImo));
                }
                saveOfflineReports(combined);
                return combined;
              });
            }
          }
        } catch (e) {
          console.warn('Track 2 (Reports & Weeks) error:', e);
        } finally {
          setStep('reports', 'done');
          setStep('weeks', 'done');
        }
      })();

      // Track 3 — Refresh GIS layers concurrently (with zero-byte IndexedDB cache verification)
      const track3 = (async () => {
        setStep('layers', 'active');
        try {
          await syncIMOFolderLayers(curRole, curImo);
        } catch (e) {
          console.warn('Track 3 (GIS Layers) error:', e);
        } finally {
          setStep('layers', 'done');
        }
      })();

      // Run all 3 tracks simultaneously
      await Promise.allSettled([track1, track2, track3]);

      setSyncStatusMessage('All data synced successfully.');
    } catch (err) {
      console.error('Sync failed:', err);
      setSyncStatusMessage('Sync encountered an error.');
    } finally {
      setTimeout(() => {
        setIsSyncing(false);
        setSyncSteps(INITIAL_SYNC_STEPS);
      }, 750);
    }
  }, [authenticatedUser, setFieldReports, fetchAvailableCloudWeeks, syncIMOFolderLayers, isImoScoped, userAssignedImo]);

  // Expose as handleSyncNow for manual navbar trigger
  const handleSyncNow = performFullSync;


  // Auth Handlers
  const handleLogin = (user: AuthUser) => {
    saveAuthSession(user);
    setAuthenticatedUser(user);
    setSimulatedRole(null);
    setSimulatedImo(null);
    setSimulatedNis(null);
    const userImo = (user.imoOffice && user.imoOffice !== 'All IMOs' && user.imoOffice !== 'Regional Office IV-B')
      ? user.imoOffice
      : 'All IMOs';
    if (userImo !== 'All IMOs') {
      setLocationFilter(prev => ({ ...prev, imo: userImo }));
    }
    // Immediate scoped synchronization specifically for this user's role & IMO
    performFullSync(user.role, userImo);
  };

  const handleLogout = () => {
    clearAuthSession();
    setAuthenticatedUser(null);
    setSimulatedRole(null);
    setSimulatedImo(null);
    setSimulatedNis(null);
    setFieldReports([]);
    setLayers(INITIAL_GIS_LAYERS);
    setLocationFilter({
      imo: 'All IMOs',
      nis: 'All NIS',
      province: 'All Provinces',
      activityCategory: 'All Activities'
    });
  };

  const handleRoleChange = (newRole: UserRole) => {
    setSimulatedRole(newRole);
  };

  const handleSimulateContext = useCallback((role: UserRole | null, imo: string | null, nis: string | null) => {
    setSimulatedRole(role);
    setSimulatedImo(imo);
    setSimulatedNis(nis);
  }, []);

  const handleRevertRole = useCallback(() => {
    setSimulatedRole(null);
    setSimulatedImo(null);
    setSimulatedNis(null);
  }, []);

  // Two-Tier Approval Pipeline Handler
  const handleApproveReport = async (reportId: string, action: 'pre_approve' | 'final_approve' | 'reject', reason?: string) => {
    try {
      const res = await fetch(`/api/reports/${reportId}/approval`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          authorizerName: authenticatedUser?.name || 'Authorized Officer',
          authorizerRole: activeRole,
          reason
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.report) {
          // Update report in local state
          setFieldReports(prev => prev.map(r => r.id === reportId ? data.report : r));
          if (selectedReport?.id === reportId) {
            setSelectedReport(data.report);
          }
        }
      }
    } catch (err) {
      console.warn('Failed to update report approval state:', err);
    }
  };

  // Layer Actions
  const handleToggleLayerVisibility = async (layerId: string) => {
    setLayers(prev => {
      const updated = prev.map(l => l.id === layerId ? { ...l, visible: !l.visible } : l);
      saveCachedLayersDB(updated);
      const target = updated.find(l => l.id === layerId);
      if (target) {
        fetch(`/api/layers/${layerId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ visible: target.visible })
        }).catch(e => console.warn('Could not update layer visibility on server', e));
      }
      return updated;
    });
  };

  const handleChangeLayerOpacity = async (layerId: string, opacity: number) => {
    setLayers(prev => {
      const updated = prev.map(l => l.id === layerId ? { ...l, opacity } : l);
      saveCachedLayersDB(updated);
      fetch(`/api/layers/${layerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opacity })
      }).catch(e => console.warn('Could not update layer opacity on server', e));
      return updated;
    });
  };

  const handleChangeLayerColor = async (layerId: string, color: string) => {
    setLayers(prev => {
      const updated = prev.map(l => l.id === layerId ? { ...l, color } : l);
      saveCachedLayersDB(updated);
      fetch(`/api/layers/${layerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ color })
      }).catch(e => console.warn('Could not update layer color on server', e));
      return updated;
    });
  };

  const handleDeleteLayer = async (layerId: string) => {
    setLayers(prev => {
      const updated = prev.filter(l => l.id !== layerId);
      saveCachedLayersDB(updated);
      return updated;
    });
    try {
      await fetch(`/api/layers/${layerId}`, { method: 'DELETE' });
    } catch (err) {
      console.warn('Failed to delete layer on server', err);
    }
  };

  const handleAddLayer = async (newLayer: GISLayer) => {
    setLayers(prev => {
      const updated = [newLayer, ...prev];
      saveCachedLayersDB(updated);
      return updated;
    });
    if (!isOffline) {
      try {
        await fetch('/api/layers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newLayer)
        });
      } catch (err) {
        console.warn('Failed to save layer to backend server', err);
      }
    }
  };

  // Field Report Actions
  const handleSubmitReport = async (newReport: FieldReport) => {
    // 1. Instantly update client reports state (handles both new submissions and edits)
    setFieldReports(prev => {
      const exists = prev.some(r => r.id === newReport.id);
      if (exists) {
        return prev.map(r => r.id === newReport.id ? newReport : r);
      }
      return deduplicateItems([newReport, ...prev]);
    });

    if (selectedReport && selectedReport.id === newReport.id) {
      setSelectedReport(newReport);
    }

    // 2. Reflect on spatial features
    if (newReport.canalSegment || newReport.locationName) {
      setLayers(prevLayers => {
        return prevLayers.map(layer => {
          if (!layer.data || !Array.isArray(layer.data.features)) return layer;
          let modified = false;
          const updatedFeatures = layer.data.features.map((feat: any) => {
            const p = feat.properties || {};
            const matchesSegment = newReport.canalSegment && (
              p.canal_name === newReport.canalSegment ||
              p.station_code === newReport.canalSegment ||
              p.name === newReport.canalSegment
            );
            const matchesLocation = newReport.locationName && (
              p.station_name === newReport.locationName ||
              p.name === newReport.locationName
            );
            
            if (matchesSegment || matchesLocation) {
              modified = true;
              return {
                ...feat,
                properties: {
                  ...p,
                  status: newReport.status,
                  last_maintenance: newReport.createdAt,
                  maintenance_activity: newReport.maintenanceActivity || newReport.title
                }
              };
            }
            return feat;
          });

          if (modified) {
            const updatedLayer = {
              ...layer,
              data: {
                ...layer.data,
                features: updatedFeatures
              }
            };
            if (!isOffline) {
              fetch('/api/layers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedLayer)
              }).catch(e => console.warn('Failed to sync updated layer feature status', e));
            }
            return updatedLayer;
          }
          return layer;
        });
      });
    }

    // 3. Save report locally in offline storage
    addOfflineReport(newReport);

    // Initial Submitting notification
    setDriveToast({
      id: `toast-${Date.now()}`,
      type: isOffline ? 'warning' : 'submitting',
      title: isOffline ? 'Saved Locally (Offline)' : 'Submitting Field Report...',
      message: isOffline 
        ? 'Report saved to local device memory. Will auto-sync when online.'
        : 'Saving field report, engineering parameters, and geotagged photos...',
      reportTitle: newReport.title
    });

    if (isOffline) {
      setTimeout(() => {
        setDriveToast(current => current?.type === 'warning' ? null : current);
      }, 5000);
    }

    // 4. Submit report via backend API
    if (!isOffline) {
      const driveToken = getAccessToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (driveToken) {
        headers['x-google-drive-token'] = driveToken;
      }

      try {
        const res = await fetch('/api/reports', {
          method: 'POST',
          headers,
          body: JSON.stringify(newReport)
        });

        if (res.ok) {
          markReportsSynced([newReport.id]);
          const data = await res.json();
          if (data.report) {
            setFieldReports(prev => prev.map(r => r.id === newReport.id ? { ...newReport, ...data.report, synced: true } : r));
            addOfflineReport({ ...newReport, ...data.report, synced: true });
          }
          setDriveToast({
            id: `toast-${Date.now()}`,
            type: 'success',
            title: 'Report Submitted Successfully',
            message: 'Field report & photos saved to database and synchronized.',
            reportTitle: newReport.title
          });
          setTimeout(() => {
            setDriveToast(current => current?.type === 'success' ? null : current);
          }, 4500);
        } else {
          setDriveToast({
            id: `toast-${Date.now()}`,
            type: 'warning',
            title: 'Saved Locally on Device',
            message: 'Report cached safely in local memory. Will auto-sync on next refresh.',
            reportTitle: newReport.title
          });
          setTimeout(() => {
            setDriveToast(current => current?.type === 'warning' ? null : current);
          }, 5000);
        }
      } catch (serverErr) {
        console.warn('Backend server unreachable, report safely stored locally:', serverErr);
        setDriveToast({
          id: `toast-${Date.now()}`,
          type: 'warning',
          title: 'Saved Locally on Device',
          message: 'Report cached safely in local memory. Will auto-sync on next refresh.',
          reportTitle: newReport.title
        });
        setTimeout(() => {
          setDriveToast(current => current?.type === 'warning' ? null : current);
        }, 5000);
      }
    }
  };

  const handleAddReports = async (newReports: FieldReport[]) => {
    setFieldReports(prev => deduplicateItems([...newReports, ...prev]));

    if (!isOffline) {
      for (const rep of newReports) {
        try {
          await fetch('/api/reports', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(rep)
          });
        } catch (err) {
          console.warn('Server report sync failed', rep.id, err);
        }

        const driveToken = getAccessToken();
        if (driveToken) {
          uploadMaintenanceReportToDrive(driveToken, rep).catch(err => {
            console.warn('Drive background upload error:', err);
          });
        }
      }
    }
  };

  const handleDeleteReport = useCallback(async (reportId: string) => {
    // 1. Instantly remove from in-memory reports state
    setFieldReports(prev => prev.filter(r => r.id !== reportId));
    if (selectedReport && selectedReport.id === reportId) {
      setSelectedReport(null);
    }

    // 2. Remove from local IndexedDB & localStorage
    await deleteCachedReportDB(reportId);

    // 3. Notify backend server
    if (!isOfflineRef.current) {
      try {
        const res = await fetch(`/api/reports/${reportId}?role=${encodeURIComponent(activeRole)}&userImo=${encodeURIComponent(effectiveImo)}`, {
          method: 'DELETE'
        });
        if (res.ok) {
          console.log(`✅ Report ${reportId} deleted successfully on server and cloud.`);
        }
      } catch (err) {
        console.warn('Delete report request warning:', err);
      }
    }
  }, [activeRole, effectiveImo, selectedReport, setFieldReports]);

  const handleFullSystemOverhaul = useCallback(async () => {
    const setStep = (id: string, status: SyncStep['status'], progress?: SyncStep['progress'], sublabel?: string) =>
      setSyncSteps(prev => prev.map(s => s.id === id ? { ...s, status, progress, ...(sublabel ? { sublabel } : {}) } : s));

    const OVERHAUL_STEPS: SyncStep[] = [
      { id: 'upload',  label: 'Preserving & Resetting Cache',    sublabel: 'Safeguarding unsynced reports and purging cache', status: 'pending' },
      { id: 'layers',  label: 'Downloading GIS Canal Networks', sublabel: 'Fetching fresh layers from Google Drive',  status: 'pending' },
      { id: 'reports', label: 'Downloading All Field Reports',   sublabel: 'Fetching complete historical reports',    status: 'pending' },
      { id: 'weeks',   label: 'Rebuilding Manifest & Indexes',   sublabel: 'Verifying checksums and week archives',   status: 'pending' },
    ];

    try {
      setIsSyncing(true);
      setSyncSteps(OVERHAUL_STEPS);
      setSyncStatusMessage('Executing full system overhaul: Safeguarding local data...');

      // 0. Safeguard: Capture all unsynced or local-only reports before clearing
      setStep('upload', 'active');
      const localCachedReports = await getCachedReportsDB();
      const offlineReports = getOfflineReports();
      const allCurrentLocal = [...(fieldReports || []), ...(localCachedReports || []), ...(offlineReports || [])];
      
      const unsyncedReportsMap = new Map<string, FieldReport>();
      allCurrentLocal.forEach(r => {
        if (r && r.id && !r.id.startsWith('mock-') && !(r as any).isMock) {
          if (!r.synced) {
            unsyncedReportsMap.set(r.id, r);
          }
        }
      });
      const unsyncedReports = Array.from(unsyncedReportsMap.values());
      if (unsyncedReports.length > 0) {
        console.log(`🛡️ System Overhaul Safeguard: Preserving ${unsyncedReports.length} unsynced local reports.`);
      }

      // If online and drive token or server available, try uploading unsynced reports first
      const driveToken = getAccessToken();
      if (unsyncedReports.length > 0 && !isOfflineRef.current) {
        for (const unRep of unsyncedReports) {
          try {
            if (driveToken) {
              const res = await uploadMaintenanceReportToDrive(driveToken, unRep);
              if (res && res.folderId) {
                unRep.synced = true;
                if (res.updatedReport) {
                  Object.assign(unRep, res.updatedReport);
                }
              }
            } else {
              const res = await fetch('/api/reports', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(unRep)
              });
              if (res.ok) {
                unRep.synced = true;
              }
            }
          } catch (flushErr) {
            console.warn('Could not auto-flush unsynced report during overhaul:', flushErr);
          }
        }
      }

      // 1. Wipe local layer & manifest caches (safe purge)
      await clearAllLayersDB();
      setLastOverhaulTimestamp();
      await new Promise(r => setTimeout(r, 400));
      setStep('upload', 'done');

      // 2. Re-download fresh layers from Google Drive & server
      setStep('layers', 'active');
      setSyncStatusMessage('Downloading fresh GIS layers and canal networks...');
      const targetImo = effectiveImo;
      try {
        await syncIMOFolderLayers(activeRole, targetImo);
      } catch (lErr) {
        console.warn('Overhaul layer sync notice:', lErr);
        try {
          const layerRes = await fetch(`/api/layers?role=${encodeURIComponent(activeRole)}&imo=${encodeURIComponent(targetImo)}`);
          if (layerRes.ok) {
            const lData = await layerRes.json();
            if (Array.isArray(lData.layers) && lData.layers.length > 0) {
              const clean = lData.layers.filter((l: any) => !isMockLayer(l) && l.geometryType !== 'Polygon' && l.category !== 'Parcels');
              setLayers(clean);
              await saveCachedLayersDB(clean);
            }
          }
        } catch (_) {}
      }
      setStep('layers', 'done');

      // 3. Re-download fresh reports (all historical reports & pre-cached photos)
      setStep('reports', 'active');
      setSyncStatusMessage('Synchronizing Google Drive reports and downloading complete archive...');
      let downloadedReports: FieldReport[] = [];
      try {
        const headers: Record<string, string> = {};
        if (driveToken) headers['x-google-drive-token'] = driveToken;

        // Force server to sync reports and pre-cache photos from Google Drive first
        try {
          await fetch(`/api/drive/sync-reports?imo=${encodeURIComponent(targetImo)}`, {
            method: 'POST',
            headers
          });
        } catch (syncErr) {
          console.warn('Overhaul Drive sync-reports notice:', syncErr);
        }

        const repRes = await fetch(`/api/reports?role=${encodeURIComponent(activeRole)}&imo=${encodeURIComponent(targetImo)}&timeScope=all`, { headers });
        if (repRes.ok) {
          const rData = await repRes.json();
          if (Array.isArray(rData.reports)) {
            downloadedReports = rData.reports;
          }
        }
      } catch (rErr) {
        console.warn('Overhaul reports fetch notice:', rErr);
      }

      // If remote reports fetch returned empty (or 404 on static hosting), fall back to persistent json if available
      if (downloadedReports.length === 0) {
        try {
          const staticRes = await fetch('data/persistent_reports.json');
          if (staticRes.ok) {
            const staticData = await staticRes.json();
            if (Array.isArray(staticData)) {
              downloadedReports = staticData;
            }
          }
        } catch (_) {}
      }

      // MERGE downloaded reports with all preserved unsynced/local reports
      let finalReports = deduplicateItems([...unsyncedReports, ...downloadedReports]);
      if (isImoScoped && targetImo !== 'All IMOs') {
        finalReports = finalReports.filter((r: any) => !r.imoOffice || matchesImoOffice(r.imoOffice, targetImo));
      }
      setFieldReports(finalReports);
      await saveCachedReportsDB(finalReports);
      saveOfflineReports(finalReports);
      setStep('reports', 'done');

      // 4. Update manifest metadata & available cloud weeks
      setStep('weeks', 'active');
      setSyncStatusMessage('Updating manifest checksums and week archives...');
      try {
        const [lManRes, rManRes, weeksRes] = await Promise.allSettled([
          fetch(`/api/layers/manifest?imo=${encodeURIComponent(targetImo)}`).then(r => r.ok ? r.json() : null),
          fetch(`/api/reports/manifest?role=${encodeURIComponent(activeRole)}&imo=${encodeURIComponent(targetImo)}`).then(r => r.ok ? r.json() : null),
          fetch(`/api/reports/available-weeks?role=${encodeURIComponent(activeRole)}&imo=${encodeURIComponent(targetImo)}`).then(r => r.ok ? r.json() : null)
        ]);

        const lMan = lManRes.status === 'fulfilled' ? lManRes.value : null;
        const rMan = rManRes.status === 'fulfilled' ? rManRes.value : null;
        const weeksData = weeksRes.status === 'fulfilled' ? weeksRes.value : null;

        if (weeksData && Array.isArray(weeksData.weeks)) {
          setAvailableCloudWeeks(weeksData.weeks);
        }

        if (lMan && rMan) {
          await saveManifestMetadataDB('master_manifest', {
            layerChecksum: lMan.checksum,
            reportChecksum: rMan.checksum,
            lastSync: new Date().toISOString()
          });
        }
      } catch (mErr) {
        console.warn('Overhaul manifest update notice:', mErr);
      }
      setStep('weeks', 'done');

      setSyncStatusMessage('System overhaul completed successfully!');

      setDriveToast({
        id: `toast-${Date.now()}`,
        type: 'success',
        title: 'System Overhaul Complete',
        message: 'Local cache reset and all GIS layers & field reports freshly synchronized.'
      });
      setTimeout(() => {
        setDriveToast(current => current?.type === 'success' ? null : current);
      }, 5000);
    } catch (err) {
      console.error('System overhaul error:', err);
      setSyncStatusMessage('System overhaul encountered an issue.');
    } finally {
      setTimeout(() => {
        setIsSyncing(false);
        setSyncSteps(INITIAL_SYNC_STEPS);
        setSyncStatusMessage('');
      }, 600);
    }
  }, [activeRole, effectiveImo, fieldReports, isImoScoped, setAvailableCloudWeeks, setFieldReports, setLayers, syncIMOFolderLayers]);

  // Search Autocomplete List
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];

    const results: { id: string; title: string; subTitle?: string; category: string; coords: [number, number]; layerId?: string; props?: any }[] = [];
    const seenTitles = new Set<string>();

    layers.forEach(layer => {
      if (layer.data && Array.isArray(layer.data.features)) {
        layer.data.features.forEach((feat: any) => {
          const props = feat.properties || {};
          const fullText = Object.values(props).filter(v => typeof v === 'string' || typeof v === 'number').join(' ').toLowerCase();

          if (fullText.includes(q)) {
            let coords: [number, number] | null = null;
            if (feat.geometry) {
              if (feat.geometry.type === 'Point' && Array.isArray(feat.geometry.coordinates)) {
                coords = [feat.geometry.coordinates[1], feat.geometry.coordinates[0]];
              } else if (feat.geometry.type === 'LineString' && Array.isArray(feat.geometry.coordinates) && feat.geometry.coordinates.length > 0) {
                const mid = feat.geometry.coordinates[Math.floor(feat.geometry.coordinates.length / 2)];
                coords = [mid[1], mid[0]];
              }
            }

            if (coords) {
              const actualName = props.Name || props.name || props.NAME || props.canal_name || props.station_name || props.station_code || 'Unnamed Feature';
              const locationSub = props.NIS ? `${props.NIS}${props.Municipality ? ` • ${props.Municipality}` : ''}` : props.Municipality || props.Barangay || '';
              const dedupKey = `${actualName}_${coords[0].toFixed(4)}_${coords[1].toFixed(4)}`;

              if (!seenTitles.has(dedupKey)) {
                seenTitles.add(dedupKey);
                results.push({
                  id: `feat-${feat.id || Math.random()}`,
                  title: String(actualName),
                  subTitle: locationSub,
                  category: layer.geometryType === 'Point' ? 'Structures' : 'Canals',
                  coords,
                  layerId: layer.id,
                  props
                });
              }
            }
          }
        });
      }
    });

    fieldReports.forEach(report => {
      const text = `${report.title} ${report.locationName || ''} ${report.canalSegment || ''} ${report.remarks || ''}`.toLowerCase();
      if (text.includes(q)) {
        results.push({
          id: report.id,
          title: report.title,
          subTitle: report.locationName || `Status: ${report.status}`,
          category: 'Reports',
          coords: [report.lat, report.lng],
          props: report
        });
      }
    });

    return results.slice(0, 15);
  }, [layers, fieldReports, searchQuery]);

  const handleSelectSearchResult = (result: { id: string; title: string; coords: [number, number]; layerId?: string; props?: any }) => {
    setSearchTargetCoords(result.coords);
    if (result.props) {
      if (result.props.reportType || result.props.categoryMode) {
        setSelectedReport(result.props as FieldReport);
        setSelectedFeatureProps(null);
      } else {
        setSelectedFeatureProps(result.props);
        setSelectedFeatureType(result.props.category || 'Spatial Feature');
        setSelectedReport(undefined);
      }
      setSelectedCoords(result.coords);
    }
  };

  const handleSelectFeature = useCallback((props: any, geomType: string, crds?: [number, number]) => {
    closeAllModals();
    setSelectedFeatureProps(props);
    setSelectedFeatureType(geomType);
    setSelectedReport(undefined);
    setSelectedCoords(crds);
  }, [closeAllModals]);

  const handleSelectReport = useCallback((rep: FieldReport, crds?: [number, number]) => {
    closeAllModals();
    setSelectedReport(rep);
    setSelectedFeatureProps(null);
    setSelectedCoords(crds);
  }, [closeAllModals]);

  const handleDeselectFeature = useCallback(() => {
    setSelectedFeatureProps(null);
    setSelectedReport(undefined);
    setSelectedCoords(undefined);
  }, []);

  const handleOpenReportForFeature = useCallback((canalSegment?: string, parcelId?: string, crds?: [number, number]) => {
    closeAllModals();
    setEditingReport(null);
    setReportPrefill({
      canalSegment,
      parcelId,
      lat: crds ? crds[0] : undefined,
      lng: crds ? crds[1] : undefined,
      reportType: 'maintenance'
    });
    setIsReportModalOpen(true);
  }, [closeAllModals]);

  const handleEditReport = useCallback((report: FieldReport) => {
    closeAllModals();
    setEditingReport(report);
    setReportPrefill({
      reportType: report.categoryMode || (report.reportType === 'operational' ? 'operational' : 'maintenance'),
      canalSegment: report.canalSegment,
      parcelId: report.parcelId,
      lat: report.lat,
      lng: report.lng,
      lat2: report.secondLat,
      lng2: report.secondLng
    });
    setIsReportModalOpen(true);
  }, [closeAllModals]);

  const handleStartMapPicking = useCallback((reportCategory: 'maintenance' | 'operational', coords?: { lat1?: number; lng1?: number; lat2?: number; lng2?: number }) => {
    setMapPickerReportType(reportCategory);
    setMapPickerMode(coords?.lat2 !== undefined ? 'double' : 'single');
    if (coords?.lat1 !== undefined && coords?.lng1 !== undefined) {
      setReportPrefill(prev => ({
        ...prev,
        lat: coords.lat1,
        lng: coords.lng1,
        lat2: coords.lat2,
        lng2: coords.lng2,
        reportType: reportCategory
      }));
    }
    setIsMapPickerActive(true);
  }, []);

  const handleConfirmMapPick = useCallback((res: {
    lat1: number;
    lng1: number;
    lat2?: number;
    lng2?: number;
    locationName: string;
    canalCode?: string;
    parcelId?: string;
    pathCoords?: [number, number][];
  }) => {
    setIsMapPickerActive(false);
    setReportPrefill(prev => ({
      ...prev,
      lat: res.lat1,
      lng: res.lng1,
      lat2: res.lat2,
      lng2: res.lng2,
      canalSegment: res.canalCode || prev.canalSegment,
      parcelId: res.parcelId || prev.parcelId,
      reportType: mapPickerReportType
    }));
    setIsReportModalOpen(true);
  }, [mapPickerReportType]);

  const handleCancelMapPick = useCallback(() => {
    setIsMapPickerActive(false);
    setIsReportModalOpen(true);
  }, []);

  const handleTriggerReportFromMap = useCallback((lat: number, lng: number) => {
    closeAllModals();
    setEditingReport(null);
    if (selectedFeatureProps || (lat && lng)) {
      const canalCode = selectedFeatureProps?.canal_code || selectedFeatureProps?.Name || selectedFeatureProps?.name;
      const parcelId = selectedFeatureProps?.parcel_id;
      setReportPrefill({
        canalSegment: canalCode,
        parcelId: parcelId,
        lat: lat,
        lng: lng,
        reportType: 'maintenance'
      });
    } else {
      setReportPrefill(prev => ({ ...prev, lat, lng, reportType: 'maintenance' }));
    }
    setIsReportModalOpen(true);
  }, [closeAllModals, selectedFeatureProps]);

  // Calculate set of cached ISO week keys from active fieldReports dataset and persistent downloaded keys
  const cachedWeekKeys = useMemo(() => {
    const keys = new Set<string>(getDownloadedWeekKeys());
    fieldReports.forEach(r => {
      if (r && r.createdAt) {
        const info = getIsoWeekInfo(r.createdAt);
        keys.add(info.key);
      }
    });
    return keys;
  }, [fieldReports]);

  const unsyncedCount = getOfflineReports().filter(r => !r.synced).length;

  // Filter visible reports for Viewer role (Approved records only)
  const visibleFieldReports = useMemo(() => {
    if (activeRole === 'Viewer') {
      return fieldReports.filter(r => r.approvalStatus === 'Approved' || (!r.approvalStatus && r.status === 'Completed'));
    }
    return fieldReports;
  }, [activeRole, fieldReports]);

  return (
    <div className={`relative w-screen h-[100dvh] overflow-hidden select-none transition-colors duration-200 ${
      theme === 'light' ? 'bg-slate-100 text-slate-900 light' : 'bg-slate-950 text-slate-100 dark'
    }`}>
      {/* Top Navbar */}
      <Navbar
        authenticatedUser={authenticatedUser}
        activeRole={activeRole}
        activeImo={activeImo}
        activeNis={activeNis}
        simulatedRole={simulatedRole}
        simulatedImo={simulatedImo}
        simulatedNis={simulatedNis}
        onSimulateContext={handleSimulateContext}
        onRoleChange={handleRoleChange}
        isOffline={isOffline}
        onToggleOfflineMode={() => setIsOffline(prev => !prev)}
        unsyncedCount={unsyncedCount}
        onSyncNow={handleSyncNow}
        isSyncing={isSyncing}
        onOpenUpload={() => {
          closeAllModals();
          setIsUploadOpen(true);
        }}
        onOpenReportModal={(type) => {
          closeAllModals();
          setEditingReport(null);
          if (selectedFeatureProps) {
            const canalCode = selectedFeatureProps?.canal_code || selectedFeatureProps?.Name || selectedFeatureProps?.name;
            const parcelId = selectedFeatureProps?.parcel_id;
            setReportPrefill({
              canalSegment: canalCode,
              parcelId: parcelId,
              lat: selectedCoords ? selectedCoords[0] : undefined,
              lng: selectedCoords ? selectedCoords[1] : undefined,
              reportType: type || 'maintenance'
            });
          } else {
            setReportPrefill({
              canalSegment: undefined,
              parcelId: undefined,
              lat: undefined,
              lng: undefined,
              lat2: undefined,
              lng2: undefined,
              reportType: type || 'maintenance'
            });
          }
          setIsReportModalOpen(true);
        }}
        onOpenReportsSummary={(tab) => {
          closeAllModals();
          setSummaryModalInitialTab(tab || 'ledger');
          setIsSummaryModalOpen(true);
        }}
        availableCloudWeeks={availableCloudWeeks}
        onDownloadWeek={handleDownloadWeek}
        onDownloadAllWeeks={handleDownloadAllWeeks}
        isDownloadingWeek={isDownloadingWeek}
        cachedReportsCount={fieldReports.length}
        cachedWeekKeys={cachedWeekKeys}
        onOpenSyncModal={() => {
          const willOpen = !isSyncDataModalOpen;
          closeAllModals();
          setIsSyncDataModalOpen(willOpen);
        }}
        isSyncDataModalOpen={isSyncDataModalOpen}
        onToggleLayerPanel={() => {
          const willOpen = !isLayerPanelOpen;
          closeAllModals();
          setIsLayerPanelOpen(willOpen);
        }}
        isLayerPanelOpen={isLayerPanelOpen}
        onOpenFilterModal={() => {
          const willOpen = !isFilterModalOpen;
          closeAllModals();
          setIsFilterModalOpen(willOpen);
        }}
        isFilterModalOpen={isFilterModalOpen}
        isFilterActive={isFilterActive}
        onOpenHelp={() => {
          closeAllModals();
          setIsHelpOpen(true);
        }}
        onOpenConfigurations={() => {
          closeAllModals();
          setIsConfigurationsModalOpen(true);
        }}
        onOpenDevPanel={() => {
          closeAllModals();
          setIsDevPanelOpen(true);
        }}
        onOpenAccessRequests={() => {
          closeAllModals();
          setIsAccessRequestsModalOpen(true);
        }}
        pendingRequestsCount={pendingAccessRequestsCount}
        onOpenRoleMatrix={() => {
          closeAllModals();
          setIsRoleMatrixModalOpen(true);
        }}
        onLogout={handleLogout}
        isMapPickerActive={isMapPickerActive}
        currentTheme={theme}
        onToggleTheme={toggleTheme}
        isMenuOpen={isMenuOpen}
        onToggleMenu={() => setIsMenuOpen(prev => !prev)}
      />

      {/* Privileged Role Simulation Banner */}
      <RoleSimulationBanner
        authenticatedUser={authenticatedUser}
        activeRole={activeRole}
        activeImo={activeImo}
        activeNis={activeNis}
        isSimulating={isSimulating}
        onRevertRole={handleRevertRole}
      />

      {/* Main Map View Container */}
      <MapContainer
        layers={layers}
        fieldReports={visibleFieldReports}
        basemap={basemap}
        onBasemapChange={setBasemap}
        onSelectFeature={handleSelectFeature}
        onDeselectFeature={handleDeselectFeature}
        onSelectReport={handleSelectReport}
        onTriggerReportFromMap={handleTriggerReportFromMap}
        selectedFeatureProps={selectedFeatureProps}
        selectedReport={selectedReport}
        targetFlyCoords={searchTargetCoords}
        locationFilter={locationFilter}
        isFilterActive={isFilterActive}
        isMapPickerActive={isMapPickerActive}
        mapPickerMode={mapPickerMode}
        initialPickerLat1={reportPrefill.lat}
        initialPickerLng1={reportPrefill.lng}
        initialPickerLat2={reportPrefill.lat2}
        initialPickerLng2={reportPrefill.lng2}
        onConfirmMapPick={handleConfirmMapPick}
        onCancelMapPick={handleCancelMapPick}
      />

      {/* Layer Management Drawer */}
      <LayerPanel
        isOpen={isLayerPanelOpen}
        onClose={() => setIsLayerPanelOpen(false)}
        layers={layers}
        fieldReports={fieldReports}
        onToggleVisibility={handleToggleLayerVisibility}
        onChangeOpacity={handleChangeLayerOpacity}
        onChangeColor={handleChangeLayerColor}
        onDeleteLayer={handleDeleteLayer}
        onOpenUpload={() => {
          closeAllModals();
          setIsUploadOpen(true);
        }}
        currentRole={activeRole}
        onSyncDriveLayers={() => syncIMOFolderLayers(activeRole, locationFilter.imo)}
        isSyncingDrive={isSyncingDrive}
      />


      {/* Selected Feature / Report Attribute Inspector Drawer */}
      <AttributeInspector
        authenticatedUser={authenticatedUser}
        selectedFeatureProps={selectedFeatureProps}
        selectedFeatureType={selectedFeatureType}
        selectedReport={selectedReport}
        coords={selectedCoords}
        onClose={() => {
          setSelectedFeatureProps(null);
          setSelectedReport(undefined);
          setSelectedCoords(undefined);
        }}
        onOpenReportForFeature={handleOpenReportForFeature}
        onEditReport={handleEditReport}
        onOpenReportsSummary={() => {
          setSummaryModalInitialTab('ledger');
          setIsSummaryModalOpen(true);
        }}
        onViewOfficialReport={(tab) => {
          setSummaryModalInitialTab(tab);
          setIsSummaryModalOpen(true);
        }}
        onPreviewReportPdf={handleOpenPdfPreview}
        currentRole={activeRole}
        onApproveReport={handleApproveReport}
        isPickingLocation={isMapPickerActive}
      />

      {/* GIS Data Upload Modal (Mounted only when open) */}
      {isUploadOpen && (
        <UploadModal
          isOpen={isUploadOpen}
          onClose={() => setIsUploadOpen(false)}
          onAddLayer={handleAddLayer}
          layers={layers}
          onToggleVisibility={handleToggleLayerVisibility}
          onDeleteLayer={handleDeleteLayer}
        />
      )}

      {/* Field Work Report Modal (Kept mounted during map picking to preserve state & photos) */}
      {(isReportModalOpen || isMapPickerActive) && (
        <FieldReportModal
          isOpen={isReportModalOpen}
          isPickingLocation={isMapPickerActive}
          onClose={() => {
            setIsReportModalOpen(false);
            setIsMapPickerActive(false);
            setEditingReport(null);
            setReportPrefill({});
            try { sessionStorage.removeItem('om_active_report_draft'); } catch (_) {}
          }}
          onSubmitReport={handleSubmitReport}
          onDeleteReport={handleDeleteReport}
          editingReport={editingReport}
          onPreviewReportPdf={handleOpenPdfPreview}
          initialLat={reportPrefill.lat}
          initialLng={reportPrefill.lng}
          initialLat2={reportPrefill.lat2}
          initialLng2={reportPrefill.lng2}
          initialCanalSegment={reportPrefill.canalSegment}
          initialParcelId={reportPrefill.parcelId}
          initialReportType={reportPrefill.reportType || 'maintenance'}
          currentRole={activeRole}
          currentImo={locationFilter.imo}
          activeImo={activeImo}
          activeNis={activeNis}
          isOffline={isOffline}
          layers={layers}
          currentUser={authenticatedUser}
          onStartMapPicking={handleStartMapPicking}
        />
      )}

      {/* Reports Summary Window (Weekly & Monthly Accomplishment Clusters - Mounted only when open) */}
      {isSummaryModalOpen && (
        <ReportsSummaryModal
          isOpen={isSummaryModalOpen}
          onClose={() => setIsSummaryModalOpen(false)}
          reports={fieldReports}
          currentRole={activeRole}
          currentUser={authenticatedUser}
          activeImo={activeImo || (locationFilter.imo !== 'All' ? locationFilter.imo : undefined)}
          activeNis={activeNis || (locationFilter.nis !== 'All' ? locationFilter.nis : undefined)}
          initialTab={summaryModalInitialTab}
          onPreviewReportPdf={handleOpenPdfPreview}
          onSelectReportOnMap={(rep) => {
            setSelectedReport(rep);
            setSelectedFeatureProps(null);
            if (rep.lat && rep.lng) {
              setSelectedCoords([rep.lat, rep.lng]);
              setSearchTargetCoords([rep.lat, rep.lng]);
            }
          }}
          onEditReport={(rep, snapshot) => {
            setEditingReport(snapshot ? ({ ...rep, ...snapshot } as FieldReport) : rep);
            setIsReportModalOpen(true);
          }}
        />
      )}

      {/* In-App Official PDF Report Previewer Modal */}
      {isPdfPreviewOpen && (
        <PdfPreviewModal
          isOpen={isPdfPreviewOpen}
          onClose={() => setIsPdfPreviewOpen(false)}
          report={previewingPdfReport}
          onOpenConfigurations={() => setIsConfigurationsModalOpen(true)}
        />
      )}

      {/* Help Modal */}
      {isHelpOpen && (
        <HelpModal
          isOpen={isHelpOpen}
          onClose={() => setIsHelpOpen(false)}
        />
      )}

      {/* Location Filter Modal (Mounted only when open) */}
      {isFilterModalOpen && (
        <LocationFilterModal
          isOpen={isFilterModalOpen}
          onClose={() => setIsFilterModalOpen(false)}
          activeFilter={locationFilter}
          onApplyFilter={(newFilter) => setLocationFilter(newFilter)}
          onResetFilter={() => setLocationFilter({
            imo: isImoScoped && userAssignedImo !== 'All IMOs' ? userAssignedImo : 'All IMOs',
            nis: 'All NIS',
            province: 'All Provinces',
            activityCategory: 'All Activities'
          })}
          layers={layers}
          fieldReports={fieldReports}
          isImoLocked={isImoScoped && userAssignedImo !== 'All IMOs'}
          userImoOffice={userAssignedImo}
        />
      )}

      {/* Sync Data & Cloud Batches Modal (Mounted only when open, identical floating behavior) */}
      {isSyncDataModalOpen && (
        <SyncDataModal
          onClose={() => setIsSyncDataModalOpen(false)}
          isSyncing={isSyncing}
          isOffline={isOffline}
          unsyncedCount={unsyncedCount}
          onSyncNow={handleSyncNow}
          onFullOverhaul={handleFullSystemOverhaul}
          availableCloudWeeks={availableCloudWeeks}
          onDownloadWeek={handleDownloadWeek}
          onDownloadAllWeeks={handleDownloadAllWeeks}
          isDownloadingWeek={isDownloadingWeek}
          cachedWeekKeys={cachedWeekKeys}
          cachedReportsCount={fieldReports.length}
          currentRole={activeRole}
        />
      )}

      {/* System Configurations & Photo Settings Modal */}
      <ConfigurationsModal
        isOpen={isConfigurationsModalOpen}
        onClose={() => setIsConfigurationsModalOpen(false)}
        currentUser={authenticatedUser}
        currentRole={activeRole}
      />

      {/* Standalone GIS Search Suggestions Window */}
      {isSearchModalOpen && (
        <SearchResultsModal
          isOpen={isSearchModalOpen}
          onClose={() => setIsSearchModalOpen(false)}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchResults={searchResults}
          onSelectSearchResult={handleSelectSearchResult}
        />
      )}

      {/* Developer User & Passcode Management Modal (Developer Master Access Only) */}
      {isDevPanelOpen && (
        <DeveloperUserManagementModal
          isOpen={isDevPanelOpen}
          onClose={() => setIsDevPanelOpen(false)}
          currentUser={authenticatedUser}
          onUserUpdated={() => {
            const current = getSavedAuthSession();
            if (current) {
              const users = getAuthUsers();
              const live = users.find(u => u.id === current.id || u.username.toLowerCase() === current.username.toLowerCase());
              if (live) {
                setAuthenticatedUser(live);
                saveAuthSession(live);
              }
            }
          }}
        />
      )}

      {/* Login Authentication Modal Gate */}
      <LoginModal
        isOpen={!authenticatedUser}
        onLogin={handleLogin}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* 6-Tier Institutional Rights Matrix Modal */}
      <RoleMatrixModal
        isOpen={isRoleMatrixModalOpen}
        onClose={() => setIsRoleMatrixModalOpen(false)}
        isLight={theme === 'light'}
      />

      {/* Access Requests Management Queue Modal */}
      <AccessRequestManagementModal
        isOpen={isAccessRequestsModalOpen}
        onClose={() => {
          setIsAccessRequestsModalOpen(false);
          loadAccessRequests();
        }}
        currentUser={authenticatedUser}
        requests={accessRequests}
        onRefreshRequests={loadAccessRequests}
        isLight={theme === 'light'}
      />

      {/* Full-screen Sync Overlay — blocks all input during sync */}
      {(() => {
        // Compute overall pct from step states + GIS layer sub-progress
        const doneCount = syncSteps.filter(s => s.status === 'done').length;
        const totalSteps = syncSteps.length;
        // Weight each step equally; within the layers step use syncProgress for sub-pct
        let basePct = (doneCount / totalSteps) * 100;
        const layersStep = syncSteps.find(s => s.id === 'layers' && s.status === 'active');
        if (layersStep && syncProgress && syncProgress.total > 0) {
          const subPct = (syncProgress.current / syncProgress.total) * (100 / totalSteps);
          basePct += subPct;
        }
        // Inject live layer progress into the layers step
        const stepsWithProgress: SyncStep[] = syncSteps.map(s =>
          s.id === 'layers' && s.status === 'active' && syncProgress
            ? { ...s, progress: syncProgress }
            : s
        );
        return (
          <SyncOverlay
            isVisible={isSyncing}
            steps={stepsWithProgress}
            overallPct={Math.min(99, basePct)} // cap at 99 until finally block
            statusMessage={syncStatusMessage}
          />
        );
      })()}

      {/* Google Drive Submitting / Saved Floating User Toast Notification */}
      {driveToast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm w-[92vw] sm:w-[380px] animate-in slide-in-from-bottom-5 fade-in duration-300 pointer-events-auto">
          <div className={`p-3.5 sm:p-4 rounded-2xl border shadow-2xl backdrop-blur-xl transition-all ${
            driveToast.type === 'submitting'
              ? 'bg-slate-900/95 border-cyan-500/50 shadow-cyan-950/40 text-slate-100'
              : driveToast.type === 'success'
              ? 'bg-slate-900/95 border-emerald-500/50 shadow-emerald-950/40 text-slate-100'
              : 'bg-slate-900/95 border-amber-500/50 shadow-amber-950/40 text-slate-100'
          }`}>
            <div className="flex items-start gap-3">
              {driveToast.type === 'submitting' && (
                <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center shrink-0 text-cyan-400 mt-0.5">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
              )}
              {driveToast.type === 'success' && (
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0 text-emerald-400 mt-0.5">
                  <CheckCircle2 className="w-4.5 h-4.5" />
                </div>
              )}
              {driveToast.type === 'warning' && (
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0 text-amber-400 mt-0.5">
                  <HardDrive className="w-4 h-4" />
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5 truncate">
                    <span>{driveToast.title}</span>
                    {driveToast.type === 'success' && (
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                        Archived
                      </span>
                    )}
                  </h4>
                  <button
                    type="button"
                    onClick={() => setDriveToast(null)}
                    className="text-slate-400 hover:text-slate-200 transition cursor-pointer p-0.5"
                    title="Dismiss"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                {driveToast.reportTitle && (
                  <p className="text-[11px] font-semibold text-cyan-300 truncate mt-0.5">
                    {driveToast.reportTitle}
                  </p>
                )}
                <p className="text-[10.5px] text-slate-300 mt-1 leading-snug">
                  {driveToast.message}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Option 3: Android Native Double-Back-to-Exit Toast */}
      {showExitToast && (
        <div className="fixed bottom-20 md:bottom-8 inset-x-0 z-50 flex justify-center pointer-events-none px-4 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="bg-slate-900/98 text-white border border-slate-700/80 px-4 py-2 rounded-full shadow-2xl text-xs font-semibold backdrop-blur-xl flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#009933] animate-pulse" />
            <span>Press back again to exit NIA O&M GIS</span>
          </div>
        </div>
      )}

      {/* Dedicated Mobile Bottom Navigation Dock */}
      <MobileBottomNav
        onOpenReportModal={() => {
          closeAllModals();
          setEditingReport(null);
          setReportPrefill({
            canalSegment: undefined,
            parcelId: undefined,
            lat: undefined,
            lng: undefined,
            lat2: undefined,
            lng2: undefined,
            reportType: 'maintenance'
          });
          setIsReportModalOpen(true);
        }}
        onToggleLayerPanel={() => {
          const willOpen = !isLayerPanelOpen;
          closeAllModals();
          setIsLayerPanelOpen(willOpen);
        }}
        isLayerPanelOpen={isLayerPanelOpen}
        onOpenReportsSummary={() => {
          closeAllModals();
          setSummaryModalInitialTab('ledger');
          setIsSummaryModalOpen(true);
        }}
        isSummaryModalOpen={isSummaryModalOpen}
        onOpenMenu={() => {
          setIsMenuOpen(prev => !prev);
        }}
        isMenuOpen={isMenuOpen}
        onOpenFilter={() => {
          const willOpen = !isFilterModalOpen;
          closeAllModals();
          setIsFilterModalOpen(willOpen);
        }}
        isFilterActive={isFilterActive}
        unsyncedCount={unsyncedCount}
      />

      {/* PWA In-App Real-time Cloud Update Notifier */}
      <PwaUpdateToast />
    </div>
  );
};

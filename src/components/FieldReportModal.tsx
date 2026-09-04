import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  X, 
  MapPin, 
  Camera, 
  CheckCircle2, 
  Wrench, 
  Activity, 
  Plus, 
  Trash2, 
  Gauge, 
  Compass, 
  AlertTriangle,
  Crosshair,
  Info,
  HelpCircle,
  Ruler,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Upload,
  Calculator,
  Users,
  Building2,
  Search,
  Eye,
  FileDown,
  Loader2,
  User,
  RefreshCw,
  FileText,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Sparkles
} from 'lucide-react';
import exifr from 'exifr';
import { 
  FieldReport, 
  ReportCategoryMode, 
  MaintenanceActivityType, 
  OperationalState, 
  WaterQualityLevel, 
  PhotoAttachment, 
  UserRole,
  AuthUser,
  GISLayer
} from '../types';
import { detectNearestGISFeature, calculateCanalPathBetweenPoints, haversineDistanceMeters, isSyntheticFeatureId } from '../utils/gisLocationUtils';
import { getIAsForContext, resolveCanonicalNis, IrrigatorsAssociation } from '../data/irrigatorsAssociations';
import { downloadReportPdf } from '../utils/reportPdfBuilder';
import { generateWmrReportId } from '../utils/reportIdGenerator';
import { 
  canUserEditReport, 
  getEffectiveReportTier, 
  getTierLabel, 
  getTierBadgeStyle, 
  ORDERED_APPROVAL_TIERS,
  TIER_CONFIG
} from '../utils/approvalHierarchyEngine';
import { PhotoManager } from './PhotoManager';
import { CaptionContext } from '../utils/captionGenerator';
import { getUserSignatories } from '../utils/signatoriesConfig';
import { composeTechnicalRemarks } from '../utils/technicalRemarksComposer';



interface FieldReportModalProps {
  isOpen: boolean;
  isPickingLocation?: boolean;
  onClose: () => void;
  onSubmitReport: (report: FieldReport) => void;
  editingReport?: FieldReport | null;
  onPreviewReportPdf?: (report: FieldReport) => void;
  initialLat?: number;
  initialLng?: number;
  initialLat2?: number;
  initialLng2?: number;
  initialCanalSegment?: string;
  initialParcelId?: string;
  initialReportType?: ReportCategoryMode;
  currentRole: UserRole;
  currentImo?: string;
  activeImo?: string;
  activeNis?: string;
  isOffline: boolean;
  layers?: GISLayer[];
  currentUser?: AuthUser | null;
  onStartMapPicking?: (reportCategory: ReportCategoryMode, coords?: { lat1?: number; lng1?: number; lat2?: number; lng2?: number }) => void;
}

const MAINTENANCE_ACTIVITIES: MaintenanceActivityType[] = [
  'Desilting / Clearing of Canal (Mechanical)',
  'Desilting / Clearing of Canal (Manual)',
  'Brush Dam / Dredging at Water Source',
  'Gate Lubrication',
  'Temporary Fix',
  'Canal Repair / Construction',
  'Service Road Maintenance',
  'Painting / Repainting',
  'Staff Gauge Installation / Maintenance',
  'Herbicide / Vegetation Control (Chemical)',
  'Farm Ditch / Lateral Restoration',
  'Other Repair / Maintenance'
];

export const FieldReportModal: React.FC<FieldReportModalProps> = ({
  isOpen,
  isPickingLocation = false,
  onClose,
  onSubmitReport,
  editingReport,
  onPreviewReportPdf,
  initialLat,
  initialLng,
  initialLat2,
  initialLng2,
  initialCanalSegment,
  initialParcelId,
  initialReportType = 'maintenance',
  currentRole,
  currentImo,
  activeImo,
  activeNis,
  isOffline,
  layers = [],
  currentUser,
  onStartMapPicking
}) => {
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  // Category Mode: Maintenance or Operational Status
  const [categoryMode, setCategoryMode] = useState<ReportCategoryMode>(initialReportType);

  // Maintenance Activity selection (empty initially to prompt user selection)
  const [maintenanceActivity, setMaintenanceActivity] = useState<MaintenanceActivityType | ''>((editingReport?.maintenanceActivity as MaintenanceActivityType) || '');
  const [customActivity, setCustomActivity] = useState('');

  // Performed By Multi-select List (by IMO, by IA, by Others) - Unselected by default
  const [performedByList, setPerformedByList] = useState<('IMO' | 'IA' | 'Others')[]>(() => editingReport?.performedByList || []);
  const [performedByIA, setPerformedByIA] = useState<string>('');
  const [performedByOthers, setPerformedByOthers] = useState<string>('');
  const [iaSearchQuery, setIaSearchQuery] = useState<string>('');
  const [isIaDropdownOpen, setIsIaDropdownOpen] = useState<boolean>(false);
  const [isSpecifyingCustomIA, setIsSpecifyingCustomIA] = useState<boolean>(false);
  const iaComboboxRef = useRef<HTMLDivElement | null>(null);

  const togglePerformedBy = (opt: 'IMO' | 'IA' | 'Others') => {
    setPerformedByList(prev => {
      if (prev.includes(opt)) {
        return prev.filter(item => item !== opt);
      } else {
        return [...prev, opt];
      }
    });
  };

  // Operational Parameters
  const [operationalState, setOperationalState] = useState<OperationalState>('Fully Operational');
  const [waterLevelMeters, setWaterLevelMeters] = useState<number>(2.45);
  const [dischargeFlowM3s, setDischargeFlowM3s] = useState<number>(12.5);
  const [gateOpeningCm, setGateOpeningCm] = useState<number>(85);
  const [waterQuality, setWaterQuality] = useState<WaterQualityLevel>('Clear / Optimal');
  const [beneficiaryServiceArea, setBeneficiaryServiceArea] = useState('');
  const [operationalIncident, setOperationalIncident] = useState('');

  // Location picking mode: 'single' or 'double' and hierarchy source tracker
  const [locationMode, setLocationMode] = useState<'single' | 'double'>('single');
  const [locationSource, setLocationSource] = useState<'manual_picker' | 'prefill' | 'photo_exif' | 'none'>(() => {
    if (initialLat !== undefined && initialLng !== undefined) return 'prefill';
    return 'none';
  });
  const [lat1, setLat1] = useState<number | undefined>(initialLat);
  const [lng1, setLng1] = useState<number | undefined>(initialLng);
  const [lat2, setLat2] = useState<number | undefined>(initialLat2);
  const [lng2, setLng2] = useState<number | undefined>(initialLng2);

  // Activity Physical Measurements & Dimension Estimator State
  const [depthMeters, setDepthMeters] = useState<number | ''>('');
  const [widthMeters, setWidthMeters] = useState<number | ''>('');
  const [sandPileHeightMeters, setSandPileHeightMeters] = useState<number | ''>('');
  const [paintedAreaSqm, setPaintedAreaSqm] = useState<number | ''>('');

  // Auto-detected GIS metadata
  const [detectedLocationName, setDetectedLocationName] = useState<string>('');
  const [detectedCanalCode, setDetectedCanalCode] = useState<string | undefined>(initialCanalSegment);
  const [detectedParcelId, setDetectedParcelId] = useState<string | undefined>(initialParcelId);
  const [detectedPathCoords, setDetectedPathCoords] = useState<[number, number][] | undefined>(undefined);

  // Status: In Progress, Completed, or Suspended (No pre-select: User must choose)
  const [status, setStatus] = useState<'In Progress' | 'Completed' | 'Suspended' | ''>('');
  const [suspensionReason, setSuspensionReason] = useState<string>(() => editingReport?.suspensionReason || '');
  const [isRemarksUserModified, setIsRemarksUserModified] = useState<boolean>(false);

  // Reporter Name & Designation with persistent device cache & logged-in user prefill
  const [reporterName, setReporterName] = useState<string>(() => {
    if (editingReport?.reporterName) return editingReport.reporterName;
    try {
      const saved = localStorage.getItem('nia_saved_reporter_name');
      if (saved) return saved;
    } catch (_) {}
    return currentUser?.name || '';
  });

  const [reporterDesignation, setReporterDesignation] = useState<string>(() => {
    if (editingReport?.reporterDesignation) return editingReport.reporterDesignation;
    try {
      const saved = localStorage.getItem('nia_saved_reporter_designation');
      if (saved) return saved;
    } catch (_) {}
    return currentUser?.designation || (currentRole === 'Field Personnel' ? 'Water Resource Officer' : 'NIS In-Charge');
  });

  // Immediate Supervisor / Verifier with persistent device cache
  const [verifierName, setVerifierName] = useState<string>(() => {
    if (editingReport?.verifierName) return editingReport.verifierName;
    try {
      return localStorage.getItem('nia_saved_supervisor_name') || '';
    } catch (_) {
      return '';
    }
  });

  const [verifierDesignation, setVerifierDesignation] = useState<string>(() => {
    if (editingReport?.verifierDesignation) return editingReport.verifierDesignation;
    try {
      return localStorage.getItem('nia_saved_supervisor_designation') || '';
    } catch (_) {
      return '';
    }
  });

  // Guided Form Navigation State
  const [guidedStep, setGuidedStep] = useState<'reporter' | 'activity' | 'photos' | 'location' | 'workforce' | 'remarks'>('reporter');
  const [revisionChangeSummary, setRevisionChangeSummary] = useState<string>('');

  const editPermission = useMemo(() => {
    if (!editingReport) return { allowed: true, mode: 'direct_edit' as const };
    return canUserEditReport(editingReport, currentUser || null, currentRole);
  }, [editingReport, currentUser, currentRole]);

  const effectiveTier = useMemo(() => {
    if (!editingReport) return 'Pending_IMO_Preparer' as const;
    return getEffectiveReportTier(editingReport);
  }, [editingReport]);

  // Section & Input Refs for Guided Scrolling & Highlighting
  const reporterNameRef = useRef<HTMLInputElement>(null);
  const activitySelectRef = useRef<HTMLSelectElement>(null);
  const step2PhotosRef = useRef<HTMLDivElement>(null);
  const step3LocationRef = useRef<HTMLDivElement>(null);
  const step4WorkforceRef = useRef<HTMLDivElement>(null);
  const step5RemarksRef = useRef<HTMLDivElement>(null);

  // Auto-focus Reporter Name and initialize guided step on open
  useEffect(() => {
    if (isOpen) {
      if (!editingReport) {
        try {
          const saved = localStorage.getItem('nia_saved_reporter_name') || currentUser?.name;
          if (saved && !reporterName) {
            setReporterName(saved);
            setGuidedStep('activity');
          } else if (!reporterName) {
            setGuidedStep('reporter');
          }
          const savedDesig = localStorage.getItem('nia_saved_reporter_designation') || currentUser?.designation;
          if (savedDesig && !reporterDesignation) {
            setReporterDesignation(savedDesig);
          }
          const savedSup = localStorage.getItem('nia_saved_supervisor_name');
          if (savedSup && !verifierName) {
            setVerifierName(savedSup);
          }
          const savedSupDesig = localStorage.getItem('nia_saved_supervisor_designation');
          if (savedSupDesig && !verifierDesignation) {
            setVerifierDesignation(savedSupDesig);
          }
        } catch (_) {}
      }
      setTimeout(() => {
        reporterNameRef.current?.focus();
      }, 150);
    }
  }, [isOpen, editingReport, currentUser]);


  // Helper: Automatically resolve IMO Office based on spatial feature attributes, user assignment, or spatial bounds
  const resolveAutomaticImo = (lat?: number, lng?: number): string => {
    // 1. Check if layers or nearest feature has IMO or locationName keywords
    if (lat !== undefined && lng !== undefined) {
      const feat = detectNearestGISFeature(lat, lng, layers);
      if (feat.locationName) {
        const lower = feat.locationName.toLowerCase();
        if (lower.includes('palawan') || lower.includes('malatgao') || lower.includes('batang-batang') || lower.includes('ibato') || lower.includes('iraan')) {
          return 'Palawan IMO';
        }
        if (lower.includes('occidental') || lower.includes('caguray') || lower.includes('lumintao') || lower.includes('mongpong') || lower.includes('amnay') || lower.includes('pagbahan')) {
          return 'Occidental Mindoro IMO';
        }
        if (lower.includes('oriental') || lower.includes('momaro') || lower.includes('baco') || lower.includes('bucayao') || lower.includes('mag-asawang') || lower.includes('pula') || lower.includes('bansud') || lower.includes('bongabong') || lower.includes('cantingas')) {
          return 'Mindoro Oriental-Marinduque-Romblon IMO';
        }
      }
    }

    if (activeImo && activeImo !== 'All IMOs' && activeImo !== 'Regional Office IV-B' && activeImo !== 'Regional Office') {
      return activeImo;
    }
    if (lat !== undefined && lng !== undefined) {
      if (lat < 11.8 && lng < 120.0) return 'Palawan IMO';
      if (lng <= 120.9 && lat >= 12.0 && lat <= 14.0) return 'Occidental Mindoro IMO';
      if (lng > 120.9 && lat >= 12.0 && lat <= 14.0) return 'Mindoro Oriental-Marinduque-Romblon IMO';
    }
    if (currentImo && currentImo !== 'All IMOs') return currentImo;
    return 'Palawan IMO';
  };

  // Nearest GIS Feature at Point 1 (for spatial attribution)
  const nearestGISFeature = useMemo(() => {
    if (lat1 !== undefined && lng1 !== undefined && layers && layers.length > 0) {
      return detectNearestGISFeature(lat1, lng1, layers);
    }
    return null;
  }, [lat1, lng1, layers]);

  // Automatically resolve the canonical NIS name based on detected feature, location name, canal segment, or active filter
  const resolvedNisName = useMemo(() => {
    if (nearestGISFeature?.nis) {
      const canon = resolveCanonicalNis(nearestGISFeature.nis);
      if (canon) return canon;
    }
    if (detectedLocationName) {
      const canon = resolveCanonicalNis(detectedLocationName);
      if (canon) return canon;
    }
    if (detectedCanalCode) {
      const canon = resolveCanonicalNis(detectedCanalCode);
      if (canon) return canon;
    }
    if (activeNis && activeNis !== 'All NIS' && activeNis !== 'All') {
      const canon = resolveCanonicalNis(activeNis);
      if (canon) return canon || activeNis;
    }
    return undefined;
  }, [nearestGISFeature, detectedLocationName, detectedCanalCode, activeNis]);

  const resolvedImoName = useMemo(() => {
    if (nearestGISFeature?.imo) return nearestGISFeature.imo;
    return resolveAutomaticImo(lat1, lng1);
  }, [nearestGISFeature, lat1, lng1, activeImo, currentImo, layers]);

  // Compute available and dynamically filtered Irrigators Associations for current NIS & IMO
  const availableIAs = useMemo(() => {
    return getIAsForContext(resolvedImoName, resolvedNisName);
  }, [resolvedImoName, resolvedNisName]);

  const filteredIAsList = useMemo(() => {
    if (!iaSearchQuery.trim()) return availableIAs;
    const q = iaSearchQuery.toLowerCase();
    return availableIAs.filter(ia => 
      ia.name.toLowerCase().includes(q) || 
      ia.nis.toLowerCase().includes(q)
    );
  }, [availableIAs, iaSearchQuery]);

  // Multiple Photos with Before / During / After stages
  const [photos, setPhotos] = useState<PhotoAttachment[]>([]);
  const [remarks, setRemarks] = useState('');
  const [showPhotoGuideModal, setShowPhotoGuideModal] = useState(false);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [previewPhotoIndex, setPreviewPhotoIndex] = useState<number | null>(null);

  // Validation Alarm State
  const [touchedSubmit, setTouchedSubmit] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Click outside listener for real-time IA combobox dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (iaComboboxRef.current && !iaComboboxRef.current.contains(e.target as Node)) {
        setIsIaDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset form helper
  const resetForm = () => {
    try { sessionStorage.removeItem('om_active_report_draft'); } catch (_) {}
    setMaintenanceActivity('');
    setCustomActivity('');
    const savedReporter = (() => {
      try { return localStorage.getItem('nia_saved_reporter_name') || ''; } catch (_) { return ''; }
    })();
    setReporterName(savedReporter);
    setGuidedStep(savedReporter ? 'activity' : 'reporter');
    setPerformedByList(['IMO']);
    setPerformedByIA('');
    setPerformedByOthers('');
    setIaSearchQuery('');
    setIsIaDropdownOpen(false);
    setIsSpecifyingCustomIA(false);
    setOperationalState('Fully Operational');
    setWaterLevelMeters(2.45);
    setDischargeFlowM3s(12.5);
    setGateOpeningCm(85);
    setWaterQuality('Clear / Optimal');
    setBeneficiaryServiceArea('');
    setOperationalIncident('');
    setLat1(undefined);
    setLng1(undefined);
    setLat2(undefined);
    setLng2(undefined);
    setDepthMeters('');
    setWidthMeters('');
    setSandPileHeightMeters('');
    setPaintedAreaSqm('');
    setDetectedLocationName('');
    setDetectedCanalCode(undefined);
    setDetectedParcelId(undefined);
    setDetectedPathCoords(undefined);
    setStatus('');
    setReporterName('');
    setPhotos([]);
    setRemarks('');
    setTouchedSubmit(false);
    setValidationErrors([]);
  };

  // Restore draft from sessionStorage on initial load (only for new reports)
  useEffect(() => {
    if (!editingReport) {
      try {
        const saved = sessionStorage.getItem('om_active_report_draft');
        if (saved) {
          const d = JSON.parse(saved);
          if (d.categoryMode) setCategoryMode(d.categoryMode);
          if (d.maintenanceActivity) setMaintenanceActivity(d.maintenanceActivity);
          if (d.customActivity) setCustomActivity(d.customActivity);
          if (Array.isArray(d.performedByList) && d.performedByList.length > 0) setPerformedByList(d.performedByList);
          if (d.performedByIA) {
            setPerformedByIA(d.performedByIA);
            setIaSearchQuery(d.performedByIA);
          }
          if (d.performedByOthers) setPerformedByOthers(d.performedByOthers);
          if (d.operationalState) setOperationalState(d.operationalState);
          if (d.waterLevelMeters !== undefined) setWaterLevelMeters(d.waterLevelMeters);
          if (d.dischargeFlowM3s !== undefined) setDischargeFlowM3s(d.dischargeFlowM3s);
          if (d.gateOpeningCm !== undefined) setGateOpeningCm(d.gateOpeningCm);
          if (d.waterQuality) setWaterQuality(d.waterQuality);
          if (d.beneficiaryServiceArea) setBeneficiaryServiceArea(d.beneficiaryServiceArea);
          if (d.operationalIncident) setOperationalIncident(d.operationalIncident);
          if (d.reporterName) setReporterName(d.reporterName);
          if (d.remarks) setRemarks(d.remarks);
          if (Array.isArray(d.photos) && d.photos.length > 0) setPhotos(d.photos);
          if (d.status) setStatus(d.status);
          if (d.suspensionReason) setSuspensionReason(d.suspensionReason);
          if (d.depthMeters !== undefined && d.depthMeters !== '') setDepthMeters(d.depthMeters);
          if (d.widthMeters !== undefined && d.widthMeters !== '') setWidthMeters(d.widthMeters);
          if (d.sandPileHeightMeters !== undefined && d.sandPileHeightMeters !== '') setSandPileHeightMeters(d.sandPileHeightMeters);
          if (d.paintedAreaSqm !== undefined && d.paintedAreaSqm !== '') setPaintedAreaSqm(d.paintedAreaSqm);
          if (d.lat1 !== undefined && initialLat === undefined) setLat1(d.lat1);
          if (d.lng1 !== undefined && initialLng === undefined) setLng1(d.lng1);
          if (d.lat2 !== undefined && initialLat2 === undefined) setLat2(d.lat2);
          if (d.lng2 !== undefined && initialLng2 === undefined) setLng2(d.lng2);
          if (d.locationMode) setLocationMode(d.locationMode);
        }
      } catch (err) {
        console.warn('Could not restore report draft:', err);
      }
    }
  }, []);

  // Save draft whenever state changes (only for new reports)
  useEffect(() => {
    if (!editingReport) {
      try {
        const draft = {
          categoryMode,
          maintenanceActivity,
          customActivity,
          performedByList,
          performedByIA,
          performedByOthers,
          operationalState,
          waterLevelMeters,
          dischargeFlowM3s,
          gateOpeningCm,
          waterQuality,
          beneficiaryServiceArea,
          operationalIncident,
          reporterName,
          remarks,
          photos,
          status,
          suspensionReason,
          depthMeters,
          widthMeters,
          sandPileHeightMeters,
          paintedAreaSqm,
          lat1,
          lng1,
          lat2,
          lng2,
          locationMode
        };
        sessionStorage.setItem('om_active_report_draft', JSON.stringify(draft));
      } catch (_) {}
    }
  }, [
    editingReport,
    categoryMode,
    maintenanceActivity,
    customActivity,
    performedByList,
    performedByIA,
    performedByOthers,
    operationalState,
    waterLevelMeters,
    dischargeFlowM3s,
    gateOpeningCm,
    waterQuality,
    beneficiaryServiceArea,
    operationalIncident,
    reporterName,
    remarks,
    photos,
    status,
    suspensionReason,
    depthMeters,
    widthMeters,
    sandPileHeightMeters,
    paintedAreaSqm,
    lat1,
    lng1,
    lat2,
    lng2,
    locationMode
  ]);

  // Update initial parameters when modal opens or props change (Supports New & Edit Modes)
  useEffect(() => {
    if (isOpen) {
      if (editingReport) {
        setCategoryMode(editingReport.categoryMode || (editingReport.reportType === 'operational' ? 'operational' : 'maintenance'));
        if (editingReport.maintenanceActivity) {
          if (MAINTENANCE_ACTIVITIES.includes(editingReport.maintenanceActivity as any)) {
            setMaintenanceActivity(editingReport.maintenanceActivity as MaintenanceActivityType);
            setCustomActivity('');
          } else {
            setMaintenanceActivity('Other Repair / Maintenance');
            setCustomActivity(editingReport.maintenanceActivity);
          }
        }
        if (Array.isArray(editingReport.performedByList) && editingReport.performedByList.length > 0) {
          setPerformedByList(editingReport.performedByList);
        } else if (editingReport.performedBy) {
          if (Array.isArray(editingReport.performedBy)) {
            setPerformedByList(editingReport.performedBy as any);
          } else if (typeof editingReport.performedBy === 'string') {
            const parts = editingReport.performedBy.split(',').map(s => s.trim()) as ('IMO' | 'IA' | 'Others')[];
            const valid = parts.filter(p => ['IMO', 'IA', 'Others'].includes(p));
            setPerformedByList(valid);
          } else {
            setPerformedByList([]);
          }
        } else {
          setPerformedByList([]);
        }
        if (editingReport.performedByIA) {
          setPerformedByIA(editingReport.performedByIA);
          setIaSearchQuery(editingReport.performedByIA);
        } else if (editingReport.performedByDetails && (editingReport.performedBy === 'IA' || (typeof editingReport.performedBy === 'string' && editingReport.performedBy.includes('IA')))) {
          setPerformedByIA(editingReport.performedByDetails);
          setIaSearchQuery(editingReport.performedByDetails);
        } else {
          setPerformedByIA('');
          setIaSearchQuery('');
        }
        if (editingReport.performedByDetails && (editingReport.performedBy === 'Others' || (typeof editingReport.performedBy === 'string' && editingReport.performedBy.includes('Others')))) {
          setPerformedByOthers(editingReport.performedByDetails);
        } else {
          setPerformedByOthers('');
        }
        if (editingReport.operationalState) setOperationalState(editingReport.operationalState);
        if (editingReport.waterLevelMeters !== undefined) setWaterLevelMeters(editingReport.waterLevelMeters);
        if (editingReport.dischargeFlowM3s !== undefined) setDischargeFlowM3s(editingReport.dischargeFlowM3s);
        if (editingReport.gateOpeningCm !== undefined) setGateOpeningCm(editingReport.gateOpeningCm);
        if (editingReport.waterQuality) setWaterQuality(editingReport.waterQuality);
        if (editingReport.beneficiaryServiceArea) setBeneficiaryServiceArea(editingReport.beneficiaryServiceArea);
        if (editingReport.operationalIncident) setOperationalIncident(editingReport.operationalIncident);

        setLat1(editingReport.lat);
        setLng1(editingReport.lng);
        setLat2(editingReport.secondLat);
        setLng2(editingReport.secondLng);
        setLocationMode(editingReport.secondLat !== undefined && editingReport.secondLng !== undefined ? 'double' : 'single');

        setDepthMeters(typeof editingReport.depthMeters === 'number' ? editingReport.depthMeters : '');
        setWidthMeters(typeof editingReport.widthMeters === 'number' ? editingReport.widthMeters : '');
        setSandPileHeightMeters(typeof editingReport.sandPileHeightMeters === 'number' ? editingReport.sandPileHeightMeters : '');
        setPaintedAreaSqm(typeof editingReport.paintedAreaSqm === 'number' ? editingReport.paintedAreaSqm : '');

        setDetectedLocationName(editingReport.locationName || '');
        setDetectedCanalCode(editingReport.canalSegment);
        setDetectedParcelId(editingReport.parcelId);
        setDetectedPathCoords(editingReport.pathCoords);

        setStatus(editingReport.status as any || 'In Progress');
        setSuspensionReason(editingReport.suspensionReason || '');
        setReporterName(editingReport.reporterName || '');
        setReporterDesignation(editingReport.reporterDesignation || (() => { try { return localStorage.getItem('nia_saved_reporter_designation') || 'NIS In-Charge'; } catch (_) { return 'NIS In-Charge'; } })());
        setVerifierName(editingReport.verifierName || (() => { try { return localStorage.getItem('nia_saved_supervisor_name') || ''; } catch (_) { return ''; } })());
        setVerifierDesignation(editingReport.verifierDesignation || (() => { try { return localStorage.getItem('nia_saved_supervisor_designation') || ''; } catch (_) { return ''; } })());
        setRemarks(editingReport.remarks || '');
        setPhotos(editingReport.photos || (editingReport.photoUrl ? [{ id: 'p1', url: editingReport.photoUrl, stage: 'During' }] : []));
      } else {
        if (initialReportType) setCategoryMode(initialReportType);
        if (initialLat !== undefined && initialLng !== undefined) {
          setLat1(initialLat);
          setLng1(initialLng);
          setDetectedCanalCode(initialCanalSegment);
          setDetectedParcelId(initialParcelId);

          if (initialLat2 !== undefined && initialLng2 !== undefined) {
            setLat2(initialLat2);
            setLng2(initialLng2);
            setLocationMode('double');
          } else {
            setLat2(undefined);
            setLng2(undefined);
            setLocationMode('single');
          }
          setLocationSource(prev => (prev === 'photo_exif' ? 'photo_exif' : 'manual_picker'));
        }
      }
    }
  }, [isOpen, editingReport, initialReportType, initialLat, initialLng, initialLat2, initialLng2, initialCanalSegment, initialParcelId]);

  // Recalculate GIS detection when coordinates or mode changes
  useEffect(() => {
    if (lat1 !== undefined && lng1 !== undefined) {
      if (locationMode === 'single') {
        const feat = detectNearestGISFeature(lat1, lng1, layers);
        setDetectedLocationName(feat.locationName);
        const resolvedCode = (!isSyntheticFeatureId(feat.canalCode) && feat.canalCode) || (!isSyntheticFeatureId(initialCanalSegment) && initialCanalSegment) || undefined;
        setDetectedCanalCode(resolvedCode);
        const resolvedParcel = (!isSyntheticFeatureId(feat.parcelId) && feat.parcelId) || (!isSyntheticFeatureId(initialParcelId) && initialParcelId) || undefined;
        setDetectedParcelId(resolvedParcel);
        setDetectedPathCoords([[feat.snappedCoords[0], feat.snappedCoords[1]]]);
      } else if (lat2 !== undefined && lng2 !== undefined) {
        const pathRes = calculateCanalPathBetweenPoints(
          { lat: lat1, lng: lng1 },
          { lat: lat2, lng: lng2 },
          layers
        );
        setDetectedLocationName(pathRes.locationName);
        const resolvedCode = (!isSyntheticFeatureId(pathRes.canalCode) && pathRes.canalCode) || (!isSyntheticFeatureId(initialCanalSegment) && initialCanalSegment) || undefined;
        setDetectedCanalCode(resolvedCode);
        const resolvedParcel = (!isSyntheticFeatureId(pathRes.parcelId) && pathRes.parcelId) || (!isSyntheticFeatureId(initialParcelId) && initialParcelId) || undefined;
        setDetectedParcelId(resolvedParcel);
        setDetectedPathCoords(pathRes.pathCoords);
      }
    } else {
      setDetectedLocationName('');
      if (!initialCanalSegment) setDetectedCanalCode(undefined);
      if (!initialParcelId) setDetectedParcelId(undefined);
      setDetectedPathCoords(undefined);
    }
  }, [lat1, lng1, lat2, lng2, locationMode, layers, initialCanalSegment, initialParcelId]);

  const segmentDistanceMeters = React.useMemo(() => {
    if (lat1 !== undefined && lng1 !== undefined && lat2 !== undefined && lng2 !== undefined) {
      if (detectedPathCoords && detectedPathCoords.length > 1) {
        let total = 0;
        for (let i = 0; i < detectedPathCoords.length - 1; i++) {
          total += haversineDistanceMeters(
            detectedPathCoords[i][0], detectedPathCoords[i][1],
            detectedPathCoords[i+1][0], detectedPathCoords[i+1][1]
          );
        }
        return Math.round(total);
      }
      return Math.round(haversineDistanceMeters(lat1, lng1, lat2, lng2));
    }
    return 0;
  }, [lat1, lng1, lat2, lng2, detectedPathCoords]);

  const segmentDistanceFormatted = React.useMemo(() => {
    if (segmentDistanceMeters <= 0) return '';
    if (segmentDistanceMeters >= 1000) {
      return `${(segmentDistanceMeters / 1000).toFixed(2)} km (${segmentDistanceMeters.toLocaleString()} m)`;
    }
    return `${segmentDistanceMeters.toLocaleString()} meters`;
  }, [segmentDistanceMeters]);

  const requiresVolumeEstimator = categoryMode === 'maintenance' && 
    locationMode === 'double' &&
    lat1 !== undefined && lng1 !== undefined &&
    lat2 !== undefined && lng2 !== undefined &&
    segmentDistanceMeters > 0 &&
    Boolean(
      maintenanceActivity && (
        maintenanceActivity.includes('Desilting') ||
        maintenanceActivity.includes('Service Road') ||
        maintenanceActivity.includes('dredging') ||
        maintenanceActivity.includes('Brush Dam') ||
        maintenanceActivity.includes('Brass dam') ||
        maintenanceActivity.includes('Painting')
      )
    );

  // Context-Aware dynamic photo caption context
  const photoCaptionContext: CaptionContext = useMemo(() => ({
    canalSegment: detectedCanalCode || initialCanalSegment || detectedLocationName || (resolvedNisName ? `${resolvedNisName} Main Canal` : 'Main Canal'),
    locationName: detectedLocationName || resolvedNisName,
    maintenanceActivity: categoryMode === 'maintenance' ? maintenanceActivity : operationalState,
    operationalState,
    segmentDistanceMeters: segmentDistanceMeters > 0 ? segmentDistanceMeters : undefined,
    performedByList,
    performedByIA,
    performedByOthers,
    equipmentType: 'excavator',
    wrfoName: verifierName || 'WRFO',
    nisName: resolvedNisName || 'NIS',
    imoName: resolvedImoName || 'IMO',
    targetDate: new Date().toISOString(),
    status: status || 'In Progress'
  }), [
    detectedCanalCode,
    initialCanalSegment,
    detectedLocationName,
    resolvedNisName,
    categoryMode,
    maintenanceActivity,
    operationalState,
    segmentDistanceMeters,
    performedByList,
    performedByIA,
    performedByOthers,
    verifierName,
    resolvedImoName,
    status
  ]);

  // Sanitizer: Strip meaningless punctuation, symbols, brackets, quotes, colons, and markdown
  const sanitizeRemarksText = (raw: string): string => {
    if (!raw || typeof raw !== 'string') return '';
    let text = raw.trim();

    // Strip markdown formatting symbols (*, _, #, ~, `, |, •, \)
    text = text.replace(/[*#_~`|•\\]/g, '');
    text = text.replace(/\[\s*(.*?)\s*\]/g, '$1');
    text = text.replace(/\{\s*(.*?)\s*\}/g, '$1');

    // Strip artificial label prefixes
    text = text.replace(/^(Technical Remarks|Remarks|Field Notes|Executive Summary|Narrative|Status|Notes|Observation|Observations):\s*/gim, '');
    text = text.replace(/\b(Notes|Status|Spoil disposal|Servicing scope|Materials|Operational check|Impact):\s*/gi, '');

    // Strip redundant parenthetical status/completion tags
    text = text.replace(/\(\s*\d+%\s*(physical\s+completion)?\s*\)/gi, '');
    text = text.replace(/\(\s*(In Progress|Completed|Suspended)\s*\)/gi, '');
    text = text.replace(/\(\s*\)/g, '');

    // Strip artificial quotes
    text = text.replace(/["“”'']/g, '');

    // Normalize spacing and standard sentence punctuation
    text = text.replace(/\s+/g, ' ');
    text = text.replace(/\s*([,.;:])\s*/g, '$1 ');
    text = text.replace(/\.{2,}/g, '.');
    text = text.replace(/,\s*\./g, '.');
    text = text.replace(/\s+([,.;])/g, '$1');

    return text.trim();
  };

  // Baseline deterministic generator (applied automatically by default)
  const generateBaselineRemarks = () => {
    const act = (categoryMode === 'maintenance' ? maintenanceActivity : operationalState) || 'Maintenance operations';
    const cleanCanal = (!isSyntheticFeatureId(detectedCanalCode) && detectedCanalCode) ||
      (!isSyntheticFeatureId(initialCanalSegment) && initialCanalSegment) ||
      (!isSyntheticFeatureId(detectedLocationName) && detectedLocationName) ||
      (resolvedNisName ? `${resolvedNisName} Main Canal` : 'main canal reach');

    let performer = 'by field maintenance personnel';
    if (performedByIA && performedByIA.trim()) {
      performer = `in coordination with ${performedByIA.trim()}`;
    } else if (Array.isArray(performedByList) && performedByList.length > 0) {
      if (performedByList.includes('IMO') && performedByList.length === 1) {
        performer = 'by the IMO workforce';
      } else if (performedByList.includes('Others') && performedByOthers.trim()) {
        performer = `by ${performedByOthers.trim()}`;
      } else {
        performer = `by ${performedByList.join(' and ')}`;
      }
    }

    const isCompleted = status === 'Completed';
    const statusVerb = isCompleted ? 'was completed' : 'is in progress';

    const d = typeof depthMeters === 'number' ? depthMeters : 0;
    const w = typeof widthMeters === 'number' ? widthMeters : 0;
    const h = typeof sandPileHeightMeters === 'number' ? sandPileHeightMeters : 0;
    let estVolume = 0;
    if (d > 0 && w > 0 && segmentDistanceMeters > 0) {
      estVolume = Number((segmentDistanceMeters * d * w).toFixed(2));
    } else if (h > 0 && segmentDistanceMeters > 0) {
      estVolume = Number((1.43 * h * h * segmentDistanceMeters).toFixed(2));
    } else if (typeof editingReport?.desiltingVolumeM3 === 'number') {
      estVolume = editingReport.desiltingVolumeM3;
    }

    const vol = estVolume > 0 ? `${estVolume.toLocaleString()} m³` : '';
    const dist = segmentDistanceMeters > 0 ? `${Math.round(segmentDistanceMeters)} meters` : '';

    let sentence = '';
    if (categoryMode === 'operational') {
      const gHeight = typeof waterLevelMeters === 'number' ? `${waterLevelMeters}m gauge height` : '';
      const dFlow = typeof dischargeFlowM3s === 'number' ? `${dischargeFlowM3s} m³/s discharge flow` : '';
      const sArea = beneficiaryServiceArea.trim() ? `serving ${beneficiaryServiceArea.trim()}` : '';
      const parts = [gHeight, dFlow, sArea].filter(Boolean).join(', ');
      sentence = `Operational inspection was recorded at ${cleanCanal} with ${parts || 'regular discharge levels'} maintaining irrigation delivery.`;
    } else if (act.toLowerCase().includes('desilt') || act.toLowerCase().includes('clearing')) {
      if (vol && dist) {
        sentence = `Desilting and canal clearing ${statusVerb} along ${cleanCanal} ${performer}, removing ${vol} of sediment across a ${dist} reach to restore design flow capacity.`;
      } else if (vol) {
        sentence = `Desilting operations ${statusVerb} along ${cleanCanal} ${performer}, excavating ${vol} of silt to restore canal cross-section.`;
      } else if (dist) {
        sentence = `Canal clearing ${statusVerb} along ${dist} of ${cleanCanal} ${performer} to restore unobstructed conveyance.`;
      } else {
        sentence = `Desilting and clearing operations ${statusVerb} along ${cleanCanal} ${performer}.`;
      }
    } else if (act.toLowerCase().includes('painting')) {
      const area = typeof paintedAreaSqm === 'number' && paintedAreaSqm > 0 ? `covering ${paintedAreaSqm.toLocaleString()} m² of surfaces ` : '';
      sentence = `Protective painting works ${statusVerb} ${area}along ${cleanCanal} ${performer}.`;
    } else if (act.toLowerCase().includes('service road')) {
      const distStr = dist ? `across ${dist} ` : '';
      sentence = `Service road maintenance and roadway leveling ${statusVerb} ${distStr}along ${cleanCanal} ${performer}.`;
    } else if (act.toLowerCase().includes('gate') || act.toLowerCase().includes('dam') || act.toLowerCase().includes('intake')) {
      sentence = `Control structure servicing and gate maintenance ${statusVerb} at ${cleanCanal} ${performer}.`;
    } else {
      sentence = `${act} ${statusVerb} along ${cleanCanal} ${performer}.`;
    }

    return sanitizeRemarksText(sentence);
  };



  // Locate current position using device GPS
  const handleLocateCurrentPosition = (pointIndex: 1 | 2) => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (pointIndex === 1) {
            setLat1(pos.coords.latitude);
            setLng1(pos.coords.longitude);
          } else {
            setLat2(pos.coords.latitude);
            setLng2(pos.coords.longitude);
          }
        },
        (err) => {
          console.warn('Geolocation error:', err);
          alert('Unable to retrieve current position. Please ensure location permissions are enabled.');
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    }
  };

  // Image compressor helper (resizes to max 1600px, 0.82 JPEG quality for optimal upload reliability)
  const compressImage = (dataUrl: string, maxWidth = 1600, quality = 0.82): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxWidth || height > maxWidth) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxWidth) / height);
            height = maxWidth;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        } else {
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  };

  // Helper: compute dynamic stage labels sequentially in array order (Before #1, During #1, After #1, Before #2, During #2, etc.)
  const getPhotoStageLabel = (photoId: string, photosList: PhotoAttachment[]): string => {
    let beforeCounter = 0;
    let duringCounter = 0;
    let afterCounter = 0;

    for (const p of photosList) {
      const stage = p.stage || 'During';
      if (stage === 'Before') beforeCounter++;
      else if (stage === 'During') duringCounter++;
      else if (stage === 'After') afterCounter++;

      if (p.id === photoId) {
        if (stage === 'Before') return `Before #${beforeCounter}`;
        if (stage === 'During') return `During #${duringCounter}`;
        if (stage === 'After') return `After #${afterCounter}`;
      }
    }
    return 'Inspection Photo';
  };

  const handleMovePhotoUp = (index: number) => {
    if (index <= 0) return;
    setPhotos(prev => {
      const updated = [...prev];
      const temp = updated[index - 1];
      updated[index - 1] = updated[index];
      updated[index] = temp;
      return updated;
    });
  };

  const handleMovePhotoDown = (index: number) => {
    setPhotos(prev => {
      if (index >= prev.length - 1) return prev;
      const updated = [...prev];
      const temp = updated[index + 1];
      updated[index + 1] = updated[index];
      updated[index] = temp;
      return updated;
    });
  };

  const handleReorderPhotos = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
    setPhotos(prev => {
      if (fromIndex >= prev.length || toIndex >= prev.length) return prev;
      const updated = [...prev];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      return updated;
    });
  };

  // Add photo file upload with automatic compression & EXIF metadata GPS / date extraction
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const filesArray: File[] = Array.from(files);
    const newPhotosList: PhotoAttachment[] = [];

    for (let index = 0; index < filesArray.length; index++) {
      const file: File = filesArray[index];
      let photoDateStr = file.lastModified 
        ? new Date(file.lastModified).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
        : new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });

      let photoGpsLat: number | undefined = undefined;
      let photoGpsLng: number | undefined = undefined;

      try {
        const gps = await exifr.gps(file);
        if (gps && typeof gps.latitude === 'number' && typeof gps.longitude === 'number' && !isNaN(gps.latitude) && !isNaN(gps.longitude)) {
          photoGpsLat = gps.latitude;
          photoGpsLng = gps.longitude;
        }
        const exifDates = await exifr.parse(file, ['DateTimeOriginal', 'CreateDate']);
        if (exifDates?.DateTimeOriginal) {
          photoDateStr = new Date(exifDates.DateTimeOriginal).toLocaleString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true
          });
        }
      } catch (exifErr) {
        console.warn('EXIF GPS extraction error for photo:', exifErr);
      }

      const compressedUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = async (event) => {
          if (event.target?.result) {
            const rawUrl = event.target.result as string;
            const compressed = await compressImage(rawUrl);
            resolve(compressed);
          } else {
            resolve('');
          }
        };
        reader.onerror = () => resolve('');
        reader.readAsDataURL(file);
      });

      if (compressedUrl) {
        newPhotosList.push({
          id: `photo-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 6)}`,
          url: compressedUrl,
          stage: 'During', // Default initial stage
          capturedAt: photoDateStr,
          lat: photoGpsLat,
          lng: photoGpsLng
        });
      }
    }

    if (newPhotosList.length === 0) return;

    setPhotos(prevPhotos => {
      const combinedPhotos = [...prevPhotos, ...newPhotosList];

      // Location hierarchy resolution:
      // Hierarchy: selected manually on location selector mode > pre-selected location before creating report > location detected on photo metadata
      if (locationSource === 'none' || locationSource === 'photo_exif') {
        const validGpsPhotos = combinedPhotos.filter(
          p => typeof p.lat === 'number' && typeof p.lng === 'number' && !isNaN(p.lat) && !isNaN(p.lng)
        );

        if (validGpsPhotos.length === 1) {
          setLat1(validGpsPhotos[0].lat);
          setLng1(validGpsPhotos[0].lng);
          setLocationSource('photo_exif');
        } else if (validGpsPhotos.length >= 2) {
          // Find the 2 points that are farthest from each other
          let maxDist = -1;
          let p1 = validGpsPhotos[0];
          let p2 = validGpsPhotos[1];

          for (let i = 0; i < validGpsPhotos.length; i++) {
            for (let j = i + 1; j < validGpsPhotos.length; j++) {
              const dist = haversineDistanceMeters(
                validGpsPhotos[i].lat!, validGpsPhotos[i].lng!,
                validGpsPhotos[j].lat!, validGpsPhotos[j].lng!
              );
              if (dist > maxDist) {
                maxDist = dist;
                p1 = validGpsPhotos[i];
                p2 = validGpsPhotos[j];
              }
            }
          }

          setLat1(p1.lat);
          setLng1(p1.lng);
          setLat2(p2.lat);
          setLng2(p2.lng);
          setLocationMode('double');
          setLocationSource('photo_exif');
        }
      }

      return combinedPhotos;
    });

    e.target.value = '';
  };

  const handleUpdatePhotoStage = (photoId: string, stage: 'Before' | 'During' | 'After') => {
    setPhotos(prev => prev.map(p => p.id === photoId ? { ...p, stage } : p));
  };

  const handleRemovePhoto = (photoId: string) => {
    setPhotos(prev => prev.filter(p => p.id !== photoId));
  };

  const handleAutoComposeRemarks = (force = false) => {
    if (!force && isRemarksUserModified && remarks.trim().length > 0) return;
    const locSummary = detectedLocationName || detectedCanalCode || '';
    const generated = composeTechnicalRemarks({
      categoryMode,
      maintenanceActivity,
      customActivity,
      nisName: activeNis || editingReport?.nisBinding,
      imoName: activeImo || currentImo || editingReport?.imoOffice,
      canalSegment: detectedCanalCode,
      locationName: locSummary,
      lat: lat1,
      lng: lng1,
      lat2: locationMode === 'double' ? lat2 : undefined,
      lng2: locationMode === 'double' ? lng2 : undefined,
      distanceMeters: segmentDistanceMeters,
      performedByList,
      performedByIA,
      performedByOthers,
      status,
      suspensionReason,
      photos,
      reporterName,
      reporterRole: currentRole
    });
    if (generated) {
      setRemarks(generated);
    }
  };

  // Validate form fields (Remarks / Notes is OPTIONAL)
  const validateForm = (): string[] => {
    const errors: string[] = [];

    // 1. Map Location
    if (lat1 === undefined || lng1 === undefined) {
      errors.push('Map Location (Click "Choose on Map" or "My Location")');
    }

    // 2. Category specific
    if (categoryMode === 'maintenance') {
      if (!maintenanceActivity) {
        errors.push('Maintenance / Repair Activity');
      }
      if ((maintenanceActivity === 'Other Repair / Maintenance' || (maintenanceActivity as string) === 'Other Repair/Maintenance (specify)') && !customActivity.trim()) {
        errors.push('Custom Repair Activity Details');
      }
      if (performedByList.length === 0) {
        errors.push('Performed by (Select at least one option: IMO, IA, or Others)');
      }
      if (performedByList.includes('IA') && (!performedByIA.trim() || performedByIA === '__custom__')) {
        errors.push("Irrigators' Association (IA) Selection / Name");
      }
      if (performedByList.includes('Others') && !performedByOthers.trim()) {
        errors.push('Specified Other Entity / Contractor');
      }
    } else {
      if (!operationalState) {
        errors.push('Facility Operational State');
      }
      if (waterLevelMeters === undefined || isNaN(waterLevelMeters)) {
        errors.push('Water Gauge Height');
      }
      if (dischargeFlowM3s === undefined || isNaN(dischargeFlowM3s)) {
        errors.push('Current Discharge Flow');
      }
      if (gateOpeningCm === undefined || isNaN(gateOpeningCm)) {
        errors.push('Control Gate Opening');
      }
      if (!beneficiaryServiceArea.trim()) {
        errors.push('Target Service Area / Beneficiaries');
      }
      if (!operationalIncident.trim()) {
        errors.push('Operational Issue / Incident Log');
      }
    }

    // 3. Status (Required selection)
    if (!status) {
      errors.push('Final Work Status (Please select In Progress, Completed, or Suspended)');
    } else if (status === 'Suspended' && !suspensionReason.trim()) {
      errors.push('Suspension Reason / Justification (Required when status is Suspended)');
    }

    // 4. Reporter Name
    if (!reporterName.trim()) {
      errors.push("Reporter's Name");
    }

    // 5. Photos
    if (photos.length === 0) {
      errors.push('Site Inspection Photos (At least 1 photo required)');
    }

    return errors;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouchedSubmit(true);

    const errors = validateForm();
    setValidationErrors(errors);

    if (errors.length > 0) {
      const modalForm = document.getElementById('report-modal-form');
      if (modalForm) modalForm.scrollTop = 0;
      return;
    }

    const activityText = (maintenanceActivity === 'Other Repair / Maintenance' || (maintenanceActivity as string) === 'Other Repair/Maintenance (specify)')
      ? customActivity || 'Custom Maintenance Action'
      : maintenanceActivity;

    const locName = detectedLocationName || (lat1 && lng1 ? `Coords: ${lat1.toFixed(4)}, ${lng1.toFixed(4)}` : 'Irrigation Facility');

    const reportTitle = categoryMode === 'maintenance' 
      ? `${activityText} - ${locName}`
      : `Operational Check (${operationalState}) - ${locName}`;

    // Automatically route the report based on authenticated user assignment or spatial feature / GPS bounds
    const reportImoOffice = resolveAutomaticImo(lat1, lng1);
    const rawNis = resolvedNisName 
      || (nearestGISFeature?.nis && !/^\d+$/.test(String(nearestGISFeature.nis).trim()) ? nearestGISFeature.nis : undefined)
      || (activeNis && activeNis !== 'All NIS' && activeNis !== 'All' ? activeNis : undefined)
      || 'MIMAROPA RIS';
    const reportNisBinding = resolveCanonicalNis(rawNis) || rawNis;

    const cleanCanalSegment = detectedCanalCode && !/^\d+$/.test(String(detectedCanalCode).trim())
      ? detectedCanalCode
      : (detectedLocationName || initialCanalSegment || undefined);

    const isRevisionMode = Boolean(editingReport && editPermission.mode === 'create_revision');

    // Document Revision Tracking System
    const currentRev = typeof editingReport?.revisionNumber === 'number' ? editingReport.revisionNumber : 0;
    const nextRev = editingReport ? currentRev + 1 : 0;
    const history = Array.isArray(editingReport?.revisionHistory) ? [...editingReport.revisionHistory] : [];
    if (editingReport) {
      history.push({
        revisionNumber: nextRev,
        modifiedAt: new Date().toISOString(),
        modifiedBy: reporterName.trim()
      });
    }

    // Two-Tier Approval Pipeline Initial Status
    let initialApprovalStatus: 'Pending_PreApproval' | 'PreApproved' | 'Approved' = 'Pending_PreApproval';
    let preApprovedBy: string | undefined = undefined;
    let preApprovedAt: string | undefined = undefined;
    let approvedBy: string | undefined = undefined;
    let approvedAt: string | undefined = undefined;

    if (currentRole === 'IMO Reviewer' || currentRole === 'RO Reviewer' || currentRole === 'RO Preparer') {
      initialApprovalStatus = 'PreApproved';
      preApprovedBy = reporterName.trim();
      preApprovedAt = new Date().toISOString();
    } else if (currentRole === 'IMO Admin' || currentRole === 'IMO Evaluator' || currentRole === 'RO Admin' || currentRole === 'RO Evaluator' || currentRole === 'Developer') {
      initialApprovalStatus = 'Approved';
      approvedBy = reporterName.trim();
      approvedAt = new Date().toISOString();
    }

    const calculatedMeters = (locationMode === 'double' && segmentDistanceMeters > 0)
      ? segmentDistanceMeters
      : (editingReport?.segmentDistanceMeters || undefined);

    const calculatedFormatted = (locationMode === 'double' && segmentDistanceFormatted)
      ? segmentDistanceFormatted
      : (editingReport?.segmentDistanceFormatted || undefined);

    // Activity-Specific Physical Measurement & Dimension Calculations
    let calculatedVolume: number | undefined = undefined;
    let dimensionDetails: string | undefined = undefined;

    const isDesiltingOrRoad = activityText.includes('Desilting') || activityText.includes('Service Road');
    const isDredging = activityText.includes('dredging') || activityText.includes('Brass dam');
    const isPainting = activityText === 'Painting';

    if (isDesiltingOrRoad) {
      const d = typeof depthMeters === 'number' ? depthMeters : undefined;
      const w = typeof widthMeters === 'number' ? widthMeters : undefined;
      const dist = calculatedMeters || 0;
      if (d !== undefined && w !== undefined && dist > 0) {
        calculatedVolume = Number((dist * d * w).toFixed(2));
        dimensionDetails = `Depth: ${d}m, Width: ${w}m, Length: ${dist.toFixed(1)}m → Vol: ${calculatedVolume.toLocaleString()} m³`;
      } else if (d !== undefined && w !== undefined) {
        dimensionDetails = `Depth: ${d}m, Width: ${w}m`;
      }
    } else if (isDredging) {
      const h = typeof sandPileHeightMeters === 'number' ? sandPileHeightMeters : undefined;
      const dist = calculatedMeters || 0;
      if (h !== undefined && dist > 0) {
        // Formula: 1.43 * H^2 * Length
        calculatedVolume = Number((1.43 * h * h * dist).toFixed(2));
        dimensionDetails = `Sand Pile H: ${h}m, Length: ${dist.toFixed(1)}m → Earth Vol: ${calculatedVolume.toLocaleString()} m³`;
      } else if (h !== undefined) {
        dimensionDetails = `Sand Pile Height: ${h}m`;
      }
    } else if (isPainting) {
      const area = typeof paintedAreaSqm === 'number' ? paintedAreaSqm : undefined;
      if (area !== undefined) {
        dimensionDetails = `Accomplished Painting Area: ${area.toLocaleString()} m²`;
      }
    }

      const userSig = getUserSignatories(currentUser?.id, currentUser);
      const resolvedReporterDesignation = editingReport?.reporterDesignation || currentUser?.designation || userSig.inspectionReport.preparedByTitle || 'Water Resource Officer';
      const resolvedVerifierName = editingReport?.verifierName || userSig.inspectionReport.verifiedByName || 'AVE JANE V. ALVARADO';
      const resolvedVerifierDesignation = editingReport?.verifierDesignation || userSig.inspectionReport.verifiedByTitle || 'Supervising Engineer A';

      const newReport: FieldReport = {
        id: editingReport ? editingReport.id : generateWmrReportId(reportNisBinding, reportImoOffice),
        title: reportTitle,
        reportType: categoryMode === 'maintenance' ? 'maintenance' : 'operational',
        categoryMode,
        imoOffice: reportImoOffice,
        nisBinding: reportNisBinding,
        
        lat: lat1!,
        lng: lng1!,
        secondLat: (locationMode === 'double' && typeof lat2 === 'number') ? lat2 : undefined,
        secondLng: (locationMode === 'double' && typeof lng2 === 'number') ? lng2 : undefined,
        locationName: locName,
        pathCoords: detectedPathCoords,

        canalSegment: cleanCanalSegment,
        parcelId: detectedParcelId,

        segmentDistanceMeters: calculatedMeters,
        segmentDistanceFormatted: calculatedFormatted,
        depthMeters: typeof depthMeters === 'number' ? depthMeters : undefined,
        widthMeters: typeof widthMeters === 'number' ? widthMeters : undefined,
        sandPileHeightMeters: typeof sandPileHeightMeters === 'number' ? sandPileHeightMeters : undefined,
        paintedAreaSqm: typeof paintedAreaSqm === 'number' ? paintedAreaSqm : undefined,
        calculatedVolumeM3: calculatedVolume,
        dimensionDetailsFormatted: dimensionDetails || editingReport?.dimensionDetailsFormatted,

        maintenanceActivity: categoryMode === 'maintenance' ? activityText : undefined,
        performedBy: categoryMode === 'maintenance' ? (performedByList.length === 1 ? performedByList[0] : (performedByList.join(', ') as any)) : undefined,
        performedByList: categoryMode === 'maintenance' ? performedByList : undefined,
        performedByIA: categoryMode === 'maintenance' && performedByList.includes('IA') && performedByIA !== '__custom__' ? performedByIA.trim() : undefined,
        performedByDetails: categoryMode === 'maintenance'
          ? performedByList.map(opt => {
              if (opt === 'IMO') return `by ${resolvedImoName}`;
              if (opt === 'IA') return `by IA: ${(performedByIA !== '__custom__' ? performedByIA.trim() : '') || 'Irrigators Assn'}`;
              if (opt === 'Others') return `by Others: ${performedByOthers.trim() || 'External Entity'}`;
              return opt;
            }).join('; ')
          : undefined,

        operationalState: categoryMode === 'operational' ? operationalState : undefined,
        waterLevelMeters: categoryMode === 'operational' ? waterLevelMeters : undefined,
        dischargeFlowM3s: categoryMode === 'operational' ? dischargeFlowM3s : undefined,
        gateOpeningCm: categoryMode === 'operational' ? gateOpeningCm : undefined,
        waterQuality: categoryMode === 'operational' ? waterQuality : undefined,
        beneficiaryServiceArea: categoryMode === 'operational' ? beneficiaryServiceArea : undefined,
        operationalIncident: categoryMode === 'operational' ? operationalIncident : undefined,

        status: (status || 'Completed') as 'Completed' | 'In Progress' | 'Suspended',
        suspensionReason: status === 'Suspended' && suspensionReason.trim() ? suspensionReason.trim() : undefined,
        // Institutional Multi-Tier State Assignment
        currentTier: isRevisionMode
          ? 'Pending_IMO_Preparer'
          : (editingReport?.currentTier || ((currentRole === 'RO Evaluator' || currentRole === 'RO Admin') ? 'Approved_RO_Evaluator' : 'Pending_IMO_Preparer')),
        submittedByUserId: editingReport?.submittedByUserId || currentUser?.id,
        submittedByUsername: editingReport?.submittedByUsername || currentUser?.username,
        submittedByRole: editingReport?.submittedByRole || currentRole,

        approvalStatus: editingReport ? (isRevisionMode ? 'Pending_PreApproval' : (editingReport.approvalStatus || initialApprovalStatus)) : initialApprovalStatus,
        preApprovedBy: isRevisionMode ? undefined : (editingReport?.preApprovedBy || preApprovedBy),
        preApprovedAt: isRevisionMode ? undefined : (editingReport?.preApprovedAt || preApprovedAt),
        approvedBy: isRevisionMode ? undefined : (editingReport?.approvedBy || approvedBy),
        approvedAt: isRevisionMode ? undefined : (editingReport?.approvedAt || approvedAt),
        remarks: remarks || (categoryMode === 'maintenance' 
          ? `Maintenance activity performed efficiently along ${locName}.`
          : `Hydrological and operational inspection verified at ${locName}.`),
        
        reporterName: reporterName.trim(),
        reporterRole: editingReport ? editingReport.reporterRole : currentRole,
        reporterDesignation: resolvedReporterDesignation,
        verifierName: resolvedVerifierName,
        verifierDesignation: resolvedVerifierDesignation,
      revisionNumber: nextRev,
      revisionHistory: history,
      createdAt: editingReport ? editingReport.createdAt : new Date().toISOString(),
      synced: !isOffline,
      
      photos: photos.map(p => ({
        ...p,
        caption: (p.caption && p.caption.trim()) ? p.caption.trim() : getPhotoStageLabel(p.id, photos),
        stageLabel: getPhotoStageLabel(p.id, photos),
        imoOffice: reportImoOffice,
        locationName: locName,
        canalSegment: cleanCanalSegment,
        parcelId: detectedParcelId,
        lat: lat1,
        lng: lng1,
        capturedAt: p.capturedAt || new Date().toISOString()
      })),
      photoUrl: photos.length > 0 ? photos[0].url : undefined,
      completionPercent: status === 'Completed' ? 100 : (editingReport?.completionPercent || 50),
      desiltingVolumeM3: calculatedVolume !== undefined ? calculatedVolume : (editingReport?.desiltingVolumeM3 || 0)
    };

    // Attach Revisions Array
    if (isRevisionMode) {
      const existingRevisions = Array.isArray(editingReport?.revisions) && editingReport.revisions.length > 0
        ? [...editingReport.revisions]
        : [{
            revisionNumber: 1,
            createdAt: editingReport?.createdAt || new Date().toISOString(),
            createdBy: editingReport?.reporterName || 'Field Personnel',
            createdById: editingReport?.submittedByUserId,
            createdRole: editingReport?.submittedByRole || 'Field Personnel',
            changeSummary: 'Initial field submission',
            snapshot: { ...editingReport }
          }];

      existingRevisions.push({
        revisionNumber: nextRev,
        createdAt: new Date().toISOString(),
        createdBy: reporterName.trim(),
        createdById: currentUser?.id,
        createdRole: currentRole,
        changeSummary: revisionChangeSummary.trim() || `Revision v${nextRev} submitted`,
        snapshot: { ...newReport }
      });
      newReport.revisions = existingRevisions;
      newReport.activeRevisionNumber = nextRev;
    } else if (!editingReport) {
      newReport.revisions = [{
        revisionNumber: 1,
        createdAt: new Date().toISOString(),
        createdBy: reporterName.trim(),
        createdById: currentUser?.id,
        createdRole: currentRole,
        changeSummary: 'Initial field submission',
        snapshot: { ...newReport }
      }];
      newReport.activeRevisionNumber = 1;
    }

    try {
      localStorage.setItem('nia_saved_reporter_name', reporterName.trim());
      localStorage.setItem('nia_saved_reporter_designation', reporterDesignation.trim());
      localStorage.setItem('nia_saved_supervisor_name', verifierName.trim());
      localStorage.setItem('nia_saved_supervisor_designation', verifierDesignation.trim());
    } catch (_) {}

    setIsSubmittingReport(true);
    onSubmitReport(newReport);
    resetForm();
    onClose();
  };

  const isReporterMissing = touchedSubmit && !reporterName.trim();
  const isPhotosMissing = touchedSubmit && photos.length === 0;
  const isLocationMissing = touchedSubmit && (lat1 === undefined || lng1 === undefined);
  const isStatusMissing = touchedSubmit && !status;
  const isPerformedByMissing = touchedSubmit && categoryMode === 'maintenance' && (
    performedByList.length === 0 ||
    (performedByList.includes('IA') && (!performedByIA.trim() || performedByIA === '__custom__')) ||
    (performedByList.includes('Others') && !performedByOthers.trim())
  );
  const isCustomActivityMissing = touchedSubmit && categoryMode === 'maintenance' && (maintenanceActivity === 'Other Repair / Maintenance' || (maintenanceActivity as string) === 'Other Repair/Maintenance (specify)') && !customActivity.trim();
  const isServiceAreaMissing = touchedSubmit && categoryMode === 'operational' && !beneficiaryServiceArea.trim();
  const isIncidentMissing = touchedSubmit && categoryMode === 'operational' && !operationalIncident.trim();

  // 1-Glance Readiness States
  const isReporterReady = Boolean(reporterName.trim());
  const isActivityReady = categoryMode === 'maintenance'
    ? Boolean(maintenanceActivity) && (maintenanceActivity !== 'Other Repair / Maintenance' && (maintenanceActivity as string) !== 'Other Repair/Maintenance (specify)' || Boolean(customActivity.trim()))
    : Boolean(operationalState);
  const isPhotosReady = photos.length > 0;
  const isLocationReady = lat1 !== undefined && lng1 !== undefined;
  const isPerformedByReady = categoryMode === 'operational' || (
    performedByList.length > 0 &&
    (!performedByList.includes('IA') || Boolean(performedByIA.trim() && performedByIA !== '__custom__')) &&
    (!performedByList.includes('Others') || Boolean(performedByOthers.trim()))
  );
  const isStatusReady = Boolean(status);

  const isStep1Ready = isReporterReady && isActivityReady;
  const isStep2Ready = isPhotosReady;
  const isStep3Ready = isLocationReady;
  const isStep4Ready = isPerformedByReady && isStatusReady;

  const totalRequiredSteps = 4;
  const completedStepsCount = [
    isStep1Ready,
    isStep2Ready,
    isStep3Ready,
    isStep4Ready
  ].filter(Boolean).length;

  if (!isOpen && !isPickingLocation) return null;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto ${isPickingLocation ? 'hidden' : 'animate-in fade-in'}`}>
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800/90 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden my-auto">
        
        {/* Sticky Modal Header */}
        <div className="border-b border-slate-800/90 bg-slate-900/95 sticky top-0 z-20 backdrop-blur-md">
          <div className="flex items-center justify-between p-3.5 sm:p-4 pb-2.5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl border bg-cyan-500/10 text-cyan-400 border-cyan-500/30">
                {categoryMode === 'maintenance' ? <Wrench className="w-5 h-5" /> : <Activity className="w-5 h-5" />}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm sm:text-base font-bold text-white font-heading">
                    {editingReport
                      ? `Edit ${categoryMode === 'maintenance' ? 'Maintenance' : 'Operational'} Report`
                      : (categoryMode === 'maintenance' ? 'Irrigation Facility Maintenance Report' : 'Operational Status Report')}
                  </h2>
                  {editingReport && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-cyan-500/20 text-cyan-300 border-cyan-500/40">
                      Editing Mode
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400">
                  {categoryMode === 'maintenance' 
                    ? 'Record canal desilting, structural repairs, gate servicing & maintenance progress'
                    : 'Monitor discharge flow rates, gauge heights, gate openings & water distribution'}
                </p>
              </div>
            </div>
            <button 
              type="button"
              onClick={onClose} 
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
              title="Close window"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Multi-Tier Institutional Progress Banner (When Editing or Inspecting) */}
        {editingReport && (
          <div className="px-4 py-2.5 bg-slate-950/70 border-b border-slate-800 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
              <span className="text-slate-400 flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
                <span>Approval Stage: <strong className="text-white">{getTierLabel(effectiveTier)}</strong></span>
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full border ${getTierBadgeStyle(effectiveTier)}`}>
                Stage {TIER_CONFIG[effectiveTier]?.stageNumber || 1} of 7
              </span>
            </div>

            {/* Lock / Revision Notice */}
            {editPermission.mode === 'create_revision' && (
              <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-bold block text-amber-300">Direct Editing Locked — Revision Mode</span>
                  <p className="text-[11px] text-amber-200/90 leading-tight">
                    {editPermission.reason || 'Report has advanced to the next institutional tier. Submitting this form will record a new revision version.'}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Form Body */}
        <form id="report-modal-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-4">
          
          {/* Validation Alarm Prompt Banner */}
          {touchedSubmit && validationErrors.length > 0 && (
            <div className="p-3.5 bg-rose-950/80 border-2 border-rose-500/80 rounded-xl flex items-start gap-3 shadow-lg shadow-rose-950/50 animate-shake">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5 animate-bounce" />
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-rose-200 uppercase tracking-wide">
                  Form Incomplete — Please address missing items below:
                </h4>
                <ul className="list-disc list-inside text-[11px] text-rose-200 font-medium space-y-0.5">
                  {validationErrors.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Top Report Type Switcher (Consistent styling on the same level) */}
          <div className="bg-slate-950/80 p-1.5 rounded-xl border border-slate-800 grid grid-cols-2 gap-1.5 shadow-sm">
            <button
              type="button"
              onClick={() => setCategoryMode('maintenance')}
              className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer border ${
                categoryMode === 'maintenance'
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-900/40 border-cyan-400/40 font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border-transparent'
              }`}
            >
              <Wrench className="w-4 h-4" />
              <span>Maintenance Activity Report</span>
            </button>

            <button
              type="button"
              onClick={() => setCategoryMode('operational')}
              className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer border ${
                categoryMode === 'operational'
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-900/40 border-cyan-400/40 font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border-transparent'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>Operational Status Report</span>
            </button>
          </div>

          {/* ========================================================
              STEP 1: ACTIVITY & WORK CLASSIFICATION
              -> Guided Input with auto-focus & persistent cache
             ======================================================== */}
          <div className={`bg-slate-950/60 border rounded-2xl p-4 sm:p-5 space-y-4 transition-all duration-300 ${
            (guidedStep === 'reporter' || guidedStep === 'activity')
              ? 'border-cyan-500/70 shadow-lg shadow-cyan-950/40'
              : (isReporterMissing || isCustomActivityMissing || isServiceAreaMissing || isIncidentMissing) 
              ? 'border-rose-500/80 ring-2 ring-rose-500/30' 
              : 'border-slate-800/90'
          }`}>
            <div className="flex items-center justify-between gap-2.5 border-b border-slate-800/80 pb-2.5">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <span className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center shrink-0 transition ${
                  (guidedStep === 'reporter' || guidedStep === 'activity')
                    ? 'bg-cyan-500 text-slate-950 ring-2 ring-cyan-400/50 animate-pulse'
                    : 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                }`}>
                  1
                </span>
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2 truncate">
                    <Wrench className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span className="truncate">Activity &amp; Work Classification</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 truncate">
                    Specify work type, operational category, and reporter attribution
                  </p>
                </div>
              </div>
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border shrink-0 whitespace-nowrap ${
                isStep1Ready
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : (guidedStep === 'reporter' || guidedStep === 'activity')
                  ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 animate-pulse'
                  : 'bg-slate-900 text-slate-400 border-slate-800'
              }`}>
                {isStep1Ready ? '✓ Complete' : 'Step 1 of 5'}
              </span>
            </div>

            {/* Reporter Attribution */}
            <div className="space-y-2">
              {/* Reporter Name (Auto-focused on open, cached on device) */}
              <div className={`space-y-1.5 p-3 rounded-xl transition-all duration-300 ${
                guidedStep === 'reporter' ? 'bg-cyan-950/25 border border-cyan-500/50 ring-1 ring-cyan-500/30' : 'bg-slate-900/40 border border-slate-800'
              }`}>
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Reporter's Name</span>
                    <span className="text-amber-400 font-bold">*</span>
                  </label>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Access Role: <strong className="text-cyan-300">{currentRole}</strong>
                  </span>
                </div>
                <input
                  ref={reporterNameRef}
                  type="text"
                  placeholder="e.g. Engr. Juan Dela Cruz"
                  value={reporterName}
                  onChange={(e) => {
                    setReporterName(e.target.value);
                    try { localStorage.setItem('nia_saved_reporter_name', e.target.value); } catch (_) {}
                  }}
                  onBlur={() => {
                    if (reporterName.trim() && guidedStep === 'reporter') {
                      setGuidedStep('activity');
                    }
                  }}
                  className={`w-full bg-slate-900 border text-white text-xs p-2.5 rounded-xl focus:outline-none transition ${
                    isReporterMissing
                      ? 'border-rose-500 ring-2 ring-rose-500/40 bg-rose-950/20'
                      : guidedStep === 'reporter'
                      ? 'border-cyan-400 ring-2 ring-cyan-500/40'
                      : 'border-slate-700 focus:border-cyan-500'
                  }`}
                  required
                />
                <div className="flex items-center gap-1.5 text-[10.5px] text-slate-400 mt-1.5 pt-1 border-t border-slate-800/80">
                  <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span>Designations and supervisor signatories are managed in <strong>System Configurations &gt; Signatories</strong> for each report type.</span>
                </div>
              </div>
            </div>

            {/* Activity Selector */}
            <div className="pt-1">

              {/* Maintenance Activity Selector (Highlights next; shows prompt note) */}
              {categoryMode === 'maintenance' ? (
                <div className={`space-y-1.5 p-2.5 rounded-xl transition-all duration-300 ${
                  guidedStep === 'activity' ? 'bg-cyan-950/25 border border-cyan-500/50 ring-1 ring-cyan-500/30' : 'bg-transparent'
                }`}>
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Maintenance Activity Performed</span>
                    <span className="text-amber-400">*</span>
                  </label>
                  <select
                    ref={activitySelectRef}
                    value={maintenanceActivity}
                    onChange={(e) => {
                      const val = e.target.value as MaintenanceActivityType;
                      setMaintenanceActivity(val);
                      if (val) {
                        setGuidedStep('photos');
                        setTimeout(() => {
                          step2PhotosRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }, 150);
                      }
                    }}
                    className={`w-full bg-slate-900 border text-white text-xs p-2.5 rounded-xl focus:outline-none cursor-pointer transition ${
                      touchedSubmit && !maintenanceActivity
                        ? 'border-rose-500 ring-2 ring-rose-500/40 bg-rose-950/20'
                        : guidedStep === 'activity'
                        ? 'border-cyan-400 ring-2 ring-cyan-500/40'
                        : 'border-slate-700 focus:border-cyan-500'
                    }`}
                  >
                    <option value="" disabled>-- Choose activity category --</option>
                    {MAINTENANCE_ACTIVITIES.map((act) => (
                      <option key={act} value={act}>{act}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className={`space-y-1.5 p-2.5 rounded-xl transition-all duration-300 ${
                  guidedStep === 'activity' ? 'bg-cyan-950/25 border border-cyan-500/50 ring-1 ring-cyan-500/30' : 'bg-transparent'
                }`}>
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Gauge className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Facility Operational State</span>
                    <span className="text-amber-400">*</span>
                  </label>
                  <select
                    value={operationalState}
                    onChange={(e) => {
                      const val = e.target.value as OperationalState;
                      setOperationalState(val);
                      if (val) {
                        setGuidedStep('photos');
                        setTimeout(() => {
                          step2PhotosRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }, 150);
                      }
                    }}
                    className="w-full bg-slate-900 border border-slate-700 text-white text-xs p-2.5 rounded-xl focus:border-cyan-500 focus:outline-none cursor-pointer"
                  >
                    <option value="Fully Operational">Fully Operational</option>
                    <option value="Partially Operational / Restricted Flow">Partially Operational / Restricted Flow</option>
                    <option value="Critical Fault / Inoperative">Critical Fault / Inoperative</option>
                    <option value="Closed for Maintenance / Off-Season">Closed for Maintenance / Off-Season</option>
                  </select>
                </div>
              )}
            </div>

            {/* Custom Activity Inline Input */}
            {categoryMode === 'maintenance' && (maintenanceActivity === 'Other Repair / Maintenance' || (maintenanceActivity as string) === 'Other Repair/Maintenance (specify)') && (
              <div className="space-y-1.5 pt-1">
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <span>Specify Custom Maintenance Activity Details</span>
                  <span className="text-amber-400 font-bold">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Specify other repair/maintenance activity details..."
                  value={customActivity}
                  onChange={(e) => setCustomActivity(e.target.value)}
                  className={`w-full bg-slate-900 border text-white text-xs p-2.5 rounded-xl focus:outline-none transition ${
                    isCustomActivityMissing
                      ? 'border-rose-500 ring-2 ring-rose-500/40 bg-rose-950/20'
                      : 'border-slate-700 focus:border-cyan-500'
                  }`}
                  required
                />
              </div>
            )}

            {/* Operational Status Extra Inputs */}
            {categoryMode === 'operational' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800/80">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Water Quality &amp; Siltation *</label>
                  <select
                    value={waterQuality}
                    onChange={(e) => setWaterQuality(e.target.value as WaterQualityLevel)}
                    className="w-full bg-slate-900 border border-slate-700 text-white text-xs p-2 rounded-lg focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="Clear / Optimal">Clear / Optimal</option>
                    <option value="Moderate Siltation">Moderate Siltation</option>
                    <option value="Heavy Sedimentation">Heavy Sedimentation</option>
                    <option value="Debris / Trash Blockage">Debris / Trash Blockage</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Water Gauge Height (meters) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={waterLevelMeters}
                    onChange={(e) => setWaterLevelMeters(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 text-white text-xs p-2 rounded-lg font-mono focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Current Discharge Flow (m³/s) *</label>
                  <input
                    type="number"
                    step="0.1"
                    value={dischargeFlowM3s}
                    onChange={(e) => setDischargeFlowM3s(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 text-white text-xs p-2 rounded-lg font-mono focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Control Gate Opening (cm) *</label>
                  <input
                    type="number"
                    value={gateOpeningCm}
                    onChange={(e) => setGateOpeningCm(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 text-white text-xs p-2 rounded-lg font-mono focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Target Service Area / Beneficiaries *</label>
                  <input
                    type="text"
                    value={beneficiaryServiceArea}
                    onChange={(e) => setBeneficiaryServiceArea(e.target.value)}
                    placeholder="e.g. Sector 1 Farmland Area (320 ha)"
                    className={`w-full bg-slate-900 border text-white text-xs p-2 rounded-lg focus:outline-none transition ${
                      isServiceAreaMissing ? 'border-rose-500 ring-2 ring-rose-500/40 bg-rose-950/20' : 'border-slate-700 focus:border-cyan-500'
                    }`}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Operational Issue / Incident Log *</label>
                  <input
                    type="text"
                    value={operationalIncident}
                    onChange={(e) => setOperationalIncident(e.target.value)}
                    placeholder="e.g. Normal operations maintained, Trash rack cleared..."
                    className={`w-full bg-slate-900 border text-white text-xs p-2 rounded-lg focus:outline-none transition ${
                      isIncidentMissing ? 'border-rose-500 ring-2 ring-rose-500/40 bg-rose-950/20' : 'border-slate-700 focus:border-cyan-500'
                    }`}
                  />
                </div>
              </div>
            )}
          </div>

          {/* ========================================================
              STEP 2: SITE INSPECTION PHOTOS (PHOTO UPLOAD / CAMERA)
              -> Guided Input with auto-arrange & one-time inspection lock
             ======================================================== */}
          <div 
            ref={step2PhotosRef}
            className={`bg-slate-950/60 border rounded-2xl p-4 sm:p-5 space-y-4 transition-all duration-300 ${
              guidedStep === 'photos'
                ? 'border-cyan-500/70 shadow-lg shadow-cyan-950/40'
                : isPhotosMissing 
                ? 'border-rose-500/80 ring-2 ring-rose-500/30' 
                : 'border-slate-800/90'
            }`}
          >
            <div className="flex items-center justify-between gap-2.5 border-b border-slate-800/80 pb-2.5">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <span className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center shrink-0 transition ${
                  guidedStep === 'photos'
                    ? 'bg-cyan-500 text-slate-950 ring-2 ring-cyan-400/50 animate-pulse'
                    : 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                }`}>
                  2
                </span>
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2 truncate">
                    <Camera className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span className="truncate">Site Inspection Photos &amp; Geotag Evidence</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 truncate">
                    Upload inspection photos — GPS metadata will automatically detect map coordinates &amp; IMO office
                  </p>
                </div>
              </div>
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border shrink-0 whitespace-nowrap ${
                isPhotosReady
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : guidedStep === 'photos'
                  ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 animate-pulse'
                  : 'bg-slate-900 text-slate-400 border-slate-800'
              }`}>
                {isPhotosReady ? `${photos.length} Photo${photos.length > 1 ? 's' : ''} ✓` : 'Step 2 of 5'}
              </span>
            </div>

            {/* Photo Manager Component: Upload, Camera, Lens Selector, 4:3 Grid, Dynamic Captions & WYSIWYG Framing */}
            <PhotoManager
              photos={photos}
              onChangePhotos={(updated) => {
                setPhotos(updated);
                if (updated.length > 0 && guidedStep === 'photos') {
                  setGuidedStep('remarks');
                }
              }}
              context={photoCaptionContext}
              onOpenPhotographyGuide={() => setShowPhotoGuideModal(true)}
            />
          </div>

          {/* ========================================================
              STEP 3: LOCATION & PHYSICAL DIMENSIONS
              -> Consistent Section Badge, Header, Subheader & Buttons
             ======================================================== */}
          <div 
            ref={step3LocationRef}
            className={`bg-slate-950/60 border rounded-2xl p-4 sm:p-5 space-y-4 transition-all duration-300 ${
              guidedStep === 'location'
                ? 'border-cyan-500/70 shadow-lg shadow-cyan-950/40'
                : isLocationMissing 
                ? 'border-rose-500/80 ring-2 ring-rose-500/30' 
                : 'border-slate-800/90'
            }`}
          >
            <div className="flex items-center justify-between gap-2.5 border-b border-slate-800/80 pb-2.5">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <span className="w-6 h-6 rounded-lg bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 text-xs font-black flex items-center justify-center shrink-0">
                  3
                </span>
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2 truncate">
                    <MapPin className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span className="truncate">Location &amp; Physical Dimensions</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 truncate">Auto-detected from photo GPS or pinpointed on GIS map</p>
                </div>
              </div>
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border shrink-0 whitespace-nowrap ${
                isLocationReady
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : 'bg-slate-900 text-slate-400 border-slate-800'
              }`}>
                {isLocationReady ? '✓ Location Set' : 'Location Required *'}
              </span>
            </div>

            {/* Location Display & Picker Controls */}
            <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl space-y-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-1 min-w-0 flex-1">
                  {lat1 !== undefined && lng1 !== undefined ? (
                    locationMode === 'double' && lat2 !== undefined && lng2 !== undefined ? (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                            <Compass className="w-4 h-4 text-cyan-400 shrink-0" />
                            <span className="truncate">{detectedLocationName || '2-Point Canal Segment'}</span>
                          </p>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-mono">
                            📏 Reach Distance: {segmentDistanceFormatted || '0 m'}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-mono">
                          Pt 1: ({lat1.toFixed(5)}, {lng1.toFixed(5)}) → Pt 2: ({lat2.toFixed(5)}, {lng2.toFixed(5)})
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                          <Compass className="w-4 h-4 text-cyan-400 shrink-0" />
                          <span className="truncate">{detectedLocationName || 'Point Location'}</span>
                        </p>
                        <p className="text-[10.5px] text-slate-300 font-mono">
                          Coordinates: <span className="font-bold text-white">{lat1.toFixed(6)}, {lng1.toFixed(6)}</span>
                        </p>
                      </div>
                    )
                  ) : (
                    <div className="space-y-0.5">
                      <p className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                        <Compass className="w-4 h-4 text-slate-500 shrink-0" />
                        <span>No location selected yet</span>
                      </p>
                      <p className="text-[10px] text-slate-500">
                        Upload a photo with GPS to auto-detect location, or click "Choose on Map" / "My Location"
                      </p>
                    </div>
                  )}
                </div>

                {/* Map Action Buttons (Consistent same-level styling) */}
                <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setLocationSource('manual_picker');
                      handleLocateCurrentPosition(1);
                    }}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition flex-1 sm:flex-none cursor-pointer"
                    title="Use Device GPS Location"
                  >
                    <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
                    <span>My Location</span>
                  </button>

                  {onStartMapPicking && (
                    <button
                      type="button"
                      onClick={() => {
                        setLocationSource('manual_picker');
                        onStartMapPicking(categoryMode, { lat1, lng1, lat2, lng2 });
                      }}
                      className="px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl text-xs shadow-md shadow-cyan-900/30 border border-cyan-400/40 flex items-center justify-center gap-1.5 transition flex-1 sm:flex-none cursor-pointer"
                      title="Select or drag location points on live map"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      <span>Choose on Map</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Integrated Physical Measurement & Dimension Estimator (Only displayed when activity requires measurement) */}
            {requiresVolumeEstimator && (
              <div className="pt-2 border-t border-slate-800/80 space-y-2.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Ruler className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Activity Measurements &amp; Volume Estimator</span>
                    <span className="text-slate-500 text-[10px] font-normal normal-case">(Optional)</span>
                  </label>
                  {segmentDistanceMeters > 0 ? (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-bold">
                      Canal Length (L): {segmentDistanceMeters >= 1000 ? `${(segmentDistanceMeters / 1000).toFixed(2)} km` : `${segmentDistanceMeters.toFixed(1)} m`}
                    </span>
                  ) : (
                    <span className="text-[9.5px] text-slate-500">
                      (2-point reach computes exact cubic volume)
                    </span>
                  )}
                </div>

                {/* Condition 1: Desilting / Clearing of Canal & Service Road Maintenance */}
                {(maintenanceActivity.includes('Desilting') || maintenanceActivity.includes('Service Road')) && (
                  <div className="space-y-2">
                    {segmentDistanceMeters <= 0 && (
                      <div className="p-2 bg-slate-900/90 border border-slate-800 rounded-lg text-[10.5px] text-slate-400 flex items-center gap-1.5">
                        <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <span>Select 2 points on the map to compute canal reach distance (L) and calculate total earth excavation volume (m³).</span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="space-y-1">
                        <span className="text-[10px] font-semibold text-slate-300">Estimated Depth (meters)</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="e.g. 0.35"
                          value={depthMeters}
                          onChange={(e) => setDepthMeters(e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full bg-slate-900 border border-slate-700 text-white text-xs p-2 rounded-lg focus:border-cyan-500 focus:outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] font-semibold text-slate-300">Estimated Width (meters)</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="e.g. 1.50"
                          value={widthMeters}
                          onChange={(e) => setWidthMeters(e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full bg-slate-900 border border-slate-700 text-white text-xs p-2 rounded-lg focus:border-cyan-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Live Computed Value Display */}
                    {typeof depthMeters === 'number' && typeof widthMeters === 'number' && depthMeters > 0 && widthMeters > 0 && (
                      <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg flex items-center justify-between gap-2 flex-wrap text-xs">
                        <div className="flex items-center gap-1.5 text-slate-300 font-medium">
                          <Calculator className="w-4 h-4 text-cyan-400 shrink-0" />
                          <span>Formula: Length ({segmentDistanceMeters > 0 ? `${segmentDistanceMeters.toFixed(1)}m` : 'L'}) × Depth ({depthMeters}m) × Width ({widthMeters}m)</span>
                        </div>
                        <div className="font-bold text-cyan-300 font-mono text-sm">
                          {segmentDistanceMeters > 0 
                            ? `${(segmentDistanceMeters * depthMeters * widthMeters).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m³`
                            : `${(depthMeters * widthMeters).toFixed(2)} m² (Cross-section Area)`}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Condition 2: Brass Dam / Dredging Activity at Water Source */}
                {(maintenanceActivity.includes('dredging') || maintenanceActivity.includes('Brass dam')) && (
                  <div className="space-y-2">
                    {segmentDistanceMeters <= 0 && (
                      <div className="p-2 bg-slate-900/90 border border-slate-800 rounded-lg text-[10.5px] text-slate-400 flex items-center gap-1.5">
                        <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <span>Select 2 points on the map to calculate dredging reach distance (L) and compute sand pile earth volume (1.43 × H² × L).</span>
                      </div>
                    )}

                    <div className="space-y-1">
                      <span className="text-[10px] font-semibold text-slate-300">Estimated Height of Sand Pile (H in meters)</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="e.g. 1.20"
                        value={sandPileHeightMeters}
                        onChange={(e) => setSandPileHeightMeters(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 text-white text-xs p-2 rounded-lg focus:border-cyan-500 focus:outline-none"
                      />
                    </div>

                    {typeof sandPileHeightMeters === 'number' && sandPileHeightMeters > 0 && (
                      <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg flex items-center justify-between gap-2 flex-wrap text-xs">
                        <div className="flex items-center gap-1.5 text-slate-300 font-medium">
                          <Calculator className="w-4 h-4 text-cyan-400 shrink-0" />
                          <span>Formula: 1.43 × H² × Length (1.43 × {sandPileHeightMeters}² × {segmentDistanceMeters > 0 ? `${segmentDistanceMeters.toFixed(1)}m` : 'L'})</span>
                        </div>
                        <div className="font-bold text-cyan-300 font-mono text-sm">
                          {segmentDistanceMeters > 0 
                            ? `${(1.43 * sandPileHeightMeters * sandPileHeightMeters * segmentDistanceMeters).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m³`
                            : 'Pick 2 points on map to compute cubic meters'}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Condition 3: Painting Activity */}
                {Boolean(maintenanceActivity && maintenanceActivity.includes('Painting')) && (
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <span className="text-[10px] font-semibold text-slate-300">Accomplished Painting Area (m²)</span>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        placeholder="e.g. 45.5"
                        value={paintedAreaSqm}
                        onChange={(e) => setPaintedAreaSqm(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 text-white text-xs p-2 rounded-lg focus:border-cyan-500 focus:outline-none"
                      />
                    </div>

                    {typeof paintedAreaSqm === 'number' && paintedAreaSqm > 0 && (
                      <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg flex items-center justify-between gap-2 text-xs">
                        <span className="text-slate-300 font-medium">Recorded Painting Coverage:</span>
                        <span className="font-bold text-cyan-300 font-mono text-sm">{paintedAreaSqm.toLocaleString()} m²</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ========================================================
              STEP 4: EXECUTION WORKFORCE & FINAL WORK STATUS
              -> Guided Input with cleaned IA dropdown
             ======================================================== */}
          <div 
            ref={step4WorkforceRef}
            className={`bg-slate-950/60 border rounded-2xl p-4 sm:p-5 space-y-4 transition-all duration-300 ${
              guidedStep === 'workforce'
                ? 'border-cyan-500/70 shadow-lg shadow-cyan-950/40'
                : (isPerformedByMissing || isStatusMissing) 
                ? 'border-rose-500/80 ring-2 ring-rose-500/30' 
                : 'border-slate-800/90'
            }`}
          >
            <div className="flex items-center justify-between gap-2.5 border-b border-slate-800/80 pb-2.5">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <span className="w-6 h-6 rounded-lg bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 text-xs font-black flex items-center justify-center shrink-0">
                  4
                </span>
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2 truncate">
                    <Users className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span className="truncate">Execution Workforce &amp; Final Work Status</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 truncate">
                    Assign executing team/association and record current completion status
                  </p>
                </div>
              </div>
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border shrink-0 whitespace-nowrap ${
                isStep4Ready
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : 'bg-slate-900 text-slate-400 border-slate-800'
              }`}>
                {isStep4Ready ? '✓ Complete' : 'Required Inputs *'}
              </span>
            </div>

            {/* Performed By Section (Maintenance Mode) */}
            {categoryMode === 'maintenance' && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Performed by</span>
                    <span className="text-amber-400">*</span>
                    <span className="text-[10px] text-slate-400 font-normal normal-case">(Select all that apply)</span>
                  </label>
                  {performedByList.includes('IA') && (
                    <span className="text-[10px] text-cyan-400 font-medium font-mono">
                      {availableIAs.length} IA{availableIAs.length === 1 ? '' : 's'} available
                    </span>
                  )}
                </div>

                {/* 3 Selectable Option Cards: 'by IMO', 'by IA', 'by Others' */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {/* 1. by IMO */}
                  <button
                    type="button"
                    onClick={() => togglePerformedBy('IMO')}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition flex flex-col items-center justify-center gap-1 text-center cursor-pointer relative min-h-[64px] ${
                      performedByList.includes('IMO')
                        ? 'bg-cyan-500/15 text-cyan-200 border-cyan-500/60 shadow-sm ring-1 ring-cyan-500/30'
                        : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-1.5 w-full">
                      <Building2 className={`w-4 h-4 shrink-0 ${performedByList.includes('IMO') ? 'text-cyan-400' : 'text-slate-400'}`} />
                      <span className="text-xs font-bold leading-tight">
                        by IMO
                      </span>
                    </div>
                    <span className="text-[9px] font-normal text-slate-400">NIA Personnel</span>
                    {performedByList.includes('IMO') && (
                      <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-cyan-400 ring-2 ring-cyan-400/40" />
                    )}
                  </button>

                  {/* 2. by IA */}
                  <button
                    type="button"
                    onClick={() => togglePerformedBy('IA')}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition flex flex-col items-center justify-center gap-1 text-center cursor-pointer relative min-h-[64px] ${
                      performedByList.includes('IA')
                        ? 'bg-cyan-500/15 text-cyan-200 border-cyan-500/60 shadow-sm ring-1 ring-cyan-500/30'
                        : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <Users className={`w-4 h-4 shrink-0 ${performedByList.includes('IA') ? 'text-cyan-400' : 'text-slate-400'}`} />
                      <span>by IA</span>
                    </div>
                    <span className="text-[9px] font-normal text-slate-400">Irrigators' Association</span>
                    {performedByList.includes('IA') && (
                      <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-cyan-400 ring-2 ring-cyan-400/40" />
                    )}
                  </button>

                  {/* 3. by Others */}
                  <button
                    type="button"
                    onClick={() => togglePerformedBy('Others')}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition flex flex-col items-center justify-center gap-1 text-center cursor-pointer relative min-h-[64px] ${
                      performedByList.includes('Others')
                        ? 'bg-cyan-500/15 text-cyan-200 border-cyan-500/60 shadow-sm ring-1 ring-cyan-500/30'
                        : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <Wrench className={`w-4 h-4 shrink-0 ${performedByList.includes('Others') ? 'text-cyan-400' : 'text-slate-400'}`} />
                      <span>by Others</span>
                    </div>
                    <span className="text-[9px] font-normal text-slate-400">(Specify Entity)</span>
                    {performedByList.includes('Others') && (
                      <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-cyan-400 ring-2 ring-cyan-400/40" />
                    )}
                  </button>
                </div>

                {/* Sub-selector when by IA is selected (Dynamically filtered by NIS / IMO in Real-Time) */}
                {performedByList.includes('IA') && (
                  <div className="space-y-2.5 pt-2 bg-slate-900/95 p-3.5 rounded-xl border border-slate-800" ref={iaComboboxRef}>
                    <div className="flex items-center justify-between flex-wrap gap-1">
                      <label className="block text-[10.5px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-amber-400" />
                        <span>Select Irrigators' Association (IA) *</span>
                      </label>
                      <span className="text-[9.5px] text-cyan-400 font-mono px-2 py-0.5 rounded-md bg-cyan-950/40 border border-cyan-800/40">
                        {resolvedNisName ? `${resolvedNisName} (${availableIAs.length} IAs)` : `${resolvedImoName || 'System'} (${availableIAs.length} IAs)`}
                      </span>
                    </div>

                    {/* Search Input Combobox with Real-Time Dropdown */}
                    <div className="relative">
                      <div className="relative flex items-center">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
                        <input
                          type="text"
                          placeholder="Type to search or filter IAs in real time..."
                          value={iaSearchQuery}
                          onFocus={() => setIsIaDropdownOpen(true)}
                          onChange={(e) => {
                            setIaSearchQuery(e.target.value);
                            setIsIaDropdownOpen(true);
                            if (!e.target.value.trim()) {
                              setPerformedByIA('');
                              setIsSpecifyingCustomIA(false);
                            }
                          }}
                          className={`w-full bg-slate-950 border text-white text-xs pl-9 pr-16 py-2.5 rounded-xl focus:outline-none transition ${
                            touchedSubmit && performedByList.includes('IA') && (!performedByIA.trim() || performedByIA === '__custom__')
                              ? 'border-rose-500 ring-2 ring-rose-500/40 bg-rose-950/20'
                              : isIaDropdownOpen
                              ? 'border-cyan-500 ring-1 ring-cyan-500/40 shadow-lg shadow-cyan-950/30'
                              : 'border-slate-700 hover:border-slate-600'
                          }`}
                        />
                        
                        <div className="absolute right-2 flex items-center gap-1">
                          {iaSearchQuery && (
                            <button
                              type="button"
                              onClick={() => {
                                setIaSearchQuery('');
                                setPerformedByIA('');
                                setIsSpecifyingCustomIA(false);
                                setIsIaDropdownOpen(true);
                              }}
                              className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
                              title="Clear search"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                          
                          <button
                            type="button"
                            onClick={() => setIsIaDropdownOpen(!isIaDropdownOpen)}
                            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
                            title="Toggle dropdown list"
                          >
                            {isIaDropdownOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Real-time narrowed down results dropdown */}
                      {isIaDropdownOpen && (
                        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-slate-950 border border-slate-700 rounded-xl shadow-2xl overflow-hidden max-h-56 flex flex-col animate-in fade-in slide-in-from-top-1 duration-150">
                          <div className="p-2 border-b border-slate-800/80 bg-slate-900/90 text-[10.5px] text-slate-400 flex items-center justify-between shrink-0">
                            <span>
                              {filteredIAsList.length > 0 
                                ? `Showing ${filteredIAsList.length} matching ${filteredIAsList.length === 1 ? 'IA' : 'IAs'}` 
                                : 'No matching IA in this NIS'}
                            </span>
                            <span className="text-[10px] text-cyan-400 font-mono">Click to select</span>
                          </div>

                          <div className="overflow-y-auto p-1 divide-y divide-slate-800/40 flex-1">
                            {filteredIAsList.length > 0 ? (
                              filteredIAsList.map((ia, idx) => {
                                const isSelected = performedByIA === ia.name;
                                return (
                                  <button
                                    key={`${ia.name}-${idx}`}
                                    type="button"
                                    onClick={() => {
                                      setPerformedByIA(ia.name);
                                      setIaSearchQuery(ia.name);
                                      setIsSpecifyingCustomIA(false);
                                      setIsIaDropdownOpen(false);
                                    }}
                                    className={`w-full text-left p-2.5 rounded-lg transition flex items-center justify-between gap-2 cursor-pointer ${
                                      isSelected
                                        ? 'bg-cyan-950/70 border border-cyan-500/50 text-white font-bold'
                                        : 'hover:bg-slate-800/80 text-slate-200 hover:text-white'
                                    }`}
                                  >
                                    <div className="min-w-0 flex-1">
                                      <div className="text-xs font-semibold leading-normal text-slate-100">{ia.name}</div>
                                    </div>
                                    {isSelected && (
                                      <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                                    )}
                                  </button>
                                );
                              })
                            ) : (
                              <div className="p-3 text-center text-xs text-slate-400">
                                No matching Irrigators' Association found for "{iaSearchQuery}"
                              </div>
                            )}

                            {/* Option to specify unlisted IA */}
                            <button
                              type="button"
                              onClick={() => {
                                setIsSpecifyingCustomIA(true);
                                setPerformedByIA('__custom__');
                                setIaSearchQuery('');
                                setIsIaDropdownOpen(false);
                              }}
                              className="w-full text-left p-2.5 rounded-lg hover:bg-slate-800/80 text-amber-300 hover:text-amber-200 transition flex items-center gap-2 cursor-pointer font-medium text-xs border-t border-slate-800"
                            >
                              <Plus className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                              <span>
                                {iaSearchQuery.trim() 
                                  ? `Use "${iaSearchQuery.trim()}" as unlisted IA`
                                  : '+ Specify unlisted IA Name'}
                              </span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Selected IA Confirmation Badge (shown only when a registered IA is selected) */}
                    {performedByIA && performedByIA !== '__custom__' && !isSpecifyingCustomIA && availableIAs.some(ia => ia.name === performedByIA) && (
                      <div className="flex items-center justify-between p-2.5 bg-slate-950/80 border border-emerald-500/40 rounded-xl text-xs">
                        <div className="flex items-center gap-2 text-slate-200 min-w-0">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          <div className="min-w-0">
                            <span className="font-bold text-white block truncate">{performedByIA}</span>
                            <span className="text-[10px] text-emerald-400 font-medium">Selected Irrigators' Association</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setPerformedByIA('');
                            setIaSearchQuery('');
                            setIsSpecifyingCustomIA(false);
                            setIsIaDropdownOpen(true);
                          }}
                          className="text-[10.5px] text-slate-400 hover:text-rose-300 transition underline cursor-pointer shrink-0 ml-2"
                        >
                          Change
                        </button>
                      </div>
                    )}

                    {/* Dedicated Separate Input field to input the Unlisted IA Name */}
                    {(isSpecifyingCustomIA || performedByIA === '__custom__' || (!availableIAs.some(ia => ia.name === performedByIA) && performedByIA !== '')) && (
                      <div className="space-y-1.5 pt-2 border-t border-slate-800 animate-in fade-in duration-150">
                        <div className="flex items-center justify-between">
                          <label className="block text-[10.5px] text-amber-300 font-bold uppercase tracking-wider flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-amber-400" />
                            <span>Specify Unlisted IA Name *</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setIsSpecifyingCustomIA(false);
                              setPerformedByIA('');
                              setIaSearchQuery('');
                              setIsIaDropdownOpen(true);
                            }}
                            className="text-[10px] text-slate-400 hover:text-cyan-300 underline cursor-pointer"
                          >
                            Choose from registered list
                          </button>
                        </div>
                        <input
                          type="text"
                          placeholder="Type unlisted Irrigators' Association (IA) name..."
                          value={performedByIA === '__custom__' ? '' : performedByIA}
                          onChange={(e) => {
                            setPerformedByIA(e.target.value);
                            setIaSearchQuery(e.target.value);
                          }}
                          className={`w-full bg-slate-950 border text-white text-xs p-2.5 rounded-xl focus:outline-none transition ${
                            touchedSubmit && performedByList.includes('IA') && (!performedByIA.trim() || performedByIA === '__custom__')
                              ? 'border-rose-500 ring-2 ring-rose-500/40 bg-rose-950/20'
                              : 'border-amber-500/80 focus:border-amber-400 focus:ring-1 focus:ring-amber-400'
                          }`}
                          required
                          autoFocus
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Sub-input when by Others is selected */}
                {performedByList.includes('Others') && (
                  <div className="space-y-1 pt-2 bg-slate-900/90 p-3 rounded-xl border border-slate-800">
                    <label className="block text-[10.5px] font-bold text-slate-300 uppercase">
                      Specify Entity / External Contractor / LGU *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Local Government Unit (LGU), Private Contractor, Barangay Council..."
                      value={performedByOthers}
                      onChange={(e) => setPerformedByOthers(e.target.value)}
                      className={`w-full bg-slate-950 border text-white text-xs p-2 rounded-lg focus:outline-none transition ${
                        touchedSubmit && performedByList.includes('Others') && !performedByOthers.trim()
                          ? 'border-rose-500 ring-2 ring-rose-500/40 bg-rose-950/20'
                          : 'border-slate-700 focus:border-cyan-500'
                      }`}
                      required
                    />
                  </div>
                )}
              </div>
            )}

            {/* Final Work Status Selector (No pre-select: User must choose) */}
            <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Final Work Status</span>
                  <span className="text-amber-400">*</span>
                  <span className="text-[10px] text-slate-400 font-normal normal-case">(Please select one)</span>
                </label>
                {isStatusMissing && (
                  <span className="text-[10px] text-rose-400 font-bold">Status selection required *</span>
                )}
              </div>
              <div className={`grid grid-cols-3 gap-2 p-1 rounded-xl transition ${
                isStatusMissing ? 'bg-rose-950/30 border border-rose-500/80 ring-2 ring-rose-500/30' : ''
              }`}>
                <button
                  type="button"
                  onClick={() => {
                    setStatus('In Progress');
                    setGuidedStep('remarks');
                    if (!remarks.trim() || !isRemarksUserModified) {
                      setTimeout(() => handleAutoComposeRemarks(false), 50);
                    }
                    setTimeout(() => {
                      step5RemarksRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 150);
                  }}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition text-center cursor-pointer ${
                    status === 'In Progress'
                      ? 'bg-amber-500/20 text-amber-200 border-amber-500/80 shadow-md ring-1 ring-amber-500/40 font-black'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-300'
                  }`}
                >
                  In Progress
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setStatus('Completed');
                    setGuidedStep('remarks');
                    if (!remarks.trim() || !isRemarksUserModified) {
                      setTimeout(() => handleAutoComposeRemarks(false), 50);
                    }
                    setTimeout(() => {
                      step5RemarksRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 150);
                  }}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition text-center cursor-pointer ${
                    status === 'Completed'
                      ? 'bg-emerald-500/20 text-emerald-200 border-emerald-500/80 shadow-md ring-1 ring-emerald-500/40 font-black'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-300'
                  }`}
                >
                  Completed
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setStatus('Suspended');
                    setGuidedStep('remarks');
                    if (!remarks.trim() || !isRemarksUserModified) {
                      setTimeout(() => handleAutoComposeRemarks(false), 50);
                    }
                    setTimeout(() => {
                      step5RemarksRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 150);
                  }}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition text-center cursor-pointer ${
                    status === 'Suspended'
                      ? 'bg-rose-500/20 text-rose-200 border-rose-500/80 shadow-md ring-1 ring-rose-500/40 font-black'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-300'
                  }`}
                >
                  Suspended
                </button>
              </div>

              {/* Reason for Work Suspension (Required if Suspended) */}
              {status === 'Suspended' && (
                <div className="mt-2.5 p-3 rounded-xl bg-rose-950/40 border border-rose-500/60 space-y-1.5 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-rose-300 uppercase tracking-wider flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <span>Reason for Work Suspension</span>
                      <span className="text-rose-400">*</span>
                    </label>
                    <span className="text-[9.5px] text-rose-300/80">(Required explanation)</span>
                  </div>
                  <input
                    type="text"
                    value={suspensionReason}
                    onChange={(e) => {
                      setSuspensionReason(e.target.value);
                    }}
                    placeholder="e.g., Heavy monsoon rainfall & high canal water level / Awaiting spare parts delivery..."
                    className={`w-full bg-slate-900 border text-xs p-2.5 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-1 ${
                      touchedSubmit && !suspensionReason.trim()
                        ? 'border-rose-500 ring-rose-500/40 bg-rose-950/20'
                        : 'border-rose-500/40 focus:border-rose-400 focus:ring-rose-400/30'
                    }`}
                  />
                  {touchedSubmit && !suspensionReason.trim() && (
                    <span className="text-[10px] text-rose-400 font-bold block">
                      Please provide a brief explanation why the activity is suspended.
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ========================================================
              STEP 5: TECHNICAL REMARKS & FIELD NOTES (ISOLATED BOTTOM WINDOW)
             ======================================================== */}
          <div 
            ref={step5RemarksRef}
            className={`bg-slate-950/60 border rounded-2xl p-4 sm:p-5 space-y-3 transition-all duration-300 ${
              guidedStep === 'remarks'
                ? 'border-cyan-500/70 shadow-lg shadow-cyan-950/40'
                : 'border-slate-800/90'
            }`}
          >
            <div className="flex items-center justify-between gap-2.5 border-b border-slate-800/80 pb-2.5">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <span className="w-6 h-6 rounded-lg bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 text-xs font-black flex items-center justify-center shrink-0">
                  5
                </span>
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2 truncate">
                    <FileText className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span className="truncate">Technical Remarks &amp; Field Notes</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 truncate">
                    Document engineering observations, site conditions, equipment utilized and accomplishment notes
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleAutoComposeRemarks(true)}
                className="px-2.5 py-1.5 bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 hover:text-white border border-cyan-500/50 hover:border-cyan-400 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs shrink-0 active:scale-95"
                title="Synthesize smart engineering summary from activity, stationing, photos, workforce and work status"
              >
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>Auto-Compose Summary</span>
              </button>
            </div>

            <textarea
              rows={4}
              value={remarks}
              onChange={(e) => {
                setRemarks(e.target.value);
                setIsRemarksUserModified(true);
              }}
              placeholder="Enter field notes: equipment on site, crew observations, site conditions, accomplishment details..."
              className="w-full bg-slate-900 border border-slate-700 text-white text-xs p-3 rounded-xl focus:border-cyan-500 focus:outline-none leading-relaxed"
            />
          </div>

          {/* EDITING REPORT PDF ACTIONS (PREVIEW & DIRECT DOWNLOAD) */}
          {editingReport && (
            <div className="pt-2 border-t border-slate-800 space-y-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Official Document Actions</span>
              <div className="grid grid-cols-2 gap-2">
                {onPreviewReportPdf && (
                  <button
                    type="button"
                    onClick={() => onPreviewReportPdf(editingReport)}
                    className="py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-sm"
                    title="Preview this report in official PDF layout"
                  >
                    <Eye className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Preview PDF</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={async () => {
                    setIsDownloadingPdf(true);
                    try {
                      await downloadReportPdf(editingReport);
                    } catch (err) {
                      console.error('Failed to download report PDF:', err);
                    } finally {
                      setIsDownloadingPdf(false);
                    }
                  }}
                  disabled={isDownloadingPdf}
                  className="py-2.5 px-3 bg-cyan-600 hover:bg-cyan-500 text-white border border-cyan-400/40 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50 shadow-sm"
                  title="Download this report as an official PDF file"
                >
                  {isDownloadingPdf ? (
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
              </div>
            </div>
          )}

          {/* Revision Change Summary Input (Rendered when in Revision Mode) */}
          {editPermission.mode === 'create_revision' && (
            <div className="p-3.5 bg-slate-950/80 rounded-xl border border-amber-500/40 space-y-1.5 shadow-sm">
              <label className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                <span>Revision Changelog Summary Note:</span>
              </label>
              <input
                type="text"
                value={revisionChangeSummary}
                onChange={e => setRevisionChangeSummary(e.target.value)}
                placeholder="e.g. Corrected canal depth measurement from 0.8m to 1.2m per field re-survey..."
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 font-medium"
              />
            </div>
          )}

          {/* SUBMIT BUTTON */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmittingReport}
              className={`w-full py-3.5 rounded-xl font-bold text-xs sm:text-sm shadow-xl transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 ${
                completedStepsCount === totalRequiredSteps
                  ? editPermission.mode === 'create_revision'
                    ? 'bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 shadow-amber-900/30 border border-amber-300/30 font-black'
                    : 'bg-gradient-to-r from-cyan-600 to-teal-500 hover:from-cyan-500 hover:to-teal-400 text-white shadow-cyan-900/30 border border-cyan-400/30'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
              }`}
            >
              {isSubmittingReport ? (
                <>
                  <Loader2 className="w-4.5 h-4.5 animate-spin text-cyan-300" />
                  <span>Submitting &amp; Archiving to Google Drive...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4.5 h-4.5" />
                  <span>
                    {isOffline 
                      ? `Save ${categoryMode === 'maintenance' ? 'Maintenance' : 'Operational'} Report to Sync Queue`
                      : editPermission.mode === 'create_revision'
                        ? `Submit as New Revision (v${(editingReport?.revisionNumber || (editingReport?.revisions?.length || 1)) + 1})`
                        : editingReport
                          ? `Update ${categoryMode === 'maintenance' ? 'Maintenance' : 'Operational'} Report`
                          : `Submit ${categoryMode === 'maintenance' ? 'Maintenance' : 'Operational Status'} Report`}
                  </span>
                  {completedStepsCount < totalRequiredSteps && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-900/90 text-amber-300 border border-amber-500/30">
                      {totalRequiredSteps - completedStepsCount} items missing
                    </span>
                  )}
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* PHOTO GUIDE DETAILED POPUP MODAL */}
      {showPhotoGuideModal && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in"
          onClick={(e) => { if (e.target === e.currentTarget) setShowPhotoGuideModal(false); }}
        >
          <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-up">
            {/* Header */}
            <div className="p-3.5 sm:p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs sm:text-sm">
                <Camera className="w-4 h-4" />
                <span>Site Photography Protocol &amp; The Fixed Vantage Point Rule</span>
              </div>
              <button
                type="button"
                onClick={() => setShowPhotoGuideModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
                title="Close guide"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 sm:p-5 space-y-4 overflow-y-auto text-xs leading-relaxed text-slate-300">
              {/* Revised Protocol Statement */}
              <div className="p-3.5 bg-cyan-950/40 border border-cyan-500/30 rounded-xl space-y-1">
                <h4 className="font-bold text-cyan-300 flex items-center gap-1.5 text-xs">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>Site Photography Protocol</span>
                </h4>
                <p className="text-slate-200 text-xs leading-relaxed">
                  Field Inspection photos serve as legal, financial, and engineering proof of repair and maintenance work. To clearly demonstrate accomplishment and evidence of progress, always stand in the <strong>exact same physical spot</strong> and frame the camera at the same reference / landmark (e.g., control gate structures, large trees, electric post) across all inspection stages.
                </p>
              </div>

              {/* Infographic Guide Image */}
              <div className="rounded-xl overflow-hidden border-2 border-slate-700 shadow-xl bg-black flex items-center justify-center">
                <img 
                  src="/photo-protocol-guide.jpg" 
                  alt="The Fixed Vantage Point Rule & Field Photo Tips" 
                  className="w-full h-auto object-contain max-h-[550px]"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="p-3 sm:p-4 bg-slate-950 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setShowPhotoGuideModal(false)}
                className="px-5 py-2 bg-gradient-to-r from-cyan-600 to-teal-500 hover:from-cyan-500 hover:to-teal-400 text-white font-bold rounded-xl text-xs shadow-lg shadow-cyan-500/20 transition cursor-pointer"
              >
                Got It, Understood
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULL-SIZE PHOTO PREVIEW LIGHTBOX MODAL */}
      {previewPhotoIndex !== null && photos[previewPhotoIndex] && (
        <div 
          className="fixed inset-0 z-[120] flex items-center justify-center p-2 sm:p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-200"
          onClick={(e) => { if (e.target === e.currentTarget) setPreviewPhotoIndex(null); }}
        >
          <div className="bg-slate-900 border border-slate-700/80 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-3 sm:p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider ${
                  photos[previewPhotoIndex].stage === 'Before'
                    ? 'bg-amber-500 text-slate-950'
                    : photos[previewPhotoIndex].stage === 'During'
                    ? 'bg-cyan-500 text-slate-950'
                    : 'bg-emerald-500 text-slate-950'
                }`}>
                  {photos[previewPhotoIndex].stage || 'Site Photo'}
                </span>
                <div className="min-w-0">
                  <h4 className="text-xs sm:text-sm font-bold text-white truncate flex items-center gap-2">
                    <span>Photo {previewPhotoIndex + 1} of {photos.length}</span>
                    {photos[previewPhotoIndex].lat !== undefined && photos[previewPhotoIndex].lng !== undefined && (
                      <span className="text-[10px] font-mono text-cyan-300 font-normal">
                        ({photos[previewPhotoIndex].lat.toFixed(5)}, {photos[previewPhotoIndex].lng.toFixed(5)})
                      </span>
                    )}
                  </h4>
                  <p className="text-[11px] text-slate-400 truncate">
                    {photos[previewPhotoIndex].capturedAt || 'Field Inspection Geotagged Evidence'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  disabled={previewPhotoIndex === 0}
                  onClick={() => setPreviewPhotoIndex(prev => (prev !== null && prev > 0 ? prev - 1 : prev))}
                  className="p-1.5 text-slate-300 hover:text-white disabled:opacity-30 rounded-lg hover:bg-slate-800 transition cursor-pointer"
                  title="Previous photo"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  disabled={previewPhotoIndex === photos.length - 1}
                  onClick={() => setPreviewPhotoIndex(prev => (prev !== null && prev < photos.length - 1 ? prev + 1 : prev))}
                  className="p-1.5 text-slate-300 hover:text-white disabled:opacity-30 rounded-lg hover:bg-slate-800 transition cursor-pointer"
                  title="Next photo"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
                <div className="w-px h-5 bg-slate-800 mx-1" />
                <button
                  type="button"
                  onClick={() => setPreviewPhotoIndex(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
                  title="Close preview"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Photo Container */}
            <div className="flex-1 bg-black/90 p-2 sm:p-4 flex items-center justify-center overflow-hidden min-h-[300px] max-h-[70vh]">
              <img
                src={photos[previewPhotoIndex].url}
                alt={`Photo ${previewPhotoIndex + 1}`}
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              />
            </div>

            {/* Footer with stage changer & close */}
            <div className="p-3 sm:p-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase">Stage:</span>
                <div className="flex items-center bg-slate-900 border border-slate-800 p-0.5 rounded-lg text-xs font-bold">
                  {(['Before', 'During', 'After'] as const).map((stg) => (
                    <button
                      key={stg}
                      type="button"
                      onClick={() => handleUpdatePhotoStage(photos[previewPhotoIndex].id, stg)}
                      className={`px-2.5 py-1 rounded transition ${
                        photos[previewPhotoIndex].stage === stg
                          ? stg === 'Before'
                            ? 'bg-amber-500 text-slate-950 font-black'
                            : stg === 'During'
                            ? 'bg-cyan-500 text-slate-950 font-black'
                            : 'bg-emerald-500 text-slate-950 font-black'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {stg}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewPhotoIndex(null)}
                  className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  Close Preview
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


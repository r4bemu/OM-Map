import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, 
  FileText, 
  Calendar, 
  Download, 
  Printer, 
  Search, 
  Filter, 
  ChevronDown, 
  ChevronRight, 
  Ruler, 
  CheckCircle2, 
  Clock, 
  FileCheck2, 
  Ban, 
  MapPin, 
  Camera, 
  Activity, 
  Wrench, 
  TrendingUp, 
  BarChart3, 
  RefreshCw, 
  Layers, 
  Building2, 
  Users, 
  Eye, 
  Droplets, 
  AlertTriangle, 
  Gauge, 
  Waves,
  GitCompare,
  ShieldCheck,
  CornerDownLeft,
  Edit3
} from 'lucide-react';
import { FieldReport, UserRole, ApprovalStatus, AuthUser, OperationalState, ApprovalTier } from '../types';
import { Form691WeeklyReport } from './Form691WeeklyReport';
import { Form691PhotoDocumentation } from './Form691PhotoDocumentation';
import { ReportRevisionDiffViewer } from './ReportRevisionDiffViewer';
import { convertFieldReportsToGeoJson, triggerGeoJsonDownload } from '../utils/geoJsonExport';
import { getFridayEndingWeekInfo } from '../utils/weekUtils';
import { 
  getEffectiveReportTier, 
  getTierLabel, 
  getTierBadgeStyle, 
  canUserAdvanceTier, 
  canUserEditReport, 
  canUserViewReport, 
  ORDERED_APPROVAL_TIERS,
  TIER_CONFIG
} from '../utils/approvalHierarchyEngine';

interface ReportsSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  reports?: FieldReport[];
  currentRole: UserRole;
  currentUser?: AuthUser | null;
  activeImo?: string;
  activeNis?: string;
  onSelectReportOnMap: (report: FieldReport) => void;
  onPreviewReportPdf?: (report: FieldReport) => void;
  onEditReport?: (report: FieldReport, snapshot?: Partial<FieldReport>) => void;
  initialTab?: 'ledger' | 'form691' | 'photos';
  initialSummaryMode?: 'maintenance' | 'operational';
}

type ClusterMode = 'weekly' | 'monthly';
type SummaryMode = 'maintenance' | 'operational';

// Helper: Get Friday-ending Week number and start/end dates for weekly clustering
function getWeekClusterKey(date: Date): { key: string; label: string; startDate: string; endDate: string; weekNum: number; year: number } {
  try {
    const info = getFridayEndingWeekInfo(date);
    return {
      key: info.key,
      label: `Week ${info.weekNumber} (${info.startDate} – ${info.endDate})`,
      startDate: info.startDate,
      endDate: info.endDate,
      weekNum: info.weekNumber,
      year: info.year
    };
  } catch (e) {
    return {
      key: 'current-week',
      label: 'Current Week',
      startDate: '',
      endDate: '',
      weekNum: 1,
      year: new Date().getFullYear()
    };
  }
}

// Helper: Get Month cluster key for monthly clustering
function getMonthClusterKey(date: Date): { key: string; label: string; year: number; month: number } {
  try {
    const year = date.getFullYear();
    const month = date.getMonth();
    const monthName = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    return {
      key: `${year}-${String(month + 1).padStart(2, '0')}`,
      label: monthName,
      year,
      month
    };
  } catch (e) {
    return {
      key: 'current-month',
      label: 'Current Month',
      year: new Date().getFullYear(),
      month: 0
    };
  }
}

export const ReportsSummaryModal: React.FC<ReportsSummaryModalProps> = ({
  isOpen,
  onClose,
  reports = [],
  currentRole,
  currentUser,
  activeImo,
  activeNis,
  onSelectReportOnMap,
  onPreviewReportPdf,
  onEditReport,
  initialTab = 'ledger',
  initialSummaryMode = 'maintenance'
}) => {
  const [summaryMode, setSummaryMode] = useState<SummaryMode>(initialSummaryMode);
  const [activeTab, setActiveTab] = useState<'ledger' | 'form691' | 'photos'>(initialTab);
  const [clusterMode, setClusterMode] = useState<ClusterMode>('weekly');
  const [imoFilter, setImoFilter] = useState<string>('All');
  const [operationalStateFilter, setOperationalStateFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [tierFilter, setTierFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedClusters, setExpandedClusters] = useState<Record<string, boolean>>({});

  const [selectedReportForDiff, setSelectedReportForDiff] = useState<FieldReport | null>(null);
  const [isDiffViewerOpen, setIsDiffViewerOpen] = useState<boolean>(false);
  const [localReports, setLocalReports] = useState<FieldReport[]>(reports || []);

  useEffect(() => {
    if (Array.isArray(reports)) {
      setLocalReports(reports);
    }
  }, [reports]);

  const handleAdvanceTier = async (targetReport: FieldReport, nextTier: ApprovalTier, comment?: string) => {
    try {
      const res = await fetch(`/api/reports/${targetReport.id}/advance-tier`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nextTier,
          actorName: currentUser?.name || 'Institutional Officer',
          actorId: currentUser?.id,
          actorRole: currentRole,
          comments: comment
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.report) {
          setLocalReports(prev => prev.map(r => r.id === targetReport.id ? data.report : r));
        }
      }
    } catch (err) {
      console.error('Failed to advance tier:', err);
    }
  };

  const handleRequestRevision = async (targetReport: FieldReport, reason: string) => {
    try {
      const res = await fetch(`/api/reports/${targetReport.id}/return-revision`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason,
          actorName: currentUser?.name || 'Reviewing Officer',
          actorId: currentUser?.id,
          actorRole: currentRole
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.report) {
          setLocalReports(prev => prev.map(r => r.id === targetReport.id ? data.report : r));
        }
      }
    } catch (err) {
      console.error('Failed to return report for revision:', err);
    }
  };

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab, isOpen]);

  useEffect(() => {
    if (initialSummaryMode) {
      setSummaryMode(initialSummaryMode);
    }
  }, [initialSummaryMode, isOpen]);

  // If switched to operational summary mode while on WMR (Form 691), switch to ledger view
  useEffect(() => {
    if (summaryMode === 'operational' && activeTab === 'form691') {
      setActiveTab('ledger');
    }
  }, [summaryMode, activeTab]);

  // Keyboard Escape listener to safely close modal anytime
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const safeReports = useMemo(() => {
    return Array.isArray(localReports) ? localReports.filter(Boolean) : [];
  }, [localReports]);

  // Extract unique IMO options safely
  const imoOptions = useMemo(() => {
    const set = new Set<string>();
    safeReports.forEach(r => {
      if (r && r.imoOffice) set.add(r.imoOffice);
    });
    return ['All', ...Array.from(set)];
  }, [safeReports]);

  // Scope-Filtered reports based on Summary Mode (Maintenance vs Operational)
  const filteredReports = useMemo(() => {
    return safeReports.filter(r => {
      if (!r) return false;

      // Restrict Viewer to only Approved & Published reports
      if (!canUserViewReport(r, currentUser || null, currentRole)) {
        return false;
      }

      // Primary Selection Filter: Maintenance vs Operational
      const isOp = r.categoryMode === 'operational' || r.reportType === 'operational';
      if (summaryMode === 'maintenance' && isOp) return false;
      if (summaryMode === 'operational' && !isOp) return false;

      // Active / Simulated IMO scope filter
      if (activeImo && activeImo !== 'All IMOs' && activeImo !== 'Regional Office IV-B' && activeImo !== 'All') {
        const rImo = r.imoOffice || '';
        if (!rImo.toLowerCase().includes(activeImo.toLowerCase()) && !activeImo.toLowerCase().includes(rImo.toLowerCase())) {
          return false;
        }
      }

      // Active / Simulated NIS scope filter
      if (activeNis && activeNis !== 'All NIS' && !activeNis.toLowerCase().includes('all systems')) {
        const canalText = (r.canalSegment || r.locationName || r.title || '').toLowerCase();
        const nisClean = activeNis.replace(' RIS', '').replace(' CIS', '').toLowerCase();
        const matchesCanal = canalText.includes(nisClean);
        const matchesBinding = r.nisBinding ? r.nisBinding.toLowerCase().includes(nisClean) : false;
        if (!matchesCanal && !matchesBinding) {
          return false;
        }
      }

      // IMO filter from dropdown selector
      if (imoFilter !== 'All' && r.imoOffice !== imoFilter) return false;

      // Operational State Filter (Only active in Operational mode)
      if (summaryMode === 'operational' && operationalStateFilter !== 'All') {
        if (r.operationalState !== operationalStateFilter) return false;
      }

      // Status / Approval Filter
      if (statusFilter !== 'All') {
        if (statusFilter === 'Approved' && r.approvalStatus !== 'Approved') return false;
        if (statusFilter === 'PreApproved' && r.approvalStatus !== 'PreApproved') return false;
        if (statusFilter === 'Pending' && r.approvalStatus !== 'Pending_PreApproval' && r.approvalStatus) return false;
      }

      // Approval Tier Filter
      if (tierFilter !== 'All') {
        const effTier = getEffectiveReportTier(r);
        if (effTier !== tierFilter) return false;
      }

      // Search Query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const text = [
          r.title,
          r.locationName,
          r.canalSegment,
          r.parcelId,
          r.maintenanceActivity,
          r.operationalState,
          r.waterQuality,
          r.reporterName,
          r.imoOffice,
          r.nisBinding,
          r.remarks
        ].filter(Boolean).join(' ').toLowerCase();

        if (!text.includes(q)) return false;
      }

      return true;
    });
  }, [safeReports, summaryMode, activeImo, activeNis, imoFilter, operationalStateFilter, statusFilter, searchQuery]);

  // Group filtered reports into Clusters (Weekly or Monthly)
  const clusteredGroups = useMemo(() => {
    const groups: {
      key: string;
      label: string;
      reports: FieldReport[];
      totalDistanceMeters: number;
      totalDesiltingM3: number;
      totalPaintingSqm: number;
      completedCount: number;
      approvedCount: number;
      operationalNormalCount: number;
      operationalCriticalCount: number;
    }[] = [];

    const map = new Map<string, { label: string; reports: FieldReport[] }>();

    filteredReports.forEach(r => {
      const d = r.createdAt ? new Date(r.createdAt) : new Date();
      const validDate = isNaN(d.getTime()) ? new Date() : d;

      let key = '';
      let label = '';

      if (clusterMode === 'weekly') {
        const w = getWeekClusterKey(validDate);
        key = w.key;
        label = w.label;
      } else {
        const m = getMonthClusterKey(validDate);
        key = m.key;
        label = m.label;
      }

      if (!map.has(key)) {
        map.set(key, { label, reports: [] });
      }
      map.get(key)!.reports.push(r);
    });

    // Sort clusters descending chronologically
    const sortedKeys = Array.from(map.keys()).sort((a, b) => b.localeCompare(a));

    sortedKeys.forEach(k => {
      const item = map.get(k)!;
      item.reports.sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });

      let totalDistance = 0;
      let totalDesilting = 0;
      let totalPainting = 0;
      let completed = 0;
      let approved = 0;
      let opNormal = 0;
      let opCritical = 0;

      item.reports.forEach(r => {
        if (typeof r.segmentDistanceMeters === 'number' && !isNaN(r.segmentDistanceMeters) && r.segmentDistanceMeters > 0) {
          totalDistance += r.segmentDistanceMeters;
        }
        const vol = r.calculatedVolumeM3 || r.desiltingVolumeM3;
        if (typeof vol === 'number' && !isNaN(vol) && vol > 0) {
          totalDesilting += vol;
        }
        if (typeof r.paintedAreaSqm === 'number' && !isNaN(r.paintedAreaSqm) && r.paintedAreaSqm > 0) {
          totalPainting += r.paintedAreaSqm;
        }
        if (r.status === 'Completed') completed++;
        if (r.approvalStatus === 'Approved') approved++;
        if (r.operationalState === 'Fully Operational') opNormal++;
        if (r.operationalState === 'Critical Fault / Inoperative' || r.operationalState === 'Partially Operational / Restricted Flow') opCritical++;
      });

      groups.push({
        key: k,
        label: item.label,
        reports: item.reports,
        totalDistanceMeters: totalDistance,
        totalDesiltingM3: totalDesilting,
        totalPaintingSqm: totalPainting,
        completedCount: completed,
        approvedCount: approved,
        operationalNormalCount: opNormal,
        operationalCriticalCount: opCritical
      });
    });

    return groups;
  }, [filteredReports, clusterMode]);

  // Overall KPIs for Maintenance
  const maintenanceKPIs = useMemo(() => {
    let totalDist = 0;
    let totalVol = 0;
    let totalPainting = 0;
    let completed = 0;
    let approved = 0;
    let structureCount = 0;
    let maintainedByIACount = 0;

    filteredReports.forEach(r => {
      if (typeof r.segmentDistanceMeters === 'number' && !isNaN(r.segmentDistanceMeters) && r.segmentDistanceMeters > 0) {
        totalDist += r.segmentDistanceMeters;
      }
      
      const vol = r.calculatedVolumeM3 || r.desiltingVolumeM3;
      if (typeof vol === 'number' && !isNaN(vol) && vol > 0) {
        totalVol += vol;
      }
      if (typeof r.paintedAreaSqm === 'number' && !isNaN(r.paintedAreaSqm) && r.paintedAreaSqm > 0) {
        totalPainting += r.paintedAreaSqm;
      }
      if (r.status === 'Completed') completed++;
      if (r.approvalStatus === 'Approved') approved++;

      const isTwoPointSegment = Boolean(
        (r.secondLat !== undefined && r.secondLng !== undefined) ||
        (typeof r.segmentDistanceMeters === 'number' && r.segmentDistanceMeters > 0) ||
        (Array.isArray(r.pathCoords) && r.pathCoords.length > 1)
      );

      if (!isTwoPointSegment) {
        const act = (r.maintenanceActivity || '').toLowerCase();
        const title = (r.title || '').toLowerCase();
        const loc = (r.locationName || '').toLowerCase();
        const structName = (r.structureName || '').toLowerCase();

        const structureKeywords = [
          'dam', 'intake', 'gate', 'diversion', 'staff gauge', 'turnout', 
          'flume', 'siphon', 'culvert', 'checkgate', 'headgate', 'crossing', 
          'drop', 'bridge', 'pump', 'spillway', 'sluice', 'barrel', 'weir', 
          'outlet', 'inlet', 'control structure'
        ];

        const isStructure = structureKeywords.some(kw => 
          act.includes(kw) || title.includes(kw) || loc.includes(kw) || structName.includes(kw)
        ) || Boolean(r.structureName);

        if (isStructure) {
          structureCount++;
        }
      }

      const isIA = Boolean(
        r.performedBy === 'IA' ||
        (Array.isArray(r.performedByList) && r.performedByList.includes('IA')) ||
        (typeof r.performedBy === 'string' && r.performedBy.toLowerCase().includes('ia')) ||
        (r.performedByIA && r.performedByIA.trim().length > 0) ||
        (r.performedByDetails && r.performedByDetails.toLowerCase().includes('ia')) ||
        r.reporterRole === 'Field Personnel'
      );

      if (isIA) {
        maintainedByIACount++;
      }
    });

    return {
      count: filteredReports.length,
      totalDistanceKm: (totalDist / 1000).toFixed(2),
      totalDistanceMeters: totalDist,
      totalDesiltingM3: totalVol,
      totalPaintingSqm: totalPainting,
      completed,
      approved,
      structureCount,
      maintainedByIACount
    };
  }, [filteredReports]);

  // Overall KPIs for Operational Summary
  const operationalKPIs = useMemo(() => {
    let fullyOperational = 0;
    let restrictedFlow = 0;
    let criticalInoperative = 0;
    let closedMaintenance = 0;
    let dischargeSum = 0;
    let dischargeCount = 0;
    let approved = 0;

    filteredReports.forEach(r => {
      if (r.operationalState === 'Fully Operational') fullyOperational++;
      else if (r.operationalState === 'Partially Operational / Restricted Flow') restrictedFlow++;
      else if (r.operationalState === 'Critical Fault / Inoperative') criticalInoperative++;
      else if (r.operationalState === 'Closed for Maintenance / Off-Season') closedMaintenance++;

      if (typeof r.dischargeFlowM3s === 'number' && !isNaN(r.dischargeFlowM3s) && r.dischargeFlowM3s > 0) {
        dischargeSum += r.dischargeFlowM3s;
        dischargeCount++;
      }
      if (r.approvalStatus === 'Approved') approved++;
    });

    const total = filteredReports.length;
    const healthRatePct = total > 0 ? Math.round((fullyOperational / total) * 100) : 100;
    const avgDischarge = dischargeCount > 0 ? (dischargeSum / dischargeCount).toFixed(2) : '0.00';

    return {
      count: total,
      fullyOperational,
      restrictedFlow,
      criticalInoperative,
      closedMaintenance,
      healthRatePct,
      avgDischarge,
      approved
    };
  }, [filteredReports]);

  // Toggle single cluster accordion
  const toggleCluster = (key: string) => {
    setExpandedClusters(prev => ({
      ...prev,
      [key]: prev[key] === undefined ? false : !prev[key]
    }));
  };

  // Expand All / Collapse All
  const handleToggleAll = (expand: boolean) => {
    const next: Record<string, boolean> = {};
    clusteredGroups.forEach(g => {
      next[g.key] = expand;
    });
    setExpandedClusters(next);
  };

  // Export CSV
  const handleExportCSV = () => {
    try {
      const isMaint = summaryMode === 'maintenance';
      const headers = isMaint ? [
        'Ref No.',
        'Created Date',
        'Cluster Key',
        'IMO Office',
        'NIS Binding',
        'Location / Stationing',
        'Particulars / Maintenance Activity',
        'Accomplishment Distance (Meters)',
        'Accomplishment Distance (km)',
        'Estimated Depth (m)',
        'Estimated Width (m)',
        'Sand Pile Height (m)',
        'Accomplished Painting Area (m2)',
        'Calculated Accomplishment Volume (m3)',
        'Dimension Details / Formula',
        'Work Status',
        'Approval Status',
        'Reporter Name',
        'Reporter Role',
        'Latitude',
        'Longitude',
        'Photos Count',
        'Remarks'
      ] : [
        'Ref No.',
        'Created Date',
        'Cluster Key',
        'IMO Office',
        'NIS Binding',
        'Location / Stationing',
        'Canal Segment / Structure',
        'Operational State',
        'Discharge Flow (m3/s)',
        'Water Level (m)',
        'Gate Opening (cm)',
        'Water Quality',
        'Beneficiary Service Area',
        'Work Status',
        'Approval Status',
        'Reporter Name',
        'Reporter Role',
        'Latitude',
        'Longitude',
        'Photos Count',
        'Remarks'
      ];

      const rows = filteredReports.map(r => {
        const d = r.createdAt ? new Date(r.createdAt) : new Date();
        const validDate = isNaN(d.getTime()) ? new Date() : d;
        const clusterKey = clusterMode === 'weekly' ? getWeekClusterKey(validDate).label : getMonthClusterKey(validDate).label;
        const distM = r.segmentDistanceMeters || 0;
        const distKm = (distM / 1000).toFixed(3);
        const vol = r.calculatedVolumeM3 || r.desiltingVolumeM3 || 0;

        if (isMaint) {
          return [
            `"${validDate.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})} – ${r.imoOffice || ''}"`,
            `"${validDate.toISOString().replace('T', ' ').substring(0, 19)}"`,
            `"${clusterKey}"`,
            `"${r.imoOffice || ''}"`,
            `"${r.nisBinding || ''}"`,
            `"${(r.locationName || '').replace(/"/g, '""')}"`,
            `"${(r.maintenanceActivity || r.title || '').replace(/"/g, '""')}"`,
            distM,
            distKm,
            r.depthMeters ?? '',
            r.widthMeters ?? '',
            r.sandPileHeightMeters ?? '',
            r.paintedAreaSqm ?? '',
            vol,
            `"${(r.dimensionDetailsFormatted || '').replace(/"/g, '""')}"`,
            `"${r.status || 'In Progress'}"`,
            `"${r.approvalStatus || 'Pending_PreApproval'}"`,
            `"${(r.reporterName || '').replace(/"/g, '""')}"`,
            `"${r.reporterRole || ''}"`,
            r.lat || '',
            r.lng || '',
            r.photos?.length || (r.photoUrl ? 1 : 0),
            `"${(r.remarks || '').replace(/"/g, '""')}"`
          ].join(',');
        } else {
          return [
            `"${validDate.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})} – ${r.imoOffice || ''}"`,
            `"${validDate.toISOString().replace('T', ' ').substring(0, 19)}"`,
            `"${clusterKey}"`,
            `"${r.imoOffice || ''}"`,
            `"${r.nisBinding || ''}"`,
            `"${(r.locationName || '').replace(/"/g, '""')}"`,
            `"${(r.canalSegment || r.structureName || '').replace(/"/g, '""')}"`,
            `"${r.operationalState || 'Fully Operational'}"`,
            r.dischargeFlowM3s ?? '',
            r.waterLevelMeters ?? '',
            r.gateOpeningCm ?? '',
            `"${r.waterQuality || 'Clear / Optimal'}"`,
            `"${(r.beneficiaryServiceArea || '').replace(/"/g, '""')}"`,
            `"${r.status || 'In Progress'}"`,
            `"${r.approvalStatus || 'Pending_PreApproval'}"`,
            `"${(r.reporterName || '').replace(/"/g, '""')}"`,
            `"${r.reporterRole || ''}"`,
            r.lat || '',
            r.lng || '',
            r.photos?.length || (r.photoUrl ? 1 : 0),
            `"${(r.remarks || '').replace(/"/g, '""')}"`
          ].join(',');
        }
      });

      const csvContent = 'data:text/csv;charset=utf-8,﻿' + [headers.join(','), ...rows].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `NIA_OM_${summaryMode.toUpperCase()}_Summary_${clusterMode}_${new Date().toISOString().substring(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.warn('CSV Export error:', err);
    }
  };

  // Export GeoJSON
  const handleExportGeoJSON = () => {
    try {
      const geoJson = convertFieldReportsToGeoJson(filteredReports, summaryMode === 'maintenance' ? 'maintenance' : 'operational');
      const filename = `NIA_OM_${summaryMode.toUpperCase()}_GIS_${clusterMode}_${new Date().toISOString().substring(0, 10)}.geojson`;
      triggerGeoJsonDownload(geoJson, filename);
    } catch (err) {
      console.warn('GeoJSON Export error:', err);
    }
  };

  // Print Summary
  const handlePrint = () => {
    window.print();
  };

  const getApprovalBadge = (status?: ApprovalStatus) => {
    switch (status) {
      case 'Approved':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 border border-emerald-500/30 flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-700 dark:text-emerald-400" /> Approved</span>;
      case 'PreApproved':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#166534]/15 text-[#166534] dark:text-emerald-200 border border-[#166534]/30 flex items-center gap-1"><FileCheck2 className="w-3 h-3 text-[#166534] dark:text-emerald-400" /> Pre-Approved</span>;
      case 'Rejected':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-800 dark:text-rose-200 border border-rose-500/30 flex items-center gap-1"><Ban className="w-3 h-3 text-rose-700 dark:text-rose-400" /> Rejected</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-800 dark:text-amber-200 border border-amber-500/30 flex items-center gap-1"><Clock className="w-3 h-3 text-amber-700 dark:text-amber-400" /> Pending</span>;
    }
  };

  const getOperationalStateBadge = (state?: OperationalState) => {
    switch (state) {
      case 'Fully Operational':
        return (
          <span className="px-2 py-0.5 rounded-lg text-[10.5px] font-bold bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border border-emerald-500/30 inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-600 dark:bg-emerald-400 animate-pulse" />
            <span>Fully Operational</span>
          </span>
        );
      case 'Partially Operational / Restricted Flow':
        return (
          <span className="px-2 py-0.5 rounded-lg text-[10.5px] font-bold bg-amber-500/15 text-amber-800 dark:text-amber-200 border border-amber-500/30 inline-flex items-center gap-1.5">
            <AlertTriangle className="w-3 h-3 text-amber-700 dark:text-amber-400" />
            <span>Restricted Flow</span>
          </span>
        );
      case 'Critical Fault / Inoperative':
        return (
          <span className="px-2 py-0.5 rounded-lg text-[10.5px] font-bold bg-rose-500/15 text-rose-800 dark:text-rose-200 border border-rose-500/30 inline-flex items-center gap-1.5">
            <Ban className="w-3 h-3 text-rose-700 dark:text-rose-400" />
            <span>Critical Fault</span>
          </span>
        );
      case 'Closed for Maintenance / Off-Season':
        return (
          <span className="px-2 py-0.5 rounded-lg text-[10.5px] font-bold bg-stone-500/15 text-stone-800 dark:text-slate-200 border border-stone-400/40 inline-flex items-center gap-1.5">
            <Clock className="w-3 h-3 text-stone-600 dark:text-slate-400" />
            <span>Closed / Off-Season</span>
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-lg text-[10.5px] font-bold bg-slate-800 text-slate-300 border border-slate-700 inline-flex items-center gap-1">
            <span>Normal Operation</span>
          </span>
        );
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        className="w-full max-w-6xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] h-full sm:h-auto overflow-hidden my-auto relative z-10"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Top Primary Mode Switcher Bar (Maintenance vs Operational Summary) */}
        <div className="px-3 sm:px-5 pt-3.5 pb-2.5 bg-slate-950/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider hidden sm:inline">
              Summary Mode:
            </span>
            <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800 shadow-inner">
              <button
                type="button"
                onClick={() => setSummaryMode('maintenance')}
                className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                  summaryMode === 'maintenance'
                    ? 'bg-[#15803d] text-white shadow-md font-bold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>Maintenance Report Summary</span>
              </button>
              <button
                type="button"
                onClick={() => setSummaryMode('operational')}
                className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                  summaryMode === 'operational'
                    ? 'bg-[#15803d] text-white shadow-md font-bold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Operational Report Summary</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-slate-800 text-slate-200 border border-slate-700 font-bold">
              {filteredReports.length} {summaryMode === 'maintenance' ? 'Maintenance' : 'Operational'} Record{filteredReports.length === 1 ? '' : 's'}
            </span>
          </div>
        </div>

        {/* Top Header Bar */}
        <div className="p-3 sm:p-4 border-b border-slate-800 bg-slate-900/95 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border shadow-inner shrink-0 ${
              summaryMode === 'maintenance'
                ? 'bg-gradient-to-br from-amber-500/20 to-teal-500/20 text-amber-300 border-amber-500/30'
                : 'bg-gradient-to-br from-cyan-500/20 to-blue-500/20 text-cyan-300 border-cyan-500/30'
            }`}>
              {summaryMode === 'maintenance' ? (
                <Wrench className="w-5 h-5 sm:w-6 sm:h-6" />
              ) : (
                <Activity className="w-5 h-5 sm:w-6 sm:h-6" />
              )}
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-white font-heading truncate">
                {summaryMode === 'maintenance' ? 'Irrigation Facility Maintenance Summary' : 'Irrigation Flow & Operational Status Summary'}
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-300 truncate">
                {summaryMode === 'maintenance' 
                  ? 'NIA MIMAROPA • Canal Desilting, Structural Repairs & Physical Accomplishments'
                  : 'NIA MIMAROPA • Water Delivery, Discharge Readings & System Status'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* View Switcher Tabs */}
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('ledger')}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'ledger'
                    ? 'bg-[#15803d] text-white shadow-sm font-bold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Ledger View</span>
                <span className="sm:hidden">Ledger</span>
              </button>

              {summaryMode === 'maintenance' && (
                <button
                  type="button"
                  onClick={() => setActiveTab('form691')}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'form691'
                      ? 'bg-[#15803d] text-white shadow-sm font-bold'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">WMR (Form 691)</span>
                  <span className="sm:hidden">WMR</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setActiveTab('photos')}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'photos'
                    ? 'bg-[#15803d] text-white shadow-sm font-bold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Photo Documentation</span>
                <span className="sm:hidden">Photos</span>
              </button>
            </div>

            {activeTab === 'ledger' && (
              <>
                {/* Weekly vs Monthly Switcher */}
                <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0">
                  <button
                    type="button"
                    onClick={() => setClusterMode('weekly')}
                    className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      clusterMode === 'weekly'
                        ? 'bg-[#15803d] text-white shadow-sm font-bold'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span className="hidden xs:inline">Weekly</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setClusterMode('monthly')}
                    className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      clusterMode === 'monthly'
                        ? 'bg-[#15803d] text-white shadow-sm font-bold'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                    <span className="hidden xs:inline">Monthly</span>
                  </button>
                </div>

                {/* Export CSV */}
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl border border-slate-700 transition cursor-pointer shrink-0 shadow-sm active:scale-95"
                  title="Download CSV Spreadsheet"
                >
                  <Download className="w-3.5 h-3.5 text-[#15803d]" />
                  <span className="hidden md:inline">Export CSV</span>
                </button>

                {/* Export GeoJSON */}
                <button
                  type="button"
                  onClick={handleExportGeoJSON}
                  className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl border border-slate-700 transition cursor-pointer shrink-0"
                  title="Export as QGIS / ArcGIS compliant GeoJSON Layer"
                >
                  <Layers className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="hidden md:inline">Export GeoJSON</span>
                </button>

                {/* Print Button */}
                <button
                  type="button"
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl border border-slate-700 transition cursor-pointer shrink-0"
                  title="Print Accomplishment Sheet"
                >
                  <Printer className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="hidden md:inline">Print</span>
                </button>
              </>
            )}

            {/* Close Modal Button */}
            <button 
              type="button"
              onClick={onClose}
              className="p-1.5 sm:p-2 text-slate-300 hover:text-white rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 transition shrink-0 cursor-pointer"
              title="Close window"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {activeTab === 'form691' ? (
          <div className="flex-1 overflow-y-auto min-h-0 p-3 sm:p-5">
            <Form691WeeklyReport
              reports={filteredReports}
              currentUser={currentUser}
              activeImo={activeImo}
              activeNis={activeNis}
              currentRole={currentRole}
            />
          </div>
        ) : activeTab === 'photos' ? (
          <div className="flex-1 overflow-y-auto min-h-0 p-3 sm:p-5">
            <Form691PhotoDocumentation
              reports={filteredReports}
              currentUser={currentUser}
              activeImo={activeImo}
              activeNis={activeNis}
              currentRole={currentRole}
            />
          </div>
        ) : (
          <>
            {/* Executive KPI Summary Cards Banner */}
            {summaryMode === 'maintenance' ? (
              <div className="p-3 sm:p-4 bg-slate-950/70 border-b border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0">
                {/* Metric 1: Total Length of Canal */}
                <div className="p-2.5 sm:p-3 bg-slate-900/90 rounded-xl border border-slate-800 space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-slate-300 tracking-wider flex items-center gap-1">
                    <Ruler className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Total Length of Canal</span>
                  </span>
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <span className="text-lg sm:text-2xl font-black text-white font-mono">{maintenanceKPIs.totalDistanceKm}</span>
                    <span className="text-xs text-slate-300 font-medium">km ({maintenanceKPIs.totalDistanceMeters.toLocaleString()} m)</span>
                  </div>
                </div>

                {/* Metric 2: No. of Structures */}
                <div className="p-2.5 sm:p-3 bg-slate-900/90 rounded-xl border border-slate-800 space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-slate-300 tracking-wider flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-cyan-400" />
                    <span>No. of Structures</span>
                  </span>
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <span className="text-lg sm:text-2xl font-black text-white font-mono">{maintenanceKPIs.structureCount}</span>
                    <span className="text-xs text-slate-300 font-medium">point structure{maintenanceKPIs.structureCount === 1 ? '' : 's'}</span>
                  </div>
                </div>

                {/* Metric 3: Maintained by IA */}
                <div className="p-2.5 sm:p-3 bg-slate-900/90 rounded-xl border border-slate-800 space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-slate-300 tracking-wider flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-amber-400" />
                    <span>Maintained by IA</span>
                  </span>
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <span className="text-lg sm:text-2xl font-black text-white font-mono">{maintenanceKPIs.maintainedByIACount}</span>
                    <span className="text-xs text-slate-300 font-medium">instance{maintenanceKPIs.maintainedByIACount === 1 ? '' : 's'}</span>
                  </div>
                </div>

                {/* Metric 4: Calculated Volume */}
                <div className="p-2.5 sm:p-3 bg-slate-900/90 rounded-xl border border-slate-800 space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-slate-300 tracking-wider flex items-center gap-1">
                    <Wrench className="w-3.5 h-3.5 text-purple-400" />
                    <span>Calculated Volume</span>
                  </span>
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <span className="text-lg sm:text-2xl font-black text-white font-mono">{maintenanceKPIs.totalDesiltingM3.toLocaleString()}</span>
                    <span className="text-xs text-slate-300 font-medium">m³</span>
                  </div>
                </div>
              </div>
            ) : (
              /* Operational Summary KPI Banner */
              <div className="p-3 sm:p-4 bg-slate-950/70 border-b border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0">
                {/* Metric 1: System Health Rate */}
                <div className="p-2.5 sm:p-3 bg-slate-900/90 rounded-xl border border-slate-800 space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-slate-300 tracking-wider flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Operational Health Rate</span>
                  </span>
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <span className="text-lg sm:text-2xl font-black text-white font-mono">{operationalKPIs.healthRatePct}%</span>
                    <span className="text-xs text-slate-300 font-medium">({operationalKPIs.fullyOperational}/{operationalKPIs.count} Normal)</span>
                  </div>
                </div>

                {/* Metric 2: Restricted / Critical Flow Alerts */}
                <div className="p-2.5 sm:p-3 bg-slate-900/90 rounded-xl border border-slate-800 space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-slate-300 tracking-wider flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    <span>Restricted / Critical</span>
                  </span>
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <span className="text-lg sm:text-2xl font-black text-white font-mono">{operationalKPIs.restrictedFlow + operationalKPIs.criticalInoperative}</span>
                    <span className="text-xs text-slate-300 font-medium">station alert{operationalKPIs.restrictedFlow + operationalKPIs.criticalInoperative === 1 ? '' : 's'}</span>
                  </div>
                </div>

                {/* Metric 3: Average Discharge Flow */}
                <div className="p-2.5 sm:p-3 bg-slate-900/90 rounded-xl border border-slate-800 space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-slate-300 tracking-wider flex items-center gap-1">
                    <Waves className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Avg Discharge Flow</span>
                  </span>
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <span className="text-lg sm:text-2xl font-black text-white font-mono">{operationalKPIs.avgDischarge}</span>
                    <span className="text-xs text-slate-300 font-medium">m³/s</span>
                  </div>
                </div>

                {/* Metric 4: Closed / Off-Season */}
                <div className="p-2.5 sm:p-3 bg-slate-900/90 rounded-xl border border-slate-800 space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-slate-300 tracking-wider flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Closed / Off-Season</span>
                  </span>
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <span className="text-lg sm:text-2xl font-black text-white font-mono">{operationalKPIs.closedMaintenance}</span>
                    <span className="text-xs text-slate-300 font-medium">station{operationalKPIs.closedMaintenance === 1 ? '' : 's'}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Filter Toolbar (Category Dropdown REMOVED for Maintenance Summary) */}
            <div className="p-3 sm:p-4 bg-slate-900/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
              <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[260px]">
                {/* Search Input */}
                <div className="relative flex-1 min-w-[150px]">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder={summaryMode === 'maintenance' ? "Search stationing, canal, activity..." : "Search station, flow rate, state..."}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 pl-8 pr-3 py-1.5 rounded-xl text-xs text-white placeholder-slate-400 focus:border-[#15803d] focus:outline-none"
                  />
                </div>

                {/* IMO Filter */}
                <select
                  value={imoFilter}
                  onChange={e => setImoFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-slate-200 text-xs px-2.5 py-1.5 rounded-xl focus:border-[#15803d] focus:outline-none cursor-pointer"
                >
                  {imoOptions.map(opt => (
                    <option key={opt} value={opt}>{opt === 'All' ? 'All IMO Offices' : opt}</option>
                  ))}
                </select>

                {/* Operational State Filter (Only displayed in Operational Report Summary mode) */}
                {summaryMode === 'operational' && (
                  <select
                    value={operationalStateFilter}
                    onChange={e => setOperationalStateFilter(e.target.value)}
                    className="bg-slate-950 border border-slate-800 text-slate-200 text-xs px-2.5 py-1.5 rounded-xl focus:border-[#15803d] focus:outline-none cursor-pointer"
                  >
                    <option value="All">All Operational States</option>
                    <option value="Fully Operational">Fully Operational</option>
                    <option value="Partially Operational / Restricted Flow">Restricted Flow</option>
                    <option value="Critical Fault / Inoperative">Critical Fault</option>
                    <option value="Closed for Maintenance / Off-Season">Closed / Off-Season</option>
                  </select>
                )}

                {/* Institutional Approval Tier Filter */}
                <select
                  value={tierFilter}
                  onChange={e => setTierFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-slate-200 text-xs px-2.5 py-1.5 rounded-xl focus:border-[#15803d] focus:outline-none cursor-pointer"
                >
                  <option value="All">All Hierarchy Tiers (7 Stages)</option>
                  {ORDERED_APPROVAL_TIERS.map(t => (
                    <option key={t} value={t}>Stage {TIER_CONFIG[t].stageNumber}: {TIER_CONFIG[t].shortLabel}</option>
                  ))}
                  <option value="Returned_For_Revision">Returned for Revision</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-slate-300 shrink-0">
                <button
                  type="button"
                  onClick={() => handleToggleAll(true)}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition cursor-pointer font-medium"
                >
                  Expand All
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleAll(false)}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition cursor-pointer font-medium"
                >
                  Collapse All
                </button>
              </div>
            </div>

            {/* Clustered Content Area */}
            <div className="flex-1 overflow-y-auto min-h-0 p-3 sm:p-5 space-y-4">
              {clusteredGroups.length === 0 ? (
                <div className="p-10 sm:p-14 text-center bg-slate-950/50 rounded-2xl border border-slate-800/80 space-y-2.5">
                  <FileText className="w-10 h-10 text-slate-600 mx-auto" />
                  <p className="text-sm font-semibold text-white">
                    No {summaryMode === 'maintenance' ? 'maintenance accomplishment' : 'operational status'} reports match the selected filters
                  </p>
                  <p className="text-xs text-slate-400">Try adjusting your IMO, operational state, or search query criteria.</p>
                </div>
              ) : (
                clusteredGroups.map(cluster => {
                  const isExpanded = expandedClusters[cluster.key] !== false;

                  return (
                    <div 
                      key={cluster.key}
                      className="bg-slate-950/80 border border-slate-800 rounded-2xl overflow-hidden shadow-lg transition-all"
                    >
                      {/* Cluster Header Bar */}
                      <div
                        onClick={() => toggleCluster(cluster.key)}
                        className="p-3 sm:p-4 bg-slate-900/90 hover:bg-slate-800/70 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-2.5 cursor-pointer select-none transition"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="text-slate-400 shrink-0">
                            {isExpanded ? <ChevronDown className="w-4 h-4 text-cyan-400" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                          </div>
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-xs sm:text-sm font-bold text-white font-heading">
                                {cluster.label}
                              </h3>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-200 font-bold border border-slate-700">
                                {cluster.reports.length} {cluster.reports.length === 1 ? 'Report' : 'Reports'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Cluster Metrics Quick Pill */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {summaryMode === 'maintenance' ? (
                            <>
                              {cluster.totalDistanceMeters > 0 && (
                                <div className="px-2 py-0.5 sm:px-2.5 sm:py-1 bg-emerald-950/40 border border-emerald-500/40 rounded-lg text-emerald-300 font-bold font-mono flex items-center gap-1.5 text-[11px] sm:text-xs">
                                  <Ruler className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                  <span>{cluster.totalDistanceMeters >= 1000 ? `${(cluster.totalDistanceMeters / 1000).toFixed(2)} km` : `${cluster.totalDistanceMeters.toLocaleString()} m`}</span>
                                </div>
                              )}

                              {cluster.totalDesiltingM3 > 0 && (
                                <div className="px-2 py-0.5 sm:px-2.5 sm:py-1 bg-amber-950/40 border border-amber-500/40 rounded-lg text-amber-300 font-bold font-mono flex items-center gap-1.5 text-[11px] sm:text-xs">
                                  <Wrench className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                  <span>{cluster.totalDesiltingM3.toLocaleString()} m³</span>
                                </div>
                              )}
                            </>
                          ) : (
                            <>
                              <div className="px-2 py-0.5 sm:px-2.5 sm:py-1 bg-emerald-950/40 border border-emerald-500/40 rounded-lg text-emerald-300 font-bold font-mono flex items-center gap-1 text-[11px] sm:text-xs">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                <span>{cluster.operationalNormalCount} Normal</span>
                              </div>
                              {cluster.operationalCriticalCount > 0 && (
                                <div className="px-2 py-0.5 sm:px-2.5 sm:py-1 bg-rose-950/40 border border-rose-500/40 rounded-lg text-rose-300 font-bold font-mono flex items-center gap-1 text-[11px] sm:text-xs">
                                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                                  <span>{cluster.operationalCriticalCount} Restricted</span>
                                </div>
                              )}
                            </>
                          )}

                          <div className="px-2 py-0.5 sm:px-2.5 sm:py-1 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 font-bold font-mono flex items-center gap-1 text-[11px] sm:text-xs">
                            <FileCheck2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                            <span>{cluster.approvedCount}/{cluster.reports.length} Approved</span>
                          </div>
                        </div>
                      </div>

                      {/* Cluster Data Table */}
                      {isExpanded && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs text-slate-300 divide-y divide-slate-800">
                            <thead className="bg-slate-900/60 text-[10px] uppercase font-bold text-slate-300 tracking-wider">
                              {summaryMode === 'maintenance' ? (
                                <tr>
                                  <th className="p-3">Date / Code</th>
                                  <th className="p-3">Location &amp; Stationing</th>
                                  <th className="p-3">Accomplishment Dist</th>
                                  <th className="p-3">Activity / Particulars</th>
                                  <th className="p-3">IMO &amp; Reporter</th>
                                  <th className="p-3">Status</th>
                                  <th className="p-3 text-center">Photos</th>
                                  <th className="p-3 text-right">Action</th>
                                </tr>
                              ) : (
                                <tr>
                                  <th className="p-3">Date &amp; Station</th>
                                  <th className="p-3">Canal Segment / System</th>
                                  <th className="p-3">Operational State</th>
                                  <th className="p-3">Hydraulic &amp; Flow Readings</th>
                                  <th className="p-3">IMO &amp; Reporter</th>
                                  <th className="p-3">Approval</th>
                                  <th className="p-3 text-center">Photos</th>
                                  <th className="p-3 text-right">Action</th>
                                </tr>
                              )}
                            </thead>
                            <tbody className="divide-y divide-slate-800/60 font-sans">
                              {cluster.reports.map(report => {
                                const dateStr = report.createdAt ? new Date(report.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A';
                                const photoCount = report.photos?.length || (report.photoUrl ? 1 : 0);

                                if (summaryMode === 'maintenance') {
                                  return (
                                    <tr key={report.id} className="hover:bg-slate-800/40 transition">
                                      <td className="p-3 whitespace-nowrap">
                                        <span className="font-semibold text-white block">{dateStr}</span>
                                      </td>

                                      <td className="p-3 max-w-xs">
                                        <div className="font-bold text-white text-xs truncate">
                                          {report.locationName || 'Irrigation Facility'}
                                        </div>
                                        <div className="text-[11px] text-slate-300 font-medium truncate">
                                          {report.canalSegment ? `Canal: ${report.canalSegment}` : (report.parcelId ? `Parcel: ${report.parcelId}` : '')}
                                        </div>
                                      </td>

                                      <td className="p-3 whitespace-nowrap font-mono font-bold">
                                        {report.segmentDistanceFormatted || (typeof report.segmentDistanceMeters === 'number' && report.segmentDistanceMeters > 0 ? (
                                          <span className="text-emerald-300">
                                            {report.segmentDistanceMeters >= 1000 
                                              ? `${(report.segmentDistanceMeters / 1000).toFixed(2)} km` 
                                              : `${report.segmentDistanceMeters.toLocaleString()} m`}
                                          </span>
                                        ) : (
                                          <span className="text-slate-400 font-normal">Point (0 m)</span>
                                        ))}
                                      </td>

                                      <td className="p-3 max-w-xs">
                                        <div className="text-white font-medium truncate">
                                          {report.maintenanceActivity || report.title}
                                        </div>
                                        {report.dimensionDetailsFormatted ? (
                                          <div className="text-[10px] text-amber-200 font-mono font-medium truncate" title={report.dimensionDetailsFormatted}>
                                            {report.dimensionDetailsFormatted}
                                          </div>
                                        ) : (
                                          (report.calculatedVolumeM3 || report.desiltingVolumeM3) ? (
                                            <div className="text-[10px] text-amber-300 font-mono">
                                              Vol: {(report.calculatedVolumeM3 || report.desiltingVolumeM3)?.toLocaleString()} m³
                                            </div>
                                          ) : (
                                            report.paintedAreaSqm ? (
                                              <div className="text-[10px] text-purple-300 font-mono">
                                                Painting: {report.paintedAreaSqm.toLocaleString()} m²
                                              </div>
                                            ) : null
                                          )
                                        )}
                                      </td>

                                      <td className="p-3 whitespace-nowrap">
                                        <div className="text-white text-xs font-medium">{report.reporterName || 'Field Personnel'}</div>
                                        <div className="text-[10px] text-slate-300">{report.imoOffice || 'IMO Office'}</div>
                                      </td>

                                      <td className="p-3 whitespace-nowrap">
                                         <div className="space-y-1">
                                           <div className="flex items-center gap-1.5 flex-wrap">
                                             <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${getTierBadgeStyle(getEffectiveReportTier(report))}`}>
                                               {getTierLabel(getEffectiveReportTier(report))}
                                             </span>
                                             {report.revisions && report.revisions.length > 1 && (
                                               <span className="text-[9px] px-1.5 py-0.5 rounded bg-teal-950 text-teal-300 border border-teal-700 font-mono">
                                                 v{report.revisions.length}
                                               </span>
                                             )}
                                           </div>
                                           <span className={`block text-[10px] font-semibold ${
                                             report.status === 'Completed' ? 'text-emerald-300' : 'text-amber-300'
                                           }`}>
                                             {report.status || 'In Progress'}
                                           </span>
                                         </div>
                                       </td>

                                      <td className="p-3 text-center whitespace-nowrap">
                                        {photoCount > 0 ? (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setActiveTab('photos');
                                            }}
                                            className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-800 hover:bg-[#15803d]/30 text-white hover:text-emerald-300 border border-slate-700 hover:border-emerald-500/50 inline-flex items-center gap-1.5 transition cursor-pointer active:scale-95 shadow-sm"
                                            title="Click to view full photo documentation"
                                          >
                                            <Camera className="w-3.5 h-3.5 text-emerald-400" />
                                            <span>{photoCount} Photo{photoCount > 1 ? 's' : ''}</span>
                                          </button>
                                        ) : (
                                          <span className="text-[10px] text-slate-500">None</span>
                                        )}
                                      </td>

                                      <td className="p-3 text-right whitespace-nowrap">
                                        <div className="flex items-center justify-end gap-1.5">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setSelectedReportForDiff(report);
                                              setIsDiffViewerOpen(true);
                                            }}
                                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-teal-300 border border-teal-500/30 hover:border-teal-400 rounded-lg text-xs font-semibold transition inline-flex items-center gap-1 cursor-pointer shadow-sm"
                                            title="Open Visual Revision Comparison Diff Viewer"
                                          >
                                            <GitCompare className="w-3.5 h-3.5 text-teal-400" />
                                            <span className="hidden md:inline">Diff</span>
                                          </button>

                                          {(() => {
                                            const adv = canUserAdvanceTier(report, currentUser || null, currentRole);
                                            if (adv.allowed && adv.nextTier) {
                                              return (
                                                <button
                                                  type="button"
                                                  onClick={() => handleAdvanceTier(report, adv.nextTier!, `Approved by ${currentRole}`)}
                                                  className="p-1.5 bg-[#15803d]/20 hover:bg-[#15803d]/40 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-semibold transition inline-flex items-center gap-1 cursor-pointer shadow-sm"
                                                  title={adv.actionLabel || 'Advance to next stage'}
                                                >
                                                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                                                  <span className="hidden md:inline">Advance</span>
                                                </button>
                                              );
                                            }
                                            return null;
                                          })()}

                                          {onPreviewReportPdf && (
                                            <button
                                              type="button"
                                              onClick={() => onPreviewReportPdf(report)}
                                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 hover:border-slate-500 rounded-lg text-xs font-semibold transition inline-flex items-center gap-1 cursor-pointer shadow-sm"
                                              title="Preview official PDF report"
                                            >
                                              <Eye className="w-3.5 h-3.5 text-cyan-400" />
                                              <span className="hidden sm:inline">PDF</span>
                                            </button>
                                          )}
                                          <button
                                            type="button"
                                            onClick={() => {
                                              onSelectReportOnMap(report);
                                              onClose();
                                            }}
                                            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 rounded-lg text-xs font-semibold transition inline-flex items-center gap-1 cursor-pointer"
                                            title="View location on map"
                                          >
                                            <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                                            <span>Map</span>
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                } else {
                                  // Operational Table Row
                                  return (
                                    <tr key={report.id} className="hover:bg-slate-800/40 transition">
                                      <td className="p-3 whitespace-nowrap">
                                        <span className="font-semibold text-white block">{dateStr}</span>
                                        <span className="text-[10px] text-slate-400 font-mono">{report.locationName || 'Station'}</span>
                                      </td>

                                      <td className="p-3 max-w-xs">
                                        <div className="font-bold text-white text-xs truncate">
                                          {report.canalSegment || report.nisBinding || 'Irrigation Canal Reach'}
                                        </div>
                                        <div className="text-[11px] text-slate-300 font-medium truncate">
                                          {report.structureName ? `Structure: ${report.structureName}` : (report.nisBinding || '')}
                                        </div>
                                      </td>

                                      <td className="p-3 whitespace-nowrap">
                                        {getOperationalStateBadge(report.operationalState)}
                                      </td>

                                      <td className="p-3 max-w-xs">
                                        <div className="flex items-center gap-2 flex-wrap text-[11px] font-mono">
                                          {typeof report.dischargeFlowM3s === 'number' && report.dischargeFlowM3s > 0 && (
                                            <span className="px-1.5 py-0.5 rounded bg-cyan-950/60 text-cyan-200 border border-cyan-800/40">
                                              Flow: <strong>{report.dischargeFlowM3s}</strong> m³/s
                                            </span>
                                          )}
                                          {typeof report.waterLevelMeters === 'number' && report.waterLevelMeters > 0 && (
                                            <span className="px-1.5 py-0.5 rounded bg-blue-950/60 text-blue-200 border border-blue-800/40">
                                              Level: <strong>{report.waterLevelMeters}</strong> m
                                            </span>
                                          )}
                                          {typeof report.gateOpeningCm === 'number' && report.gateOpeningCm > 0 && (
                                            <span className="px-1.5 py-0.5 rounded bg-purple-950/60 text-purple-200 border border-purple-800/40">
                                              Gate: <strong>{report.gateOpeningCm}</strong> cm
                                            </span>
                                          )}
                                        </div>
                                        {report.waterQuality && (
                                          <div className="text-[10px] text-slate-300 font-medium mt-0.5">
                                            Water Quality: {report.waterQuality}
                                          </div>
                                        )}
                                      </td>

                                      <td className="p-3 whitespace-nowrap">
                                        <div className="text-white text-xs font-medium">{report.reporterName || 'Field Personnel'}</div>
                                        <div className="text-[10px] text-slate-300">{report.imoOffice || 'IMO Office'}</div>
                                      </td>

                                      <td className="p-3 whitespace-nowrap">
                                         <div className="space-y-1">
                                           <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${getTierBadgeStyle(getEffectiveReportTier(report))}`}>
                                             {getTierLabel(getEffectiveReportTier(report))}
                                           </span>
                                           {report.revisions && report.revisions.length > 1 && (
                                             <span className="block text-[9px] px-1.5 py-0.5 rounded bg-teal-950 text-teal-300 border border-teal-700 font-mono w-fit">
                                               v{report.revisions.length}
                                             </span>
                                           )}
                                         </div>
                                       </td>

                                      <td className="p-3 text-center whitespace-nowrap">
                                        {photoCount > 0 ? (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setActiveTab('photos');
                                            }}
                                            className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-800 hover:bg-cyan-500/20 text-white hover:text-cyan-300 border border-slate-700 hover:border-cyan-500/50 inline-flex items-center gap-1.5 transition cursor-pointer active:scale-95 shadow-sm"
                                            title="Click to view full photo documentation"
                                          >
                                            <Camera className="w-3.5 h-3.5 text-cyan-400" />
                                            <span>{photoCount} Photo{photoCount > 1 ? 's' : ''}</span>
                                          </button>
                                        ) : (
                                          <span className="text-[10px] text-slate-500">None</span>
                                        )}
                                      </td>

                                      <td className="p-3 text-right whitespace-nowrap">
                                        <div className="flex items-center justify-end gap-1.5">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setSelectedReportForDiff(report);
                                              setIsDiffViewerOpen(true);
                                            }}
                                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-teal-300 border border-teal-500/30 hover:border-teal-400 rounded-lg text-xs font-semibold transition inline-flex items-center gap-1 cursor-pointer shadow-sm"
                                            title="Open Visual Revision Comparison Diff Viewer"
                                          >
                                            <GitCompare className="w-3.5 h-3.5 text-teal-400" />
                                            <span className="hidden md:inline">Diff</span>
                                          </button>

                                          {(() => {
                                            const adv = canUserAdvanceTier(report, currentUser || null, currentRole);
                                            if (adv.allowed && adv.nextTier) {
                                              return (
                                                <button
                                                  type="button"
                                                  onClick={() => handleAdvanceTier(report, adv.nextTier!, `Approved by ${currentRole}`)}
                                                  className="p-1.5 bg-[#15803d]/20 hover:bg-[#15803d]/40 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-semibold transition inline-flex items-center gap-1 cursor-pointer shadow-sm"
                                                  title={adv.actionLabel || 'Advance to next stage'}
                                                >
                                                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                                                  <span className="hidden md:inline">Advance</span>
                                                </button>
                                              );
                                            }
                                            return null;
                                          })()}

                                          {onPreviewReportPdf && (
                                            <button
                                              type="button"
                                              onClick={() => onPreviewReportPdf(report)}
                                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 hover:border-slate-500 rounded-lg text-xs font-semibold transition inline-flex items-center gap-1 cursor-pointer shadow-sm"
                                              title="Preview official PDF report"
                                            >
                                              <Eye className="w-3.5 h-3.5 text-cyan-400" />
                                              <span className="hidden sm:inline">PDF</span>
                                            </button>
                                          )}
                                          <button
                                            type="button"
                                            onClick={() => {
                                              onSelectReportOnMap(report);
                                              onClose();
                                            }}
                                            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 rounded-lg text-xs font-semibold transition inline-flex items-center gap-1 cursor-pointer"
                                            title="View location on map"
                                          >
                                            <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                                            <span>Map</span>
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                }
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

        {/* Modal Bottom Footer */}
        <div className="p-3 sm:p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs text-slate-300 shrink-0">
          <div className="flex items-center gap-2">
            <span>💡 <strong>Tip:</strong> Filter by Weekly or Monthly clusters to generate official submission reports. Press <strong>Esc</strong> anytime to close.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl border border-slate-700 transition cursor-pointer"
          >
            Close Window
          </button>
        </div>

      </div>

      {/* Visual Revision Comparison Diff Viewer Modal */}
      {isDiffViewerOpen && selectedReportForDiff && (
        <ReportRevisionDiffViewer
          isOpen={isDiffViewerOpen}
          onClose={() => {
            setIsDiffViewerOpen(false);
            setSelectedReportForDiff(null);
          }}
          report={selectedReportForDiff}
          currentRole={currentRole}
          currentUser={currentUser || null}
          onAdvanceTier={handleAdvanceTier}
          onRequestRevision={handleRequestRevision}
          onEditRevision={(rep, snapshot) => {
            if (onEditReport) {
              onEditReport(rep, snapshot);
              onClose();
            }
          }}
        />
      )}
    </div>
  );
};

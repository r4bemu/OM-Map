export type UserRole = 
  | 'Developer'
  | 'RO Admin'
  | 'RO Evaluator' 
  | 'RO Reviewer' 
  | 'RO Preparer' 
  | 'IMO Admin'
  | 'IMO Evaluator' 
  | 'IMO Reviewer' 
  | 'IMO Preparer' 
  | 'Field Personnel' 
  | 'Viewer';

export type ApprovalStatus = 'Draft' | 'Pending_PreApproval' | 'PreApproved' | 'Approved' | 'Rejected';

export type ApprovalTier = 
  | 'Pending_IMO_Preparer'
  | 'Pending_IMO_Reviewer'
  | 'Pending_IMO_Evaluator'
  | 'Pending_RO_Preparer'
  | 'Pending_RO_Reviewer'
  | 'Pending_RO_Evaluator'
  | 'Approved_RO_Evaluator'
  | 'Returned_For_Revision';

export interface FieldDiffItem {
  fieldName: string;
  fieldLabel: string;
  oldValue: any;
  newValue: any;
  category: 'location' | 'measurement' | 'status' | 'general' | 'photos';
}

export interface ReportRevision {
  revisionNumber: number;
  createdAt: string;
  createdBy: string;
  createdById?: string;
  createdRole: UserRole;
  changeSummary?: string;
  snapshot: Partial<FieldReport>;
  diffs?: FieldDiffItem[];
}

export interface TierActionHistory {
  id: string;
  tier: ApprovalTier;
  action: 'submitted' | 'pre_approved' | 'approved' | 'revised' | 'forwarded' | 'returned_for_revision';
  actorName: string;
  actorId?: string;
  actorRole: UserRole;
  timestamp: string;
  comments?: string;
  revisionNumber?: number;
}

export interface AuthUser {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  passcode: string;
  imoOffice: string; // e.g. 'Regional Office IV-B' | 'Mindoro Oriental-Marinduque-Romblon IMO' | 'Occidental Mindoro IMO' | 'Palawan IMO' | 'All IMOs'
  nisBinding?: string; // e.g. 'Baco-Bucayao RIS' | 'Mag-asawang Tubig RIS' | 'All NIS'
  avatar?: string;
  designation?: string;
  email?: string;
  googleId?: string;
  isAdmitted?: boolean;
  createdAt?: string;
}

export type BasemapType = 'satellite' | 'dark' | 'streets';

export type ReportTimeScope = 'current_and_prev_week' | 'past_4_weeks' | 'past_3_months' | 'all';

export interface AvailableCloudWeek {
  key: string;
  label: string;
  startDate: string;
  endDate: string;
  reportCount: number;
  isCurrentWeek?: boolean;
  isPrevWeek?: boolean;
}

export type MeasureTool = 'none' | 'distance' | 'area' | 'pin' | 'radius';

export type ReportCategoryMode = 'maintenance' | 'operational';

export type MaintenanceActivityType = 
  | 'Desilting / Clearing of Canal (Mechanical)'
  | 'Desilting / Clearing of Canal (Manual)'
  | 'Brush Dam / Dredging at Water Source'
  | 'Gate Lubrication'
  | 'Temporary Fix'
  | 'Canal Repair / Construction'
  | 'Service Road Maintenance'
  | 'Painting / Repainting'
  | 'Staff Gauge Installation / Maintenance'
  | 'Herbicide / Vegetation Control (Chemical)'
  | 'Farm Ditch / Lateral Restoration'
  | 'Other Repair / Maintenance';

export type OperationalState = 
  | 'Fully Operational'
  | 'Partially Operational / Restricted Flow'
  | 'Critical Fault / Inoperative'
  | 'Closed for Maintenance / Off-Season';

export type WaterQualityLevel = 
  | 'Clear / Optimal'
  | 'Moderate Siltation'
  | 'Heavy Sedimentation'
  | 'Debris / Trash Blockage';

export type ReportType = 'maintenance' | 'operational' | 'desilting_work' | 'land_parcel_status' | 'hazard' | 'infrastructure';

export type ReportStatus = 'In Progress' | 'Completed' | 'Suspended' | 'Inspection Required' | 'Delayed';

export interface PhotoFramingConfig {
  mode: 'fit-width' | 'fit-height' | 'custom';
  zoom: number; // 0.5 to 2.0 (default 1.0 = 100%)
  panStep: number; // -10 to +10 (0 = center)
  offsetXPercent?: number; // Normalized -100 to +100
  offsetYPercent?: number; // Normalized -100 to +100
  naturalWidth?: number;
  naturalHeight?: number;
  naturalAspectRatio?: number;
  rotation?: number; // 0, 90, 180, 270
}

export interface PhotoAttachment {
  id: string;
  url: string; // The framed 4:3 canvas (1400x1050 px)
  sourceDataUrl?: string; // Original lossless uncropped upload for non-destructive re-framing
  dataUrl?: string; // Standard 4:3 canvas representation
  stage?: 'Before' | 'During' | 'After';
  caption?: string;
  capturedAt?: string;
  imoOffice?: string;
  locationName?: string;
  canalSegment?: string;
  parcelId?: string;
  lat?: number;
  lng?: number;
  featureName?: string;
  driveFileId?: string;
  driveUrl?: string;
  sizeBytes?: number; // In bytes (e.g. 250,000 = ~244 KB)
  framingConfig?: PhotoFramingConfig;
}

export interface GeoJSONFeatureProperties {
  [key: string]: any;
}

export interface GISLayer {
  id: string;
  name: string;
  fileName?: string;
  category: 'Canals' | 'Structures' | 'Maintenance' | 'Operations' | 'Canal Networks' | 'Maintenance Reports' | 'Operational Status Reports';
  subCategory?: 'Main Canals' | 'Lateral Canals' | 'Other Unclassified Canals' | 'Unclassified Canals' | 'Structures' | 'Canals' | 'Parcels' | 'Maintenance Reports' | 'Operational Status Reports';
  visible: boolean;
  color: string;
  opacity: number;
  data: any; // GeoJSON FeatureCollection
  featureCount: number;
  geometryType: 'LineString' | 'Point' | 'Mixed';
  sizeBytes?: number;
  uploadedAt: string;
  isDefault?: boolean;
  imoOffice?: string;
  driveFileId?: string;
  driveModifiedTime?: string;
  source?: 'Google Drive' | 'Local Upload' | 'Firestore' | 'Default Sample';
  approvalStatus?: ApprovalStatus;
  approvedBy?: string;
  approvedAt?: string;
}

export interface LocationPick {
  lat: number;
  lng: number;
  name?: string;
  stationing?: string;
  featureName?: string;
  featureCode?: string;
}

export interface FieldReport {
  id: string;
  title: string; // Activity Description / Particulars
  reportType: ReportType;
  categoryMode?: ReportCategoryMode;
  imoOffice?: string;
  nisBinding?: string;
  
  // Locations
  lat: number;
  lng: number;
  secondLat?: number;
  secondLng?: number;
  locationName?: string; // e.g. "Main Canal 0+150" or "Main Canal 0+150 to 0+450"
  pathCoords?: [number, number][]; // Line coordinates along canal network
  
  // Auto-detected details from map
  canalSegment?: string;
  parcelId?: string;
  structureName?: string;

  // Maintenance Specific
  maintenanceActivity?: MaintenanceActivityType | string;
  
  // Operational Specific
  operationalState?: OperationalState;
  waterLevelMeters?: number;
  dischargeFlowM3s?: number;
  gateOpeningCm?: number;
  waterQuality?: WaterQualityLevel;
  beneficiaryServiceArea?: string;
  operationalIncident?: string;

  // Shared Status & Details
  status: 'In Progress' | 'Completed' | 'Suspended' | ReportStatus;
  suspensionReason?: string;
  performedBy?: ('IMO' | 'IA' | 'Others')[] | 'IMO' | 'IA' | 'Others' | string;
  performedByList?: ('IMO' | 'IA' | 'Others')[];
  performedByDetails?: string;
  performedByIA?: string;
  remarks: string;
  reporterName: string;
  reporterRole: UserRole;
  reporterDesignation?: string;
  verifierName?: string;
  verifierDesignation?: string;
  revisionNumber?: number;
  revisionHistory?: { revisionNumber: number; modifiedAt: string; modifiedBy?: string; reason?: string }[];
  createdAt: string;
  synced: boolean;
  
  // Multi-Tier Institutional Approval Chain & Revision Tracking
  currentTier?: ApprovalTier;
  submittedByUserId?: string;
  submittedByUsername?: string;
  submittedByRole?: UserRole;
  revisions?: ReportRevision[];
  activeRevisionNumber?: number;
  tierHistory?: TierActionHistory[];

  // Legacy Two-Tier Approval Pipeline Metadata (Maintained for backwards compatibility)
  approvalStatus?: ApprovalStatus;
  preApprovedBy?: string;
  preApprovedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;

  // Photos
  photoUrl?: string; // Backwards compatibility single photo
  photos?: PhotoAttachment[];
  
  // Activity Measurements & Calculated Dimensions
  segmentDistanceMeters?: number;
  segmentDistanceFormatted?: string;
  depthMeters?: number;
  widthMeters?: number;
  sandPileHeightMeters?: number;
  paintedAreaSqm?: number;
  calculatedVolumeM3?: number;
  dimensionDetailsFormatted?: string;
  completionPercent?: number;
  desiltingVolumeM3?: number;
  hazardSeverity?: 'Low' | 'Medium' | 'High' | 'Critical';
}

export interface MeasurementResult {
  type: MeasureTool;
  coordinates: [number, number][];
  distanceMeters?: number;
  areaSqMeters?: number;
  radiusMeters?: number;
}

export interface SpatialFilter {
  searchQuery: string;
  reportTypeFilter: string;
  statusFilter: string;
  layerCategoryFilter: string;
  dateRange: string;
}

export interface LocationFilter {
  imo: string;
  nis: string;
  province: string;
  activityCategory?: string; // e.g. 'All Activities' | 'Desilting / Clearing of Canal (Mechanical)' | 'Gate Lubrication' | etc.
  municipality?: string;
  barangay?: string;
}

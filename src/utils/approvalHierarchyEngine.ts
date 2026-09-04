import { ApprovalTier, FieldReport, UserRole, AuthUser, FieldDiffItem } from '../types';

export const ORDERED_APPROVAL_TIERS: ApprovalTier[] = [
  'Pending_IMO_Preparer',
  'Pending_IMO_Reviewer',
  'Pending_IMO_Evaluator',
  'Pending_RO_Preparer',
  'Pending_RO_Reviewer',
  'Pending_RO_Evaluator',
  'Approved_RO_Evaluator'
];

export function normalizeUserRole(role?: string | null): UserRole {
  if (!role) return 'Viewer';
  const r = role.trim();
  if (r === 'RO Admin') return 'RO Evaluator';
  if (r === 'RO Evaluator') return 'RO Reviewer';
  if (r === 'IMO Admin') return 'IMO Evaluator';
  if (r === 'NIS In-Charge' || r === 'NIS In-charge') return 'IMO Reviewer';
  if (r === 'NIS Preparer') return 'IMO Preparer';
  return r as UserRole;
}

export const TIER_CONFIG: Record<ApprovalTier, {
  label: string;
  shortLabel: string;
  requiredRole: UserRole | 'Published';
  stageNumber: number;
  badgeStyle: string;
  description: string;
}> = {
  Pending_IMO_Preparer: {
    label: 'Pending IMO Preparer',
    shortLabel: 'IMO Prep Review',
    requiredRole: 'IMO Preparer',
    stageNumber: 1,
    badgeStyle: 'bg-teal-500/20 text-teal-300 border-teal-500/40',
    description: 'Submitted from field; awaiting review and pre-approval by IMO Preparer.'
  },
  Pending_IMO_Reviewer: {
    label: 'Pending IMO Reviewer',
    shortLabel: 'IMO Reviewer',
    requiredRole: 'IMO Reviewer',
    stageNumber: 2,
    badgeStyle: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
    description: 'Pre-approved by IMO Preparer; awaiting review & approval by IMO O&M Reviewer.'
  },
  Pending_IMO_Evaluator: {
    label: 'Pending IMO Evaluator',
    shortLabel: 'IMO Evaluator',
    requiredRole: 'IMO Evaluator',
    stageNumber: 3,
    badgeStyle: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    description: 'Approved by IMO Reviewer; awaiting evaluation & approval by IMO Division Manager.'
  },
  Pending_RO_Preparer: {
    label: 'Pending RO Preparer',
    shortLabel: 'RO Prep',
    requiredRole: 'RO Preparer',
    stageNumber: 4,
    badgeStyle: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
    description: 'Endorsed by IMO; awaiting regional packaging and consolidation.'
  },
  Pending_RO_Reviewer: {
    label: 'Pending RO Reviewer',
    shortLabel: 'RO Reviewer',
    requiredRole: 'RO Reviewer',
    stageNumber: 5,
    badgeStyle: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    description: 'Consolidated; awaiting regional technical & compliance review.'
  },
  Pending_RO_Evaluator: {
    label: 'Pending RO Evaluator',
    shortLabel: 'RO Evaluator',
    requiredRole: 'RO Evaluator',
    stageNumber: 6,
    badgeStyle: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    description: 'Reviewed; awaiting final regional executive evaluation & publishing approval.'
  },
  Approved_RO_Evaluator: {
    label: 'Approved & Published',
    shortLabel: 'Published',
    requiredRole: 'Published',
    stageNumber: 7,
    badgeStyle: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold',
    description: 'Fully approved by Regional Office and published across GIS layers and public records.'
  },
  Returned_For_Revision: {
    label: 'Returned for Revision',
    shortLabel: 'Needs Revision',
    requiredRole: 'Field Personnel',
    stageNumber: 0,
    badgeStyle: 'bg-rose-500/20 text-rose-300 border-rose-500/40 font-bold',
    description: 'Returned by reviewer with feedback; requires submitter modifications.'
  }
};

/**
 * Returns the effective approval tier of a report, resolving backwards compatibility
 */
export function getEffectiveReportTier(report: FieldReport): ApprovalTier {
  const current = report.currentTier as string | undefined;
  if (current) {
    if (TIER_CONFIG[current as ApprovalTier]) {
      return current as ApprovalTier;
    }
    // Backward compatibility mapping for stored tier names
    if (current === 'Pending_NIS_Preparer') return 'Pending_IMO_Preparer';
    if (current === 'Pending_NIS_InCharge') return 'Pending_IMO_Reviewer';
    if (current === 'Pending_IMO_Admin') return 'Pending_IMO_Evaluator';
    if (current === 'Pending_RO_Evaluator') return 'Pending_RO_Reviewer';
    if (current === 'Pending_RO_Admin') return 'Pending_RO_Evaluator';
    if (current === 'Approved_RO_Admin') return 'Approved_RO_Evaluator';
  }
  // Fallbacks for legacy reports
  if (report.approvalStatus === 'Approved') {
    return 'Approved_RO_Evaluator';
  }
  if (report.approvalStatus === 'PreApproved') {
    return 'Pending_IMO_Evaluator';
  }
  if (report.approvalStatus === 'Rejected') {
    return 'Returned_For_Revision';
  }
  return 'Pending_IMO_Preparer';
}

export function getTierLabel(tier: ApprovalTier): string {
  return TIER_CONFIG[tier]?.label || tier;
}

export function getTierShortLabel(tier: ApprovalTier): string {
  return TIER_CONFIG[tier]?.shortLabel || tier;
}

export function getTierBadgeStyle(tier: ApprovalTier): string {
  return TIER_CONFIG[tier]?.badgeStyle || 'bg-slate-800 text-slate-300 border-slate-700';
}

export function getNextTier(tier: ApprovalTier): ApprovalTier | null {
  switch (tier) {
    case 'Pending_IMO_Preparer': return 'Pending_IMO_Reviewer';
    case 'Pending_IMO_Reviewer': return 'Pending_IMO_Evaluator';
    case 'Pending_IMO_Evaluator': return 'Pending_RO_Preparer';
    case 'Pending_RO_Preparer': return 'Pending_RO_Reviewer';
    case 'Pending_RO_Reviewer': return 'Pending_RO_Evaluator';
    case 'Pending_RO_Evaluator': return 'Approved_RO_Evaluator';
    case 'Returned_For_Revision': return 'Pending_IMO_Preparer';
    default: return null;
  }
}

/**
 * Checks if a user has permission to view the report
 */
export function canUserViewReport(report: FieldReport, user: AuthUser | null, role: UserRole): boolean {
  const normRole = normalizeUserRole(role);
  const effectiveTier = getEffectiveReportTier(report);
  if (normRole === 'Viewer') {
    return effectiveTier === 'Approved_RO_Evaluator';
  }
  return true;
}

/**
 * Checks if the user can directly edit the report or must create a revision
 */
export function canUserEditReport(
  report: FieldReport,
  user: AuthUser | null,
  activeRole: UserRole
): { allowed: boolean; mode: 'direct_edit' | 'create_revision' | 'locked'; reason?: string } {
  const normRole = normalizeUserRole(activeRole);
  if (normRole === 'Developer') {
    return { allowed: true, mode: 'direct_edit' };
  }

  const effectiveTier = getEffectiveReportTier(report);

  // If already published, direct editing is prohibited for everyone except Developer
  if (effectiveTier === 'Approved_RO_Evaluator') {
    return {
      allowed: false,
      mode: 'locked',
      reason: 'This report has received final regional approval and is published. Direct edits are locked.'
    };
  }

  // 1. Field Personnel Rules
  if (normRole === 'Field Personnel') {
    const isOriginalAuthor = Boolean(
      (user?.id && report.submittedByUserId === user.id) ||
      (user?.username && report.submittedByUsername === user.username) ||
      (user?.name && report.reporterName?.toLowerCase() === user.name.toLowerCase())
    );

    if (!isOriginalAuthor) {
      return {
        allowed: false,
        mode: 'locked',
        reason: 'Field personnel can only edit or revise reports submitted by themselves.'
      };
    }

    if (effectiveTier === 'Pending_IMO_Preparer' || effectiveTier === 'Returned_For_Revision') {
      return { allowed: true, mode: 'direct_edit' };
    }

    // Report has already been advanced beyond IMO Preparer
    return {
      allowed: true,
      mode: 'create_revision',
      reason: `Report is currently at ${getTierLabel(effectiveTier)}. Direct editing is locked, but you can submit a new revision.`
    };
  }

  // 2. IMO Preparer Rules
  if (normRole === 'IMO Preparer') {
    if (effectiveTier === 'Pending_IMO_Preparer' || effectiveTier === 'Returned_For_Revision') {
      return { allowed: true, mode: 'direct_edit' };
    }
    return {
      allowed: true,
      mode: 'create_revision',
      reason: `Report is currently at ${getTierLabel(effectiveTier)}. Direct editing is locked, but you can submit a new revision.`
    };
  }

  // 3. IMO Reviewer Rules
  if (normRole === 'IMO Reviewer') {
    if (effectiveTier === 'Pending_IMO_Reviewer' || effectiveTier === 'Pending_IMO_Preparer') {
      return { allowed: true, mode: 'direct_edit' };
    }
    return {
      allowed: true,
      mode: 'create_revision',
      reason: `Report is currently at ${getTierLabel(effectiveTier)}. Direct editing is locked, but you can submit a revision.`
    };
  }

  // 4. IMO Evaluator Rules
  if (normRole === 'IMO Evaluator') {
    if (effectiveTier === 'Pending_IMO_Evaluator' || effectiveTier === 'Pending_IMO_Reviewer' || effectiveTier === 'Pending_IMO_Preparer') {
      return { allowed: true, mode: 'direct_edit' };
    }
    return {
      allowed: true,
      mode: 'create_revision',
      reason: `Report has been forwarded to Regional Office (${getTierLabel(effectiveTier)}). Direct edit is locked.`
    };
  }

  // 5. RO Preparer Rules
  if (normRole === 'RO Preparer') {
    if (effectiveTier === 'Pending_RO_Preparer' || effectiveTier === 'Pending_IMO_Evaluator') {
      return { allowed: true, mode: 'direct_edit' };
    }
    return {
      allowed: true,
      mode: 'create_revision',
      reason: `Report has advanced to ${getTierLabel(effectiveTier)}.`
    };
  }

  // 6. RO Reviewer Rules
  if (normRole === 'RO Reviewer') {
    if (effectiveTier === 'Pending_RO_Reviewer' || effectiveTier === 'Pending_RO_Preparer') {
      return { allowed: true, mode: 'direct_edit' };
    }
    return {
      allowed: true,
      mode: 'create_revision',
      reason: `Report has advanced to ${getTierLabel(effectiveTier)}.`
    };
  }

  // 7. RO Evaluator Rules
  if (normRole === 'RO Evaluator') {
    return { allowed: true, mode: 'direct_edit' };
  }

  // Viewer
  return {
    allowed: false,
    mode: 'locked',
    reason: 'Viewers have read-only access.'
  };
}

/**
 * Validates if the current user can advance the report to the next approval stage
 */
export function canUserAdvanceTier(
  report: FieldReport,
  user: AuthUser | null,
  activeRole: UserRole
): { allowed: boolean; nextTier?: ApprovalTier; actionLabel?: string } {
  const normRole = normalizeUserRole(activeRole);
  const effectiveTier = getEffectiveReportTier(report);

  if (normRole === 'Developer') {
    const next = getNextTier(effectiveTier);
    return {
      allowed: Boolean(next),
      nextTier: next || undefined,
      actionLabel: next === 'Approved_RO_Evaluator' ? 'Final Regional Approval (Publish)' : `Advance to ${getTierShortLabel(next || effectiveTier)}`
    };
  }

  switch (effectiveTier) {
    case 'Pending_IMO_Preparer':
      if (normRole === 'IMO Preparer' || normRole === 'IMO Reviewer' || normRole.startsWith('RO') || normRole === 'IMO Evaluator') {
        return {
          allowed: true,
          nextTier: 'Pending_IMO_Reviewer',
          actionLabel: 'Pre-Approve & Advance to IMO Reviewer'
        };
      }
      break;

    case 'Pending_IMO_Reviewer':
      if (normRole === 'IMO Reviewer' || normRole === 'IMO Evaluator' || normRole.startsWith('RO')) {
        return {
          allowed: true,
          nextTier: 'Pending_IMO_Evaluator',
          actionLabel: 'Approve & Advance to IMO Evaluator'
        };
      }
      break;

    case 'Pending_IMO_Evaluator':
      if (normRole === 'IMO Evaluator' || normRole.startsWith('RO')) {
        return {
          allowed: true,
          nextTier: 'Pending_RO_Preparer',
          actionLabel: 'IMO Approve & Forward to Regional Office'
        };
      }
      break;

    case 'Pending_RO_Preparer':
      if (normRole === 'RO Preparer' || normRole === 'RO Reviewer' || normRole === 'RO Evaluator') {
        return {
          allowed: true,
          nextTier: 'Pending_RO_Reviewer',
          actionLabel: 'Consolidate & Forward to RO Reviewer'
        };
      }
      break;

    case 'Pending_RO_Reviewer':
      if (normRole === 'RO Reviewer' || normRole === 'RO Evaluator') {
        return {
          allowed: true,
          nextTier: 'Pending_RO_Evaluator',
          actionLabel: 'Review & Forward to RO Evaluator'
        };
      }
      break;

    case 'Pending_RO_Evaluator':
      if (normRole === 'RO Evaluator') {
        return {
          allowed: true,
          nextTier: 'Approved_RO_Evaluator',
          actionLabel: 'Grant Final Regional Approval (Publish)'
        };
      }
      break;

    case 'Returned_For_Revision':
      if (normRole === 'Field Personnel' || normRole === 'IMO Preparer') {
        return {
          allowed: true,
          nextTier: 'Pending_IMO_Preparer',
          actionLabel: 'Re-Submit for IMO Preparer Review'
        };
      }
      break;
  }

  return { allowed: false };
}

/**
 * Computes deep field differences between two report snapshots
 */
export function computeFieldDiffs(
  oldSnapshot: Partial<FieldReport>,
  newSnapshot: Partial<FieldReport>
): FieldDiffItem[] {
  const diffs: FieldDiffItem[] = [];

  const check = (
    fieldName: string,
    fieldLabel: string,
    category: FieldDiffItem['category'],
    formatter?: (v: any) => any
  ) => {
    const rawOld = (oldSnapshot as any)[fieldName];
    const rawNew = (newSnapshot as any)[fieldName];

    const oldVal = formatter ? formatter(rawOld) : rawOld;
    const newVal = formatter ? formatter(rawNew) : rawNew;

    // Normalizing empty strings, undefined, null
    const normOld = oldVal === undefined || oldVal === null ? '' : oldVal;
    const normNew = newVal === undefined || newVal === null ? '' : newVal;

    if (JSON.stringify(normOld) !== JSON.stringify(normNew)) {
      diffs.push({
        fieldName,
        fieldLabel,
        oldValue: normOld,
        newValue: normNew,
        category
      });
    }
  };

  // 1. Location & Geography
  check('locationName', 'Location / Stationing', 'location');
  check('canalSegment', 'Canal Reach / Code', 'location');
  check('lat', 'Start Latitude', 'location', v => typeof v === 'number' ? v.toFixed(5) : v);
  check('lng', 'Start Longitude', 'location', v => typeof v === 'number' ? v.toFixed(5) : v);
  check('secondLat', 'End Latitude', 'location', v => typeof v === 'number' ? v.toFixed(5) : v);
  check('secondLng', 'End Longitude', 'location', v => typeof v === 'number' ? v.toFixed(5) : v);
  check('segmentDistanceMeters', 'Canal Distance (m)', 'location', v => typeof v === 'number' ? `${v.toFixed(1)} m` : v);

  // 2. Physical Measurements
  check('maintenanceActivity', 'Maintenance Activity', 'measurement');
  check('depthMeters', 'Depth (m)', 'measurement', v => typeof v === 'number' ? `${v} m` : v);
  check('widthMeters', 'Width (m)', 'measurement', v => typeof v === 'number' ? `${v} m` : v);
  check('sandPileHeightMeters', 'Sand Pile Height (m)', 'measurement', v => typeof v === 'number' ? `${v} m` : v);
  check('paintedAreaSqm', 'Painted Area (m²)', 'measurement', v => typeof v === 'number' ? `${v} m²` : v);
  check('calculatedVolumeM3', 'Computed Volume (m³)', 'measurement', v => typeof v === 'number' ? `${v.toLocaleString()} m³` : v);
  check('dimensionDetailsFormatted', 'Dimension Summary', 'measurement');

  // 3. Operational State
  check('operationalState', 'Operational State', 'status');
  check('dischargeFlowM3s', 'Discharge Flow (m³/s)', 'status', v => typeof v === 'number' ? `${v} m³/s` : v);
  check('waterLevelMeters', 'Water Level (m)', 'status', v => typeof v === 'number' ? `${v} m` : v);
  check('gateOpeningCm', 'Gate Opening (cm)', 'status', v => typeof v === 'number' ? `${v} cm` : v);
  check('waterQuality', 'Water Quality', 'status');

  // 4. General & Status
  check('status', 'Work Progress Status', 'general');
  check('performedBy', 'Work Performed By', 'general');
  check('remarks', 'Field Remarks & Notes', 'general');

  // 5. Photos count
  const oldPhotosCount = Array.isArray(oldSnapshot.photos) ? oldSnapshot.photos.length : (oldSnapshot.photoUrl ? 1 : 0);
  const newPhotosCount = Array.isArray(newSnapshot.photos) ? newSnapshot.photos.length : (newSnapshot.photoUrl ? 1 : 0);
  if (oldPhotosCount !== newPhotosCount) {
    diffs.push({
      fieldName: 'photos',
      fieldLabel: 'Attached Photos',
      oldValue: `${oldPhotosCount} photo(s)`,
      newValue: `${newPhotosCount} photo(s)`,
      category: 'photos'
    });
  }

  return diffs;
}

import { ApprovalTier, FieldReport, UserRole, AuthUser, FieldDiffItem } from '../types';

export const ORDERED_APPROVAL_TIERS: ApprovalTier[] = [
  'Pending_NIS_Preparer',
  'Pending_NIS_InCharge',
  'Pending_IMO_Admin',
  'Pending_RO_Preparer',
  'Pending_RO_Evaluator',
  'Pending_RO_Admin',
  'Approved_RO_Admin'
];

export const TIER_CONFIG: Record<ApprovalTier, {
  label: string;
  shortLabel: string;
  requiredRole: UserRole | 'Published';
  stageNumber: number;
  badgeStyle: string;
  description: string;
}> = {
  Pending_NIS_Preparer: {
    label: 'Pending NIS Preparer',
    shortLabel: 'NIS Prep Review',
    requiredRole: 'NIS Preparer',
    stageNumber: 1,
    badgeStyle: 'bg-teal-500/20 text-teal-300 border-teal-500/40',
    description: 'Submitted from field; awaiting review and pre-approval by NIS Preparer.'
  },
  Pending_NIS_InCharge: {
    label: 'Pending NIS In-Charge',
    shortLabel: 'NIS In-Charge',
    requiredRole: 'NIS In-Charge',
    stageNumber: 2,
    badgeStyle: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
    description: 'Pre-approved by NIS Preparer; awaiting review & approval by System Engineer.'
  },
  Pending_IMO_Admin: {
    label: 'Pending IMO Admin',
    shortLabel: 'IMO Admin',
    requiredRole: 'IMO Admin',
    stageNumber: 3,
    badgeStyle: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    description: 'Approved by NIS In-Charge; awaiting approval by IMO Division Manager.'
  },
  Pending_RO_Preparer: {
    label: 'Pending RO Preparer',
    shortLabel: 'RO Prep',
    requiredRole: 'RO Preparer',
    stageNumber: 4,
    badgeStyle: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
    description: 'Endorsed by IMO; awaiting regional packaging and consolidation.'
  },
  Pending_RO_Evaluator: {
    label: 'Pending RO Evaluator',
    shortLabel: 'RO Evaluator',
    requiredRole: 'RO Evaluator',
    stageNumber: 5,
    badgeStyle: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    description: 'Consolidated; awaiting regional technical & compliance evaluation.'
  },
  Pending_RO_Admin: {
    label: 'Pending RO Admin',
    shortLabel: 'RO Executive',
    requiredRole: 'RO Admin',
    stageNumber: 6,
    badgeStyle: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    description: 'Evaluated; awaiting final regional executive publishing approval.'
  },
  Approved_RO_Admin: {
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
  if (report.currentTier && TIER_CONFIG[report.currentTier]) {
    return report.currentTier;
  }
  // Fallbacks for legacy reports
  if (report.approvalStatus === 'Approved') {
    return 'Approved_RO_Admin';
  }
  if (report.approvalStatus === 'PreApproved') {
    return 'Pending_IMO_Admin';
  }
  if (report.approvalStatus === 'Rejected') {
    return 'Returned_For_Revision';
  }
  return 'Pending_NIS_Preparer';
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
    case 'Pending_NIS_Preparer': return 'Pending_NIS_InCharge';
    case 'Pending_NIS_InCharge': return 'Pending_IMO_Admin';
    case 'Pending_IMO_Admin': return 'Pending_RO_Preparer';
    case 'Pending_RO_Preparer': return 'Pending_RO_Evaluator';
    case 'Pending_RO_Evaluator': return 'Pending_RO_Admin';
    case 'Pending_RO_Admin': return 'Approved_RO_Admin';
    case 'Returned_For_Revision': return 'Pending_NIS_Preparer';
    default: return null;
  }
}

/**
 * Checks if a user has permission to view the report
 */
export function canUserViewReport(report: FieldReport, user: AuthUser | null, role: UserRole): boolean {
  const effectiveTier = getEffectiveReportTier(report);
  if (role === 'Viewer') {
    return effectiveTier === 'Approved_RO_Admin';
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
  if (activeRole === 'Developer') {
    return { allowed: true, mode: 'direct_edit' };
  }

  const effectiveTier = getEffectiveReportTier(report);

  // If already published, direct editing is prohibited for everyone except Developer
  if (effectiveTier === 'Approved_RO_Admin') {
    return {
      allowed: false,
      mode: 'locked',
      reason: 'This report has received final regional approval and is published. Direct edits are locked.'
    };
  }

  // 1. Field Personnel Rules
  if (activeRole === 'Field Personnel') {
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

    if (effectiveTier === 'Pending_NIS_Preparer' || effectiveTier === 'Returned_For_Revision') {
      return { allowed: true, mode: 'direct_edit' };
    }

    // Report has already been advanced beyond NIS Preparer
    return {
      allowed: true,
      mode: 'create_revision',
      reason: `Report is currently at ${getTierLabel(effectiveTier)}. Direct editing is locked, but you can submit a new revision.`
    };
  }

  // 2. NIS Preparer Rules
  if (activeRole === 'NIS Preparer') {
    if (effectiveTier === 'Pending_NIS_Preparer' || effectiveTier === 'Returned_For_Revision') {
      return { allowed: true, mode: 'direct_edit' };
    }
    return {
      allowed: true,
      mode: 'create_revision',
      reason: `Report is currently at ${getTierLabel(effectiveTier)}. Direct editing is locked, but you can submit a new revision.`
    };
  }

  // 3. NIS In-Charge Rules
  if (activeRole === 'NIS In-Charge') {
    if (effectiveTier === 'Pending_NIS_InCharge') {
      return { allowed: true, mode: 'direct_edit' };
    }
    if (effectiveTier === 'Pending_NIS_Preparer') {
      return { allowed: true, mode: 'direct_edit' };
    }
    return {
      allowed: true,
      mode: 'create_revision',
      reason: `Report is currently at ${getTierLabel(effectiveTier)}. Direct editing is locked, but you can submit a revision.`
    };
  }

  // 4. IMO Admin Rules
  if (activeRole === 'IMO Admin') {
    if (effectiveTier === 'Pending_IMO_Admin' || effectiveTier === 'Pending_NIS_InCharge' || effectiveTier === 'Pending_NIS_Preparer') {
      return { allowed: true, mode: 'direct_edit' };
    }
    return {
      allowed: true,
      mode: 'create_revision',
      reason: `Report has been forwarded to Regional Office (${getTierLabel(effectiveTier)}). Direct edit is locked.`
    };
  }

  // 5. RO Preparer Rules
  if (activeRole === 'RO Preparer') {
    if (effectiveTier === 'Pending_RO_Preparer' || effectiveTier === 'Pending_IMO_Admin') {
      return { allowed: true, mode: 'direct_edit' };
    }
    return {
      allowed: true,
      mode: 'create_revision',
      reason: `Report has advanced to ${getTierLabel(effectiveTier)}.`
    };
  }

  // 6. RO Evaluator Rules
  if (activeRole === 'RO Evaluator') {
    if (effectiveTier === 'Pending_RO_Evaluator' || effectiveTier === 'Pending_RO_Preparer') {
      return { allowed: true, mode: 'direct_edit' };
    }
    return {
      allowed: true,
      mode: 'create_revision',
      reason: `Report has advanced to ${getTierLabel(effectiveTier)}.`
    };
  }

  // 7. RO Admin Rules
  if (activeRole === 'RO Admin') {
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
  const effectiveTier = getEffectiveReportTier(report);

  if (activeRole === 'Developer') {
    const next = getNextTier(effectiveTier);
    return {
      allowed: Boolean(next),
      nextTier: next || undefined,
      actionLabel: next === 'Approved_RO_Admin' ? 'Final Regional Approval (Publish)' : `Advance to ${getTierShortLabel(next || effectiveTier)}`
    };
  }

  switch (effectiveTier) {
    case 'Pending_NIS_Preparer':
      if (activeRole === 'NIS Preparer' || activeRole === 'NIS In-Charge' || activeRole.startsWith('RO') || activeRole === 'IMO Admin') {
        return {
          allowed: true,
          nextTier: 'Pending_NIS_InCharge',
          actionLabel: 'Pre-Approve & Advance to NIS In-Charge'
        };
      }
      break;

    case 'Pending_NIS_InCharge':
      if (activeRole === 'NIS In-Charge' || activeRole === 'IMO Admin' || activeRole.startsWith('RO')) {
        return {
          allowed: true,
          nextTier: 'Pending_IMO_Admin',
          actionLabel: 'Approve & Advance to IMO Admin'
        };
      }
      break;

    case 'Pending_IMO_Admin':
      if (activeRole === 'IMO Admin' || activeRole.startsWith('RO')) {
        return {
          allowed: true,
          nextTier: 'Pending_RO_Preparer',
          actionLabel: 'IMO Approve & Forward to Regional Office'
        };
      }
      break;

    case 'Pending_RO_Preparer':
      if (activeRole === 'RO Preparer' || activeRole === 'RO Evaluator' || activeRole === 'RO Admin') {
        return {
          allowed: true,
          nextTier: 'Pending_RO_Evaluator',
          actionLabel: 'Consolidate & Forward to RO Evaluator'
        };
      }
      break;

    case 'Pending_RO_Evaluator':
      if (activeRole === 'RO Evaluator' || activeRole === 'RO Admin') {
        return {
          allowed: true,
          nextTier: 'Pending_RO_Admin',
          actionLabel: 'Evaluate & Forward to RO Admin'
        };
      }
      break;

    case 'Pending_RO_Admin':
      if (activeRole === 'RO Admin') {
        return {
          allowed: true,
          nextTier: 'Approved_RO_Admin',
          actionLabel: 'Grant Final Regional Approval (Publish)'
        };
      }
      break;

    case 'Returned_For_Revision':
      if (activeRole === 'Field Personnel' || activeRole === 'NIS Preparer') {
        return {
          allowed: true,
          nextTier: 'Pending_NIS_Preparer',
          actionLabel: 'Re-Submit for NIS Preparer Review'
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

import { MaintenanceActivityType, OperationalState } from '../types';

export const STRUCTURE_BLUE_COLOR = '#0284c7'; // Sky / Azure Blue
export const CANAL_MAIN_COLOR = '#38bdf8';      // Light Sky Blue
export const CANAL_LATERAL_COLOR = '#2563eb';   // Royal Blue
export const CANAL_OTHER_COLOR = '#1e3a8a';     // Deep Navy / Dark Blue

// NON-BLUE, Distinct Palette for 12 Maintenance Activity Categories
export const MAINTENANCE_ACTIVITY_CONFIG: Record<string, { id: string; label: string; color: string; desc: string }> = {
  'Desilting / Clearing of Canal (Mechanical)': {
    id: 'layer-activity-desilting-mech',
    label: 'Desilting / Clearing (Mechanical)',
    color: '#f59e0b', // Amber / Goldenrod
    desc: 'Heavy machine / excavator desilting and sediment removal'
  },
  'Desilting / Clearing of Canal (Manual)': {
    id: 'layer-activity-desilting-manual',
    label: 'Desilting / Clearing (Manual)',
    color: '#ea580c', // Deep Orange
    desc: 'Manual desilting, vegetation clearing, and silt removal'
  },
  'Brush Dam / Dredging at Water Source': {
    id: 'layer-activity-brush-dam',
    label: 'Brush Dam / Dredging at Source',
    color: '#c2410c', // Terracotta / Rust
    desc: 'Dredging, brush dam construction & intake source maintenance'
  },
  'Gate Lubrication': {
    id: 'layer-activity-gate-lube',
    label: 'Gate Lubrication & Servicing',
    color: '#a855f7', // Purple / Violet
    desc: 'Steel spindle, gear greasing, and mechanism servicing'
  },
  'Temporary Fix': {
    id: 'layer-activity-temp-fix',
    label: 'Temporary Fix / Emergency',
    color: '#ec4899', // Pink / Rose
    desc: 'Sandbagging, emergency plug, and quick stabilization'
  },
  'Canal Repair / Construction': {
    id: 'layer-activity-canal-repair',
    label: 'Canal Repair / Construction',
    color: '#10b981', // Emerald Green
    desc: 'Concrete lining repair, joint sealing, and masonry works'
  },
  'Service Road Maintenance': {
    id: 'layer-activity-service-road',
    label: 'Service Road Maintenance',
    color: '#84cc16', // Lime / Olive Green
    desc: 'Gravel re-gravelling, grading, and shoulder restoration'
  },
  'Painting / Repainting': {
    id: 'layer-activity-painting',
    label: 'Painting / Repainting',
    color: '#e11d48', // Crimson Red
    desc: 'Anti-corrosion primer and protective painting on gates & staff gauges'
  },
  'Staff Gauge Installation / Maintenance': {
    id: 'layer-activity-staff-gauge',
    label: 'Staff Gauge Installation / Maint.',
    color: '#06b6d4', // Cyan / Aqua
    desc: 'Staff gauge mounting, gauge calibration, and elevation markings'
  },
  'Herbicide / Vegetation Control (Chemical)': {
    id: 'layer-activity-herbicide',
    label: 'Herbicide / Vegetation Control',
    color: '#eab308', // Sunflower Yellow / Gold
    desc: 'Chemical weed control along canal embankments and ROW'
  },
  'Farm Ditch / Lateral Restoration': {
    id: 'layer-activity-farm-ditch',
    label: 'Farm Ditch / Lateral Restoration',
    color: '#14b8a6', // Teal / Turquoise
    desc: 'Farm ditch excavation, lateral profiling, and turnout restoration'
  },
  'Other Repair / Maintenance': {
    id: 'layer-activity-other',
    label: 'Other Repair / Maintenance',
    color: '#d946ef', // Fuchsia / Magenta
    desc: 'Specialized, cable wire, or unclassified field maintenance works'
  }
};

// NON-BLUE, Distinct Palette for Operational Statuses
export const OPERATIONAL_STATE_CONFIG: Record<string, { id: string; label: string; color: string; desc: string }> = {
  'Fully Operational': {
    id: 'layer-operational-fully-operational',
    label: 'Fully Operational',
    color: '#22c55e', // Vibrant Spring Green
    desc: 'Optimal discharge and unrestricted water conveyance'
  },
  'Partially Operational / Restricted Flow': {
    id: 'layer-operational-partially-operational',
    label: 'Partially Operational / Restricted',
    color: '#eab308', // Sunflower Yellow
    desc: 'Restricted flow, minor siltation, or partial gate opening'
  },
  'Critical Fault / Inoperative': {
    id: 'layer-operational-critical-fault',
    label: 'Critical Fault / Inoperative',
    color: '#ef4444', // Alert Red
    desc: 'Canal breach, gate jam, or zero conveyance emergency'
  },
  'Closed for Maintenance / Off-Season': {
    id: 'layer-operational-closed-maintenance',
    label: 'Closed for Maintenance / Off-Season',
    color: '#71717a', // Slate / Zinc
    desc: 'Scheduled dry-up, seasonal shutdown, or major overhaul'
  }
};

/**
 * Returns a guaranteed NON-BLUE distinct color for any field report activity or operational state.
 */
export function getActivityColor(
  activityOrState?: string,
  categoryMode?: 'maintenance' | 'operational'
): string {
  if (!activityOrState) {
    return categoryMode === 'operational' ? '#22c55e' : '#f59e0b';
  }

  const raw = activityOrState.trim();

  // 1. Direct match in Maintenance Activity Config
  if (MANINTENANCE_MATCH(raw)) {
    return MANINTENANCE_MATCH(raw);
  }

  // 2. Direct match in Operational State Config
  if (OPERATIONAL_MATCH(raw)) {
    return OPERATIONAL_MATCH(raw);
  }

  // 3. Fallback deterministic non-blue hash color
  return getDeterministicNonBlueColor(raw);
}

function MANINTENANCE_MATCH(raw: string): string | null {
  for (const [key, cfg] of Object.entries(MAINTENANCE_ACTIVITY_CONFIG)) {
    if (raw === key || raw.toLowerCase() === key.toLowerCase() || raw.toLowerCase().includes(cfg.label.toLowerCase())) {
      return cfg.color;
    }
  }
  const lower = raw.toLowerCase();
  if (lower.includes('staff gauge') || lower.includes('gauge')) return '#06b6d4';
  if (lower.includes('herbicide') || lower.includes('chemical') || lower.includes('weed')) return '#eab308';
  if (lower.includes('farm ditch') || lower.includes('lateral restoration')) return '#14b8a6';
  if (lower.includes('mech') || (lower.includes('desilting') && lower.includes('clearing'))) return '#f59e0b';
  if (lower.includes('manual') || lower.includes('desilting')) return '#ea580c';
  if (lower.includes('dredging') || lower.includes('brush dam') || lower.includes('brass dam') || lower.includes('source')) return '#c2410c';
  if (lower.includes('gate') || lower.includes('lube') || lower.includes('lubrication') || lower.includes('greas')) return '#a855f7';
  if (lower.includes('temp') || lower.includes('emergency')) return '#ec4899';
  if (lower.includes('repair') || lower.includes('construction') || lower.includes('lining') || lower.includes('concrete')) return '#10b981';
  if (lower.includes('road') || lower.includes('service') || lower.includes('shoulder')) return '#84cc16';
  if (lower.includes('paint') || lower.includes('repainting') || lower.includes('rust') || lower.includes('primer')) return '#e11d48';
  if (lower.includes('other') || lower.includes('special')) return '#d946ef';
  return null;
}

function OPERATIONAL_MATCH(raw: string): string | null {
  for (const [key, cfg] of Object.entries(OPERATIONAL_STATE_CONFIG)) {
    if (raw === key || raw.toLowerCase() === key.toLowerCase() || raw.toLowerCase().includes(cfg.label.toLowerCase())) {
      return cfg.color;
    }
  }
  const lower = raw.toLowerCase();
  if (lower.includes('fully') || lower.includes('optimal') || lower.includes('normal')) return '#22c55e';
  if (lower.includes('partial') || lower.includes('restrict')) return '#eab308';
  if (lower.includes('critical') || lower.includes('fault') || lower.includes('inoperative') || lower.includes('breach') || lower.includes('fail')) return '#ef4444';
  if (lower.includes('closed') || lower.includes('off-season') || lower.includes('dry-up') || lower.includes('shut')) return '#71717a';
  return null;
}

// Deterministic non-blue fallback palette
const FALLBACK_NON_BLUE_PALETTE = [
  '#f59e0b', // Amber
  '#10b981', // Emerald
  '#ea580c', // Orange
  '#a855f7', // Purple
  '#ec4899', // Pink
  '#84cc16', // Lime
  '#e11d48', // Crimson
  '#d946ef', // Fuchsia
  '#14b8a6', // Teal
  '#f97316', // Bright Orange
  '#8b5cf6', // Violet
  '#065f46'  // Forest Green
];

function getDeterministicNonBlueColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % FALLBACK_NON_BLUE_PALETTE.length;
  return FALLBACK_NON_BLUE_PALETTE[index];
}

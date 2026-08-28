/**
 * NIA MIMAROPA – 3-Level Photo Caption Wizard Data Tree
 * Covers 12 Maintenance Activity Categories x 3 Stages (BEFORE / DURING / AFTER)
 * Based on official NIA MIMAROPA Maintenance Activity Photo Caption Guidelines
 */

export type CaptionStage = 'BEFORE' | 'DURING' | 'AFTER';

export type CaptionActivityCode = 
  | 'A' // Desilting / Clearing of Canal (Mechanical)
  | 'B' // Desilting / Clearing of Canal (Manual)
  | 'C' // Brush Dam / Dredging at Water Source
  | 'D' // Gate Lubrication
  | 'E' // Temporary Fix
  | 'F' // Canal Repair / Construction
  | 'G' // Service Road Maintenance
  | 'H' // Painting / Repainting
  | 'I' // Staff Gauge Installation / Maintenance
  | 'K' // Herbicide / Vegetation Control (Chemical)
  | 'L' // Farm Ditch / Lateral Restoration
  | 'M'; // Other Repair / Maintenance

export interface Tap1Situation {
  id: string;
  emoji: string;
  label: string;
  subjectToken: string;
  autoDeclared?: boolean;
  t2Options: Tap2Detail[];
  t3Options: Tap3Context[];
}

export interface Tap2Detail {
  id: string;
  emoji: string;
  label: string;
  token: string; // The auto-inserted phrase, e.g. "with vegetation overgrowth", "scooping and desilting canal bed"
}

export interface Tap3Context {
  id: string;
  emoji: string;
  label: string;
  token: string; // The auto-inserted functional context / outcome phrase
  notes?: string;
}

export interface StageCaptionConfig {
  stage: CaptionStage;
  skipT1?: boolean;
  situations: Tap1Situation[];
}

export interface ActivityCaptionCategory {
  code: CaptionActivityCode;
  name: string;
  aliases: string[];
  stages: Record<CaptionStage, StageCaptionConfig>;
}

export const PHOTO_CAPTION_CATEGORIES: ActivityCaptionCategory[] = [
  // =========================================================================
  // A: Desilting / Clearing of Canal (Mechanical)
  // =========================================================================
  {
    code: 'A',
    name: 'Desilting / Clearing of Canal (Mechanical)',
    aliases: [
      'Desilting / Clearing of Canal (Mechanical)',
      'Desilting Mechanical',
      'Mechanical Desilting',
      'Desilting'
    ],
    stages: {
      BEFORE: {
        stage: 'BEFORE',
        situations: [
          {
            id: 'A-B-T1a',
            emoji: '🏞️',
            label: 'Silted canal bed',
            subjectToken: 'Canal bed',
            t2Options: [
              { id: 'A-B-T2a', emoji: '🌿', label: 'Vegetation overgrowth', token: 'with vegetation overgrowth' },
              { id: 'A-B-T2b', emoji: '💧', label: 'Soil accumulation / erosion', token: 'with soil accumulation and erosion' },
              { id: 'A-B-T2c', emoji: '🏖️', label: 'Fine sand (Banlik)', token: 'with fine sand (banlik) deposit' },
              { id: 'A-B-T2d', emoji: '🪨', label: 'Gravel / aggregate buildup', token: 'with gravel and aggregate buildup' },
              { id: 'A-B-T2e', emoji: '🗑️', label: 'Garbage / waste material', token: 'with garbage and waste material' },
              { id: 'A-B-T2f', emoji: '🚧', label: 'Intentional obstacle', token: 'with intentional obstruction' },
              { id: 'A-B-T2g', emoji: '🪵', label: 'Large obstacle (tree trunk)', token: 'with large obstacle (tree trunk / wooden post)' }
            ],
            t3Options: [
              { id: 'A-B-T3a', emoji: '✅', label: 'Acceptable, needs sustaining', token: 'acceptable condition, but needs to be sustained' },
              { id: 'A-B-T3b', emoji: '📉', label: 'Medium reduced flow', token: 'causing medium reduction in water flow' },
              { id: 'A-B-T3c', emoji: '⚠️', label: 'Critically reduced flow', token: 'causing critically reduced water flow' },
              { id: 'A-B-T3d', emoji: '🔴', label: 'No water flow', token: 'with no water flow' }
            ]
          },
          {
            id: 'A-B-T1b',
            emoji: '🏔️',
            label: 'Silted canal embankment',
            subjectToken: 'Canal embankment',
            t2Options: [
              { id: 'A-B-T2h', emoji: '💧', label: 'Soil accumulation / erosion', token: 'with soil accumulation and erosion' },
              { id: 'A-B-T2i', emoji: '🌿', label: 'Vegetation overgrowth', token: 'with vegetation overgrowth' },
              { id: 'A-B-T2j', emoji: '🪨', label: 'Gravel / aggregate buildup', token: 'with gravel and aggregate buildup' }
            ],
            t3Options: [
              { id: 'A-B-T3e', emoji: '✅', label: 'Acceptable, needs sustaining', token: 'acceptable condition, but needs to be sustained' },
              { id: 'A-B-T3f', emoji: '📉', label: 'Medium reduced flow', token: 'causing medium reduction in water flow' },
              { id: 'A-B-T3g', emoji: '⚠️', label: 'Critically reduced flow', token: 'causing critically reduced water flow' },
              { id: 'A-B-T3h', emoji: '🔴', label: 'No water flow', token: 'with no water flow' }
            ]
          },
          {
            id: 'A-B-T1c',
            emoji: '📐',
            label: 'Silted canal slide slope',
            subjectToken: 'Canal slide slope',
            t2Options: [
              { id: 'A-B-T2k', emoji: '🏖️', label: 'Fine sand (Banlik)', token: 'with fine sand (banlik) deposit' },
              { id: 'A-B-T2l', emoji: '💧', label: 'Soil accumulation', token: 'with soil accumulation' },
              { id: 'A-B-T2m', emoji: '🌿', label: 'Vegetation overgrowth', token: 'with vegetation overgrowth' }
            ],
            t3Options: [
              { id: 'A-B-T3i', emoji: '✅', label: 'Acceptable, needs sustaining', token: 'acceptable condition, but needs to be sustained' },
              { id: 'A-B-T3j', emoji: '📉', label: 'Medium reduced flow', token: 'causing medium reduction in water flow' },
              { id: 'A-B-T3k', emoji: '⚠️', label: 'Critically reduced flow', token: 'causing critically reduced water flow' },
              { id: 'A-B-T3l', emoji: '🔴', label: 'No water flow', token: 'with no water flow' }
            ]
          },
          {
            id: 'A-B-T1d',
            emoji: '🌊',
            label: 'Eroded earth canal',
            subjectToken: 'Earth canal',
            t2Options: [
              { id: 'A-B-T2n', emoji: '🌊', label: 'Eroded canal walls', token: 'with eroded canal walls' },
              { id: 'A-B-T2o', emoji: '💧', label: 'Soil accumulation / erosion', token: 'with soil accumulation and erosion' },
              { id: 'A-B-T2p', emoji: '🌿', label: 'Vegetation overgrowth', token: 'with vegetation overgrowth' }
            ],
            t3Options: [
              { id: 'A-B-T3m', emoji: '✅', label: 'Acceptable, needs sustaining', token: 'acceptable condition, but needs to be sustained' },
              { id: 'A-B-T3n', emoji: '📉', label: 'Medium reduced flow', token: 'causing medium reduction in water flow' },
              { id: 'A-B-T3o', emoji: '⚠️', label: 'Critically reduced flow', token: 'causing critically reduced water flow' },
              { id: 'A-B-T3p', emoji: '🔴', label: 'No water flow', token: 'with no water flow' }
            ]
          },
          {
            id: 'A-B-T1e',
            emoji: '🚧',
            label: 'Headgate / intake structure',
            subjectToken: 'Headgate / intake structure',
            t2Options: [
              { id: 'A-B-T2q', emoji: '🗑️', label: 'Clogged with debris', token: 'clogged with accumulated debris' },
              { id: 'A-B-T2r', emoji: '💧', label: 'Restricted water entry', token: 'with restricted water entry' },
              { id: 'A-B-T2s', emoji: '🌿', label: 'Blocked by vegetation', token: 'blocked by vegetation growth' },
              { id: 'A-B-T2t', emoji: '🔓', label: 'Stuck open', token: 'stuck open and unable to control flow' },
              { id: 'A-B-T2u', emoji: '🔒', label: 'Stuck close', token: 'stuck closed and blocking water entry' }
            ],
            t3Options: [
              { id: 'A-B-T3q', emoji: '⚠️', label: 'Unable to control flow', token: 'causing inability to control water flow' },
              { id: 'A-B-T3r', emoji: '✅', label: 'Acceptable, needs sustaining', token: 'acceptable condition, but needs to be sustained' },
              { id: 'A-B-T3s', emoji: '📉', label: 'Reduced flow', token: 'reducing water flow' },
              { id: 'A-B-T3t', emoji: '🔴', label: 'No water flow', token: 'blocking water flow' }
            ]
          }
        ]
      },
      DURING: {
        stage: 'DURING',
        situations: [
          {
            id: 'A-D-T1a',
            emoji: '🚜',
            label: 'Excavator working in canal',
            subjectToken: 'Excavator',
            t2Options: [
              { id: 'A-D-T2a', emoji: '⛏️', label: 'Scooping / desilting', token: 'scooping and desilting canal bed' },
              { id: 'A-D-T2b', emoji: '🌿', label: 'Removing vegetation', token: 'removing vegetation from canal' },
              { id: 'A-D-T2c', emoji: '🧱', label: 'Clearing canal lining', token: 'clearing canal lining' },
              { id: 'A-D-T2d', emoji: '🌊', label: 'Earth canal restoration', token: 'restoring earth canal profile' },
              { id: 'A-D-T2e', emoji: '🚧', label: 'Clearing at headgate', token: 'clearing debris at headgate' }
            ],
            t3Options: [
              { id: 'A-D-T3a', emoji: '🏛️', label: 'Using NIA equipment', token: 'using NIA equipment' },
              { id: 'A-D-T3b', emoji: '🤝', label: 'Using IA equipment', token: 'using IA equipment' },
              { id: 'A-D-T3c', emoji: '🔑', label: 'Using rented equipment', token: 'using rented equipment' }
            ]
          },
          {
            id: 'A-D-T1b',
            emoji: '🚛',
            label: 'Silt material disposal',
            subjectToken: 'Silt material',
            t2Options: [
              { id: 'A-D-T2f', emoji: '🚛', label: 'Loaded to dump truck', token: 'loaded to dump truck for hauling' },
              { id: 'A-D-T2g', emoji: '🏔️', label: 'Piled on canal bank', token: 'temporarily piled on canal bank' },
              { id: 'A-D-T2h', emoji: '🛣️', label: 'Reused for road leveling', token: 'reused for service road leveling' }
            ],
            t3Options: [
              { id: 'A-D-T3d', emoji: '📍', label: 'At designated disposal site', token: 'at designated disposal site' },
              { id: 'A-D-T3e', emoji: '📏', label: 'More than 2.5m from bank', token: 'at more than 2.5m setback from canal bank' }
            ]
          },
          {
            id: 'A-D-T1c',
            emoji: '👷',
            label: 'NIA personnel supervising',
            subjectToken: 'NIA personnel',
            t2Options: [
              { id: 'A-D-T2i', emoji: '👁️', label: 'Instructing equipment operator', token: 'instructing equipment operator' },
              { id: 'A-D-T2j', emoji: '📝', label: 'Documenting progress', token: 'documenting desilting progress' },
              { id: 'A-D-T2k', emoji: '📏', label: 'Measuring canal depth', token: 'measuring canal depth' }
            ],
            t3Options: [
              { id: 'A-D-T3f', emoji: '🏛️', label: 'NIA O&M Personnel on site', token: 'NIA O&M Personnel on site' },
              { id: 'A-D-T3g', emoji: '🤝', label: 'With IA members present', token: 'with IA members present' }
            ]
          },
          {
            id: 'A-D-T1d',
            emoji: '🤝',
            label: 'IA members coordination',
            subjectToken: 'IA members',
            t2Options: [
              { id: 'A-D-T2l', emoji: '🤝', label: 'Coordinating with NIA HEO', token: 'coordinating with NIA Heavy Equipment Operator' },
              { id: 'A-D-T2m', emoji: '📝', label: 'Documenting activity', token: 'documenting desilting activity' },
              { id: 'A-D-T2n', emoji: '🌾', label: 'Guiding work in farm area', token: 'guiding work in farm area' }
            ],
            t3Options: [
              { id: 'A-D-T3h', emoji: '🌾', label: 'For their service area', token: 'for their irrigation service area' },
              { id: 'A-D-T3i', emoji: '📋', label: 'Under IA-NIA agreement', token: 'under IA-NIA maintenance agreement' }
            ]
          }
        ]
      },
      AFTER: {
        stage: 'AFTER',
        situations: [
          {
            id: 'A-A-T1a',
            emoji: '💧',
            label: 'Canal with restored water flow',
            subjectToken: 'Canal',
            t2Options: [
              { id: 'A-A-T2a', emoji: '💧', label: 'Water flowing freely', token: 'with water flowing freely' },
              { id: 'A-A-T2b', emoji: '🌿', label: 'Cleared of vegetation', token: 'cleared of vegetation' },
              { id: 'A-A-T2c', emoji: '🧱', label: 'Clean canal lining', token: 'with clean canal lining' },
              { id: 'A-A-T2d', emoji: '🌊', label: 'Restored earth canal', token: 'with restored earth canal profile' }
            ],
            t3Options: [
              { id: 'A-A-T3a', emoji: '✅', label: 'Maintained good water flow', token: 'maintaining good water flow' },
              { id: 'A-A-T3b', emoji: '💧', label: 'Restored water flow', token: 'with water flow restored to design capacity' },
              { id: 'A-A-T3c', emoji: '📐', label: 'Design depth restored', token: 'restoring design canal depth' },
              { id: 'A-A-T3d', emoji: '🌾', label: 'Restored optimal water flow', token: 'restoring optimal water conveyance' }
            ]
          },
          {
            id: 'A-A-T1b',
            emoji: '🏔️',
            label: 'Excavated spoil mound on bank',
            subjectToken: 'Excavated spoil mound',
            t2Options: [
              { id: 'A-A-T2e', emoji: '🏔️', label: 'Piled on canal bank', token: 'piled on canal bank' },
              { id: 'A-A-T2f', emoji: '🚛', label: 'Loaded for hauling', token: 'loaded to dump truck for hauling' },
              { id: 'A-A-T2g', emoji: '🛣️', label: 'Spread on service road', token: 'spread on service road for leveling' }
            ],
            t3Options: [
              { id: 'A-A-T3e', emoji: '📏', label: 'More than 2.5m setback', token: 'at more than 2.5m setback from canal bank' },
              { id: 'A-A-T3f', emoji: '📍', label: 'At designated disposal site', token: 'at designated disposal site' }
            ]
          }
        ]
      }
    }
  },

  // =========================================================================
  // B: Desilting / Clearing of Canal (Manual)
  // =========================================================================
  {
    code: 'B',
    name: 'Desilting / Clearing of Canal (Manual)',
    aliases: [
      'Desilting / Clearing of Canal (Manual)',
      'Desilting Manual',
      'Manual Desilting',
      'Manual Clearing'
    ],
    stages: {
      BEFORE: {
        stage: 'BEFORE',
        situations: [
          {
            id: 'B-B-T1a',
            emoji: '🌿',
            label: 'Overgrown canal bank',
            subjectToken: 'Canal bank',
            t2Options: [
              { id: 'B-B-T2a', emoji: '🌿', label: 'Heavy vegetation overgrowth', token: 'with heavy vegetation overgrowth' },
              { id: 'B-B-T2b', emoji: '🌱', label: 'Weeds encroaching on canal', token: 'with weeds encroaching on canal' },
              { id: 'B-B-T2c', emoji: '🗑️', label: 'Garbage / waste material', token: 'with garbage and waste material' }
            ],
            t3Options: [
              { id: 'B-B-T3a', emoji: '✅', label: 'Acceptable, needs sustaining', token: 'acceptable condition, but needs to be sustained' },
              { id: 'B-B-T3b', emoji: '📉', label: 'Reducing water flow', token: 'reducing water flow in canal' },
              { id: 'B-B-T3c', emoji: '🚫', label: 'No equipment access', token: 'area inaccessible to heavy equipment' },
              { id: 'B-B-T3d', emoji: '🌾', label: 'Standing crops nearby', token: 'with standing crops nearby' }
            ]
          },
          {
            id: 'B-B-T1b',
            emoji: '💧',
            label: 'Silted canal bed',
            subjectToken: 'Canal bed',
            t2Options: [
              { id: 'B-B-T2d', emoji: '💧', label: 'Accumulated silt', token: 'with accumulated silt' },
              { id: 'B-B-T2e', emoji: '🪨', label: 'Stones and debris', token: 'with accumulated stones and debris' },
              { id: 'B-B-T2f', emoji: '🏖️', label: 'Fine sand (Banlik)', token: 'with fine sand (banlik) deposit' }
            ],
            t3Options: [
              { id: 'B-B-T3e', emoji: '✅', label: 'Acceptable, needs sustaining', token: 'acceptable condition, but needs to be sustained' },
              { id: 'B-B-T3f', emoji: '📉', label: 'Reduced water flow', token: 'causing reduced water flow' },
              { id: 'B-B-T3g', emoji: '🚫', label: 'No equipment access', token: 'area inaccessible to heavy equipment' },
              { id: 'B-B-T3h', emoji: '🌾', label: 'Standing crops nearby', token: 'with standing crops nearby' }
            ]
          },
          {
            id: 'B-B-T1c',
            emoji: '🌊',
            label: 'Eroded earth canal',
            subjectToken: 'Earth canal',
            t2Options: [
              { id: 'B-B-T2g', emoji: '🌊', label: 'Eroded canal walls', token: 'with eroded canal walls' },
              { id: 'B-B-T2h', emoji: '💧', label: 'Soil accumulation', token: 'with soil accumulation' }
            ],
            t3Options: [
              { id: 'B-B-T3i', emoji: '📉', label: 'Reduced water flow', token: 'causing reduced water flow' },
              { id: 'B-B-T3j', emoji: '🚫', label: 'No equipment access', token: 'area inaccessible to heavy equipment' }
            ]
          }
        ]
      },
      DURING: {
        stage: 'DURING',
        situations: [
          {
            id: 'B-D-T1a',
            emoji: '🌿',
            label: 'Workers cutting vegetation',
            subjectToken: 'Workers',
            t2Options: [
              { id: 'B-D-T2a', emoji: '🌿', label: 'Cutting with bolos', token: 'cutting vegetation with bolos' },
              { id: 'B-D-T2b', emoji: '🚶', label: 'Standing on canal bank', token: 'standing on canal bank' },
              { id: 'B-D-T2c', emoji: '🚶', label: 'Standing in canal', token: 'standing in canal' }
            ],
            t3Options: [
              { id: 'B-D-T3a', emoji: '🌾', label: 'For their service area', token: 'for their irrigation service area' },
              { id: 'B-D-T3b', emoji: '📋', label: 'Under IA-NIA agreement', token: 'under IA-NIA maintenance agreement' }
            ]
          },
          {
            id: 'B-D-T1b',
            emoji: '⛏️',
            label: 'Workers removing silt / debris',
            subjectToken: 'Workers',
            t2Options: [
              { id: 'B-D-T2d', emoji: '⛏️', label: 'Using shovels and pans', token: 'removing silt using shovels and pans' },
              { id: 'B-D-T2e', emoji: '🪣', label: 'Using wheelbarrow', token: 'hauling spoil by wheelbarrow' },
              { id: 'B-D-T2f', emoji: '🛍️', label: 'Bagging spoil for hauling', token: 'bagging spoil for hauling' }
            ],
            t3Options: [
              { id: 'B-D-T3c', emoji: '🌾', label: 'For their service area', token: 'for their irrigation service area' },
              { id: 'B-D-T3d', emoji: '📋', label: 'Under IA-NIA agreement', token: 'under IA-NIA maintenance agreement' }
            ]
          },
          {
            id: 'B-D-T1c',
            emoji: '🏔️',
            label: 'Spoil piled on canal bank',
            subjectToken: 'Spoil',
            t2Options: [
              { id: 'B-D-T2g', emoji: '🏔️', label: 'Piled at safe setback', token: 'piled at safe canal bank setback' },
              { id: 'B-D-T2h', emoji: '🛍️', label: 'Bagged for hauling', token: 'bagged and ready for hauling' }
            ],
            t3Options: [
              { id: 'B-D-T3e', emoji: '📏', label: 'More than 2.5m from bank', token: 'at more than 2.5m from canal bank' },
              { id: 'B-D-T3f', emoji: '📍', label: 'At designated disposal site', token: 'at designated disposal site' }
            ]
          }
        ]
      },
      AFTER: {
        stage: 'AFTER',
        situations: [
          {
            id: 'B-A-T1a',
            emoji: '💧',
            label: 'Canal with restored water flow',
            subjectToken: 'Canal',
            t2Options: [
              { id: 'B-A-T2a', emoji: '💧', label: 'Water flowing freely', token: 'with free-flowing water restored' },
              { id: 'B-A-T2b', emoji: '📐', label: 'Canal profile restored', token: 'with canal cross-section profile restored' },
              { id: 'B-A-T2c', emoji: '🌊', label: 'Earth canal restored', token: 'with earth canal profile restored' }
            ],
            t3Options: [
              { id: 'B-A-T3a', emoji: '✅', label: 'Maintained good water flow', token: 'maintaining good water flow' },
              { id: 'B-A-T3b', emoji: '💧', label: 'Restored water flow', token: 'with water flow restored to design capacity' },
              { id: 'B-A-T3c', emoji: '🌾', label: 'Conveyance to laterals', token: 'restoring full conveyance to lateral turnouts' }
            ]
          },
          {
            id: 'B-A-T1b',
            emoji: '🌿',
            label: 'Cleared canal bank',
            subjectToken: 'Canal bank',
            t2Options: [
              { id: 'B-A-T2d', emoji: '✅', label: 'Clean, trimmed banks', token: 'clean and trimmed after clearing' },
              { id: 'B-A-T2e', emoji: '🏔️', label: 'Cut vegetation piled aside', token: 'with cut vegetation piled at safe setback' }
            ],
            t3Options: [
              { id: 'B-A-T3d', emoji: '🌾', label: 'Canal access restored', token: 'restoring canal bank access for maintenance' },
              { id: 'B-A-T3e', emoji: '📏', label: 'Spoil at safe setback', token: 'spoil disposed at safe setback from canal' }
            ]
          }
        ]
      }
    }
  },

  // =========================================================================
  // C: Brush Dam / Dredging at Water Source
  // =========================================================================
  {
    code: 'C',
    name: 'Brush Dam / Dredging at Water Source',
    aliases: [
      'Brush Dam / Dredging at Water Source',
      'Brass dam / dredging at water source',
      'Brush Dam',
      'Dredging at Water Source',
      'Water Source Dredging'
    ],
    stages: {
      BEFORE: {
        stage: 'BEFORE',
        situations: [
          {
            id: 'C-B-T1a',
            emoji: '🌊',
            label: 'River condition at intake',
            subjectToken: 'River',
            t2Options: [
              { id: 'C-B-T2a', emoji: '🌊', label: 'Swollen / turbulent flow', token: 'with swollen and turbulent flow' },
              { id: 'C-B-T2b', emoji: '🏖️', label: 'Sandbar blocking intake', token: 'with sandbar formation blocking intake' },
              { id: 'C-B-T2c', emoji: '🪵', label: 'Floating debris at intake', token: 'with floating timber and debris at intake' }
            ],
            t3Options: [
              { id: 'C-B-T3a', emoji: '🔴', label: 'No water diversion to canal', token: 'resulting in no water diversion to canal' },
              { id: 'C-B-T3b', emoji: '📉', label: 'Reduced water diversion', token: 'resulting in reduced water diversion to canal' },
              { id: 'C-B-T3c', emoji: '✅', label: 'Acceptable, needs monitoring', token: 'acceptable condition, needs monitoring' }
            ]
          },
          {
            id: 'C-B-T1b',
            emoji: '💥',
            label: 'Damaged brush dam structure',
            subjectToken: 'Brush dam',
            t2Options: [
              { id: 'C-B-T2d', emoji: '💥', label: 'Completely washed out', token: 'completely washed out' },
              { id: 'C-B-T2e', emoji: '🔨', label: 'Partially damaged', token: 'partially damaged and weakened' },
              { id: 'C-B-T2f', emoji: '🏞️', label: 'Riverbank eroded nearby', token: 'with riverbank eroded nearby' }
            ],
            t3Options: [
              { id: 'C-B-T3d', emoji: '🌧️', label: 'Due to heavy rain', token: 'due to heavy rain and flooding' },
              { id: 'C-B-T3e', emoji: '🔴', label: 'No water diversion to canal', token: 'resulting in no water diversion to canal' },
              { id: 'C-B-T3f', emoji: '📉', label: 'Reduced water diversion', token: 'resulting in reduced water diversion to canal' }
            ]
          },
          {
            id: 'C-B-T1c',
            emoji: '🏞️',
            label: 'Eroded riverbank / embankment',
            subjectToken: 'Riverbank',
            t2Options: [
              { id: 'C-B-T2g', emoji: '🏞️', label: 'Eroded and collapsed', token: 'eroded and collapsed' },
              { id: 'C-B-T2h', emoji: '💧', label: 'Water overflowing bank', token: 'with water overflowing bank' }
            ],
            t3Options: [
              { id: 'C-B-T3g', emoji: '🌧️', label: 'Due to heavy rain', token: 'due to heavy rain and flooding' },
              { id: 'C-B-T3h', emoji: '⚠️', label: 'Threatening canal integrity', token: 'threatening canal embankment integrity' }
            ]
          }
        ]
      },
      DURING: {
        stage: 'DURING',
        situations: [
          {
            id: 'C-D-T1a',
            emoji: '🚜',
            label: 'Excavator in river / at intake',
            subjectToken: 'Excavator',
            t2Options: [
              { id: 'C-D-T2a', emoji: '🏗️', label: 'Building brush dam', token: 'constructing brush dam in river' },
              { id: 'C-D-T2b', emoji: '💪', label: 'Strengthening brush dam', token: 'strengthening brush dam structure' },
              { id: 'C-D-T2c', emoji: '⛏️', label: 'Dredging river bed', token: 'dredging river bed and intake area' },
              { id: 'C-D-T2d', emoji: '🔄', label: 'Rechanneling river course', token: 'rechanneling river course toward intake' }
            ],
            t3Options: [
              { id: 'C-D-T3a', emoji: '🏛️', label: 'Using NIA equipment', token: 'using NIA heavy equipment' },
              { id: 'C-D-T3b', emoji: '🔑', label: 'Using rented equipment', token: 'using rented heavy equipment' },
              { id: 'C-D-T3c', emoji: '💧', label: 'To restore water diversion', token: 'to restore water diversion to canal' }
            ]
          },
          {
            id: 'C-D-T1b',
            emoji: '🪨',
            label: 'Rocks / materials being placed',
            subjectToken: 'Rocks and materials',
            t2Options: [
              { id: 'C-D-T2e', emoji: '🪨', label: 'Placed for brush dam', token: 'placed for brush dam construction' },
              { id: 'C-D-T2f', emoji: '🏞️', label: 'Placed for bank protection', token: 'placed as riprap for bank protection' }
            ],
            t3Options: [
              { id: 'C-D-T3d', emoji: '🏗️', label: 'To form brush dam structure', token: 'to form brush dam structure' },
              { id: 'C-D-T3e', emoji: '🏞️', label: 'To stabilize riverbank', token: 'to stabilize and protect riverbank' }
            ]
          },
          {
            id: 'C-D-T1c',
            emoji: '🏞️',
            label: 'Riverbank reinforcement works',
            subjectToken: 'Riverbank reinforcement',
            t2Options: [
              { id: 'C-D-T2g', emoji: '🏗️', label: 'Earthen embankment built', token: 'with earthen embankment being constructed' },
              { id: 'C-D-T2h', emoji: '🧱', label: 'Concrete revetment placed', token: 'with concrete revetment being placed' }
            ],
            t3Options: [
              { id: 'C-D-T3f', emoji: '🏛️', label: 'Using NIA equipment', token: 'using NIA heavy equipment' },
              { id: 'C-D-T3g', emoji: '🏞️', label: 'To prevent further erosion', token: 'to prevent further riverbank erosion' }
            ]
          }
        ]
      },
      AFTER: {
        stage: 'AFTER',
        situations: [
          {
            id: 'C-A-T1a',
            emoji: '🏗️',
            label: 'Completed brush dam in river',
            subjectToken: 'Completed brush dam',
            t2Options: [
              { id: 'C-A-T2a', emoji: '🏗️', label: 'Structure in place', token: 'in place in river' },
              { id: 'C-A-T2b', emoji: '💧', label: 'Water diverted to intake', token: 'with water diverted toward canal intake' },
              { id: 'C-A-T2c', emoji: '📐', label: 'Full diversion restored', token: 'with full diversion design discharge restored' }
            ],
            t3Options: [
              { id: 'C-A-T3a', emoji: '💧', label: 'Water supply restored', token: 'restoring water supply to irrigation area' },
              { id: 'C-A-T3b', emoji: '🌾', label: 'Irrigation area now served', token: 'maintaining water supply to irrigation area' }
            ]
          },
          {
            id: 'C-A-T1b',
            emoji: '🏞️',
            label: 'Stabilized riverbank / revetment',
            subjectToken: 'Stabilized riverbank',
            t2Options: [
              { id: 'C-A-T2d', emoji: '🏞️', label: 'Revetment completed', token: 'with completed revetment structure' },
              { id: 'C-A-T2e', emoji: '✅', label: 'Erosion controlled', token: 'with erosion controlled' }
            ],
            t3Options: [
              { id: 'C-A-T3c', emoji: '🏞️', label: 'Bank now protected', token: 'riverbank now protected from further erosion' },
              { id: 'C-A-T3d', emoji: '💧', label: 'Canal embankment secured', token: 'canal embankment now secured' }
            ]
          }
        ]
      }
    }
  },

  // =========================================================================
  // D: Gate Lubrication
  // =========================================================================
  {
    code: 'D',
    name: 'Gate Lubrication',
    aliases: [
      'Gate Lubrication',
      'Gate Maintenance',
      'Sluice Gate Lubrication',
      'Headgate Lubrication'
    ],
    stages: {
      BEFORE: {
        stage: 'BEFORE',
        situations: [
          {
            id: 'D-B-T1a',
            emoji: '🔧',
            label: 'Steel gate rods / mechanism',
            subjectToken: 'Steel gate rods / mechanism',
            t2Options: [
              { id: 'D-B-T2a', emoji: '🦀', label: 'Rusty and corroded', token: 'rusty and corroded' },
              { id: 'D-B-T2b', emoji: '🔒', label: 'Stiff / jammed spindle', token: 'with stiff and jammed spindle' },
              { id: 'D-B-T2c', emoji: '💧', label: 'Leaking rubber seal', token: 'with worn and leaking rubber seal' }
            ],
            t3Options: [
              { id: 'D-B-T3a', emoji: '🔧', label: 'Before lubrication', token: 'before gate lubrication and servicing' },
              { id: 'D-B-T3b', emoji: '⚠️', label: 'Gate not operational', token: 'causing gate to be non-operational' },
              { id: 'D-B-T3c', emoji: '📉', label: 'Reduced water control', token: 'reducing water control efficiency' }
            ]
          },
          {
            id: 'D-B-T1b',
            emoji: '🗑️',
            label: 'Trash screen / intake grate',
            subjectToken: 'Trash screen / intake grate',
            t2Options: [
              { id: 'D-B-T2d', emoji: '🗑️', label: 'Clogged with branches', token: 'clogged with branches and debris' },
              { id: 'D-B-T2e', emoji: '💧', label: 'Restricting water flow', token: 'restricting water flow through intake' }
            ],
            t3Options: [
              { id: 'D-B-T3d', emoji: '🧹', label: 'Before cleaning', token: 'before cleaning and clearing' },
              { id: 'D-B-T3e', emoji: '📉', label: 'Reducing water supply', token: 'reducing water supply to canal' }
            ]
          }
        ]
      },
      DURING: {
        stage: 'DURING',
        situations: [
          {
            id: 'D-D-T1a',
            emoji: '🛢️',
            label: 'Worker oiling / greasing gate',
            subjectToken: 'Worker',
            t2Options: [
              { id: 'D-D-T2a', emoji: '🛢️', label: 'Oiling gate rods', token: 'oiling steel gate rods' },
              { id: 'D-D-T2b', emoji: '🧴', label: 'Greasing spindle', token: 'greasing gate spindle and lifting mechanism' },
              { id: 'D-D-T2c', emoji: '🛡️', label: 'Applying anti-rust', token: 'applying anti-rust converter / primer' }
            ],
            t3Options: [
              { id: 'D-D-T3a', emoji: '🔧', label: 'For smooth gate operation', token: 'for smooth gate operation' },
              { id: 'D-D-T3b', emoji: '🛡️', label: 'For corrosion protection', token: 'for corrosion protection' }
            ]
          },
          {
            id: 'D-D-T1b',
            emoji: '🧹',
            label: 'Worker cleaning trash screen',
            subjectToken: 'Worker',
            t2Options: [
              { id: 'D-D-T2d', emoji: '🏊', label: 'Wading in water', token: 'wading in water to access grate' },
              { id: 'D-D-T2e', emoji: '🧹', label: 'Removing debris by hand', token: 'removing debris from trash screen by hand' }
            ],
            t3Options: [
              { id: 'D-D-T3c', emoji: '💧', label: 'To restore water flow', token: 'to restore unobstructed water flow' },
              { id: 'D-D-T3d', emoji: '🔧', label: 'For routine maintenance', token: 'for routine maintenance of intake structure' }
            ]
          },
          {
            id: 'D-D-T1c',
            emoji: '🔩',
            label: 'Worker replacing rubber seal',
            subjectToken: 'Worker',
            t2Options: [
              { id: 'D-D-T2f', emoji: '🔩', label: 'Removing old seal', token: 'removing worn rubber seal' },
              { id: 'D-D-T2g', emoji: '✅', label: 'Installing new seal', token: 'installing new rubber seal' }
            ],
            t3Options: [
              { id: 'D-D-T3e', emoji: '💧', label: 'To prevent water leakage', token: 'to prevent water leakage at gate' },
              { id: 'D-D-T3f', emoji: '🔧', label: 'For proper gate function', token: 'for proper gate sealing and function' }
            ]
          }
        ]
      },
      AFTER: {
        stage: 'AFTER',
        situations: [
          {
            id: 'D-A-T1a',
            emoji: '✅',
            label: 'Gate mechanism after servicing',
            subjectToken: 'Gate mechanism',
            t2Options: [
              { id: 'D-A-T2a', emoji: '✅', label: 'Smooth spindle operation', token: 'with smooth spindle operation without jamming' },
              { id: 'D-A-T2b', emoji: '🛡️', label: 'Anti-rust applied', token: 'with anti-rust protection applied' },
              { id: 'D-A-T2c', emoji: '🔩', label: 'New rubber seal installed', token: 'with new rubber seal installed' }
            ],
            t3Options: [
              { id: 'D-A-T3a', emoji: '💧', label: 'Gate fully operational', token: 'gate fully operational and water flow controlled' },
              { id: 'D-A-T3b', emoji: '📏', label: 'Gauge reading confirmed', token: 'staff gauge elevation readings confirmed' }
            ]
          },
          {
            id: 'D-A-T1b',
            emoji: '💧',
            label: 'Clean trash screen / intake grate',
            subjectToken: 'Trash screen / intake grate',
            t2Options: [
              { id: 'D-A-T2d', emoji: '✅', label: 'Debris cleared', token: 'cleared of all debris' },
              { id: 'D-A-T2e', emoji: '💧', label: 'Water flowing freely', token: 'with unobstructed water flow' }
            ],
            t3Options: [
              { id: 'D-A-T3c', emoji: '💧', label: 'Water supply restored', token: 'restoring full water supply to canal' },
              { id: 'D-A-T3d', emoji: '✅', label: 'Intake fully functional', token: 'intake structure fully functional' }
            ]
          }
        ]
      }
    }
  },

  // =========================================================================
  // E: Temporary Fix
  // =========================================================================
  {
    code: 'E',
    name: 'Temporary Fix',
    aliases: [
      'Temporary Fix',
      'Emergency Temporary Fix',
      'Sandbagging',
      'Emergency Repair'
    ],
    stages: {
      BEFORE: {
        stage: 'BEFORE',
        situations: [
          {
            id: 'E-B-T1a',
            emoji: '💥',
            label: 'Breached / eroded canal section',
            subjectToken: 'Canal section',
            t2Options: [
              { id: 'E-B-T2a', emoji: '💥', label: 'Breached, water escaping', token: 'breached with water escaping' },
              { id: 'E-B-T2b', emoji: '🌊', label: 'Eroded embankment', token: 'with eroded and unstable embankment' },
              { id: 'E-B-T2c', emoji: '🏚️', label: 'Collapsed section', token: 'with collapsed canal section' }
            ],
            t3Options: [
              { id: 'E-B-T3a', emoji: '🌧️', label: 'Due to heavy rain', token: 'due to heavy rain and flooding' },
              { id: 'E-B-T3b', emoji: '⚠️', label: 'Irrigation delivery at risk', token: 'putting irrigation delivery at risk' },
              { id: 'E-B-T3c', emoji: '🔴', label: 'Urgent fix needed', token: 'requiring immediate temporary repair' }
            ]
          },
          {
            id: 'E-B-T1b',
            emoji: '💧',
            label: 'Leaking / damaged sluice gate',
            subjectToken: 'Sluice gate',
            t2Options: [
              { id: 'E-B-T2d', emoji: '💧', label: 'Leaking at gate opening', token: 'leaking at gate opening' },
              { id: 'E-B-T2e', emoji: '⚠️', label: 'Unable to hold water', token: 'unable to hold water for delivery' }
            ],
            t3Options: [
              { id: 'E-B-T3d', emoji: '🔴', label: 'Urgent fix needed', token: 'requiring immediate temporary fix' },
              { id: 'E-B-T3e', emoji: '🌾', label: 'Water delivery at risk', token: 'putting water delivery to farms at risk' }
            ]
          }
        ]
      },
      DURING: {
        stage: 'DURING',
        situations: [
          {
            id: 'E-D-T1a',
            emoji: '🛍️',
            label: 'Workers placing sandbags',
            subjectToken: 'Workers',
            t2Options: [
              { id: 'E-D-T2a', emoji: '🛍️', label: 'Stacking sandbags', token: 'stacking sandbags along damaged section' },
              { id: 'E-D-T2b', emoji: '🏔️', label: 'Building earth dike', token: 'constructing temporary earth diversion dike' }
            ],
            t3Options: [
              { id: 'E-D-T3a', emoji: '🌾', label: 'To sustain irrigation delivery', token: 'to sustain emergency irrigation delivery' },
              { id: 'E-D-T3b', emoji: '📋', label: 'Pending permanent repair', token: 'pending permanent repair under future POW' }
            ]
          },
          {
            id: 'E-D-T1b',
            emoji: '🌾',
            label: 'Worker placing sacks at gate',
            subjectToken: 'Worker',
            t2Options: [
              { id: 'E-D-T2c', emoji: '🌾', label: 'Rice hull sacks at gate', token: 'placing rice hull sacks at sluice gate opening' },
              { id: 'E-D-T2d', emoji: '🛍️', label: 'Sandbags at gate', token: 'placing sandbags at gate opening' }
            ],
            t3Options: [
              { id: 'E-D-T3c', emoji: '💧', label: 'For water delivery preparation', token: 'for preparation of water delivery' },
              { id: 'E-D-T3d', emoji: '📋', label: 'Pending permanent repair', token: 'pending permanent repair under future POW' }
            ]
          }
        ]
      },
      AFTER: {
        stage: 'AFTER',
        skipT1: true,
        situations: [
          {
            id: 'E-A-T1a',
            emoji: '🛡️',
            label: 'Temporary fix in place',
            subjectToken: 'Temporary fix',
            autoDeclared: true,
            t2Options: [
              { id: 'E-A-T2a', emoji: '🛍️', label: 'Sandbags holding in place', token: 'with sandbags holding damaged section' },
              { id: 'E-A-T2b', emoji: '🏔️', label: 'Earth dike in place', token: 'with temporary earth diversion dike in place' },
              { id: 'E-A-T2c', emoji: '🌾', label: 'Gate sealed temporarily', token: 'with gate temporarily sealed' },
              { id: 'E-A-T2d', emoji: '💧', label: 'Emergency irrigation sustained', token: 'with emergency irrigation delivery sustained' }
            ],
            t3Options: [
              { id: 'E-A-T3a', emoji: '📋', label: 'Permanent repair for POW', token: 'permanent repair recommended for inclusion in future POW' },
              { id: 'E-A-T3b', emoji: '🌾', label: 'Crop delivery sustained', token: 'sustaining water delivery during crop heading stage' }
            ]
          }
        ]
      }
    }
  },

  // =========================================================================
  // F: Canal Repair / Construction
  // =========================================================================
  {
    code: 'F',
    name: 'Canal Repair / Construction',
    aliases: [
      'Canal Repair / Construction',
      'Canal Lining Construction',
      'Canal Rehabilitation',
      'Canal Repair'
    ],
    stages: {
      BEFORE: {
        stage: 'BEFORE',
        situations: [
          {
            id: 'F-B-T1a',
            emoji: '💥',
            label: 'Collapsed / damaged canal lining',
            subjectToken: 'Canal lining',
            t2Options: [
              { id: 'F-B-T2a', emoji: '💥', label: 'Collapsed concrete lining', token: 'collapsed concrete lining' },
              { id: 'F-B-T2b', emoji: '🌊', label: 'Eroded earthen canal', token: 'eroded earthen canal without lining' }
            ],
            t3Options: [
              { id: 'F-B-T3a', emoji: '🌧️', label: 'Due to heavy rainfall', token: 'due to heavy rainfall' },
              { id: 'F-B-T3b', emoji: '💧', label: 'Due to high water volume', token: 'due to high volume of water' },
              { id: 'F-B-T3c', emoji: '📋', label: 'For repair under CY 2026 POW', token: 'for repair under CY 2026 POW' }
            ]
          },
          {
            id: 'F-B-T1b',
            emoji: '🔨',
            label: 'Damaged culvert / box culvert',
            subjectToken: 'Culvert',
            t2Options: [
              { id: 'F-B-T2c', emoji: '💥', label: 'Collapsed box culvert cover', token: 'with collapsed box culvert cover' },
              { id: 'F-B-T2d', emoji: '🔨', label: 'Cracked / damaged culvert', token: 'cracked and damaged' }
            ],
            t3Options: [
              { id: 'F-B-T3d', emoji: '🌧️', label: 'Due to heavy rain', token: 'due to heavy rain and flooding' },
              { id: 'F-B-T3e', emoji: '📋', label: 'For repair under POW', token: 'for repair under future POW' }
            ]
          },
          {
            id: 'F-B-T1c',
            emoji: '🏚️',
            label: 'Damaged headworks / check structure',
            subjectToken: 'Headworks / check structure',
            t2Options: [
              { id: 'F-B-T2e', emoji: '🚪', label: 'Damaged steel gate', token: 'with damaged steel gate' },
              { id: 'F-B-T2f', emoji: '🔧', label: 'Damaged headgate', token: 'with damaged headgate' },
              { id: 'F-B-T2g', emoji: '🏚️', label: 'Structural damage', token: 'with structural damage' }
            ],
            t3Options: [
              { id: 'F-B-T3f', emoji: '🌧️', label: 'Due to heavy rain', token: 'due to heavy rain and flooding' },
              { id: 'F-B-T3g', emoji: '📋', label: 'For repair under CY 2026 POW', token: 'for repair under CY 2026 POW' }
            ]
          }
        ]
      },
      DURING: {
        stage: 'DURING',
        situations: [
          {
            id: 'F-D-T1a',
            emoji: '🧱',
            label: 'Concrete canal lining work',
            subjectToken: 'Concrete canal lining',
            t2Options: [
              { id: 'F-D-T2a', emoji: '🧱', label: 'Concrete being poured', token: 'being poured' },
              { id: 'F-D-T2b', emoji: '🔩', label: 'Rebar / formwork visible', token: 'with reinforcement steel (rebar) and formwork visible' },
              { id: 'F-D-T2c', emoji: '✅', label: 'Freshly cured concrete', token: 'freshly cured concrete surface' }
            ],
            t3Options: [
              { id: 'F-D-T3a', emoji: '📋', label: 'Under CY 2026 POW', token: 'under CY 2026 Program of Works (POW)' },
              { id: 'F-D-T3b', emoji: '🌾', label: 'To restore canal conveyance', token: 'to restore canal conveyance capacity' }
            ]
          },
          {
            id: 'F-D-T1b',
            emoji: '🚜',
            label: 'Excavator digging canal trench',
            subjectToken: 'Excavator',
            t2Options: [
              { id: 'F-D-T2d', emoji: '⛏️', label: 'Digging canal trench', token: 'digging canal / drainage trench' },
              { id: 'F-D-T2e', emoji: '🏗️', label: 'Building check structure', token: 'constructing check structure / headworks' }
            ],
            t3Options: [
              { id: 'F-D-T3c', emoji: '📋', label: 'Under CY 2026 POW', token: 'under CY 2026 Program of Works (POW)' },
              { id: 'F-D-T3d', emoji: '🏛️', label: 'Using NIA equipment', token: 'using NIA heavy equipment' }
            ]
          },
          {
            id: 'F-D-T1c',
            emoji: '🔧',
            label: 'Workers installing culvert pipes',
            subjectToken: 'Workers',
            t2Options: [
              { id: 'F-D-T2f', emoji: '🔧', label: 'Positioning culvert pipes', token: 'positioning concrete culvert / RCP pipes' },
              { id: 'F-D-T2g', emoji: '🪨', label: 'Backfilling with gravel', token: 'backfilling with gravel and soil' }
            ],
            t3Options: [
              { id: 'F-D-T3e', emoji: '📋', label: 'Under CY 2026 POW', token: 'under CY 2026 Program of Works (POW)' },
              { id: 'F-D-T3f', emoji: '💧', label: 'To restore drainage function', token: 'to restore drainage function' }
            ]
          }
        ]
      },
      AFTER: {
        stage: 'AFTER',
        situations: [
          {
            id: 'F-A-T1a',
            emoji: '🧱',
            label: 'Completed concrete-lined canal',
            subjectToken: 'Completed concrete-lined canal',
            t2Options: [
              { id: 'F-A-T2a', emoji: '💧', label: 'Water flowing through', token: 'with water flowing through' },
              { id: 'F-A-T2b', emoji: '✅', label: 'Smooth concrete surface', token: 'with smooth concrete lining surface' }
            ],
            t3Options: [
              { id: 'F-A-T3a', emoji: '📋', label: 'Completed under CY 2026 POW', token: 'completed under CY 2026 POW' },
              { id: 'F-A-T3b', emoji: '🌾', label: 'Full conveyance restored', token: 'restoring full design conveyance' }
            ]
          },
          {
            id: 'F-A-T1b',
            emoji: '🏗️',
            label: 'Completed check structure / headworks',
            subjectToken: 'Completed check structure',
            t2Options: [
              { id: 'F-A-T2c', emoji: '💧', label: 'Water flowing through gates', token: 'with water flowing through gate openings' },
              { id: 'F-A-T2d', emoji: '✅', label: 'Structure fully functional', token: 'fully functional' }
            ],
            t3Options: [
              { id: 'F-A-T3c', emoji: '📋', label: 'Completed under CY 2026 POW', token: 'completed under CY 2026 POW' },
              { id: 'F-A-T3d', emoji: '🌾', label: 'Water delivery restored', token: 'restoring water delivery to service area' }
            ]
          }
        ]
      }
    }
  },

  // =========================================================================
  // G: Service Road Maintenance
  // =========================================================================
  {
    code: 'G',
    name: 'Service Road Maintenance',
    aliases: [
      'Service Road Maintenance',
      'Road Maintenance',
      'Access Road Maintenance',
      'Service Road Grading'
    ],
    stages: {
      BEFORE: {
        stage: 'BEFORE',
        situations: [
          {
            id: 'G-B-T1a',
            emoji: '🕳️',
            label: 'Deteriorated road surface',
            subjectToken: 'Road surface',
            t2Options: [
              { id: 'G-B-T2a', emoji: '🕳️', label: 'Severe potholes', token: 'with severe potholes along wheel paths' },
              { id: 'G-B-T2b', emoji: '🌊', label: 'Impassable during rain', token: 'impassable during heavy rain' },
              { id: 'G-B-T2c', emoji: '🌿', label: 'Overgrown vegetation on road', token: 'with overgrown vegetation on road' }
            ],
            t3Options: [
              { id: 'G-B-T3a', emoji: '🚫', label: 'Blocking equipment access', token: 'blocking heavy maintenance equipment access' },
              { id: 'G-B-T3b', emoji: '🌾', label: 'Blocking harvest transport', token: 'blocking harvest transport for IA farmers' },
              { id: 'G-B-T3c', emoji: '✅', label: 'Acceptable, needs maintenance', token: 'acceptable condition, needs routine maintenance' }
            ]
          },
          {
            id: 'G-B-T1b',
            emoji: '💧',
            label: 'Blocked roadside drainage ditch',
            subjectToken: 'Roadside drainage ditch',
            t2Options: [
              { id: 'G-B-T2d', emoji: '🌿', label: 'Clogged with vegetation', token: 'clogged with vegetation' },
              { id: 'G-B-T2e', emoji: '💧', label: 'Causing road flooding', token: 'causing road flooding' }
            ],
            t3Options: [
              { id: 'G-B-T3d', emoji: '🚫', label: 'Blocking road drainage', token: 'blocking proper road drainage' },
              { id: 'G-B-T3e', emoji: '📋', label: 'Before clearing activity', token: 'before drainage clearing activity' }
            ]
          }
        ]
      },
      DURING: {
        stage: 'DURING',
        situations: [
          {
            id: 'G-D-T1a',
            emoji: '🚜',
            label: 'Road grader leveling road',
            subjectToken: 'Road grader',
            t2Options: [
              { id: 'G-D-T2a', emoji: '🚜', label: 'Leveling road surface', token: 'leveling and shaping road surface' },
              { id: 'G-D-T2b', emoji: '🌿', label: 'Grading road shoulder', token: 'grading road shoulder and lateral ditch' }
            ],
            t3Options: [
              { id: 'G-D-T3a', emoji: '🏛️', label: 'Using NIA equipment', token: 'using NIA heavy equipment' },
              { id: 'G-D-T3b', emoji: '🔑', label: 'Using rented equipment', token: 'using rented equipment' }
            ]
          },
          {
            id: 'G-D-T1b',
            emoji: '🚛',
            label: 'Dump truck dumping gravel',
            subjectToken: 'Dump truck',
            t2Options: [
              { id: 'G-D-T2c', emoji: '🚛', label: 'Dumping gravel on road', token: 'dumping gravel / aggregates on road' }
            ],
            t3Options: [
              { id: 'G-D-T3c', emoji: '🏛️', label: 'Using NIA equipment', token: 'using NIA equipment' },
              { id: 'G-D-T3d', emoji: '🔑', label: 'Using rented equipment', token: 'using rented equipment' }
            ]
          },
          {
            id: 'G-D-T1c',
            emoji: '👷',
            label: 'Workers spreading gravel on road',
            subjectToken: 'Workers',
            t2Options: [
              { id: 'G-D-T2d', emoji: '👷', label: 'Spreading gravel manually', token: 'manually spreading gravel on road surface' },
              { id: 'G-D-T2e', emoji: '🌿', label: 'Brushing vegetation (ROW)', token: 'brushing vegetation along right-of-way (ROW)' }
            ],
            t3Options: [
              { id: 'G-D-T3e', emoji: '🌾', label: 'For canal access improvement', token: 'for improved canal maintenance access' },
              { id: 'G-D-T3f', emoji: '📋', label: 'Under IA-NIA agreement', token: 'under IA-NIA maintenance agreement' }
            ]
          }
        ]
      },
      AFTER: {
        stage: 'AFTER',
        situations: [
          {
            id: 'G-A-T1a',
            emoji: '🛣️',
            label: 'Improved road surface',
            subjectToken: 'Road surface',
            t2Options: [
              { id: 'G-A-T2a', emoji: '✅', label: 'Smooth and graded', token: 'smooth and graded' },
              { id: 'G-A-T2b', emoji: '🪨', label: 'Fresh gravel applied', token: 'with fresh gravel / aggregate applied' }
            ],
            t3Options: [
              { id: 'G-A-T3a', emoji: '🚜', label: 'Equipment access restored', token: 'restoring heavy maintenance equipment access' },
              { id: 'G-A-T3b', emoji: '🌾', label: 'Harvest transport improved', token: 'improving harvest transport for IA farmers' },
              { id: 'G-A-T3c', emoji: '🌧️', label: 'Passable during rain', token: 'now passable during heavy rain' }
            ]
          },
          {
            id: 'G-A-T1b',
            emoji: '💧',
            label: 'Cleared roadside drainage ditch',
            subjectToken: 'Roadside drainage ditch',
            t2Options: [
              { id: 'G-A-T2c', emoji: '✅', label: 'Cleared of vegetation', token: 'cleared of vegetation and debris' },
              { id: 'G-A-T2d', emoji: '💧', label: 'Water flowing in ditch', token: 'with water flowing freely' }
            ],
            t3Options: [
              { id: 'G-A-T3d', emoji: '🌧️', label: 'Preventing road flooding', token: 'preventing road flooding during rain' },
              { id: 'G-A-T3e', emoji: '✅', label: 'Drainage function restored', token: 'restoring proper road drainage function' }
            ]
          }
        ]
      }
    }
  },

  // =========================================================================
  // H: Painting / Repainting
  // =========================================================================
  {
    code: 'H',
    name: 'Painting / Repainting',
    aliases: [
      'Painting / Repainting',
      'Painting',
      'Repainting',
      'Structure Painting'
    ],
    stages: {
      BEFORE: {
        stage: 'BEFORE',
        situations: [
          {
            id: 'H-B-T1a',
            emoji: '📏',
            label: 'Faded staff gauge',
            subjectToken: 'Staff gauge',
            t2Options: [
              { id: 'H-B-T2a', emoji: '📉', label: 'Faded / illegible markings', token: 'with faded and illegible markings' },
              { id: 'H-B-T2b', emoji: '⚠️', label: 'Water level unreadable', token: 'with water level reading impossible' }
            ],
            t3Options: [
              { id: 'H-B-T3a', emoji: '⚠️', label: 'Monitoring accuracy affected', token: 'affecting water level monitoring accuracy' },
              { id: 'H-B-T3b', emoji: '📋', label: 'Before repainting', token: 'before repainting activity' }
            ]
          },
          {
            id: 'H-B-T1b',
            emoji: '🦀',
            label: 'Rusty gate / structure',
            subjectToken: 'Gate / structure',
            t2Options: [
              { id: 'H-B-T2c', emoji: '🦀', label: 'Rusty intake gate', token: 'rusty intake gate' },
              { id: 'H-B-T2d', emoji: '🦀', label: 'Rusty sluice gate', token: 'rusty sluice gate' },
              { id: 'H-B-T2e', emoji: '🦀', label: 'Corroded gate rods', token: 'corroded steel gate rods and mechanism' },
              { id: 'H-B-T2f', emoji: '🏚️', label: 'Weathered dam structure', token: 'weathered dam structure' }
            ],
            t3Options: [
              { id: 'H-B-T3c', emoji: '⚠️', label: 'Structural integrity at risk', token: 'putting structural integrity at risk' },
              { id: 'H-B-T3d', emoji: '🛡️', label: 'Anti-corrosion treatment needed', token: 'requiring anti-corrosion treatment' }
            ]
          }
        ]
      },
      DURING: {
        stage: 'DURING',
        situations: [
          {
            id: 'H-D-T1a',
            emoji: '📏',
            label: 'Worker repainting staff gauge',
            subjectToken: 'Worker',
            t2Options: [
              { id: 'H-D-T2a', emoji: '🎨', label: 'Applying red/white markings', token: 'applying red and white graduated markings' },
              { id: 'H-D-T2b', emoji: '🧴', label: 'Applying primer coat first', token: 'applying primer coat before markings' }
            ],
            t3Options: [
              { id: 'H-D-T3a', emoji: '📏', label: 'For accurate water level reading', token: 'for accurate water level reading' },
              { id: 'H-D-T3b', emoji: '📋', label: 'For monitoring compliance', token: 'for water level monitoring compliance' }
            ]
          },
          {
            id: 'H-D-T1b',
            emoji: '🎨',
            label: 'Worker painting gate / structure',
            subjectToken: 'Worker',
            t2Options: [
              { id: 'H-D-T2c', emoji: '🛡️', label: 'Applying anti-rust primer', token: 'applying anti-rust primer' },
              { id: 'H-D-T2d', emoji: '🎨', label: 'Applying topcoat paint', token: 'applying topcoat paint' },
              { id: 'H-D-T2e', emoji: '🦀', label: 'De-rusting surface first', token: 'de-rusting surface before painting' }
            ],
            t3Options: [
              { id: 'H-D-T3c', emoji: '🛡️', label: 'For corrosion protection', token: 'for corrosion protection of metal components' },
              { id: 'H-D-T3d', emoji: '🔧', label: 'To extend service life', token: 'to extend service life of structure' }
            ]
          }
        ]
      },
      AFTER: {
        stage: 'AFTER',
        situations: [
          {
            id: 'H-A-T1a',
            emoji: '📏',
            label: 'Repainted staff gauge',
            subjectToken: 'Staff gauge',
            t2Options: [
              { id: 'H-A-T2a', emoji: '✅', label: 'Clear markings visible', token: 'with clear red and white markings visible' },
              { id: 'H-A-T2b', emoji: '💧', label: 'Water level readable', token: 'with water level reading now readable' }
            ],
            t3Options: [
              { id: 'H-A-T3a', emoji: '📏', label: 'Gauge functional for monitoring', token: 'gauge now functional for water level monitoring' },
              { id: 'H-A-T3b', emoji: '✅', label: 'Monitoring accuracy restored', token: 'restoring water level monitoring accuracy' }
            ]
          },
          {
            id: 'H-A-T1b',
            emoji: '🛡️',
            label: 'Painted gate / structure',
            subjectToken: 'Gate / structure',
            t2Options: [
              { id: 'H-A-T2c', emoji: '✅', label: 'Freshly painted surface', token: 'freshly painted' },
              { id: 'H-A-T2d', emoji: '🛡️', label: 'Anti-corrosion applied', token: 'with anti-corrosion protection applied' }
            ],
            t3Options: [
              { id: 'H-A-T3c', emoji: '🛡️', label: 'Corrosion protection restored', token: 'restoring corrosion protection' },
              { id: 'H-A-T3d', emoji: '🔧', label: 'Service life extended', token: 'extending service life of structure' }
            ]
          }
        ]
      }
    }
  },

  // =========================================================================
  // I: Staff Gauge Installation / Maintenance
  // =========================================================================
  {
    code: 'I',
    name: 'Staff Gauge Installation / Maintenance',
    aliases: [
      'Staff Gauge Installation / Maintenance',
      'Staff Gauge Installation',
      'Staff Gauge Maintenance',
      'Staff Gauge'
    ],
    stages: {
      BEFORE: {
        stage: 'BEFORE',
        situations: [
          {
            id: 'I-B-T1a',
            emoji: '❌',
            label: 'Canal wall without staff gauge',
            subjectToken: 'Canal wall',
            t2Options: [
              { id: 'I-B-T2a', emoji: '❌', label: 'No gauge installed', token: 'with no staff gauge installed' },
              { id: 'I-B-T2b', emoji: '📝', label: 'New monitoring point', token: 'at new water level monitoring point' }
            ],
            t3Options: [
              { id: 'I-B-T3a', emoji: '📉', label: 'No water level monitoring', token: 'preventing water level monitoring at this point' },
              { id: 'I-B-T3b', emoji: '📋', label: 'Before installation', token: 'before staff gauge installation' }
            ]
          },
          {
            id: 'I-B-T1b',
            emoji: '💥',
            label: 'Damaged / missing staff gauge',
            subjectToken: 'Staff gauge',
            t2Options: [
              { id: 'I-B-T2c', emoji: '💥', label: 'Damaged beyond use', token: 'damaged beyond use' },
              { id: 'I-B-T2d', emoji: '❌', label: 'Missing / dislodged', token: 'missing or dislodged from wall' },
              { id: 'I-B-T2e', emoji: '📉', label: 'Faded / illegible', token: 'faded and illegible' }
            ],
            t3Options: [
              { id: 'I-B-T3c', emoji: '🌊', label: 'Dislodged by flooding', token: 'dislodged by flooding' },
              { id: 'I-B-T3d', emoji: '📉', label: 'Monitoring data unreliable', token: 'making monitoring data unreliable' }
            ]
          }
        ]
      },
      DURING: {
        stage: 'DURING',
        skipT1: true,
        situations: [
          {
            id: 'I-D-T1a',
            emoji: '📏',
            label: 'Workers installing staff gauge',
            subjectToken: 'Workers',
            autoDeclared: true,
            t2Options: [
              { id: 'I-D-T2a', emoji: '🤲', label: 'Holding gauge on wall', token: 'holding staff gauge against canal wall' },
              { id: 'I-D-T2b', emoji: '🔩', label: 'Securing with bolts', token: 'securing staff gauge with fasteners and bolts' },
              { id: 'I-D-T2c', emoji: '👥', label: 'Two workers — one in canal', token: 'two workers — one in canal, one on bank' }
            ],
            t3Options: [
              { id: 'I-D-T3a', emoji: '📍', label: 'At lateral monitoring point', token: 'at lateral / main canal monitoring point' },
              { id: 'I-D-T3b', emoji: '📋', label: 'For water level monitoring', token: 'for water level and discharge monitoring' }
            ]
          }
        ]
      },
      AFTER: {
        stage: 'AFTER',
        situations: [
          {
            id: 'I-A-T1a',
            emoji: '📏',
            label: 'Installed staff gauge on canal wall',
            subjectToken: 'Staff gauge',
            t2Options: [
              { id: 'I-A-T2a', emoji: '📏', label: 'Mounted on concrete wall', token: 'mounted on concrete canal wall' },
              { id: 'I-A-T2b', emoji: '✅', label: 'Securely fastened', token: 'securely fastened to canal wall' }
            ],
            t3Options: [
              { id: 'I-A-T3a', emoji: '📈', label: 'Monitoring now active', token: 'water level monitoring now active at this point' },
              { id: 'I-A-T3b', emoji: '📋', label: 'Baseline data recorded', token: 'baseline discharge data recorded for monitoring' }
            ]
          },
          {
            id: 'I-A-T1b',
            emoji: '💧',
            label: 'Water level reading on gauge',
            subjectToken: 'Water level reading',
            t2Options: [
              { id: 'I-A-T2c', emoji: '💧', label: 'Current level visible', token: 'showing current water level' },
              { id: 'I-A-T2d', emoji: '📊', label: 'Discharge reading taken', token: 'with discharge capacity reading recorded' }
            ],
            t3Options: [
              { id: 'I-A-T3c', emoji: '📋', label: 'Baseline data recorded', token: 'baseline data recorded for monitoring' },
              { id: 'I-A-T3d', emoji: '📈', label: 'Monitoring data now available', token: 'monitoring data now available for this point' }
            ]
          }
        ]
      }
    }
  },

  // =========================================================================
  // K: Herbicide / Vegetation Control (Chemical)
  // =========================================================================
  {
    code: 'K',
    name: 'Herbicide / Vegetation Control (Chemical)',
    aliases: [
      'Herbicide / Vegetation Control (Chemical)',
      'Chemical Vegetation Control',
      'Herbicide Spraying',
      'Weed Control'
    ],
    stages: {
      BEFORE: {
        stage: 'BEFORE',
        situations: [
          {
            id: 'K-B-T1a',
            emoji: '🌿',
            label: 'Canal bank with dense weeds',
            subjectToken: 'Canal bank',
            t2Options: [
              { id: 'K-B-T2a', emoji: '🌿', label: 'Dense weed growth', token: 'with dense weed and grass growth' },
              { id: 'K-B-T2b', emoji: '🚫', label: 'Obstructing inspection', token: 'obstructing inspection clearance' },
              { id: 'K-B-T2c', emoji: '⚠️', label: 'Threatening canal structure', token: 'threatening canal structure integrity' }
            ],
            t3Options: [
              { id: 'K-B-T3a', emoji: '🚫', label: 'Blocking maintenance access', token: 'blocking maintenance access along canal' },
              { id: 'K-B-T3b', emoji: '📉', label: 'Reducing canal capacity', token: 'reducing canal water carrying capacity' },
              { id: 'K-B-T3c', emoji: '✅', label: 'Acceptable, needs treatment', token: 'acceptable condition, needs chemical treatment' }
            ]
          },
          {
            id: 'K-B-T1b',
            emoji: '🌱',
            label: 'Dam / intake area with invasive plants',
            subjectToken: 'Dam / intake area',
            t2Options: [
              { id: 'K-B-T2d', emoji: '🌱', label: 'Invasive vegetation', token: 'with invasive vegetation growth' },
              { id: 'K-B-T2e', emoji: '⚠️', label: 'Threatening dam structure', token: 'threatening dam / intake structure' }
            ],
            t3Options: [
              { id: 'K-B-T3d', emoji: '⚠️', label: 'Threatening structural integrity', token: 'threatening structural integrity of dam / intake' },
              { id: 'K-B-T3e', emoji: '📋', label: 'Before herbicide treatment', token: 'before herbicide treatment' }
            ]
          }
        ]
      },
      DURING: {
        stage: 'DURING',
        skipT1: true,
        situations: [
          {
            id: 'K-D-T1a',
            emoji: '🌿',
            label: 'Worker spraying herbicide',
            subjectToken: 'Worker',
            autoDeclared: true,
            t2Options: [
              { id: 'K-D-T2a', emoji: '💛', label: 'Yellow backpack sprayer', token: 'using yellow backpack sprayer' },
              { id: 'K-D-T2b', emoji: '🟠', label: 'Orange backpack sprayer', token: 'using orange backpack sprayer' },
              { id: 'K-D-T2c', emoji: '🌊', label: 'Along canal bank', token: 'spraying along canal bank' },
              { id: 'K-D-T2d', emoji: '🏞️', label: 'At dam / intake area', token: 'spraying at dam / intake area' }
            ],
            t3Options: [
              { id: 'K-D-T3a', emoji: '🛣️', label: 'Along right-of-way (ROW)', token: 'along canal right-of-way (ROW)' },
              { id: 'K-D-T3b', emoji: '🌿', label: 'To control invasive plants', token: 'to control invasive vegetation growth' }
            ]
          }
        ]
      },
      AFTER: {
        stage: 'AFTER',
        skipT1: true,
        situations: [
          {
            id: 'K-A-T1a',
            emoji: '✅',
            label: 'Canal bank after herbicide spraying',
            subjectToken: 'Canal bank',
            autoDeclared: true,
            t2Options: [
              { id: 'K-A-T2a', emoji: '🍂', label: 'Vegetation dying back', token: 'with vegetation dying back' },
              { id: 'K-A-T2b', emoji: '👁️', label: 'Canal structure visible', token: 'with canal structure now clearly visible' },
              { id: 'K-A-T2c', emoji: '🛣️', label: 'Inspection clearance ok', token: 'with inspection clearance restored' }
            ],
            t3Options: [
              { id: 'K-A-T3a', emoji: '🚜', label: 'Maintenance access restored', token: 'restoring maintenance access along canal' },
              { id: 'K-A-T3b', emoji: '✅', label: 'Vegetation control achieved', token: 'vegetation growth effectively controlled' }
            ]
          }
        ]
      }
    }
  },

  // =========================================================================
  // L: Farm Ditch / Lateral Restoration
  // =========================================================================
  {
    code: 'L',
    name: 'Farm Ditch / Lateral Restoration',
    aliases: [
      'Farm Ditch / Lateral Restoration',
      'Farm Ditch Restoration',
      'Lateral Restoration',
      'Farm Ditch'
    ],
    stages: {
      BEFORE: {
        stage: 'BEFORE',
        situations: [
          {
            id: 'L-B-T1a',
            emoji: '💧',
            label: 'Silted / blocked farm ditch',
            subjectToken: 'Farm ditch',
            t2Options: [
              { id: 'L-B-T2a', emoji: '💧', label: 'Silted with no water flow', token: 'silted with no water flow' },
              { id: 'L-B-T2b', emoji: '💥', label: 'Collapsed ditch', token: 'collapsed and unable to carry water' },
              { id: 'L-B-T2c', emoji: '🌿', label: 'Overgrown with vegetation', token: 'overgrown with vegetation' }
            ],
            t3Options: [
              { id: 'L-B-T3a', emoji: '🔴', label: 'No water reaching farm plots', token: 'causing no water to reach farm plots' },
              { id: 'L-B-T3b', emoji: '📉', label: 'Reduced water to farm plots', token: 'causing reduced water supply to farm plots' },
              { id: 'L-B-T3c', emoji: '📋', label: 'Before restoration', token: 'before restoration work' }
            ]
          },
          {
            id: 'L-B-T1b',
            emoji: '🌾',
            label: 'Rice fields without water supply',
            subjectToken: 'Rice fields',
            t2Options: [
              { id: 'L-B-T2d', emoji: '🌾', label: 'Dry fields, no irrigation', token: 'dry with no irrigation water supply' },
              { id: 'L-B-T2e', emoji: '🌾', label: 'Crops at risk', token: 'with crops at risk due to lack of water' }
            ],
            t3Options: [
              { id: 'L-B-T3d', emoji: '📋', label: 'Due to blocked farm ditch', token: 'due to blocked / silted farm ditch' },
              { id: 'L-B-T3e', emoji: '🌾', label: 'During critical crop stage', token: 'during critical crop growth stage' }
            ]
          }
        ]
      },
      DURING: {
        stage: 'DURING',
        skipT1: true,
        situations: [
          {
            id: 'L-D-T1a',
            emoji: '🚜',
            label: 'Excavator restoring farm ditch',
            subjectToken: 'Excavator',
            autoDeclared: true,
            t2Options: [
              { id: 'L-D-T2a', emoji: '⛏️', label: 'Clearing / excavating ditch', token: 'clearing and excavating farm ditch' },
              { id: 'L-D-T2b', emoji: '🌾', label: 'Rice paddies alongside', token: 'with flooded rice paddies alongside' },
              { id: 'L-D-T2c', emoji: '🛤️', label: 'On narrow embankment', token: 'positioned on narrow embankment between paddies' }
            ],
            t3Options: [
              { id: 'L-D-T3a', emoji: '🏛️', label: 'Using NIA equipment', token: 'using NIA heavy equipment' },
              { id: 'L-D-T3b', emoji: '🔄', label: 'From lateral turn-out', token: 'restoring from lateral turn-out' }
            ]
          }
        ]
      },
      AFTER: {
        stage: 'AFTER',
        situations: [
          {
            id: 'L-A-T1a',
            emoji: '💧',
            label: 'Restored farm ditch with water',
            subjectToken: 'Farm ditch',
            t2Options: [
              { id: 'L-A-T2a', emoji: '💧', label: 'Water flowing in ditch', token: 'with water flowing' },
              { id: 'L-A-T2b', emoji: '🛤️', label: 'Clear channel from turn-out', token: 'with clear channel from lateral turn-out' }
            ],
            t3Options: [
              { id: 'L-A-T3a', emoji: '🌾', label: 'Water reaching farm plots', token: 'restoring water supply to farm plots' },
              { id: 'L-A-T3b', emoji: '💧', label: 'Irrigation service restored', token: 'restoring irrigation service to farm area' }
            ]
          },
          {
            id: 'L-A-T1b',
            emoji: '🌾',
            label: 'Rice fields receiving water',
            subjectToken: 'Rice fields',
            t2Options: [
              { id: 'L-A-T2c', emoji: '🌾', label: 'Water reaching farm plots', token: 'now receiving water supply' },
              { id: 'L-A-T2d', emoji: '💧', label: 'Irrigation service restored', token: 'with irrigation service restored' }
            ],
            t3Options: [
              { id: 'L-A-T3c', emoji: '🌾', label: 'Crop water requirement met', token: 'meeting crop water requirement' },
              { id: 'L-A-T3d', emoji: '✅', label: 'Irrigation delivery confirmed', token: 'irrigation delivery confirmed to farm area' }
            ]
          }
        ]
      }
    }
  },

  // =========================================================================
  // M: Other Repair / Maintenance
  // =========================================================================
  {
    code: 'M',
    name: 'Other Repair / Maintenance',
    aliases: [
      'Other Repair / Maintenance',
      'Other Repair/Maintenance (specify)',
      'Other Maintenance',
      'Special Repair'
    ],
    stages: {
      BEFORE: {
        stage: 'BEFORE',
        situations: [
          {
            id: 'M-B-T1a',
            emoji: '🔗',
            label: 'Broken cable wire at gate',
            subjectToken: 'Cable wire',
            t2Options: [
              { id: 'M-B-T2a', emoji: '🔗', label: 'Broken / disconnected', token: 'broken and disconnected' },
              { id: 'M-B-T2b', emoji: '⚠️', label: 'Gate unable to operate', token: 'causing gate to be unable to operate' }
            ],
            t3Options: [
              { id: 'M-B-T3a', emoji: '⏳', label: 'Due to wear and tear', token: 'due to wear and tear' },
              { id: 'M-B-T3b', emoji: '🌧️', label: 'Due to heavy rain', token: 'due to heavy rain and flooding' },
              { id: 'M-B-T3c', emoji: '⚠️', label: 'Affecting water flow control', token: 'affecting water flow control' }
            ]
          },
          {
            id: 'M-B-T1b',
            emoji: '🔧',
            label: 'Damaged gate mechanism',
            subjectToken: 'Gate mechanism',
            t2Options: [
              { id: 'M-B-T2c', emoji: '🔧', label: 'Damaged / non-functional', token: 'damaged and non-functional' },
              { id: 'M-B-T2d', emoji: '🚪', label: 'Damaged steel gate', token: 'damaged steel gate' },
              { id: 'M-B-T2e', emoji: '🔧', label: 'Damaged headgate', token: 'damaged headgate' }
            ],
            t3Options: [
              { id: 'M-B-T3d', emoji: '🌧️', label: 'Due to heavy rain', token: 'due to heavy rain and flooding' },
              { id: 'M-B-T3e', emoji: '⏳', label: 'Due to wear and tear', token: 'due to wear and tear' },
              { id: 'M-B-T3f', emoji: '⚠️', label: 'Affecting water flow control', token: 'affecting water flow control' }
            ]
          },
          {
            id: 'M-B-T1c',
            emoji: '💥',
            label: 'Collapsed box culvert cover',
            subjectToken: 'Box culvert cover',
            t2Options: [
              { id: 'M-B-T2f', emoji: '💥', label: 'Collapsed / broken', token: 'collapsed and broken' },
              { id: 'M-B-T2g', emoji: '⚠️', label: 'Exposing culvert opening', token: 'exposing culvert opening' }
            ],
            t3Options: [
              { id: 'M-B-T3g', emoji: '🌧️', label: 'Due to heavy rain', token: 'due to heavy rain and flooding' },
              { id: 'M-B-T3h', emoji: '⚠️', label: 'Safety hazard on road', token: 'creating safety hazard on service road' }
            ]
          }
        ]
      },
      DURING: {
        stage: 'DURING',
        situations: [
          {
            id: 'M-D-T1a',
            emoji: '🔗',
            label: 'Worker repairing cable wire',
            subjectToken: 'Worker',
            t2Options: [
              { id: 'M-D-T2a', emoji: '🔗', label: 'Reconnecting cable wire', token: 'reconnecting broken cable wire' },
              { id: 'M-D-T2b', emoji: '🔧', label: 'Adjusting gate mechanism', token: 'adjusting gate mechanism' }
            ],
            t3Options: [
              { id: 'M-D-T3a', emoji: '🔧', label: 'To restore gate operation', token: 'to restore gate operation' },
              { id: 'M-D-T3b', emoji: '💧', label: 'To restore water flow control', token: 'to restore water flow control' }
            ]
          },
          {
            id: 'M-D-T1b',
            emoji: '🔧',
            label: 'Worker repairing gate / structure',
            subjectToken: 'Worker',
            t2Options: [
              { id: 'M-D-T2c', emoji: '🔧', label: 'Repairing gate mechanism', token: 'repairing gate mechanism' },
              { id: 'M-D-T2d', emoji: '🔩', label: 'Replacing damaged part', token: 'replacing damaged component' },
              { id: 'M-D-T2e', emoji: '🛡️', label: 'Applying anti-rust', token: 'applying anti-rust treatment' }
            ],
            t3Options: [
              { id: 'M-D-T3c', emoji: '🔧', label: 'To restore gate function', token: 'to restore gate function' },
              { id: 'M-D-T3d', emoji: '🛡️', label: 'For corrosion protection', token: 'for corrosion protection' }
            ]
          }
        ]
      },
      AFTER: {
        stage: 'AFTER',
        situations: [
          {
            id: 'M-A-T1a',
            emoji: '✅',
            label: 'Repaired cable wire / gate',
            subjectToken: 'Gate with cable wire repaired',
            t2Options: [
              { id: 'M-A-T2a', emoji: '✅', label: 'Cable wire repaired', token: 'with cable wire repaired' },
              { id: 'M-A-T2b', emoji: '✅', label: 'Gate mechanism repaired', token: 'with gate mechanism repaired and functional' },
              { id: 'M-A-T2c', emoji: '💧', label: 'Water control restored', token: 'with water flow control restored' }
            ],
            t3Options: [
              { id: 'M-A-T3a', emoji: '✅', label: 'Gate fully operational', token: 'gate now fully operational' },
              { id: 'M-A-T3b', emoji: '💧', label: 'Water delivery restored', token: 'restoring water delivery to service area' }
            ]
          },
          {
            id: 'M-A-T1b',
            emoji: '💧',
            label: 'Restored water flow control',
            subjectToken: 'Water flow control',
            t2Options: [
              { id: 'M-A-T2d', emoji: '💧', label: 'Water delivery restored', token: 'restored after repair' },
              { id: 'M-A-T2e', emoji: '✅', label: 'Gate operating normally', token: 'with gate operating normally' }
            ],
            t3Options: [
              { id: 'M-A-T3c', emoji: '🌾', label: 'Irrigation delivery resumed', token: 'irrigation delivery resumed to service area' },
              { id: 'M-A-T3d', emoji: '✅', label: 'Full water control restored', token: 'full water flow control restored' }
            ]
          }
        ]
      }
    }
  }
];

/**
 * Finds matching category by activity name, alias, or code
 */
export function findCaptionCategory(activityOrCode?: string): ActivityCaptionCategory {
  if (!activityOrCode) return PHOTO_CAPTION_CATEGORIES[0];
  const q = activityOrCode.trim().toLowerCase();

  // 1. Exact code match (e.g. 'A', 'E', 'M')
  let found = PHOTO_CAPTION_CATEGORIES.find(cat => cat.code.toLowerCase() === q);
  if (found) return found;

  // 2. Exact name or alias match
  found = PHOTO_CAPTION_CATEGORIES.find(cat => 
    cat.name.toLowerCase() === q ||
    cat.aliases.some(a => a.toLowerCase() === q)
  );
  if (found) return found;

  // 3. Substring match (min length > 2 to prevent single character false positives)
  if (q.length > 2) {
    found = PHOTO_CAPTION_CATEGORIES.find(cat =>
      cat.name.toLowerCase().includes(q) ||
      q.includes(cat.name.toLowerCase()) ||
      cat.aliases.some(a => a.toLowerCase().includes(q) || q.includes(a.toLowerCase()))
    );
  }

  return found || PHOTO_CAPTION_CATEGORIES[0];
}

export interface CaptionContext {
  stationFrom?: string;
  stationTo?: string;
  canalSegment?: string;
  locationName?: string;
  structureName?: string;
  maintenanceActivity?: string;
  operationalState?: string;
  segmentDistanceMeters?: number;
  serviceAreaHectares?: number;
  rcpPiecesCount?: number;
  performedByList?: string[];
  performedByIA?: string;
  performedByOthers?: string;
  operatorName?: string;
  equipmentType?: string;
  wrfoName?: string;
  assistantName?: string;
  iaChairperson?: string;
  nisName?: string;
  imoName?: string;
  targetDate?: string;
  stage?: 'Before' | 'During' | 'After';
  status?: string;
  damageReason?: string;
  programYear?: number | string;
}

export interface ContextualCaptionChip {
  id: string;
  label: string;
  caption: string;
  category: 'primary' | 'station' | 'activity' | 'pow_recommendation' | 'equipment' | 'structure';
}

/**
 * Normalizes stationing strings (e.g. 0+100 -> STA. 0+100.00)
 */
export function formatStaHeader(from?: string, to?: string): string {
  const cleanFrom = from ? (from.toUpperCase().startsWith('STA') ? from : `STA. ${from}`) : '';
  const cleanTo = to ? (to.toUpperCase().startsWith('STA') ? to : `STA. ${to}`) : '';

  if (cleanFrom && cleanTo) {
    return `${cleanFrom} – ${cleanTo}`;
  }
  if (cleanFrom) {
    return cleanFrom;
  }
  return 'STA. 0+000.00';
}

/**
 * Formats date into standard NIA photo documentation format (e.g. "June 9, 2026")
 */
export function formatNiaDate(dateStr?: string): string {
  if (!dateStr) {
    return new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

/**
 * Dynamically synthesizes context-aware quick caption suggestions matching official NIA formats
 */
export function generateContextualCaptions(ctx: CaptionContext): ContextualCaptionChip[] {
  const chips: ContextualCaptionChip[] = [];

  const canal = ctx.canalSegment || ctx.locationName || 'Main Canal';
  const dist = ctx.segmentDistanceMeters && ctx.segmentDistanceMeters > 0
    ? `${Math.round(ctx.segmentDistanceMeters)}`
    : '';
  const distStr = dist ? `${dist} meters` : '';
  const areaHas = ctx.serviceAreaHectares && ctx.serviceAreaHectares > 0 ? `${ctx.serviceAreaHectares} has.` : '';
  const rcpCount = ctx.rcpPiecesCount && ctx.rcpPiecesCount > 0 ? `${ctx.rcpPiecesCount} pcs` : '8 pcs';
  const dateFormatted = formatNiaDate(ctx.targetDate);
  const currentYear = ctx.programYear || new Date().getFullYear();
  const nis = ctx.nisName || 'NIS';
  const act = (ctx.maintenanceActivity || '').toLowerCase();
  const ia = ctx.performedByIA?.trim() || '';
  const operator = ctx.operatorName?.trim() || 'Mr. Michael Campos – HEO';
  const equipment = ctx.equipmentType?.trim() || 'Zoomlion ZE135E-10 excavator';
  const wrfo = ctx.wrfoName?.trim() || 'Mr. Luis Fernandez - WRFO';
  const assistant = ctx.assistantName?.trim() || 'Mr. Leo Natividad';
  const iaChair = ctx.iaChairperson?.trim() || 'Chairman Dotimas';

  // 1. Staff Gauge Installation & Repainting
  chips.push({
    id: 'staff-gauge-installation',
    label: 'Installation of Staff gauge',
    caption: 'Installation of Staff gauge conducted by NIA O&M Personnel.',
    category: 'structure'
  });
  chips.push({
    id: 'staff-gauge-repainting',
    label: 'Repainting of Staff gauge',
    caption: 'Repainting of Staff gauge conducted by NIA O&M Personnel.',
    category: 'structure'
  });

  // 2. Canal Clearing Operations (IA & NIA Personnel)
  if (act.includes('clearing') || act.includes('desilt') || act.includes('veg') || !act) {
    if (ia) {
      chips.push({
        id: 'ia-clearing-conducted',
        label: `Canal clearing conducted by ${ia} IA`,
        caption: distStr
          ? `Canal clearing at ${canal} approximately ${distStr} conducted by ${ia} IA last ${dateFormatted}.`
          : `Canal clearing conducted by ${ia} IA.`,
        category: 'primary'
      });
      chips.push({
        id: 'ia-clearing-continuation',
        label: `Continuation of canal clearing by ${ia} IA`,
        caption: distStr
          ? `Continuation of canal clearing at ${canal} approximately ${distStr} conducted by ${ia} IA last ${dateFormatted}.`
          : `Continuation of canal clearing conducted by ${ia} IA last ${dateFormatted}.`,
        category: 'activity'
      });
      chips.push({
        id: 'ia-clearing-pow-rehab',
        label: `Canal clearing by ${ia} IA (POW Rehab needed)`,
        caption: `Canal clearing conducted by ${ia} IA. Rehabilitation of canal in need of repair and for inclusion in future POW.`,
        category: 'pow_recommendation'
      });
    } else {
      chips.push({
        id: 'nia-clearing-veg',
        label: 'Canal clearing (Heavy vegetation)',
        caption: 'Canal clearing undertaken by NIA O&M Personnel due to heavy vegetation.',
        category: 'primary'
      });
    }

    // Main Farm Ditch (MFD) Clearing & Desilting
    chips.push({
      id: 'mfd-clearing-desilting-ia',
      label: `Canal clearing and desilting of MFD (${ia || 'Kamalay'} IA)`,
      caption: `Canal clearing and desilting of MFD conducted by NIA Personnel and ${ia || 'Kamalay'} IA.`,
      category: 'primary'
    });
    chips.push({
      id: 'mfd-clearing-desilting-nia',
      label: 'Canal clearing and desilting of MFD#1 (NIA Team)',
      caption: 'Canal clearing and desilting of MFD#1 conducted by NIA O&M Personnel.',
      category: 'primary'
    });
  }

  // 3. Mechanical Desilting & Dredging (NIA Equipment & Rented Equipment)
  if (act.includes('desilt') || act.includes('dredg') || !act) {
    chips.push({
      id: 'nia-equipment-desilting-dated',
      label: 'Desilting using NIA equipment (Dated)',
      caption: `Desilting was conducted using NIA equipment last ${dateFormatted}.`,
      category: 'primary'
    });
    chips.push({
      id: 'nia-equipment-desilting-general',
      label: 'Desilting was conducted using NIA equipment',
      caption: 'Desilting was conducted using NIA equipment.',
      category: 'primary'
    });
    chips.push({
      id: 'heo-area-desilting',
      label: `Desilting in area using ${equipment}`,
      caption: distStr
        ? `Desilting of canal in ${ia || canal} area approximately ${distStr}, conducted by ${operator} using ${equipment} last ${dateFormatted}.`
        : `Desilting of canal conducted by ${operator} using ${equipment} last ${dateFormatted}.`,
      category: 'equipment'
    });
    chips.push({
      id: 'heo-assisted-clearing-desilting',
      label: 'Clearing and desilting with IA & WRFO supervision',
      caption: distStr
        ? `Clearing and desilting of ${canal} approximately ${distStr}, conducted by ${operator} and assisted by ${ia || 'Kurtinganan-Carumbak'} IA using ${equipment} last ${dateFormatted} with supervision of ${wrfo} of ${nis}.`
        : `Clearing and desilting of ${canal}, conducted by ${operator} and assisted by ${ia || 'Irrigators'} IA using ${equipment} last ${dateFormatted} with supervision of ${wrfo} of ${nis}.`,
      category: 'equipment'
    });
    chips.push({
      id: 'heo-continuation-clearing-desilting',
      label: 'Continuation of clearing and desilting',
      caption: distStr
        ? `Continuation of clearing and desilting at the ${canal} approximately ${distStr}, conducted by ${operator} and assisted by ${ia || 'Kurtinganan-Carumbak'} IA using ${equipment} last ${dateFormatted} with supervision of ${wrfo} of ${nis}.`
        : `Continuation of clearing and desilting at ${canal}, conducted by ${operator} using ${equipment} last ${dateFormatted} with supervision of ${wrfo} of ${nis}.`,
      category: 'activity'
    });
    if (ia) {
      chips.push({
        id: 'ia-rented-equipment-desilting',
        label: `Desilting by rented equipment (${ia} IA)`,
        caption: `Desilting conducted by the equipment rented by ${ia} IA.`,
        category: 'equipment'
      });
    }
    chips.push({
      id: 'manual-desilting-ia',
      label: `Manual desilting conducted by ${ia || 'PIBRIS'} IA`,
      caption: `Manual desilting conducted by ${ia || 'PIBRIS'} IA.`,
      category: 'activity'
    });
    chips.push({
      id: 'drainage-desilting-overflow',
      label: 'Desilting drainage canal (Due to overflow)',
      caption: 'Desilting of drainage canal undertaken by NIA O&M Personnel due to overflow of water in canal.',
      category: 'activity'
    });
    chips.push({
      id: 'desilting-drainage-main-canal',
      label: 'Desilting of drainage along main canal',
      caption: 'Desilting of drainage along main canal conducted by NIA O&M Personnel.',
      category: 'activity'
    });
  }

  // 4. Stones & Debris Removal at Intakes & Checkgates
  chips.push({
    id: 'removal-accumulated-stones',
    label: 'Removal of accumulated stones',
    caption: 'Removal of accumulated stones conducted by NIA O&M Personnel.',
    category: 'structure'
  });
  chips.push({
    id: 'intake-debris-lifting-mechanism',
    label: 'Removal of debris & oiling lifting mechanism',
    caption: 'Removal of accumulated debris and oiling of lifting mechanism conducted by NIA O&M Personnel.',
    category: 'structure'
  });
  chips.push({
    id: 'checkgate-debris-removal-heo',
    label: 'Removal of debris at Checkgate (HEO + WRFO)',
    caption: `Removal of debris at ${canal} conducted by ${operator} using ${equipment} last ${dateFormatted} with assistance of ${wrfo} of ${nis}.`,
    category: 'structure'
  });
  chips.push({
    id: 'headgate-clogged-debris-removal',
    label: 'Removal of clogged debris at Headgate',
    caption: `Removal of clogged debris at the Headgate of ${canal}, conducted by ${operator} dated ${dateFormatted}.`,
    category: 'structure'
  });
  chips.push({
    id: 'wrfo-debris-removal',
    label: 'Removal of debris conducted by WRFO',
    caption: `Removal of debris at the ${canal} conducted by ${wrfo} of ${nis} last ${dateFormatted}.`,
    category: 'structure'
  });

  // 5. Road Maintenance, Re-gravelling & Culvert / RCP Works
  if (act.includes('road') || act.includes('surfacing') || act.includes('culvert') || !act) {
    chips.push({
      id: 're-gravelling-nia-equipment',
      label: 'Re-gravelling using NIA equipment',
      caption: 'Re-gravelling was conducted using NIA equipment.',
      category: 'primary'
    });
    chips.push({
      id: 'desilting-rcp-installation',
      label: `Desilting & installation of ${rcpCount} RCP`,
      caption: `Desilting and installation of ${rcpCount} RCP conducted by NIA O&M Personnel and ${ia || 'Kamalay'} IA.`,
      category: 'structure'
    });
    chips.push({
      id: 'installation-additional-culvert',
      label: 'Installation of additional culvert on service road',
      caption: `Installation of additional culvert at the ${canal} in NIA service road conducted by ${operator} using ${equipment} last ${dateFormatted} with the help of ${ia || 'Malawaan 4th Intake'} IA.`,
      category: 'structure'
    });
    chips.push({
      id: 'road-surfacing-bumpy',
      label: 'Road surfacing (Bumpy road)',
      caption: distStr
        ? `Road surfacing at ${canal} (${distStr}) undertaken by NIA O&M Personnel due to bumpy road.`
        : 'Road surfacing undertaken by NIA O&M Personnel due to bumpy road.',
      category: 'primary'
    });
  }

  // 6. Farm Ditches Restoration
  chips.push({
    id: 'restoration-farm-ditches',
    label: 'Restoration of farm ditches along lateral',
    caption: distStr
      ? `Restoration of farm ditches from the turn-out of Sta. ${ctx.stationFrom || '1+340.00'} in ${canal} approximately ${distStr}, conducted by ${operator} using ${equipment} last ${dateFormatted} with the assistance of ${ia || 'Malawaan 4th Intake'} IA.`
      : `Restoration of farm ditches along ${canal} conducted by ${operator} using ${equipment} last ${dateFormatted} with the assistance of ${ia || 'Irrigators'} IA.`,
    category: 'structure'
  });

  // 7. Dam & Brush Dam Restoration with Area Rehab (has.)
  chips.push({
    id: 'primary-intake-brush-dam-rehab',
    label: 'Restoration of damaged brush dam (Intake / Rehab area)',
    caption: distStr
      ? `Restoration of damaged brush dam at the ${canal} approximately ${distStr}${areaHas ? ` with ${areaHas} area rehab` : ''}, conducted by ${operator} using ${equipment} last ${dateFormatted} with supervision of ${wrfo} of ${nis}.`
      : `Restoration of brush dam at ${canal} conducted by ${operator} using ${equipment} last ${dateFormatted} with supervision of ${wrfo} of ${nis}.`,
    category: 'primary'
  });
  chips.push({
    id: 'brush-dam-strengthening-general',
    label: 'Strengthening of brush dam',
    caption: distStr
      ? `Strengthening of brush dam approximately ${distStr}, conducted by ${operator} using ${equipment} with assistance of ${wrfo} of ${nis} last ${dateFormatted}.`
      : `Brush damming for water diversion to improve irrigation flow, conducted by ${operator} using ${equipment} last ${dateFormatted}.`,
    category: 'activity'
  });

  // 8. Gate Repairs, Cable Wires, Oiling & Greasing & Weed Spraying
  chips.push({
    id: 'oiling-steel-gates-general',
    label: 'Oiling of steel gates by NIA personnel',
    caption: 'Oiling of steel gates conducted by NIA O&M Personnel.',
    category: 'structure'
  });
  chips.push({
    id: 'repair-broken-cable-wire',
    label: 'Repair of broken cable wire of sluice gates',
    caption: `Repair of broken cable wire of sluice gates at the ${canal} of ${nis}, conducted by ${wrfo} of ${nis} and ${assistant} last ${dateFormatted}.`,
    category: 'structure'
  });
  chips.push({
    id: 'oiling-greasing-steelgate',
    label: 'Oiling and greasing of steelgate rods and frames',
    caption: `Oiling and greasing of steelgate rods and frames at ${canal} conducted by ${wrfo} of ${nis} last ${dateFormatted}.`,
    category: 'structure'
  });
  chips.push({
    id: 'herbicide-spraying',
    label: 'Spraying of herbicide by NIA personnel',
    caption: 'Spraying of herbicide conducted by NIA O&M Personnel.',
    category: 'activity'
  });

  // 9. Joint Field Inspection
  chips.push({
    id: 'joint-lateral-inspection',
    label: 'Joint inspection at lateral with IA & WRFO',
    caption: `Conducted an inspection at ${canal} with ${iaChair}, ${operator} of NIA, and ${wrfo} of ${nis} last ${dateFormatted}.`,
    category: 'activity'
  });

  // 10. Heavy Rain Washouts & Damage Reports
  chips.push({
    id: 'heavy-rain-brush-dam-washout',
    label: 'Washout of brush dam due to heavy rain (WRFO report)',
    caption: distStr
      ? `Due to the heavy rain, approximately ${distStr} of the brush dam at the ${canal} was washed out last ${dateFormatted} reported by ${wrfo} of ${nis}.`
      : `Due to the heavy rain, brush dam section at ${canal} was washed out last ${dateFormatted} reported by ${wrfo} of ${nis}.`,
    category: 'pow_recommendation'
  });
  chips.push({
    id: 'collapsed-lining-pow-rep',
    label: 'Collapsed canal lining (POW recommendation)',
    caption: 'Collapsed canal lining due to the high volume of water in the area. Repair of canal is recommended and for inclusion in future POW.',
    category: 'pow_recommendation'
  });
  chips.push({
    id: 'damaged-steelgate-pow-rep',
    label: 'Damaged steel gate (For future POW inclusion)',
    caption: 'Damaged steel gate, for inclusion in future POW.',
    category: 'pow_recommendation'
  });

  // 11. Ongoing Construction under Program of Works (POW)
  chips.push({
    id: 'ongoing-canal-construction-pow',
    label: `Ongoing canal construction under CY ${currentYear} POW`,
    caption: `Ongoing canal construction under the CY ${currentYear} Program of Works (POW).`,
    category: 'pow_recommendation'
  });
  chips.push({
    id: 'ongoing-construction-facility-pow',
    label: `Ongoing facility construction under CY ${currentYear} POW`,
    caption: `Ongoing construction under the CY ${currentYear} Program of Works (POW).`,
    category: 'pow_recommendation'
  });

  // 12. Stage Specific Badges
  if (ctx.stage === 'Before') {
    chips.unshift({
      id: 'stage-before',
      label: 'Before: Siltation / Prior Condition',
      caption: `Condition prior to intervention at ${canal} (${formatStaHeader(ctx.stationFrom, ctx.stationTo)}).`,
      category: 'primary'
    });
  } else if (ctx.stage === 'During') {
    chips.unshift({
      id: 'stage-during',
      label: 'During: Ongoing Operations',
      caption: `Ongoing maintenance operations along ${canal} (${formatStaHeader(ctx.stationFrom, ctx.stationTo)}).`,
      category: 'primary'
    });
  } else if (ctx.stage === 'After') {
    chips.unshift({
      id: 'stage-after',
      label: 'After: Restored Flow Capacity',
      caption: `Completed maintenance reach along ${canal} (${formatStaHeader(ctx.stationFrom, ctx.stationTo)}) with restored hydraulic flow conveyance.`,
      category: 'primary'
    });
  }

  return chips;
}

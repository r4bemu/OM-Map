import { PhotoAttachment, ReportCategoryMode, MaintenanceActivityType } from '../types';

export interface ComposeTechnicalRemarksParams {
  categoryMode?: ReportCategoryMode;
  maintenanceActivity?: MaintenanceActivityType | string;
  customActivity?: string;
  nisName?: string;
  imoName?: string;
  canalSegment?: string;
  locationName?: string;
  lat?: number;
  lng?: number;
  lat2?: number;
  lng2?: number;
  startStation?: string;
  endStation?: string;
  distanceMeters?: number;
  performedByList?: ('IMO' | 'IA' | 'Others')[];
  performedByIA?: string;
  performedByOthers?: string;
  status?: 'In Progress' | 'Completed' | 'Suspended' | string;
  suspensionReason?: string;
  photos?: PhotoAttachment[];
  reporterName?: string;
  reporterRole?: string;
}


function formatCanalName(raw?: string): string {
  if (!raw) return 'designated canal network section';
  let s = raw.trim();
  const letters = s.replace(/[^a-zA-Z]/g, '');
  if (letters.length > 2 && letters === letters.toUpperCase()) {
    s = s.toLowerCase().replace(/\b([a-z])/g, c => c.toUpperCase());
    s = s.replace(/\bRis\b/g, 'RIS')
         .replace(/\bImo\b/g, 'IMO')
         .replace(/\bIa\b/g, 'IA')
         .replace(/\bSta\b/g, 'Sta.')
         .replace(/\bLat\b/g, 'Lateral');
  }
  s = s.replace(/\((\d+\+\d+)\)/g, '(Sta. $1)');
  s = s.replace(/[;,\.\s]+$/, '').trim();
  return s;
}

function formatDistance(meters?: number): string {
  if (!meters || isNaN(meters) || meters <= 0) return '';
  if (meters >= 1000) {
    return (meters / 1000).toFixed(2) + ' km (' + meters.toFixed(1) + ' m)';
  }
  return meters.toFixed(1) + ' meters';
}

function formatActivityHeading(activity?: string, custom?: string, categoryMode?: string): string {
  if (categoryMode === 'operational') {
    return 'Operational monitoring and hydrological inspection';
  }
  if (activity === 'Other Repair / Maintenance' && custom && custom.trim()) {
    const c = custom.trim();
    if (/works?|operations?|maintenance/i.test(c)) return c;
    return c + ' works';
  }
  switch (activity) {
    case 'Desilting / Clearing of Canal (Manual)':
      return 'Manual canal desilting and vegetation clearing operations';
    case 'Desilting / Clearing of Canal (Mechanical)':
      return 'Mechanical canal desilting and clearing operations';
    case 'Gate Lubrication':
      return 'Turnout and steel control gate lubrication and servicing works';
    case 'Brush Dam / Dredging at Water Source':
      return 'Dredging and brush dam rehabilitation works at the water source';
    case 'Canal Repair / Construction':
      return 'Canal lining restoration and concrete repair works';
    case 'Service Road Maintenance':
      return 'Service road grading and embankment maintenance works';
    case 'Painting / Repainting':
      return 'Structural repainting and corrosion protection works';
    case 'Staff Gauge Installation / Maintenance':
      return 'Staff gauge installation and calibration works';
    case 'Herbicide / Vegetation Control (Chemical)':
      return 'Chemical vegetation and weed control operations';
    case 'Farm Ditch / Lateral Restoration':
      return 'Farm ditch and lateral canal rehabilitation works';
    case 'Temporary Fix':
      return 'Emergency remedial and temporary repair works';
    default:
      return activity ? (activity + ' works') : 'Canal maintenance operations';
  }
}


function formatLocationReach(params: {
  canalSegment?: string;
  locationName?: string;
  nisName?: string;
  startStation?: string;
  endStation?: string;
  distanceMeters?: number;
  lat?: number;
  lng?: number;
  lat2?: number;
  lng2?: number;
}): string {
  const {
    canalSegment,
    locationName,
    nisName,
    startStation,
    endStation,
    distanceMeters,
    lat,
    lng,
    lat2,
    lng2
  } = params;

  const rawCanal = canalSegment || locationName || 'Canal Section';
  const cleanCanal = formatCanalName(rawCanal);
  
  const hasRealNis = nisName && 
    nisName !== 'All NIS' && 
    nisName !== 'All' && 
    nisName !== 'All IMOs' && 
    nisName !== 'Regional Office' && 
    !cleanCanal.includes(nisName);

  const nisClause = hasRealNis ? ('of ' + nisName) : '';
  const hasTwoPoints = typeof lat2 === 'number' && typeof lng2 === 'number' && (lat !== lat2 || lng !== lng2);
  const distanceStr = formatDistance(distanceMeters);

  if (hasTwoPoints && (startStation || endStation || distanceStr)) {
    let reachClause = '';
    if (startStation && endStation) {
      reachClause = '(from ' + startStation + ' to ' + endStation + (distanceStr ? ', covering ' + distanceStr : '') + ')';
    } else if (distanceStr) {
      reachClause = '(covering a ' + distanceStr + ' stretch)';
    }
    return ('along ' + cleanCanal + ' ' + nisClause + ' ' + reachClause).replace(/\s+/g, ' ').trim();
  }

  if (startStation && !cleanCanal.includes(startStation)) {
    return ('along ' + cleanCanal + ' ' + nisClause + ' at ' + startStation).replace(/\s+/g, ' ').trim();
  }

  if (typeof lat === 'number' && typeof lng === 'number' && !cleanCanal.includes('Sta.')) {
    return ('along ' + cleanCanal + ' ' + nisClause + ' at (' + lat.toFixed(5) + '°N, ' + lng.toFixed(5) + '°E)').replace(/\s+/g, ' ').trim();
  }

  return ('along ' + cleanCanal + ' ' + nisClause).replace(/\s+/g, ' ').trim();
}

function formatWorkforce(
  performedByList: ('IMO' | 'IA' | 'Others')[] = [],
  performedByIA?: string,
  performedByOthers?: string
): string {
  const parts: string[] = [];
  if (performedByList.includes('IMO')) {
    parts.push('NIA Personnel');
  }
  if (performedByList.includes('IA')) {
    const iaName = performedByIA && performedByIA !== '__custom__' ? performedByIA.trim() : 'the Irrigators Association (IA)';
    parts.push(iaName);
  }
  if (performedByList.includes('Others')) {
    const othersName = performedByOthers ? performedByOthers.trim() : 'External Contractor';
    parts.push(othersName);
  }

  if (parts.length === 0) return '';
  if (parts.length === 1) {
    if (performedByList.includes('IMO')) return 'conducted by NIA Personnel';
    if (performedByList.includes('IA')) return 'executed by ' + parts[0];
    return 'undertaken by ' + parts[0];
  }
  if (parts.length === 2 && performedByList.includes('IMO') && performedByList.includes('IA')) {
    return 'undertaken by NIA Personnel in close coordination with ' + parts[1];
  }
  return 'undertaken jointly by ' + parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1];
}

function transformBeforeCaption(caption: string): string {
  if (!caption) return '';
  let c = caption.trim().replace(/\.+$/, '').trim();

  c = c.replace(/^(Before|Pre-work|Initial inspection):?\s*/i, '');
  c = c.replace(/,\s*(resulting in|causing|which causes|leading to)\s+.*$/i, '');
  c = c.replace(/^(Canal bank|Canal bed|Embankment|Steel gate rods \/? mechanism|Steel gate mechanism|Steel spindle|Headgate structure|Service road)\s+(with|showing|exhibiting|having)\s+/i, '');

  const condition = c.charAt(0).toLowerCase() + c.slice(1);
  return 'Prior to intervention, initial site inspection revealed ' + condition + ', which significantly restricted design water conveyance.';
}

function transformDuringCaption(caption: string): string {
  if (!caption) return '';
  let c = caption.trim().replace(/\.+$/, '').trim();

  c = c.replace(/^(During|Ongoing|Field work):?\s*/i, '');
  c = c.replace(/\s+and bagging\s+/i, ', bagging ');

  if (/^Workers removing silt/i.test(c)) {
    return c.replace(/^Workers removing silt/i, 'During operations, maintenance crews manually removed accumulated silt') + '.';
  }
  if (/^NIA excavator scooping/i.test(c)) {
    return c.replace(/^NIA excavator scooping/i, 'During operations, a NIA excavator actively scooped') + '.';
  }
  if (/^Workers (applying|mixing|cutting|installing|clearing|grading|excavating)/i.test(c)) {
    const pastMap: Record<string, string> = {
      applying: 'applied',
      mixing: 'mixed and poured',
      cutting: 'cleared and cut',
      installing: 'installed',
      clearing: 'cleared',
      grading: 'graded and compacted',
      excavating: 'excavated'
    };
    return c.replace(/^Workers (applying|mixing|cutting|installing|clearing|grading|excavating)\s+/i, (match, p1) => {
      const v = pastMap[p1.toLowerCase()] || p1;
      return 'During operations, field workers ' + v + ' ';
    }) + '.';
  }

  if (/^Application of industrial grease/i.test(c)) {
    return 'During operations, maintenance personnel thoroughly lubricated and serviced the gear and spindle assembly with industrial grease.';
  }
  if (/^Excavation of damaged/i.test(c)) {
    return 'During operations, field crews excavated the damaged canal section and prepared formworks for rehabilitation.';
  }

  const action = c.charAt(0).toLowerCase() + c.slice(1);
  return 'During operations, maintenance personnel carried out ' + action + '.';
}

function transformAfterAndStatus(params: {
  afterCaption?: string;
  status: string;
  suspensionReason?: string;
  distanceMeters?: number;
}): string {
  const { afterCaption, status, suspensionReason, distanceMeters } = params;
  const distStr = formatDistance(distanceMeters);

  if (status === 'Completed') {
    if (afterCaption && afterCaption.trim()) {
      let c = afterCaption.trim().replace(/\.+$/, '').trim();
      c = c.replace(/^(After|Post-work|Completed):?\s*/i, '');
      
      if (/restored|design capacity|free-flowing/i.test(c)) {
        return 'With all scheduled works completed, the canal hydraulic cross-section has been fully restored, re-establishing free-flowing irrigation water to design capacity.';
      }
      if (/smooth gate operation|normal water distribution/i.test(c)) {
        return 'With servicing successfully completed, smooth gate maneuverability was verified on-site, restoring reliable water control and regulation.';
      }
      const outcome = c.charAt(0).toLowerCase() + c.slice(1);
      return 'With all works successfully completed, post-activity verification confirmed ' + outcome + '.';
    }
    return 'With all target works completed and verified on-site, the canal section has been restored to optimal operating condition.';
  }

  if (status === 'Suspended') {
    const cleanReason = suspensionReason ? suspensionReason.trim().replace(/\.+$/, '') : '';
    if (cleanReason) {
      const reasonText = cleanReason.charAt(0).toLowerCase() + cleanReason.slice(1);
      return 'Field operations are presently suspended due to ' + reasonText + '. Work will promptly resume once site conditions normalize.';
    }
    return 'Field operations are presently suspended and will resume once favorable site conditions are established.';
  }

  if (distStr) {
    return 'Maintenance operations remain actively in progress along the ' + distStr + ' stretch, with continuous field monitoring to achieve targeted physical accomplishment.';
  }
  return 'Maintenance operations remain actively in progress, with field crews continuing on-site works toward target completion.';
}

export function composeTechnicalRemarks(params: ComposeTechnicalRemarksParams): string {
  const {
    categoryMode = 'maintenance',
    maintenanceActivity,
    customActivity,
    nisName,
    canalSegment,
    locationName,
    lat,
    lng,
    lat2,
    lng2,
    startStation,
    endStation,
    distanceMeters,
    performedByList = [],
    performedByIA,
    performedByOthers,
    status = 'In Progress',
    suspensionReason,
    photos = []
  } = params;

  const activityHeading = formatActivityHeading(maintenanceActivity, customActivity, categoryMode);
  const locationReach = formatLocationReach({
    canalSegment,
    locationName,
    nisName,
    startStation,
    endStation,
    distanceMeters,
    lat,
    lng,
    lat2,
    lng2
  });
  const workforceClause = formatWorkforce(performedByList, performedByIA, performedByOthers);

  let leadSentence = '';
  if (workforceClause) {
    leadSentence = activityHeading + ' ' + locationReach + ' were ' + workforceClause + '.';
  } else {
    leadSentence = activityHeading + ' were conducted ' + locationReach + '.';
  }
  leadSentence = leadSentence.replace(/\s+/g, ' ').replace(/\s+\./g, '.').trim();

  let beforeCaption = '';
  let duringCaption = '';
  let afterCaption = '';

  photos.forEach(p => {
    if (!p.caption || p.caption.startsWith('Before #') || p.caption.startsWith('During #') || p.caption.startsWith('After #')) return;
    const stage = p.stage || 'During';
    if (stage === 'Before' && !beforeCaption) beforeCaption = p.caption;
    if (stage === 'During' && !duringCaption) duringCaption = p.caption;
    if (stage === 'After' && !afterCaption) afterCaption = p.caption;
  });

  const narrativeSentences: string[] = [leadSentence];

  if (beforeCaption) {
    const beforeSentence = transformBeforeCaption(beforeCaption);
    if (beforeSentence) narrativeSentences.push(beforeSentence);
  }

  if (duringCaption) {
    const duringSentence = transformDuringCaption(duringCaption);
    if (duringSentence) narrativeSentences.push(duringSentence);
  }

  const conclusionSentence = transformAfterAndStatus({
    afterCaption,
    status,
    suspensionReason,
    distanceMeters
  });
  if (conclusionSentence) narrativeSentences.push(conclusionSentence);

  return narrativeSentences.join(' ');
}
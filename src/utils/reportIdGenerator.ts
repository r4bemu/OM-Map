/**
 * Official NIA MIMAROPA O&M System - Standardized Report ID Generator
 * Format: wmr-YYMMDD-HHmmssSS-{system_code}
 * Example: wmr-260822-08353645-bbris
 */

export const SYSTEM_CODES_MAP: Record<string, string> = {
  // MOMARO IMO
  'BACO-BUCAYAO RIS': 'bbris',
  'MAG-ASAWANG TUBIG RIS': 'mtris',
  'PULA RIS': 'pula',
  'BANSUD RIS': 'bansud',
  'CANTINGAS RIS': 'cantingas',

  // Occidental Mindoro IMO
  'MONGPONG RIS': 'mongpong',
  'AMNAY RIS': 'amnay',
  'CAGURAY RIS': 'caguray',
  'LUMINTAO RIS': 'lumintao',
  'PAGBAHAN RIS': 'pagbahan',

  // Palawan IMO
  'BATANG-BATANG RIS': 'btngbtng',
  'MALATGAO RIS (DIVISION 1)': 'malatgao1',
  'MALATGAO RIS (DIVISION 2)': 'malatgao2',
  'MALATGAO RIS - DIVISION 1': 'malatgao1',
  'MALATGAO RIS - DIVISION 2': 'malatgao2',
  'MALATGAO RIS': 'malatgao1'
};

/**
 * Resolves the short code for a given NIS or River Irrigation System name
 */
export function resolveSystemCode(nisName?: string, imoOffice?: string): string {
  if (!nisName) {
    if (imoOffice) {
      const imoLower = imoOffice.toLowerCase();
      if (imoLower.includes('momaro') || imoLower.includes('oriental')) return 'momaro';
      if (imoLower.includes('occidental')) return 'occmdo';
      if (imoLower.includes('palawan')) return 'palawan';
    }
    return 'mimaropa';
  }

  const normalized = nisName.trim().toUpperCase();

  if (SYSTEM_CODES_MAP[normalized]) {
    return SYSTEM_CODES_MAP[normalized];
  }

  // Partial / fuzzy matching
  if (normalized.includes('BACO') || normalized.includes('BUCAYAO') || normalized.includes('BBRIS')) return 'bbris';
  if (normalized.includes('MAG-ASAWANG') || normalized.includes('TUBIG') || normalized.includes('MTRIS') || normalized.includes('MATRIS')) return 'mtris';
  if (normalized.includes('PULA')) return 'pula';
  if (normalized.includes('BANSUD')) return 'bansud';
  if (normalized.includes('CANTINGAS')) return 'cantingas';

  if (normalized.includes('MONGPONG')) return 'mongpong';
  if (normalized.includes('AMNAY')) return 'amnay';
  if (normalized.includes('CAGURAY')) return 'caguray';
  if (normalized.includes('LUMINTAO')) return 'lumintao';
  if (normalized.includes('PAGBAHAN')) return 'pagbahan';

  if (normalized.includes('BATANG') || normalized.includes('BTNG')) return 'btngbtng';
  if (normalized.includes('MALATGAO')) {
    if (normalized.includes('2') || normalized.includes('DIV 2') || normalized.includes('DIVISION 2')) return 'malatgao2';
    return 'malatgao1';
  }

  // Fallback to cleaned NIS or IMO name
  const clean = nisName.toLowerCase().replace(/[^a-z0-9]/g, '');
  return clean ? clean.substring(0, 10) : 'mimaropa';
}

/**
 * Generates a standardized WMR Report ID
 * Format: WMR-YYMMDD-HHmmssSS-{system_code}
 * e.g. WMR-260822-08353645-bbris
 */
export function generateWmrReportId(nisName?: string, imoOffice?: string, dateObj: Date = new Date()): string {
  const yy = String(dateObj.getFullYear()).slice(-2);
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  const hours = String(dateObj.getHours()).padStart(2, '0');
  const minutes = String(dateObj.getMinutes()).padStart(2, '0');
  const seconds = String(dateObj.getSeconds()).padStart(2, '0');
  const subSeconds = String(Math.floor(dateObj.getMilliseconds() / 10)).padStart(2, '0');

  const systemCode = resolveSystemCode(nisName, imoOffice);

  return `WMR-${yy}${month}${day}-${hours}${minutes}${seconds}${subSeconds}-${systemCode}`;
}

/**
 * Standardizes Report ID display with uppercase WMR and revision suffix
 * e.g. WMR-260825-09212657-bbris-rev.00
 */
export function formatReportId(rawId?: string, revisionNumber?: number): string {
  if (!rawId) return 'N/A';
  let id = rawId.trim();
  if (id.toLowerCase().startsWith('wmr-')) {
    id = 'WMR-' + id.substring(4);
  }
  const rev = revisionNumber !== undefined && revisionNumber !== null ? revisionNumber : 0;
  const revStr = rev < 10 ? `rev.0${rev}` : `rev.${rev}`;
  
  if (id.toLowerCase().includes('-rev.')) {
    return id.replace(/-rev\.\d+/i, `-${revStr}`);
  }
  return `${id}-${revStr}`;
}


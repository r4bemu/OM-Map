import { GISLayer, CanalCategory, CanalType, FieldReport } from '../types';

/**
 * Standard O&M Blue Color & Linestring Hierarchy for Vector Layers
 *
 * 1. Main Canals: Light Blue (#38bdf8) on Thick Linestring (4.8px)
 * 2. Lateral Canals: Blue (#2563eb) on Medium-Thick Linestring (3.2px)
 * 3. Unclassified Canals: Dark Blue (#1e3a8a) on Normal Thickness Linestring (2.0px)
 * 4. Structures: Azure / Cerulean Blue (#0284c7) with Crisp Solid White Ring (6px radius, 2px border)
 */
export const BLUE_PALETTE = {
  MAIN_CANAL: '#38bdf8',       // Light Sky Blue
  LATERAL_CANAL: '#2563eb',    // Royal Blue
  UNCLASSIFIED_CANAL: '#1e3a8a', // Deep Navy / Dark Blue
  STRUCTURE: '#0284c7'         // Sky / Azure Blue
} as const;

export const STROKE_WEIGHTS = {
  MAIN_CANAL: 4.8,
  LATERAL_CANAL: 3.2,
  UNCLASSIFIED_CANAL: 2.0,
  STRUCTURE_BORDER: 2.0,
  DEFAULT_LINE: 2.0
} as const;

export type CanalHierarchyType = 'Main Canals' | 'Lateral Canals' | 'Other Unclassified Canals' | 'Structures';

/**
 * Detects canal category: Lined, Unlined, or Uncategorized
 */
export function detectCanalCategory(props: any): CanalCategory {
  if (!props || typeof props !== 'object') return 'Uncategorized';

  const text = [
    props.canal_type,
    props.Canal_Type,
    props.CANAL_TYPE,
    props.type,
    props.remarks,
    props.Remarks,
    props.remarks_1,
    props.description
  ].filter(Boolean).map(v => String(v).trim().toLowerCase()).join(' ');

  if (/\bunlined\b/.test(text) || /\bearth\b/.test(text) || text.includes('un-lined')) {
    return 'Unlined';
  }
  if (/\blined\b/.test(text) || text.includes('concrete') || text.includes('grouted')) {
    return 'Lined';
  }
  return 'Uncategorized';
}

/**
 * Detects canal type: Main, Lateral, Farm Ditch, or Unclassified
 */
export function detectCanalType(props: any, layerName?: string, name?: string): CanalType {
  const candidateTexts = [
    props?.canaltype,
    props?.CanalType,
    props?.canal,
    props?.['NAME OF CA'],
    props?.remarks,
    props?.Remarks,
    props?.REMARKS,
    props?.remarks_1,
    props?.canal_name,
    props?.Canal_Name,
    props?.CANAL_NAME,
    props?.Name,
    props?.name,
    props?.NAME,
    props?.canalSegment,
    name,
    layerName
  ].filter(Boolean).map(v => String(v).toLowerCase()).join(' ');

  // Farm Ditch check
  if (
    candidateTexts.includes('farm ditch') ||
    candidateTexts.includes('farm_ditch') ||
    /\bmfd\b/.test(candidateTexts) ||
    /\bsfd\b/.test(candidateTexts) ||
    /\bditch\b/.test(candidateTexts)
  ) {
    return 'Farm Ditch';
  }

  // Main Canal check
  if (
    candidateTexts.includes('main canal') ||
    candidateTexts.includes('main_canal') ||
    /\bmain\b/.test(candidateTexts) ||
    /\bmc\b/.test(candidateTexts) ||
    /\bmc\s*\d+/.test(candidateTexts)
  ) {
    return 'Main';
  }

  // Lateral Canal check
  if (
    candidateTexts.includes('lateral') ||
    candidateTexts.includes('sub-lateral') ||
    candidateTexts.includes('sub lateral') ||
    candidateTexts.includes('supply canal') ||
    /\blat\b/.test(candidateTexts) ||
    /\blat\s*[a-z0-9]/.test(candidateTexts)
  ) {
    return 'Lateral';
  }

  return 'Unclassified';
}

/**
 * Formats combination label for Category and Type
 * e.g. "Lined (Main)", "Lined (Lateral)", "Unlined (Main)", "Uncategorized (Lateral)"
 */
export function formatCanalClassification(cat: CanalCategory, type: CanalType): string {
  const typeLabel = type === 'Main' ? 'Main' : type === 'Lateral' ? 'Lateral' : type === 'Farm Ditch' ? 'Farm Ditch' : 'Unclassified';
  return `${cat} (${typeLabel})`;
}

/**
 * Resolves the canal category and type from a FieldReport object,
 * utilizing existing explicit fields or falling back to analyzing the report attributes.
 */
export function getReportCanalCategoryAndType(report: Partial<FieldReport>): {
  category: CanalCategory;
  type: CanalType;
  classification: string;
} {
  let category: CanalCategory = report.canalCategory || 'Uncategorized';
  let type: CanalType = report.canalType || 'Unclassified';

  // Fallback category detection if uncategorized
  if (category === 'Uncategorized') {
    const text = [
      report.locationName,
      report.canalSegment,
      report.title,
      report.remarks
    ].filter(Boolean).join(' ').toLowerCase();

    if (/\bunlined\b|\bearth\b/.test(text) || text.includes('un-lined')) {
      category = 'Unlined';
    } else if (/\blined\b/.test(text) || text.includes('concrete') || text.includes('grouted')) {
      category = 'Lined';
    }
  }

  // Fallback type detection if unclassified
  if (type === 'Unclassified') {
    const text = [
      report.locationName,
      report.canalSegment,
      report.title,
      report.remarks
    ].filter(Boolean).join(' ').toLowerCase();

    if (text.includes('farm ditch') || /\bmfd\b|\bsfd\b|\bditch\b/.test(text)) {
      type = 'Farm Ditch';
    } else if (text.includes('main canal') || /\bmain\b|\bmc\b/.test(text)) {
      type = 'Main';
    } else if (text.includes('lateral') || /\blat\b|\blat\s*[a-z0-9]/.test(text)) {
      type = 'Lateral';
    }
  }

  return {
    category,
    type,
    classification: formatCanalClassification(category, type)
  };
}

/**
 * Classifies a layer or feature into the standard Canal & Structure hierarchy.
 */
export function classifyVectorItem(
  layerName?: string,
  layerCategory?: string,
  layerSubCategory?: string,
  featureProps?: any,
  geomType?: string
): {
  hierarchyType: CanalHierarchyType;
  color: string;
  weight: number;
  opacity: number;
  isStructure: boolean;
  canalCategory: CanalCategory;
  canalType: CanalType;
} {
  const nameStr = String(layerName || '').toLowerCase();
  const catStr = String(layerCategory || '').toLowerCase();
  const subCatStr = String(layerSubCategory || '').toLowerCase();
  const geomStr = String(geomType || '').toLowerCase();

  const cCategory = detectCanalCategory(featureProps);
  const cType = detectCanalType(featureProps, layerName);

  // Collect candidate text for structure detection and naming
  const rawCanalType = String(featureProps?.canal_type || featureProps?.Canal_Type || '').trim().toLowerCase();
  const isLinedValue = rawCanalType === 'lined' || rawCanalType === 'unlined';

  const featText = [
    featureProps?.Name,
    featureProps?.name,
    featureProps?.NAME,
    featureProps?.canal,
    featureProps?.['NAME OF CA'],
    featureProps?.canal_name,
    featureProps?.NAME_OF_CANAL,
    featureProps?.canalSegment,
    featureProps?.remarks,
    featureProps?.Remarks,
    featureProps?.REMARKS,
    featureProps?.remarks_1,
    featureProps?.canaltype,
    !isLinedValue ? featureProps?.canal_type : '',
    !isLinedValue ? featureProps?.Canal_Type : '',
    featureProps?.type
  ].filter(Boolean).map(v => String(v).toLowerCase()).join(' ');

  // 1. Check if Structure (Point or named structure / gate / dam / intake)
  const isStructure =
    geomStr.includes('point') ||
    catStr.includes('structure') ||
    subCatStr.includes('structure') ||
    nameStr.includes('structure') ||
    nameStr.includes('gate') ||
    nameStr.includes('dam') ||
    featText.includes('dam') ||
    featText.includes('intake') ||
    featText.includes('gate') ||
    featText.includes('turnout') ||
    featText.includes('flume') ||
    featText.includes('culvert') ||
    featText.includes('siphon');

  if (isStructure) {
    return {
      hierarchyType: 'Structures',
      color: BLUE_PALETTE.STRUCTURE,
      weight: STROKE_WEIGHTS.STRUCTURE_BORDER,
      opacity: 1.0,
      isStructure: true,
      canalCategory: cCategory,
      canalType: cType
    };
  }

  // 2. Check if Main Canal
  const isMainCanal =
    cType === 'Main' ||
    subCatStr.includes('main') ||
    nameStr.includes('main canal') ||
    nameStr.includes('main_canal') ||
    featText.includes('main canal') ||
    featText.includes('main_canal') ||
    /\bmain\b/.test(featText) ||
    /\bmc\b/.test(featText);

  if (isMainCanal) {
    return {
      hierarchyType: 'Main Canals',
      color: BLUE_PALETTE.MAIN_CANAL,
      weight: STROKE_WEIGHTS.MAIN_CANAL,
      opacity: 0.95,
      isStructure: false,
      canalCategory: cCategory,
      canalType: 'Main'
    };
  }

  // 3. Check if Lateral Canal
  const isLateral =
    cType === 'Lateral' ||
    subCatStr.includes('lateral') ||
    nameStr.includes('lateral') ||
    nameStr.includes('sub-lateral') ||
    nameStr.includes('sub lateral') ||
    featText.includes('lateral') ||
    featText.includes('sub-lateral') ||
    featText.includes('sub lateral') ||
    featText.includes('supply canal') ||
    /\blat\b/.test(featText);

  if (isLateral) {
    return {
      hierarchyType: 'Lateral Canals',
      color: BLUE_PALETTE.LATERAL_CANAL,
      weight: STROKE_WEIGHTS.LATERAL_CANAL,
      opacity: 0.90,
      isStructure: false,
      canalCategory: cCategory,
      canalType: 'Lateral'
    };
  }

  // 4. Default: Unclassified / Farm Ditch / Other Canal
  return {
    hierarchyType: 'Other Unclassified Canals',
    color: BLUE_PALETTE.UNCLASSIFIED_CANAL,
    weight: STROKE_WEIGHTS.UNCLASSIFIED_CANAL,
    opacity: 0.85,
    isStructure: false,
    canalCategory: cCategory,
    canalType: cType
  };
}

/**
 * Sanitizes any GISLayer to strictly follow the Blue hierarchy.
 */
export function sanitizeLayerToBlueHierarchy(layer: GISLayer): GISLayer {
  if (!layer) return layer;

  const classification = classifyVectorItem(
    layer.name,
    layer.category,
    layer.subCategory,
    layer.data?.features?.[0]?.properties,
    layer.geometryType
  );

  const cleanCategory = classification.isStructure ? 'Structures' : 'Canals';
  const cleanSubCategory = classification.hierarchyType;
  const cleanColor = classification.color;

  return {
    ...layer,
    category: cleanCategory,
    subCategory: cleanSubCategory,
    color: cleanColor,
    opacity: layer.opacity ?? (classification.isStructure ? 1.0 : 0.9)
  };
}

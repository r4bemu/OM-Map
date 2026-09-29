import { GISLayer, CanalCategory, CanalType, FieldReport } from '../types';

/**
 * Standard O&M Blue Color & Linestring Hierarchy for Vector Layers
 *
 * 1. Main Canals: Light Blue (#38bdf8) on Thick Linestring (5px, 0.85 opacity)
 * 2. Lateral Canals: Blue (#2563eb) on Medium-Thick Linestring (4px, 0.85 opacity)
 * 3. Unclassified Canals: Dark Blue (#1e3a8a) on Normal Thickness Linestring (3px, 0.85 opacity)
 * 4. Structures: Azure / Cerulean Blue (#0284c7) strictly on Point geometries (6px radius, 2px border)
 */
export const BLUE_PALETTE = {
  MAIN_CANAL: '#38bdf8',       // Light Sky Blue
  LATERAL_CANAL: '#2563eb',    // Royal Blue
  UNCLASSIFIED_CANAL: '#1e3a8a', // Deep Navy / Dark Blue
  STRUCTURE: '#0284c7'         // Sky / Azure Blue
} as const;

export const STROKE_WEIGHTS = {
  MAIN_CANAL: 5.0,
  LATERAL_CANAL: 4.0,
  UNCLASSIFIED_CANAL: 3.0,
  STRUCTURE_BORDER: 2.0,
  DEFAULT_LINE: 3.0
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
    props.Type,
    props.remarks,
    props.Remarks,
    props.remarks_1,
    props.description,
    props.canal,
    props.canaltype
  ].filter(Boolean).map(v => String(v).trim().toLowerCase()).join(' ');

  if (/\blined\b/.test(text) || text.includes('concrete') || text.includes('grouted')) {
    return 'Lined';
  }

  // Ditches in general are categorized as unlined
  const isDitch = text.includes('ditch') || text.includes('mfd') || text.includes('sfd') || detectCanalType(props) === 'Farm Ditch';
  if (/\bunlined\b/.test(text) || /\bearth\b/.test(text) || text.includes('un-lined') || isDitch) {
    return 'Unlined';
  }

  return 'Uncategorized';
}

/**
 * Detects canal type: Main, Lateral, Farm Ditch, or Unclassified
 */
export function detectCanalType(props: any, layerName?: string, name?: string): CanalType {
  const isGenericOrBlank = (v: any) => {
    if (v === undefined || v === null) return true;
    const s = String(v).trim().toLowerCase();
    return s === '' || s === 'null' || s === 'undefined' || s === '[blank]' || s === 'lined' || s === 'unlined' || s === 'earth' || s === 'concrete';
  };

  const featTexts = [
    props?.remarks,
    props?.Remarks,
    props?.REMARKS,
    props?.remarks_1,
    props?.canal,
    props?.['NAME OF CA'],
    props?.canal_name,
    props?.Canal_Name,
    props?.CANAL_NAME,
    props?.Name,
    props?.name,
    props?.NAME,
    props?.canalSegment,
    props?.canal_type,
    props?.Canal_Type,
    props?.CANAL_TYPE,
    props?.canaltype,
    props?.CanalType,
    props?.type,
    props?.Type,
    name
  ].filter(v => !isGenericOrBlank(v)).map(v => String(v).toLowerCase()).join(' ');

  let candidateTexts = featTexts;
  if (!candidateTexts && layerName) {
    const lName = String(layerName).toLowerCase();
    const isGeneralLayer = lName.includes('ris') || lName.includes('network') || lName.includes('om-map');
    if (!isGeneralLayer) {
      candidateTexts = lName;
    }
  }

  // 1. Farm Ditch check
  if (
    candidateTexts.includes('farm ditch') ||
    candidateTexts.includes('farm_ditch') ||
    candidateTexts.includes('farmditch') ||
    /\bmfd\b/.test(candidateTexts) ||
    /\bsfd\b/.test(candidateTexts) ||
    /\bditch\b/.test(candidateTexts)
  ) {
    return 'Farm Ditch';
  }

  // 2. Lateral Canal check (MUST precede Main Canal check!)
  // Laterals often reference parent main canal in their designation (e.g. 'MC3 LATERAL B', 'Main Canal 1 Lateral 1')
  if (
    candidateTexts.includes('lateral') ||
    candidateTexts.includes('sub-lateral') ||
    candidateTexts.includes('sub lateral') ||
    candidateTexts.includes('supply canal') ||
    /\blat\b/.test(candidateTexts) ||
    /\blat\s*[a-z0-9]/.test(candidateTexts) ||
    /\bsub\s*lat/.test(candidateTexts)
  ) {
    return 'Lateral';
  }

  // 3. Main Canal check
  if (
    candidateTexts.includes('main canal') ||
    candidateTexts.includes('main_canal') ||
    candidateTexts.includes('north main') ||
    candidateTexts.includes('south main') ||
    candidateTexts.includes('west main') ||
    candidateTexts.includes('east main') ||
    /\bmain\b/.test(candidateTexts) ||
    /\bmc\b/.test(candidateTexts) ||
    /\bmc\s*\d+/.test(candidateTexts)
  ) {
    return 'Main';
  }

  return 'Unclassified';
}

/**
 * Resolves standard user-facing label for canal type / classification.
 * Ensures the popup attribute window and inspector match the map visual hierarchy exactly.
 */
export function getCanalTypeLabel(
  hierarchyType: CanalHierarchyType,
  canalType?: CanalType,
  isStructure?: boolean
): string {
  if (isStructure || hierarchyType === 'Structures') {
    return 'Structure';
  }
  if (canalType === 'Farm Ditch') {
    return 'Farm Ditch';
  }
  if (hierarchyType === 'Main Canals' || canalType === 'Main') {
    return 'Main Canal';
  }
  if (hierarchyType === 'Lateral Canals' || canalType === 'Lateral') {
    return 'Lateral Canal';
  }
  return 'Unclassified Canal';
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

  // Farm ditches are in general categorized as unlined
  if (type === 'Farm Ditch' && category === 'Uncategorized') {
    category = 'Unlined';
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

  const isLineGeom = geomStr.includes('line');
  const isPointGeom = geomStr.includes('point');

  // 1. Check if Structure: strictly restricted to Point geometries (or explicit non-line structure layers)
  const isStructure = isPointGeom || (!isLineGeom && (
    catStr.includes('structure') ||
    subCatStr.includes('structure') ||
    nameStr.includes('structure')
  ));

  if (isStructure) {
    return {
      hierarchyType: 'Structures',
      color: BLUE_PALETTE.STRUCTURE,
      weight: STROKE_WEIGHTS.STRUCTURE_BORDER,
      opacity: 0.85,
      isStructure: true,
      canalCategory: cCategory,
      canalType: cType
    };
  }

  // 2. Check feature's detected canal type
  if (cType === 'Main') {
    return {
      hierarchyType: 'Main Canals',
      color: BLUE_PALETTE.MAIN_CANAL,
      weight: STROKE_WEIGHTS.MAIN_CANAL,
      opacity: 0.85,
      isStructure: false,
      canalCategory: cCategory,
      canalType: 'Main'
    };
  }

  if (cType === 'Lateral') {
    return {
      hierarchyType: 'Lateral Canals',
      color: BLUE_PALETTE.LATERAL_CANAL,
      weight: STROKE_WEIGHTS.LATERAL_CANAL,
      opacity: 0.85,
      isStructure: false,
      canalCategory: cCategory,
      canalType: 'Lateral'
    };
  }

  if (cType === 'Farm Ditch') {
    return {
      hierarchyType: 'Other Unclassified Canals',
      color: BLUE_PALETTE.UNCLASSIFIED_CANAL,
      weight: STROKE_WEIGHTS.UNCLASSIFIED_CANAL,
      opacity: 0.85,
      isStructure: false,
      canalCategory: cCategory,
      canalType: 'Farm Ditch'
    };
  }

  // 3. Fallback to layer name only if layer is specifically dedicated to one type (not a general RIS/network)
  const isGeneralLayer = nameStr.includes('ris') || nameStr.includes('network') || nameStr.includes('om-map');
  if (!isGeneralLayer) {
    if (nameStr.includes('main canal') || nameStr.includes('main_canal') || (subCatStr.includes('main') && !subCatStr.includes('network'))) {
      return {
        hierarchyType: 'Main Canals',
        color: BLUE_PALETTE.MAIN_CANAL,
        weight: STROKE_WEIGHTS.MAIN_CANAL,
        opacity: 0.85,
        isStructure: false,
        canalCategory: cCategory,
        canalType: 'Main'
      };
    }
    if (nameStr.includes('lateral') || (subCatStr.includes('lateral') && !subCatStr.includes('network'))) {
      return {
        hierarchyType: 'Lateral Canals',
        color: BLUE_PALETTE.LATERAL_CANAL,
        weight: STROKE_WEIGHTS.LATERAL_CANAL,
        opacity: 0.85,
        isStructure: false,
        canalCategory: cCategory,
        canalType: 'Lateral'
      };
    }
  }

  // 4. Default: Other / Unclassified Canal
  return {
    hierarchyType: 'Other Unclassified Canals',
    color: BLUE_PALETTE.UNCLASSIFIED_CANAL,
    weight: STROKE_WEIGHTS.UNCLASSIFIED_CANAL,
    opacity: 0.85,
    isStructure: false,
    canalCategory: cCategory,
    canalType: 'Unclassified'
  };
}

/**
 * Sanitizes any GISLayer to strictly follow the Blue hierarchy.
 */
export function sanitizeLayerToBlueHierarchy(layer: GISLayer): GISLayer {
  if (!layer) return layer;

  const isPointLayer = layer.geometryType === 'Point';
  const isMultiFeature = (layer.data?.features?.length || 0) > 1;

  if (isPointLayer) {
    return {
      ...layer,
      category: 'Structures',
      subCategory: 'Structures',
      color: BLUE_PALETTE.STRUCTURE,
      opacity: layer.opacity ?? 0.85
    };
  }

  if (isMultiFeature) {
    return {
      ...layer,
      category: 'Canals',
      subCategory: 'Canal Network',
      color: BLUE_PALETTE.LATERAL_CANAL,
      opacity: layer.opacity ?? 0.85
    };
  }

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
    opacity: layer.opacity ?? 0.85
  };
}

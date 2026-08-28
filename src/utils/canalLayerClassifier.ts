import { GISLayer } from '../types';

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
} {
  const nameStr = String(layerName || '').toLowerCase();
  const catStr = String(layerCategory || '').toLowerCase();
  const subCatStr = String(layerSubCategory || '').toLowerCase();
  const geomStr = String(geomType || '').toLowerCase();

  const featName = String(
    featureProps?.Name ||
    featureProps?.name ||
    featureProps?.NAME ||
    featureProps?.canal_name ||
    featureProps?.NAME_OF_CANAL ||
    featureProps?.canalSegment ||
    featureProps?.Canal_Type ||
    featureProps?.canal_type ||
    featureProps?.type ||
    ''
  ).toLowerCase();

  // 1. Check if Structure (Point or named structure / gate / dam / intake)
  const isStructure =
    geomStr.includes('point') ||
    catStr.includes('structure') ||
    subCatStr.includes('structure') ||
    nameStr.includes('structure') ||
    nameStr.includes('gate') ||
    nameStr.includes('dam') ||
    featName.includes('dam') ||
    featName.includes('intake') ||
    featName.includes('gate') ||
    featName.includes('turnout') ||
    featName.includes('flume') ||
    featName.includes('culvert') ||
    featName.includes('siphon');

  if (isStructure) {
    return {
      hierarchyType: 'Structures',
      color: BLUE_PALETTE.STRUCTURE,
      weight: STROKE_WEIGHTS.STRUCTURE_BORDER,
      opacity: 1.0,
      isStructure: true
    };
  }

  // 2. Check if Main Canal
  const isMainCanal =
    subCatStr.includes('main') ||
    nameStr.includes('main canal') ||
    nameStr.includes('main_canal') ||
    nameStr.includes('main') ||
    nameStr.includes('mc') ||
    featName.includes('main canal') ||
    featName.includes('main_canal') ||
    featName.includes('main') ||
    featName.includes('mc');

  if (isMainCanal) {
    return {
      hierarchyType: 'Main Canals',
      color: BLUE_PALETTE.MAIN_CANAL,
      weight: STROKE_WEIGHTS.MAIN_CANAL,
      opacity: 0.95,
      isStructure: false
    };
  }

  // 3. Check if Lateral Canal
  const isLateral =
    subCatStr.includes('lateral') ||
    nameStr.includes('lateral') ||
    nameStr.includes('sub-lateral') ||
    nameStr.includes('sub lateral') ||
    nameStr.includes('lat') ||
    featName.includes('lateral') ||
    featName.includes('sub-lateral') ||
    featName.includes('sub lateral') ||
    featName.includes('lat a') ||
    featName.includes('lat b') ||
    featName.includes('lat c') ||
    featName.includes('lat d') ||
    featName.includes('lat e') ||
    featName.includes('lat f') ||
    featName.includes('lat g') ||
    featName.includes('lat h') ||
    featName.includes('sub-lat') ||
    featName.includes('lat_') ||
    featName.includes('lat');

  if (isLateral) {
    return {
      hierarchyType: 'Lateral Canals',
      color: BLUE_PALETTE.LATERAL_CANAL,
      weight: STROKE_WEIGHTS.LATERAL_CANAL,
      opacity: 0.90,
      isStructure: false
    };
  }

  // 4. Default: Unclassified / Other Canal
  return {
    hierarchyType: 'Other Unclassified Canals',
    color: BLUE_PALETTE.UNCLASSIFIED_CANAL,
    weight: STROKE_WEIGHTS.UNCLASSIFIED_CANAL,
    opacity: 0.85,
    isStructure: false
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

import { GISLayer, LocationPick } from '../types';

/**
 * Calculates Euclidean distance between two lat/lng points in meters approximately
 */
export function haversineDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  if (isNaN(lat1) || isNaN(lng1) || isNaN(lat2) || isNaN(lng2)) return 0;
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Formats stationing distance in meters to standard canal nomenclature:
 * [X in thousands place] + [X in hundreds, tens, ones place]
 * Examples:
 * 0 => 0+000
 * 1 => 0+001
 * 2980.7 => 2+980.7
 * 3003.8 => 3+003.8
 * 3463.8 => 3+463.8
 */
export function formatStationingNumber(meters: number): string {
  if (isNaN(meters) || meters < 0) meters = 0;
  const rounded = Math.round(meters * 10) / 10;
  const km = Math.floor(rounded / 1000);
  const rem = rounded % 1000;
  const intPart = Math.floor(rem).toString().padStart(3, '0');
  const decVal = Math.round((rounded % 1) * 10);
  const decPart = decVal > 0 ? `.${decVal}` : '';
  return `${km}+${intPart}${decPart}`;
}

/**
 * Parses stationing distance in meters from text or structure name strings.
 * e.g. "MAIN CANAL BULLCART 1 (2+980.7)" => 2980.7
 * "MAIN CANAL OUTLET (3+003.8)" => 3003.8
 * "Sta. 0+150" => 150
 */
export function parseStationingFromText(text: string): number | null {
  if (!text || typeof text !== 'string') return null;
  const match = text.match(/(\d+)\+(\d+(?:\.\d+)?)/);
  if (match) {
    const km = parseInt(match[1], 10);
    const meters = parseFloat(match[2]);
    return km * 1000 + meters;
  }
  return null;
}

/**
 * Finds the projected point on line segment [A, B] closest to point P
 */
function projectPointOnSegment(
  p: [number, number],
  a: [number, number],
  b: [number, number]
): { point: [number, number]; t: number; distMeters: number } {
  const pLat = p[0], pLng = p[1];
  const aLat = a[0], aLng = a[1];
  const bLat = b[0], bLng = b[1];

  const dx = bLng - aLng;
  const dy = bLat - aLat;

  if (dx === 0 && dy === 0) {
    return { point: [aLat, aLng], t: 0, distMeters: haversineDistanceMeters(pLat, pLng, aLat, aLng) };
  }

  const t = Math.max(0, Math.min(1, ((pLng - aLng) * dx + (pLat - aLat) * dy) / (dx * dx + dy * dy)));
  const projLat = aLat + t * dy;
  const projLng = aLng + t * dx;

  const distMeters = haversineDistanceMeters(pLat, pLng, projLat, projLng);
  return { point: [projLat, projLng], t, distMeters };
}

/**
 * Finds the projected point on a polyline closest to point P
 */
export function projectPointOnPolyline(
  pLat: number,
  pLng: number,
  lineCoords: [number, number][]
): { distanceMeters: number; distanceAlongLineMeters: number; point: [number, number] } {
  let minDist = Infinity;
  let bestPoint: [number, number] = lineCoords[0] || [pLat, pLng];
  let bestDistAlongLine = 0;
  let cumDist = 0;

  for (let i = 0; i < lineCoords.length - 1; i++) {
    const a = lineCoords[i];
    const b = lineCoords[i + 1];
    const segLen = haversineDistanceMeters(a[0], a[1], b[0], b[1]);
    const proj = projectPointOnSegment([pLat, pLng], a, b);

    if (proj.distMeters < minDist) {
      minDist = proj.distMeters;
      bestPoint = proj.point;
      bestDistAlongLine = cumDist + proj.t * segLen;
    }
    cumDist += segLen;
  }

  return { distanceMeters: minDist, distanceAlongLineMeters: bestDistAlongLine, point: bestPoint };
}

export interface ReferenceStructureAnchor {
  name: string;
  stationMeters: number;
  lineDistMeters: number;
  coord: [number, number];
  rawProps?: any;
}

/**
 * Checks if an anchor structure name or its properties match or belong to the canal line name
 */
export function isAnchorNameMatchingCanal(anchorName: string, canalName: string, props?: any): boolean {
  if (!anchorName && !props) return false;
  const cleanA = (anchorName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const cleanC = (canalName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  
  if (cleanC.length >= 3 && cleanA.includes(cleanC)) return true;
  if (cleanA.length >= 3 && cleanC.includes(cleanA)) return true;

  if (props) {
    const pCanal = (props.canal_name || props.Canal_Name || props.canal_code || props.CANAL_NAME || '').toString().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (pCanal && cleanC && (pCanal.includes(cleanC) || cleanC.includes(pCanal))) return true;
  }

  return false;
}

/**
 * Collects all tagged structure reference anchors on or near a canal line (strictly within maxDistMeters, default 10m)
 */
export function getCanalReferenceAnchors(
  lineCoords: [number, number][],
  canalName: string,
  layers: GISLayer[],
  maxDistMeters: number = 10
): ReferenceStructureAnchor[] {
  const anchors: ReferenceStructureAnchor[] = [];
  if (!lineCoords || lineCoords.length < 2) return anchors;

  // Calculate cumulative distance map for line
  const cumDists: number[] = [0];
  for (let i = 0; i < lineCoords.length - 1; i++) {
    const segLen = haversineDistanceMeters(
      lineCoords[i][0], lineCoords[i][1],
      lineCoords[i + 1][0], lineCoords[i + 1][1]
    );
    cumDists.push(cumDists[i] + segLen);
  }

  layers.forEach((layer) => {
    if (!layer.visible || !layer.data || !layer.data.features) return;

    layer.data.features.forEach((feature: any) => {
      const geom = feature.geometry;
      const props = feature.properties || {};
      if (!geom) return;

      const titleStr = `${props.name || ''} ${props.station_code || ''} ${props.description || ''}`;
      const stationVal = parseStationingFromText(titleStr) ?? parseStationingFromText(props.station_code);

      if (stationVal === null) return;

      if (geom.type === 'Point' && geom.coordinates) {
        const [fLng, fLat] = geom.coordinates;
        let minDist = Infinity;
        let lineDist = 0;

        for (let i = 0; i < lineCoords.length - 1; i++) {
          const proj = projectPointOnSegment([fLat, fLng], lineCoords[i], lineCoords[i + 1]);
          if (proj.distMeters < minDist) {
            minDist = proj.distMeters;
            lineDist = cumDists[i] + proj.t * (cumDists[i + 1] - cumDists[i]);
          }
        }

        // Register structure strictly if within maxDistMeters (default 10m) of the canal line
        if (minDist <= maxDistMeters) {
          anchors.push({
            name: props.name || `Structure (${formatStationingNumber(stationVal)})`,
            stationMeters: stationVal,
            lineDistMeters: lineDist,
            coord: [fLat, fLng],
            rawProps: props
          });
        }
      }
    });
  });

  anchors.sort((a, b) => a.lineDistMeters - b.lineDistMeters);
  return anchors;
}

/**
 * Detects if a linestring was digitized backwards (from tail to intake)
 * by inspecting anchor station trends and intake/headgate locations.
 * Returns oriented coordinates (where vertex 0 is intake 0+000) and whether reversal occurred.
 */
export function orientLinestringDownstream(
  lineCoords: [number, number][],
  canalName: string,
  layers: GISLayer[]
): {
  orientedCoords: [number, number][];
  isReversed: boolean;
} {
  if (!lineCoords || lineCoords.length < 2) {
    return { orientedCoords: lineCoords || [], isReversed: false };
  }

  // Find anchors along the line within 15m
  const anchors = getCanalReferenceAnchors(lineCoords, canalName, layers, 15);
  if (anchors.length === 0) {
    return { orientedCoords: lineCoords, isReversed: false };
  }

  let totalLineLength = 0;
  for (let i = 0; i < lineCoords.length - 1; i++) {
    totalLineLength += haversineDistanceMeters(
      lineCoords[i][0], lineCoords[i][1],
      lineCoords[i + 1][0], lineCoords[i + 1][1]
    );
  }

  let shouldReverse = false;

  // Rule A: Check for an explicit 0+000 / Headgate / Intake anchor near the end vertex
  const intakeAnchor = anchors.find(a => {
    const n = a.name.toLowerCase();
    return a.stationMeters === 0 || n.includes('headgate') || n.includes('intake') || n.includes('dam') || n.includes('0+000');
  });

  if (intakeAnchor) {
    const distToStart = intakeAnchor.lineDistMeters;
    const distToEnd = totalLineLength - intakeAnchor.lineDistMeters;
    // If intake anchor is much closer to the end of the line than the start
    if (distToEnd < distToStart && distToEnd < 150) {
      shouldReverse = true;
    }
  }

  // Rule B: If multiple anchors exist, check slope / correlation of stationing vs line distance
  if (!shouldReverse && anchors.length >= 2) {
    let inversionCount = 0;
    let normalCount = 0;
    for (let i = 0; i < anchors.length - 1; i++) {
      for (let j = i + 1; j < anchors.length; j++) {
        const a1 = anchors[i];
        const a2 = anchors[j];
        if (a1.stationMeters !== a2.stationMeters) {
          if (a1.stationMeters > a2.stationMeters && a1.lineDistMeters < a2.lineDistMeters) {
            inversionCount++;
          } else if (a1.stationMeters < a2.stationMeters && a1.lineDistMeters < a2.lineDistMeters) {
            normalCount++;
          }
        }
      }
    }
    if (inversionCount > normalCount) {
      shouldReverse = true;
    }
  }

  if (shouldReverse) {
    return {
      orientedCoords: [...lineCoords].reverse(),
      isReversed: true
    };
  }

  return {
    orientedCoords: lineCoords,
    isReversed: false
  };
}

/**
 * Calculates true canal stationing with 3-tier validation:
 * 1. Name Match (Direct Confidence) -> Station = Anchor Station + Line Offset
 * 2. Origin Variance <= 20m -> Station = Anchor Station + Line Offset
 * 3. 2nd Previous Anchor Span Consistency <= 10m -> Station = Anchor Station + Line Offset
 * 4. Fallback -> Cumulative Haversine distance from Linestring Vertex 0 (0+000)
 */
export function calculateCanalStationing(
  bestDistAlongLine: number,
  lineCoords: [number, number][],
  canalName: string,
  layers: GISLayer[],
  isReversedCorrected: boolean = false
): {
  stationMeters: number;
  stationingLabel: string;
  referenceContext: string;
  calibrationMethod: 'name_match' | 'origin_variance' | 'inter_anchor_verified' | 'vertex0_geometric';
  varianceMeters?: number;
  anchorName?: string;
} {
  // 1. Collect reference anchors strictly within 10m of the line
  const anchors = getCanalReferenceAnchors(lineCoords, canalName, layers, 10);

  // 2. Filter anchors located between vertex origin (0) and selected point (upstream anchors)
  const upstreamAnchors = anchors.filter(a => a.lineDistMeters <= bestDistAlongLine);

  if (upstreamAnchors.length > 0) {
    // Ref. Point 1: 1st Previous Anchor
    const refPoint1 = upstreamAnchors[upstreamAnchors.length - 1];
    const lineOffset = bestDistAlongLine - refPoint1.lineDistMeters;
    const computedAnchorStation = Math.max(0, refPoint1.stationMeters + lineOffset);

    // Decision 1: Does the anchor contain the same name as the canal segment?
    if (isAnchorNameMatchingCanal(refPoint1.name, canalName, refPoint1.rawProps)) {
      const varOrigin = Math.abs(bestDistAlongLine - computedAnchorStation);
      return {
        stationMeters: computedAnchorStation,
        stationingLabel: formatStationingNumber(computedAnchorStation),
        referenceContext: `Anchored: ${refPoint1.name} (Direct Match)`,
        calibrationMethod: 'name_match',
        varianceMeters: Math.round(varOrigin * 10) / 10,
        anchorName: refPoint1.name
      };
    }

    // Decision 2: Variance from Cumulative Haversine distance from Vertex 0 (<= 20m)
    const varianceFromVertex0 = Math.abs(bestDistAlongLine - computedAnchorStation);
    if (varianceFromVertex0 <= 20) {
      return {
        stationMeters: computedAnchorStation,
        stationingLabel: formatStationingNumber(computedAnchorStation),
        referenceContext: `Anchored: ${refPoint1.name} (Origin Δ ${varianceFromVertex0.toFixed(1)}m)`,
        calibrationMethod: 'origin_variance',
        varianceMeters: Math.round(varianceFromVertex0 * 10) / 10,
        anchorName: refPoint1.name
      };
    }

    // Decision 3: 2nd Previous Anchor (Ref. Point 2) Cross-Validation (<= 10m)
    if (upstreamAnchors.length >= 2) {
      const refPoint2 = upstreamAnchors[upstreamAnchors.length - 2];
      const declaredStationSpan = Math.abs(refPoint1.stationMeters - refPoint2.stationMeters);
      const physicalLineSpan = Math.abs(refPoint1.lineDistMeters - refPoint2.lineDistMeters);
      const interAnchorVariance = Math.abs(declaredStationSpan - physicalLineSpan);

      if (interAnchorVariance <= 10) {
        return {
          stationMeters: computedAnchorStation,
          stationingLabel: formatStationingNumber(computedAnchorStation),
          referenceContext: `Anchored: ${refPoint1.name} (Verified via ${refPoint2.name} Δ ${interAnchorVariance.toFixed(1)}m)`,
          calibrationMethod: 'inter_anchor_verified',
          varianceMeters: Math.round(interAnchorVariance * 10) / 10,
          anchorName: refPoint1.name
        };
      }
    }
  }

  // Fallback: Cumulative Haversine distance from Linestring Vertex 0 (0+000)
  const stationLabel = formatStationingNumber(bestDistAlongLine);
  return {
    stationMeters: bestDistAlongLine,
    stationingLabel: stationLabel,
    referenceContext: isReversedCorrected 
      ? `Geometric 0+000 (Reversed Polyline Corrected)`
      : `Geometric 0+000 from Vertex 0`,
    calibrationMethod: 'vertex0_geometric',
    varianceMeters: 0
  };
}

/**
 * Detects if a string is a raw synthetic internal feature identifier (e.g. f-1786778534380-2)
 */
export function isSyntheticFeatureId(val: any): boolean {
  if (!val || typeof val !== 'string') return false;
  const s = val.trim();
  return /^f-\d+-\d+$/i.test(s) || /^feat-/i.test(s) || /^f-\d+$/i.test(s) || /^kml_\d+$/i.test(s);
}

/**
 * Safely extracts the official Name from feature properties or falls back to default.
 * Filters out raw internal synthetic IDs (f-1786...) and checks remarks, canal_type, NIS.
 */
export function getFeatureName(props: any, defaultFallback = 'Main Canal'): string {
  if (!props || typeof props !== 'object') return defaultFallback;

  const candidates = [
    props.Name, props.name, props.NAME,
    props.remarks, props.Remarks, props.REMARKS,
    props.canal_name, props.Canal_Name, props.CANAL_NAME,
    props.station_name, props.Station_Name,
    props.parcel_name, props.Parcel_Name,
    props.title, props.Title,
    props.label, props.Label,
    props.system_name, props.System_Name,
    props.canal_type ? `${props.canal_type}${props.NIS ? ` (${props.NIS})` : ''}` : undefined,
    props.station_code,
    props.NIS ? `${props.NIS} Main Canal` : undefined,
    props.source_layer ? String(props.source_layer).replace(/_/g, ' ') : undefined
  ];

  for (const val of candidates) {
    if (val !== undefined && val !== null) {
      const str = String(val).trim();
      if (
        str !== '' &&
        str !== '[blank]' &&
        str.toLowerCase() !== 'null' &&
        str.toLowerCase() !== 'undefined' &&
        !isSyntheticFeatureId(str)
      ) {
        return str;
      }
    }
  }

  return defaultFallback;
}

/**
 * Cleans and extracts the pure canal base name by stripping bracketed/parenthesized stationing and checkpoint codes
 * e.g. "Main Canal Lateral AA Headgate [2+719.3]" => "Main Canal Lateral AA Headgate"
 * "MAIN CANAL (2+980.7)" => "MAIN CANAL"
 * "Baco-Bucayao RIS Main Canal (Sta. 0+000 to 2+719)" => "Baco-Bucayao RIS Main Canal"
 */
export function cleanCanalBaseName(raw: string): string {
  if (!raw || typeof raw !== 'string') return 'Main Canal';
  let clean = raw.trim();
  clean = clean.replace(/\s*[\(\[]?\s*(?:Sta\.?\s*)?\d+\+\d+(?:\.\d+)?(?:\s*(?:to|-)\s*(?:Sta\.?\s*)?\d+\+\d+(?:\.\d+)?)?\s*[\)\]]?/gi, '').trim();
  clean = clean.replace(/[-–—]\s*$/, '').trim();
  return clean || 'Main Canal';
}

export interface NearestGISFeatureResult {
  locationName: string;
  stationingLabel: string;
  canalCode?: string;
  parcelId?: string;
  structureName?: string;
  nearestFeatureName?: string;
  nearestFeatureType?: string;
  snappedCoords: [number, number];
  distanceAlongLineMeters: number;
  featureCoordinates?: [number, number][]; // LineString coordinates
  isStructurePoint?: boolean;
  referenceContext?: string;
  calibrationMethod?: string;
  imo?: string;
  nis?: string;
  province?: string;
  municipality?: string;
  barangay?: string;
}

/**
 * Detects canal name, stationing, structure, and canal code for a given lat/lng
 */
export function detectNearestGISFeature(
  lat: number,
  lng: number,
  layers: GISLayer[]
): NearestGISFeatureResult {
  const numLat = Number(lat);
  const numLng = Number(lng);
  const validLat = (!isNaN(numLat) && isFinite(numLat)) ? numLat : 13.1000;
  const validLng = (!isNaN(numLng) && isFinite(numLng)) ? numLng : 121.3000;

  let minDistance = Infinity;
  let bestResult: NearestGISFeatureResult = {
    locationName: `Site Location (${validLat.toFixed(4)}, ${validLng.toFixed(4)})`,
    stationingLabel: `0+000`,
    snappedCoords: [validLat, validLng],
    distanceAlongLineMeters: 0,
    referenceContext: 'Geometric 0+000'
  };

  layers.forEach((layer) => {
    if (!layer.visible || !layer.data || !layer.data.features) return;

    const layerImo = layer.name.includes('Palawan') 
      ? 'PALAWAN IMO' 
      : layer.name.includes('Occidental') 
      ? 'OCCIDENTAL MINDORO IMO' 
      : (layer.name.includes('Oriental') || layer.name.includes('MOMARO') || layer.name.includes('Romblon') || layer.name.includes('Marinduque'))
      ? 'MINDORO ORIENTAL-MARINDUQUE-ROMBLON IMO'
      : undefined;

    layer.data.features.forEach((feature: any) => {
      const props = feature.properties || {};
      const geom = feature.geometry;

      if (!geom) return;

      // Quick bounding box check: if geometry is further than 1.0 degree lat/lng (~111km) away, skip
      if (geom.coordinates) {
        let firstCoord = geom.coordinates;
        while (Array.isArray(firstCoord[0])) firstCoord = firstCoord[0];
        if (typeof firstCoord[0] === 'number' && typeof firstCoord[1] === 'number') {
          if (Math.abs(firstCoord[1] - lat) > 1.0 || Math.abs(firstCoord[0] - lng) > 1.0) {
            return;
          }
        }
      }

      const featureImo = props.IMO || props.imo || layerImo;
      const featureNis = props.NIS || props.nis || props.River_Irrigation_System || props.System_Name || props.System;
      const featureProv = props.Province || props.province;
      const featureMuni = props.Municipality || props.municipality;
      const featureBrgy = props.Barangay || props.barangay;

      if (geom.type === 'Point' && geom.coordinates) {
        const [fLng, fLat] = geom.coordinates;
        const dist = haversineDistanceMeters(lat, lng, fLat, fLng);
        if (dist < minDistance && dist < 25) {
          minDistance = dist;
          const name = getFeatureName(props, props.station_code || 'Structure Gate');
          const titleStr = `${name} ${props.station_code || ''}`;
          const parsedSt = parseStationingFromText(titleStr);

          let stLabel = '';
          let formattedName = name;
          let canalCode = props.canal_code || props.desilting_dependency;
          let distAlongLine = 0;
          let refCtx: string | undefined = undefined;
          let calibMethod: string | undefined = undefined;

          if (parsedSt !== null) {
            stLabel = formatStationingNumber(parsedSt);
            formattedName = name.includes('+') ? name : `${name} (${stLabel})`;
            distAlongLine = parsedSt;
            refCtx = `Structure Attribute: ${name}`;
            calibMethod = 'attribute_explicit';
          } else {
            // Find connected / nearest canal line within 100m to compute true stationing along the canal
            let nearestCanalDist = Infinity;
            let nearestCanalLine: [number, number][] | null = null;
            let nearestCanalName = '';
            let nearestDistOnCanal = 0;

            layers.forEach((l) => {
              if (!l.visible || !l.data || !l.data.features) return;
              l.data.features.forEach((feat: any) => {
                const g = feat.geometry;
                if (!g || (g.type !== 'LineString' && g.type !== 'MultiLineString')) return;
                const lines: [number, number][][] = g.type === 'LineString'
                  ? [g.coordinates.map((c: any) => [c[1], c[0]])]
                  : g.coordinates.map((line: any) => line.map((c: any) => [c[1], c[0]]));

                lines.forEach((lCoords) => {
                  if (lCoords.length < 2) return;
                  const proj = projectPointOnPolyline(fLat, fLng, lCoords);
                  if (proj.distanceMeters < nearestCanalDist && proj.distanceMeters < 100) {
                    nearestCanalDist = proj.distanceMeters;
                    nearestCanalLine = lCoords;
                    nearestCanalName = getFeatureName(feat.properties || {}, 'Main Canal');
                    nearestDistOnCanal = proj.distanceAlongLineMeters;
                    if (feat.properties?.canal_code) canalCode = feat.properties.canal_code;
                  }
                });
              });
            });

            if (nearestCanalLine) {
              const { orientedCoords, isReversed } = orientLinestringDownstream(nearestCanalLine, nearestCanalName, layers);
              const proj = projectPointOnPolyline(fLat, fLng, orientedCoords);
              const stInfo = calculateCanalStationing(proj.distanceAlongLineMeters, orientedCoords, nearestCanalName, layers, isReversed);
              stLabel = stInfo.stationingLabel;
              formattedName = `${name} (${stLabel})`;
              distAlongLine = stInfo.stationMeters;
              refCtx = stInfo.referenceContext;
              calibMethod = stInfo.calibrationMethod;
            }
          }

          bestResult = {
            locationName: formattedName,
            stationingLabel: stLabel || '0+000',
            canalCode: canalCode,
            structureName: name,
            nearestFeatureName: name,
            nearestFeatureType: layer.category || 'Structure',
            snappedCoords: [fLat, fLng],
            distanceAlongLineMeters: distAlongLine,
            isStructurePoint: true,
            referenceContext: refCtx,
            calibrationMethod: calibMethod,
            imo: featureImo,
            nis: featureNis,
            province: featureProv,
            municipality: featureMuni,
            barangay: featureBrgy
          };
        }
      } else if (geom.type === 'LineString' && geom.coordinates) {
        const lineCoords: [number, number][] = geom.coordinates.map((c: any) => [c[1], c[0]]);
        const rawName = getFeatureName(props, 'Main Canal');
        const canalName = cleanCanalBaseName(rawName);

        // Orient linestring downstream (vertex 0 at intake 0+000)
        const { orientedCoords, isReversed } = orientLinestringDownstream(lineCoords, canalName, layers);

        let cumulativeDist = 0;
        let lineMinDist = Infinity;
        let bestPointAlongLine: [number, number] = orientedCoords[0];
        let bestDistAlongLine = 0;

        for (let i = 0; i < orientedCoords.length - 1; i++) {
          const segStart = orientedCoords[i];
          const segEnd = orientedCoords[i + 1];
          const segLength = haversineDistanceMeters(segStart[0], segStart[1], segEnd[0], segEnd[1]);

          const proj = projectPointOnSegment([lat, lng], segStart, segEnd);

          if (proj.distMeters < lineMinDist) {
            lineMinDist = proj.distMeters;
            bestPointAlongLine = proj.point;
            bestDistAlongLine = cumulativeDist + (proj.t * segLength);
          }

          cumulativeDist += segLength;
        }

        if (lineMinDist < minDistance) {
          minDistance = lineMinDist;
          const rawCode = props.canal_code || props.canal_id || props.station_code;
          const canalCode = (rawCode && !isSyntheticFeatureId(rawCode)) ? rawCode : (canalName !== 'Main Canal' ? canalName : 'CNL-MAIN');

          // Calculate 3-tier validated canal stationing
          const stationInfo = calculateCanalStationing(bestDistAlongLine, orientedCoords, canalName, layers, isReversed);

          bestResult = {
            locationName: `${canalName} (${stationInfo.stationingLabel})`,
            stationingLabel: stationInfo.stationingLabel,
            canalCode,
            nearestFeatureName: canalName,
            nearestFeatureType: 'Canal Line',
            snappedCoords: bestPointAlongLine,
            distanceAlongLineMeters: Math.round(stationInfo.stationMeters),
            featureCoordinates: orientedCoords,
            referenceContext: stationInfo.referenceContext,
            calibrationMethod: stationInfo.calibrationMethod,
            imo: featureImo,
            nis: featureNis,
            province: featureProv,
            municipality: featureMuni,
            barangay: featureBrgy
          };
        }
      }
    });
  });

  return bestResult;
}

/**
 * Given two location picks, calculates path along canal networks between loc1 and loc2.
 * Calculates precise canal stationing nomenclature: [Point 1 Name] to [Point 2 Name]
 */
export function calculateCanalPathBetweenPoints(
  loc1: { lat: number; lng: number },
  loc2: { lat: number; lng: number },
  layers: GISLayer[],
  pt1Props?: any,
  pt2Props?: any
): {
  pathCoords: [number, number][];
  locationName: string;
  canalCode?: string;
  parcelId?: string;
  distanceMeters: number;
  referenceContext?: string;
} {
  const l1Lat = (!isNaN(Number(loc1?.lat)) && isFinite(Number(loc1?.lat))) ? Number(loc1.lat) : 13.1000;
  const l1Lng = (!isNaN(Number(loc1?.lng)) && isFinite(Number(loc1?.lng))) ? Number(loc1.lng) : 121.3000;
  const l2Lat = (!isNaN(Number(loc2?.lat)) && isFinite(Number(loc2?.lat))) ? Number(loc2.lat) : 13.1000;
  const l2Lng = (!isNaN(Number(loc2?.lng)) && isFinite(Number(loc2?.lng))) ? Number(loc2.lng) : 121.3000;

  const feat1 = detectNearestGISFeature(l1Lat, l1Lng, layers);
  const feat2 = detectNearestGISFeature(l2Lat, l2Lng, layers);

  let canalCode = pt1Props?.canal_code || pt2Props?.canal_code || feat1.canalCode || feat2.canalCode;
  let parcelId = pt1Props?.parcel_id || pt2Props?.parcel_id || feat1.parcelId || feat2.parcelId;

  const lineFeatures: {
    id: string;
    name: string;
    canalCode?: string;
    coords: [number, number][];
  }[] = [];

  layers.forEach((layer) => {
    if (!layer.visible || !layer.data || !layer.data.features) return;
    layer.data.features.forEach((feature: any) => {
      const geom = feature.geometry;
      const props = feature.properties || {};
      if (!geom) return;

      if (geom.type === 'LineString' && geom.coordinates) {
        const lineCoords: [number, number][] = geom.coordinates.map((c: any) => [c[1], c[0]]);
        if (lineCoords.length >= 2) {
          lineFeatures.push({
            id: props.canal_code || feature.id || `line-${lineFeatures.length}`,
            name: getFeatureName(props, 'Main Canal'),
            canalCode: props.canal_code,
            coords: lineCoords
          });
        }
      } else if (geom.type === 'MultiLineString' && geom.coordinates) {
        geom.coordinates.forEach((line: any, idx: number) => {
          const lineCoords: [number, number][] = line.map((c: any) => [c[1], c[0]]);
          if (lineCoords.length >= 2) {
            lineFeatures.push({
              id: `${props.canal_code || feature.id || 'multiline'}-${idx}`,
              name: getFeatureName(props, 'Main Canal'),
              canalCode: props.canal_code,
              coords: lineCoords
            });
          }
        });
      }
    });
  });

  // Calculate Point 1 & Point 2 display names
  let name1 = feat1.locationName;
  if (pt1Props) {
    const rawName = getFeatureName(pt1Props, '');
    if (rawName) {
      const st1 = feat1.stationingLabel;
      name1 = (st1 && !rawName.includes('+')) ? `${rawName} (${st1})` : rawName;
    }
  }

  let name2 = feat2.locationName;
  if (pt2Props) {
    const rawName = getFeatureName(pt2Props, '');
    if (rawName) {
      const st2 = feat2.stationingLabel;
      name2 = (st2 && !rawName.includes('+')) ? `${rawName} (${st2})` : rawName;
    }
  }

  let locationName = '';
  const canalName1 = cleanCanalBaseName(feat1.nearestFeatureName || feat1.locationName || 'Main Canal');
  const canalName2 = cleanCanalBaseName(feat2.nearestFeatureName || feat2.locationName || 'Main Canal');

  if (
    canalName1 === canalName2 &&
    !feat1.isStructurePoint &&
    !feat2.isStructurePoint &&
    !pt1Props?.name &&
    !pt2Props?.name
  ) {
    let d1 = feat1.distanceAlongLineMeters || parseStationingFromText(feat1.stationingLabel) || 0;
    let d2 = feat2.distanceAlongLineMeters || parseStationingFromText(feat2.stationingLabel) || 0;
    if (d1 > d2) {
      const temp = d1;
      d1 = d2;
      d2 = temp;
    }
    const st1 = formatStationingNumber(d1);
    const st2 = formatStationingNumber(d2);
    locationName = `${canalName1} (${st1} to ${st2})`;
  } else {
    locationName = `${name1} to ${name2}`;
  }

  const refContext = feat1.referenceContext && feat2.referenceContext
    ? (feat1.referenceContext === feat2.referenceContext ? feat1.referenceContext : `${feat1.referenceContext} | ${feat2.referenceContext}`)
    : (feat1.referenceContext || feat2.referenceContext || undefined);

  if (lineFeatures.length === 0) {
    const directDist = haversineDistanceMeters(loc1.lat, loc1.lng, loc2.lat, loc2.lng);
    return {
      pathCoords: [[loc1.lat, loc1.lng], [loc2.lat, loc2.lng]],
      locationName,
      canalCode,
      parcelId,
      distanceMeters: Math.round(directDist),
      referenceContext: refContext
    };
  }

  let snap1 = findClosestPointOnNetwork(loc1, lineFeatures);
  let snap2 = findClosestPointOnNetwork(loc2, lineFeatures);

  const graph = buildCanalNetworkGraph(lineFeatures, snap1, snap2);
  const shortestPathNodes = dijkstraShortestPath(graph.adj, graph.nodes, snap1.nodeId, snap2.nodeId);

  let canalNetworkPathCoords: [number, number][] = [];

  if (shortestPathNodes && shortestPathNodes.length > 0) {
    canalNetworkPathCoords = shortestPathNodes.map(id => graph.nodes[id].coord);
  } else {
    canalNetworkPathCoords = [snap1.point, snap2.point];
  }

  const fullPathCoords: [number, number][] = [];

  const distLoc1ToSnap1 = haversineDistanceMeters(loc1.lat, loc1.lng, snap1.point[0], snap1.point[1]);
  if (distLoc1ToSnap1 > 1) {
    fullPathCoords.push([loc1.lat, loc1.lng]);
  }

  canalNetworkPathCoords.forEach(pt => fullPathCoords.push(pt));

  const distLoc2ToSnap2 = haversineDistanceMeters(loc2.lat, loc2.lng, snap2.point[0], snap2.point[1]);
  if (distLoc2ToSnap2 > 1) {
    fullPathCoords.push([loc2.lat, loc2.lng]);
  }

  let totalDistanceMeters = 0;
  for (let i = 0; i < fullPathCoords.length - 1; i++) {
    totalDistanceMeters += haversineDistanceMeters(
      fullPathCoords[i][0], fullPathCoords[i][1],
      fullPathCoords[i + 1][0], fullPathCoords[i + 1][1]
    );
  }

  return {
    pathCoords: fullPathCoords,
    locationName,
    canalCode,
    parcelId,
    distanceMeters: Math.round(totalDistanceMeters),
    referenceContext: refContext
  };
}

// Network Routing Helpers

interface SnapResult {
  point: [number, number];
  nodeId: string;
  lineIndex: number;
  segIndex: number;
  featureName: string;
  distMeters: number;
}

function findClosestPointOnNetwork(
  loc: { lat: number; lng: number },
  lineFeatures: { id: string; name: string; canalCode?: string; coords: [number, number][] }[]
): SnapResult {
  let minDistance = Infinity;
  let bestSnap: SnapResult = {
    point: [loc.lat, loc.lng],
    nodeId: `snap_${loc.lat.toFixed(6)}_${loc.lng.toFixed(6)}`,
    lineIndex: 0,
    segIndex: 0,
    featureName: 'Canal',
    distMeters: 0
  };

  lineFeatures.forEach((feature, lineIdx) => {
    const coords = feature.coords;
    for (let i = 0; i < coords.length - 1; i++) {
      const segStart = coords[i];
      const segEnd = coords[i + 1];
      const proj = projectPointOnSegment([loc.lat, loc.lng], segStart, segEnd);

      if (proj.distMeters < minDistance) {
        minDistance = proj.distMeters;
        bestSnap = {
          point: proj.point,
          nodeId: `snap_${proj.point[0].toFixed(6)}_${proj.point[1].toFixed(6)}`,
          lineIndex: lineIdx,
          segIndex: i,
          featureName: feature.name,
          distMeters: proj.distMeters
        };
      }
    }
  });

  return bestSnap;
}

interface NetworkNode {
  id: string;
  coord: [number, number];
}

interface NetworkEdge {
  target: string;
  weight: number;
}

function buildCanalNetworkGraph(
  lineFeatures: { id: string; name: string; canalCode?: string; coords: [number, number][] }[],
  snap1: SnapResult,
  snap2: SnapResult
) {
  const nodes: Record<string, NetworkNode> = {};
  const adj: Record<string, NetworkEdge[]> = {};
  const endpointNodeKeys = new Set<string>();

  const getNodeKey = (lat: number, lng: number) => `n_${lat.toFixed(6)}_${lng.toFixed(6)}`;

  const addNode = (coord: [number, number]): string => {
    const key = getNodeKey(coord[0], coord[1]);
    if (!nodes[key]) {
      nodes[key] = { id: key, coord };
      adj[key] = [];
    }
    return key;
  };

  const addEdge = (id1: string, id2: string, weight?: number) => {
    if (id1 === id2) return;
    const n1 = nodes[id1];
    const n2 = nodes[id2];
    if (!n1 || !n2) return;

    const w = weight ?? haversineDistanceMeters(n1.coord[0], n1.coord[1], n2.coord[0], n2.coord[1]);

    if (!adj[id1].some(e => e.target === id2)) {
      adj[id1].push({ target: id2, weight: w });
    }
    if (!adj[id2].some(e => e.target === id1)) {
      adj[id2].push({ target: id1, weight: w });
    }
  };

  lineFeatures.forEach((feature, lineIdx) => {
    const coords = [...feature.coords];

    const snapsForLine: { snap: SnapResult; segIndex: number }[] = [];
    if (snap1.lineIndex === lineIdx) snapsForLine.push({ snap: snap1, segIndex: snap1.segIndex });
    if (snap2.lineIndex === lineIdx) snapsForLine.push({ snap: snap2, segIndex: snap2.segIndex });

    snapsForLine.sort((a, b) => b.segIndex - a.segIndex);

    const lineVertices: [number, number][] = [];
    for (let i = 0; i < coords.length; i++) {
      lineVertices.push(coords[i]);
      snapsForLine.forEach(({ snap, segIndex }) => {
        if (segIndex === i) {
          lineVertices.push(snap.point);
        }
      });
    }

    // Identify start and end vertices of the feature as endpoints/line tips
    if (lineVertices.length > 0) {
      const startKey = addNode(lineVertices[0]);
      const endKey = addNode(lineVertices[lineVertices.length - 1]);
      endpointNodeKeys.add(startKey);
      endpointNodeKeys.add(endKey);
    }

    for (let i = 0; i < lineVertices.length - 1; i++) {
      const idA = addNode(lineVertices[i]);
      const idB = addNode(lineVertices[i + 1]);
      addEdge(idA, idB);
    }
  });

  const snap1NodeId = addNode(snap1.point);
  const snap2NodeId = addNode(snap2.point);

  snap1.nodeId = snap1NodeId;
  snap2.nodeId = snap2NodeId;

  // Snap start/end locations can also bridge to nearby line if starting off-network
  endpointNodeKeys.add(snap1NodeId);
  endpointNodeKeys.add(snap2NodeId);

  const GRID_CELL_DEG = 0.003;
  const grid: Record<string, string[]> = {};

  const getGridKey = (lat: number, lng: number) => {
    const r = Math.floor(lat / GRID_CELL_DEG);
    const c = Math.floor(lng / GRID_CELL_DEG);
    return `${r}:${c}`;
  };

  const nodeKeys = Object.keys(nodes);
  nodeKeys.forEach(key => {
    const n = nodes[key];
    const gKey = getGridKey(n.coord[0], n.coord[1]);
    if (!grid[gKey]) grid[gKey] = [];
    grid[gKey].push(key);
  });

  nodeKeys.forEach(k1 => {
    const n1 = nodes[k1];
    const r = Math.floor(n1.coord[0] / GRID_CELL_DEG);
    const c = Math.floor(n1.coord[1] / GRID_CELL_DEG);

    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const neighborGKey = `${r + dr}:${c + dc}`;
        const neighborNodeKeys = grid[neighborGKey];
        if (neighborNodeKeys) {
          for (const k2 of neighborNodeKeys) {
            if (k1 >= k2) continue;
            const n2 = nodes[k2];
            const dist = haversineDistanceMeters(n1.coord[0], n1.coord[1], n2.coord[0], n2.coord[1]);

            // Junction / Touching lines: distance <= 25 meters
            if (dist <= 25) {
              addEdge(k1, k2, dist);
            } 
            // End of line / Dead end jump: ONLY permitted if at least one node is a line endpoint/tip
            else if (dist <= 400 && (endpointNodeKeys.has(k1) || endpointNodeKeys.has(k2) || (adj[k1] && adj[k1].length <= 1) || (adj[k2] && adj[k2].length <= 1))) {
              // High penalty weight ensures pathfinder strictly follows canal lines and ONLY jumps across when line ends
              addEdge(k1, k2, 5000 + 10 * dist);
            }
          }
        }
      }
    }
  });

  return { nodes, adj };
}

class MinPriorityQueue {
  private heap: { id: string; priority: number }[] = [];

  push(id: string, priority: number) {
    this.heap.push({ id, priority });
    this.bubbleUp(this.heap.length - 1);
  }

  pop(): { id: string; priority: number } | undefined {
    if (this.heap.length === 0) return undefined;
    const top = this.heap[0];
    const bottom = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = bottom;
      this.sinkDown(0);
    }
    return top;
  }

  isEmpty(): boolean {
    return this.heap.length === 0;
  }

  private bubbleUp(idx: number) {
    while (idx > 0) {
      const parentIdx = Math.floor((idx - 1) / 2);
      if (this.heap[idx].priority >= this.heap[parentIdx].priority) break;
      const tmp = this.heap[idx];
      this.heap[idx] = this.heap[parentIdx];
      this.heap[parentIdx] = tmp;
      idx = parentIdx;
    }
  }

  private sinkDown(idx: number) {
    const length = this.heap.length;
    while (true) {
      let smallest = idx;
      const left = 2 * idx + 1;
      const right = 2 * idx + 2;

      if (left < length && this.heap[left].priority < this.heap[smallest].priority) {
        smallest = left;
      }
      if (right < length && this.heap[right].priority < this.heap[smallest].priority) {
        smallest = right;
      }
      if (smallest === idx) break;

      const tmp = this.heap[idx];
      this.heap[idx] = this.heap[smallest];
      this.heap[smallest] = tmp;
      idx = smallest;
    }
  }
}

function dijkstraShortestPath(
  adj: Record<string, NetworkEdge[]>,
  nodes: Record<string, NetworkNode>,
  startId: string,
  endId: string
): string[] | null {
  if (!nodes[startId] || !nodes[endId]) return null;
  if (startId === endId) return [startId];

  const distances: Record<string, number> = {};
  const previous: Record<string, string | null> = {};
  const visited = new Set<string>();

  Object.keys(nodes).forEach(id => {
    distances[id] = Infinity;
    previous[id] = null;
  });

  distances[startId] = 0;

  const pq = new MinPriorityQueue();
  pq.push(startId, 0);

  while (!pq.isEmpty()) {
    const item = pq.pop();
    if (!item) break;
    const currentId = item.id;

    if (visited.has(currentId)) continue;
    visited.add(currentId);

    if (currentId === endId) {
      const path: string[] = [];
      let curr: string | null = endId;
      while (curr !== null) {
        path.unshift(curr);
        curr = previous[curr];
      }
      return path;
    }

    const neighbors = adj[currentId] || [];
    for (const edge of neighbors) {
      if (!visited.has(edge.target)) {
        const newDist = distances[currentId] + edge.weight;
        if (newDist < distances[edge.target]) {
          distances[edge.target] = newDist;
          previous[edge.target] = currentId;
          pq.push(edge.target, newDist);
        }
      }
    }
  }

  return null;
}

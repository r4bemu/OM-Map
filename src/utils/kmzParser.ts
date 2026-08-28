import JSZip from 'jszip';
import { kml } from '@tmcw/togeojson';

export interface ParsedGISResult {
  fileName: string;
  fileSize: number;
  format: 'GeoJSON' | 'KMZ' | 'KML';
  geoJsonData: any; // FeatureCollection
  featureCount: number;
  geometryType: 'Polygon' | 'LineString' | 'Point' | 'Mixed';
  bounds?: [[number, number], [number, number]]; // [[minLat, minLng], [maxLat, maxLng]]
}

/**
 * Calculates geometry bounds for zooming and spatial indexing
 */
export function calculateGeoJSONBounds(geoJson: any): [[number, number], [number, number]] | undefined {
  let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
  let hasCoords = false;

  const processCoords = (coords: any) => {
    if (typeof coords[0] === 'number') {
      const lng = coords[0];
      const lat = coords[1];
      if (typeof lng === 'number' && typeof lat === 'number' && !isNaN(lng) && !isNaN(lat)) {
        minLng = Math.min(minLng, lng);
        maxLng = Math.max(maxLng, lng);
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
        hasCoords = true;
      }
    } else if (Array.isArray(coords)) {
      coords.forEach(processCoords);
    }
  };

  if (geoJson.type === 'FeatureCollection' && Array.isArray(geoJson.features)) {
    geoJson.features.forEach((feat: any) => {
      if (feat.geometry && feat.geometry.coordinates) {
        processCoords(feat.geometry.coordinates);
      }
    });
  } else if (geoJson.geometry && geoJson.geometry.coordinates) {
    processCoords(geoJson.geometry.coordinates);
  }

  if (!hasCoords) return undefined;
  return [[minLat, minLng], [maxLat, maxLng]];
}

/**
 * Detect primary geometry type across features using native GIS terminology
 */
export function detectGeometryType(geoJson: any): 'Polygon' | 'LineString' | 'Point' | 'Mixed' {
  if (!geoJson || !Array.isArray(geoJson.features) || geoJson.features.length === 0) {
    return 'Polygon';
  }

  let polygonCount = 0;
  let lineCount = 0;
  let pointCount = 0;
  const total = geoJson.features.length;

  geoJson.features.forEach((f: any) => {
    const t = (f?.geometry?.type || '').toLowerCase();
    if (t.includes('polygon')) {
      polygonCount++;
    } else if (t.includes('line')) {
      lineCount++;
    } else if (t.includes('point')) {
      pointCount++;
    }
  });

  if (polygonCount / total >= 0.5 || (polygonCount > 0 && lineCount === 0 && pointCount === 0)) {
    return 'Polygon';
  }
  if (lineCount / total >= 0.5 || (lineCount > 0 && polygonCount === 0 && pointCount === 0)) {
    return 'LineString';
  }
  if (pointCount / total >= 0.5 || (pointCount > 0 && polygonCount === 0 && lineCount === 0)) {
    return 'Point';
  }

  return 'Mixed';
}

/**
 * Primary parser supporting KMZ (up to 10MB zipped), GeoJSON (up to 60MB), and KML
 */
export async function parseGISFile(file: File): Promise<ParsedGISResult> {
  const fileName = file.name;
  const fileSize = file.size;
  const ext = fileName.split('.').pop()?.toLowerCase();

  let geoJsonData: any = { type: 'FeatureCollection', features: [] };
  let format: 'GeoJSON' | 'KMZ' | 'KML' = 'GeoJSON';

  if (ext === 'kmz') {
    format = 'KMZ';
    const zip = new JSZip();
    const zipContent = await zip.loadAsync(file);

    // Find first KML file in KMZ archive (usually doc.kml)
    let kmlFileName = Object.keys(zipContent.files).find(name => name.toLowerCase().endsWith('.kml'));
    if (!kmlFileName) {
      throw new Error('No .kml document found inside the uploaded .kmz file.');
    }

    const kmlString = await zipContent.files[kmlFileName].async('string');
    const parser = new DOMParser();
    const kmlDom = parser.parseFromString(kmlString, 'text/xml');
    
    // Convert KML DOM to GeoJSON using togeojson
    geoJsonData = kml(kmlDom);
  } else if (ext === 'kml') {
    format = 'KML';
    const text = await file.text();
    const parser = new DOMParser();
    const kmlDom = parser.parseFromString(text, 'text/xml');
    geoJsonData = kml(kmlDom);
  } else {
    // GeoJSON / JSON
    format = 'GeoJSON';
    const text = await file.text();
    const parsed = JSON.parse(text);

    if (parsed.type === 'FeatureCollection') {
      geoJsonData = parsed;
    } else if (parsed.type === 'Feature') {
      geoJsonData = {
        type: 'FeatureCollection',
        features: [parsed]
      };
    } else if (Array.isArray(parsed)) {
      geoJsonData = {
        type: 'FeatureCollection',
        features: parsed.map((item, idx) => ({
          type: 'Feature',
          id: item.id || `f-${idx}`,
          properties: item.properties || item,
          geometry: item.geometry
        }))
      };
    } else {
      throw new Error('Unrecognized GeoJSON format. File must contain a FeatureCollection or Feature.');
    }
  }

  // Ensure every feature has an ID
  if (geoJsonData.features) {
    geoJsonData.features = geoJsonData.features.map((feat: any, idx: number) => ({
      ...feat,
      id: feat.id || `f-${Date.now()}-${idx}`,
      properties: feat.properties || {}
    }));
  }

  const featureCount = geoJsonData.features ? geoJsonData.features.length : 0;
  const geometryType = detectGeometryType(geoJsonData);
  const bounds = calculateGeoJSONBounds(geoJsonData);

  return {
    fileName,
    fileSize,
    format,
    geoJsonData,
    featureCount,
    geometryType,
    bounds
  };
}

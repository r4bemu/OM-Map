import { FieldReport, GISLayer } from '../types';
import { isReportInWeek } from './weekUtils';

/**
 * Validates whether numeric latitude and longitude coordinates are valid geographic coordinates
 */
function isValidCoord(lat: any, lng: any): boolean {
  const nLat = Number(lat);
  const nLng = Number(lng);
  return (
    typeof nLat === 'number' &&
    typeof nLng === 'number' &&
    !isNaN(nLat) &&
    !isNaN(nLng) &&
    isFinite(nLat) &&
    isFinite(nLng) &&
    nLat >= -90 &&
    nLat <= 90 &&
    nLng >= -180 &&
    nLng <= 180 &&
    !(nLat === 0 && nLng === 0)
  );
}

/**
 * Converts FieldReport items into an RFC 7946 compliant GeoJSON FeatureCollection
 * Coordinate order is strictly [longitude, latitude] as mandated by RFC 7946 (OGC WGS84).
 */
export function convertFieldReportsToGeoJson(
  reports: FieldReport[],
  category: 'maintenance' | 'operational' | 'all' = 'all'
): any {
  const safeReports = Array.isArray(reports) ? reports.filter(Boolean) : [];

  const filtered = safeReports.filter(r => {
    const cat = r.categoryMode || r.reportType || 'maintenance';
    if (category !== 'all' && cat !== category) return false;
    return true;
  });

  const features: any[] = [];

  for (const report of filtered) {
    const lat = Number(report.lat);
    const lng = Number(report.lng);
    const lat2 = Number(report.secondLat);
    const lng2 = Number(report.secondLng);

    const hasPt1 = isValidCoord(lat, lng);
    const hasPt2 = isValidCoord(lat2, lng2);

    const isMaintenance = (report.categoryMode === 'maintenance' || report.reportType === 'maintenance');

    const baseProperties: Record<string, any> = {
      id: report.id,
      title: report.title || (isMaintenance ? 'Maintenance Accomplishment' : 'Operational Status Observation'),
      report_category: isMaintenance ? 'Maintenance' : 'Operations',
      maintenance_activity: report.maintenanceActivity || '',
      operational_state: report.operationalState || '',
      canal_segment: report.canalSegment || '',
      parcel_id: report.parcelId || '',
      location_name: report.locationName || '',
      imo_office: report.imoOffice || '',
      nis_binding: report.nisBinding || '',
      distance_meters: typeof report.segmentDistanceMeters === 'number' ? report.segmentDistanceMeters : null,
      depth_meters: typeof report.depthMeters === 'number' ? report.depthMeters : null,
      width_meters: typeof report.widthMeters === 'number' ? report.widthMeters : null,
      sand_pile_height_meters: typeof report.sandPileHeightMeters === 'number' ? report.sandPileHeightMeters : null,
      calculated_volume_m3: typeof (report.calculatedVolumeM3 || report.desiltingVolumeM3) === 'number'
        ? (report.calculatedVolumeM3 || report.desiltingVolumeM3)
        : null,
      painted_area_sqm: typeof report.paintedAreaSqm === 'number' ? report.paintedAreaSqm : null,
      water_level_meters: typeof report.waterLevelMeters === 'number' ? report.waterLevelMeters : null,
      discharge_flow_m3s: typeof report.dischargeFlowM3s === 'number' ? report.dischargeFlowM3s : null,
      gate_opening_cm: typeof report.gateOpeningCm === 'number' ? report.gateOpeningCm : null,
      water_quality: report.waterQuality || '',
      performed_by: Array.isArray(report.performedByList)
        ? report.performedByList.join(', ')
        : (report.performedBy || ''),
      performed_by_ia: report.performedByIA || '',
      work_status: report.status || 'In Progress',
      approval_status: report.approvalStatus || 'Pending_PreApproval',
      reporter_name: report.reporterName || '',
      reporter_role: report.reporterRole || 'Field Personnel',
      reported_at: report.createdAt || '',
      photo_count: Array.isArray(report.photos) ? report.photos.length : 0,
      remarks: report.remarks || ''
    };

    // 1. If pathCoords exists with 2+ valid vertices, export LineString feature
    if (report.pathCoords && Array.isArray(report.pathCoords) && report.pathCoords.length >= 2) {
      const validLineCoords = report.pathCoords
        .filter(c => Array.isArray(c) && c.length >= 2 && isValidCoord(c[0], c[1]))
        .map(c => [Number(c[1]), Number(c[0])]); // [lng, lat] GeoJSON standard

      if (validLineCoords.length >= 2) {
        features.push({
          type: 'Feature',
          id: `${report.id}-path`,
          properties: {
            ...baseProperties,
            feature_type: 'Canal Segment Path'
          },
          geometry: {
            type: 'LineString',
            coordinates: validLineCoords
          }
        });
      }
    } else if (hasPt1 && hasPt2) {
      // 2-point straight segment LineString
      features.push({
        type: 'Feature',
        id: `${report.id}-segment`,
        properties: {
          ...baseProperties,
          feature_type: '2-Point Canal Segment'
        },
        geometry: {
          type: 'LineString',
          coordinates: [
            [lng, lat],
            [lng2, lat2]
          ]
        }
      });
    }

    // 2. Primary Point Feature (Observation / Station Point 1)
    if (hasPt1) {
      features.push({
        type: 'Feature',
        id: report.id,
        properties: {
          ...baseProperties,
          feature_type: hasPt2 ? 'Station Start Point' : 'Field Work Location'
        },
        geometry: {
          type: 'Point',
          coordinates: [lng, lat]
        }
      });
    }

    // 3. Second Point Feature (Station End Point 2)
    if (hasPt2) {
      features.push({
        type: 'Feature',
        id: `${report.id}-end`,
        properties: {
          ...baseProperties,
          feature_type: 'Station End Point'
        },
        geometry: {
          type: 'Point',
          coordinates: [lng2, lat2]
        }
      });
    }
  }

  const collectionName = category === 'maintenance'
    ? 'NIA Region IV-B Maintenance Reports'
    : category === 'operational'
    ? 'NIA Region IV-B Operational Status Reports'
    : 'NIA Region IV-B Field Reports';

  return {
    type: 'FeatureCollection',
    name: collectionName,
    crs: {
      type: 'name',
      properties: {
        name: 'urn:ogc:def:crs:OGC:1.3:CRS84'
      }
    },
    features
  };
}

/**
 * Triggers a compliant Blob download for any GeoJSON object so that QGIS, ArcGIS, and Google Earth can open it directly.
 */
export function triggerGeoJsonDownload(geoJsonObject: any, filename: string): void {
  const jsonContent = JSON.stringify(geoJsonObject, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/geo+json;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename.endsWith('.geojson') ? filename : `${filename}.geojson`;
  document.body.appendChild(anchor);
  anchor.click();

  setTimeout(() => {
    anchor.remove();
    URL.revokeObjectURL(url);
  }, 1000);
}

/**
 * Exports any GISLayer or dynamic field report layer to a standard GeoJSON file recognized by QGIS
 */
export function exportLayerToGeoJson(layer: GISLayer, fieldReports: FieldReport[] = []): void {
  const layerNameLower = (layer.name || '').toLowerCase();
  const isActivityMaintenanceLayer = layer.id.startsWith('layer-activity-');
  const isActivityOperationalLayer = layer.id.startsWith('layer-operational-');
  const isMaintenanceReportLayer =
    layer.id === 'layer-reports-maintenance' ||
    isActivityMaintenanceLayer ||
    layer.category === 'Maintenance' ||
    layer.category === 'Maintenance Reports' ||
    layerNameLower.includes('maintenance');

  const isOperationalReportLayer =
    layer.id === 'layer-reports-operational' ||
    isActivityOperationalLayer ||
    layer.category === 'Operations' ||
    layer.category === 'Operational Status Reports' ||
    layerNameLower.includes('operational');

  let geoJsonOutput: any = null;

  if (isActivityMaintenanceLayer) {
    if (!layer.data || !layer.data.features || layer.data.features.length === 0) {
      const actReports = fieldReports.filter(r => {
        const isM = r.categoryMode === 'maintenance' || r.reportType === 'maintenance';
        const act = r.maintenanceActivity || r.title || '';
        return isM && (act.toLowerCase().includes(layer.name.toLowerCase()) || layer.name.toLowerCase().includes(act.toLowerCase()));
      });
      geoJsonOutput = convertFieldReportsToGeoJson(actReports.length > 0 ? actReports : fieldReports.filter(r => r.categoryMode === 'maintenance' || r.reportType === 'maintenance'), 'maintenance');
    } else {
      geoJsonOutput = layer.data;
    }
  } else if (isActivityOperationalLayer) {
    if (!layer.data || !layer.data.features || layer.data.features.length === 0) {
      const operReports = fieldReports.filter(r => {
        const isO = r.categoryMode === 'operational' || r.reportType === 'operational';
        const state = r.operationalState || '';
        return isO && (state.toLowerCase().includes(layer.name.toLowerCase()) || layer.name.toLowerCase().includes(state.toLowerCase()));
      });
      geoJsonOutput = convertFieldReportsToGeoJson(operReports.length > 0 ? operReports : fieldReports.filter(r => r.categoryMode === 'operational' || r.reportType === 'operational'), 'operational');
    } else {
      geoJsonOutput = layer.data;
    }
  } else if (isMaintenanceReportLayer) {
    if (!layer.data || !layer.data.features || layer.data.features.length === 0) {
      geoJsonOutput = convertFieldReportsToGeoJson(fieldReports, 'maintenance');
    } else {
      geoJsonOutput = layer.data;
    }
  } else if (isOperationalReportLayer) {
    if (!layer.data || !layer.data.features || layer.data.features.length === 0) {
      geoJsonOutput = convertFieldReportsToGeoJson(fieldReports, 'operational');
    } else {
      geoJsonOutput = layer.data;
    }
  } else if (layer.data) {
    // Standard GIS Layer (Canals, Structures, Parcellary)
    if (layer.data.type === 'FeatureCollection' && Array.isArray(layer.data.features)) {
      geoJsonOutput = {
        type: 'FeatureCollection',
        name: layer.name,
        crs: {
          type: 'name',
          properties: {
            name: 'urn:ogc:def:crs:OGC:1.3:CRS84'
          }
        },
        features: layer.data.features
      };
    } else if (Array.isArray(layer.data)) {
      geoJsonOutput = {
        type: 'FeatureCollection',
        name: layer.name,
        crs: {
          type: 'name',
          properties: {
            name: 'urn:ogc:def:crs:OGC:1.3:CRS84'
          }
        },
        features: layer.data
      };
    } else {
      geoJsonOutput = {
        type: 'FeatureCollection',
        name: layer.name,
        crs: {
          type: 'name',
          properties: {
            name: 'urn:ogc:def:crs:OGC:1.3:CRS84'
          }
        },
        features: [layer.data]
      };
    }
  } else {
    // Empty fallback FeatureCollection
    geoJsonOutput = {
      type: 'FeatureCollection',
      name: layer.name,
      crs: {
        type: 'name',
        properties: {
          name: 'urn:ogc:def:crs:OGC:1.3:CRS84'
        }
      },
      features: []
    };
  }

  const safeFilename = `${layer.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')}_export.geojson`;
  triggerGeoJsonDownload(geoJsonOutput, safeFilename);
}

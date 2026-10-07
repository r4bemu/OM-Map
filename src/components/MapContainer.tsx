import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { 
  BasemapType, 
  GISLayer, 
  FieldReport, 
  MeasureTool, 
  MeasurementResult,
  LocationFilter
} from '../types';
import { 
  Ruler, 
  Square, 
  MapPin, 
  Circle, 
  Layers, 
  Globe, 
  Mountain, 
  Sun, 
  Moon,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Droplets,
  Activity,
  Crosshair,
  Navigation,
  ChevronUp,
  X,
  Plus,
  Minus
} from 'lucide-react';
import { detectNearestGISFeature, calculateCanalPathBetweenPoints, getFeatureName, haversineDistanceMeters, formatStationingNumber, NearestGISFeatureResult } from '../utils/gisLocationUtils';
import { getIsoWeekInfo } from '../utils/weekUtils';
import { 
  STRUCTURE_BLUE_COLOR, 
  getActivityColor, 
  MAINTENANCE_ACTIVITY_CONFIG, 
  OPERATIONAL_STATE_CONFIG 
} from '../utils/activityColors';
import { 
  classifyVectorItem, 
  detectCanalCategory,
  detectCanalType,
  getCanalTypeLabel,
  BLUE_PALETTE, 
  STROKE_WEIGHTS 
} from '../utils/canalLayerClassifier';

interface MapContainerProps {
  layers: GISLayer[];
  fieldReports: FieldReport[];
  locationFilter?: LocationFilter;
  isFilterActive?: boolean;
  basemap: BasemapType;
  onBasemapChange: (bm: BasemapType) => void;
  onSelectFeature: (featureProps: any, featureType: string, coords?: [number, number]) => void;
  onDeselectFeature?: () => void;
  onSelectReport: (report: FieldReport) => void;
  onTriggerReportFromMap: (lat: number, lng: number) => void;
  selectedFeatureId?: string;
  selectedFeatureProps?: any;
  selectedReport?: FieldReport;
  searchTargetCoords?: [number, number];
  targetFlyCoords?: [number, number];

  // Map Picker Mode Props
  isMapPickerActive?: boolean;
  mapPickerMode?: 'single' | 'double';
  initialPickerLat1?: number;
  initialPickerLng1?: number;
  initialPickerLat2?: number;
  initialPickerLng2?: number;
  onConfirmMapPick?: (res: {
    lat1: number;
    lng1: number;
    lat2?: number;
    lng2?: number;
    locationName: string;
    canalCode?: string;
    parcelId?: string;
    pathCoords?: [number, number][];
  }) => void;
  onCancelMapPick?: () => void;

  // Downloading & Parsing Status Props
  isSyncingDrive?: boolean;
  syncProgress?: { current: number; total: number } | null;
}

function getTileConfig(bm: BasemapType): { url: string; subdomains: string | string[]; maxZoom: number; attribution: string } {
  if (bm === 'dark') {
    return {
      url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
      subdomains: 'abcd',
      maxZoom: 20,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>'
    };
  }
  if (bm === 'streets') {
    return {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
      subdomains: 'abc',
      maxZoom: 19,
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, METI, NRCAN'
    };
  }
  return {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    subdomains: 'abc',
    maxZoom: 19,
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP'
  };
}

export const MapContainer: React.FC<MapContainerProps> = ({
  layers,
  fieldReports,
  locationFilter,
  basemap,
  onBasemapChange,
  onSelectFeature,
  onDeselectFeature,
  onSelectReport,
  onTriggerReportFromMap,
  selectedFeatureId,
  selectedFeatureProps,
  searchTargetCoords,
  isMapPickerActive = false,
  mapPickerMode = 'single',
  initialPickerLat1,
  initialPickerLng1,
  initialPickerLat2,
  initialPickerLng2,
  onConfirmMapPick,
  onCancelMapPick,
  isSyncingDrive = false,
  syncProgress
}) => {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const pointsLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const reportsLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const measureLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const userLocLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const pickerLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const hasFittedInitialBoundsRef = useRef<boolean>(false);
  const featureMapRef = useRef<Array<{ properties: any; layer: any; defaultStyle: any }>>([]);
  const highlightedLayerRef = useRef<{ layer: any; defaultStyle: any } | null>(null);
  const selectionHighlightLayerGroupRef = useRef<L.LayerGroup | null>(null);

  // Active measurement tool state
  const [isBasemapExpanded, setIsBasemapExpanded] = useState<boolean>(false);
  const [activeMeasureTool, setActiveMeasureTool] = useState<MeasureTool>('none');
  const [measureCoords, setMeasureCoords] = useState<[number, number][]>([]);
  const [measurementResult, setMeasurementResult] = useState<MeasurementResult | null>(null);
  const [radiusMeters, setRadiusMeters] = useState<number>(1000);

  const isValidCoord = (lat: any, lng: any): boolean => {
    const nLat = Number(lat);
    const nLng = Number(lng);
    return typeof nLat === 'number' && typeof nLng === 'number' && !isNaN(nLat) && !isNaN(nLng) && isFinite(nLat) && isFinite(nLng);
  };

  // Picker internal state
  const [pickerPt1, setPickerPt1] = useState<[number, number] | undefined>(
    isValidCoord(initialPickerLat1, initialPickerLng1)
      ? [Number(initialPickerLat1), Number(initialPickerLng1)]
      : undefined
  );
  const [pickerPt2, setPickerPt2] = useState<[number, number] | undefined>(
    isValidCoord(initialPickerLat2, initialPickerLng2)
      ? [Number(initialPickerLat2), Number(initialPickerLng2)]
      : undefined
  );
  const [isPoint1Set, setIsPoint1Set] = useState<boolean>(
    isValidCoord(initialPickerLat1, initialPickerLng1)
  );
  const [isPoint2Set, setIsPoint2Set] = useState<boolean>(
    isValidCoord(initialPickerLat2, initialPickerLng2)
  );
  const [pickerLocationName, setPickerLocationName] = useState<string>('');
  const [pickerCanalCode, setPickerCanalCode] = useState<string | undefined>(undefined);
  const [pickerParcelId, setPickerParcelId] = useState<string | undefined>(undefined);
  const [pickerPathResult, setPickerPathResult] = useState<{
    pathCoords: [number, number][];
    locationName: string;
    canalCode?: string;
    parcelId?: string;
    distanceMeters: number;
  } | null>(null);
  const calculationSeqRef = useRef<number>(0);
  const [activePopupCoords, setActivePopupCoords] = useState<[number, number] | null>(null);
  const [activePopupProps, setActivePopupProps] = useState<any>(null);

  const clickedPointMarkerRef = useRef<L.Marker | null>(null);
  const leaderLineSvgRef = useRef<SVGSVGElement | null>(null);
  const leaderLinePathRef = useRef<SVGPathElement | null>(null);
  const activePopupInstanceRef = useRef<L.Popup | null>(null);
  const lastFeatureClickTimeRef = useRef<number>(0);

  const removeClickedPointMarker = () => {
    if (clickedPointMarkerRef.current) {
      try {
        if (mapRef.current) {
          mapRef.current.removeLayer(clickedPointMarkerRef.current);
        }
      } catch (_) {}
      clickedPointMarkerRef.current = null;
    }
    if (leaderLinePathRef.current) {
      leaderLinePathRef.current.setAttribute('d', '');
    }
  };

  const showClickedPointMarker = (lat: number, lng: number) => {
    if (!mapRef.current || !isValidCoord(lat, lng)) return;
    removeClickedPointMarker();

    const clickIcon = L.divIcon({
      className: 'custom-clicked-point-marker',
      html: `
        <div class="relative flex items-center justify-center w-6 h-6 pointer-events-none select-none">
          <span class="animate-ping absolute inline-flex h-3.5 w-3.5 rounded-full bg-slate-900/40 dark:bg-black/40 opacity-75"></span>
          <span class="relative inline-flex rounded-full h-3.5 w-3.5 bg-black border-2 border-white shadow-[0_0_6px_rgba(0,0,0,0.8),0_0_2px_#ffffff] clicked-point-blinking-dot"></span>
        </div>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });

    const marker = L.marker([lat, lng], {
      icon: clickIcon,
      interactive: false,
      zIndexOffset: 1500
    });

    marker.addTo(mapRef.current);
    clickedPointMarkerRef.current = marker;
  };

  const clearFeatureHighlight = () => {
    if (selectionHighlightLayerGroupRef.current) {
      selectionHighlightLayerGroupRef.current.clearLayers();
    }
    if (highlightedLayerRef.current) {
      try {
        const { layer, defaultStyle } = highlightedLayerRef.current;
        if (layer && typeof layer.setStyle === 'function' && defaultStyle) {
          layer.setStyle(defaultStyle);
        }
      } catch (err) {}
      highlightedLayerRef.current = null;
    }
  };

  const applyFeatureHighlight = (layer: any, defaultStyle?: any) => {
    if (!layer) return;

    // 1. Revert previous highlighted layer if different
    if (highlightedLayerRef.current && highlightedLayerRef.current.layer !== layer) {
      try {
        const { layer: prevLayer, defaultStyle: prevStyle } = highlightedLayerRef.current;
        if (prevLayer && typeof prevLayer.setStyle === 'function' && prevStyle) {
          prevLayer.setStyle(prevStyle);
        }
      } catch (err) {}
    }

    // 2. Clear any existing casing underlay
    if (selectionHighlightLayerGroupRef.current) {
      selectionHighlightLayerGroupRef.current.clearLayers();
    }

    const effectiveDefaultStyle = defaultStyle || highlightedLayerRef.current?.defaultStyle || {
      color: (layer as any).options?.color || '#0284c7',
      weight: (layer as any).options?.weight || 4.5,
      opacity: (layer as any).options?.opacity || 0.85
    };

    // 3. Determine if layer is a linestring
    const geomType = (layer as any).feature?.geometry?.type ||
      (typeof (layer as any).toGeoJSON === 'function' ? (layer as any).toGeoJSON()?.geometry?.type : '');
    const isPolyline = geomType.includes('LineString') ||
      (typeof (layer as any).getLatLngs === 'function' && !(layer instanceof L.Polygon));

    if (isPolyline) {
      try {
        const latLngs = (layer as any).getLatLngs();
        const baseWeight = effectiveDefaultStyle?.weight || 4.5;
        const coreWeight = Math.max(4.5, baseWeight + 0.5);
        // Border casing width: coreWeight + 5.0 (provides crisp 2.5px solid white border on each side)
        const casingWeight = coreWeight + 5.0;

        // 1. Underlay casing polyline in crisp solid white (#ffffff)
        const casing = L.polyline(latLngs, {
          color: '#ffffff',
          weight: casingWeight,
          opacity: 1.0,
          lineCap: 'round',
          lineJoin: 'round',
          interactive: false,
          pane: 'canalHighlightPane'
        });

        // 2. Overlay core polyline in pure solid black (#000000)
        const highlightCore = L.polyline(latLngs, {
          color: '#000000',
          weight: coreWeight,
          opacity: 1.0,
          lineCap: 'round',
          lineJoin: 'round',
          interactive: false,
          pane: 'canalHighlightPane'
        });

        selectionHighlightLayerGroupRef.current?.addLayer(casing);
        selectionHighlightLayerGroupRef.current?.addLayer(highlightCore);

        // Also style the underlying layer in solid black
        if (typeof layer.setStyle === 'function') {
          layer.setStyle({
            color: '#000000',
            weight: coreWeight,
            opacity: 1.0,
            lineCap: 'round',
            lineJoin: 'round'
          });
        }
      } catch (err) {
        console.warn('Error applying canal highlight:', err);
      }
    } else {
      // Polygon or Point feature
      if (typeof layer.setStyle === 'function') {
        layer.setStyle({
          color: '#000000',
          fillColor: '#38bdf8',
          weight: (effectiveDefaultStyle?.weight || 2.0) + 2.0,
          opacity: 1.0,
          fillOpacity: 1.0
        });
      }
    }

    highlightedLayerRef.current = { layer, defaultStyle: effectiveDefaultStyle };
  };

  const segmentsIntersect = (
    x1: number, y1: number, x2: number, y2: number,
    x3: number, y3: number, x4: number, y4: number
  ): boolean => {
    const ccw = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number) => {
      return (cy - ay) * (bx - ax) > (by - ay) * (cx - ax);
    };
    return (
      ccw(x1, y1, x3, y3, x4, y4) !== ccw(x2, y2, x3, y3, x4, y4) &&
      ccw(x1, y1, x2, y2, x3, y3) !== ccw(x1, y1, x2, y2, x4, y4)
    );
  };

  const segmentIntersectsBox = (
    xa: number, ya: number, xb: number, yb: number,
    left: number, top: number, right: number, bottom: number
  ): boolean => {
    if (Math.max(xa, xb) < left || Math.min(xa, xb) > right || Math.max(ya, yb) < top || Math.min(ya, yb) > bottom) {
      return false;
    }
    if (xa >= left && xa <= right && ya >= top && ya <= bottom) return true;
    if (xb >= left && xb <= right && yb >= top && yb <= bottom) return true;

    if (segmentsIntersect(xa, ya, xb, yb, left, top, right, top)) return true;
    if (segmentsIntersect(xa, ya, xb, yb, left, bottom, right, bottom)) return true;
    if (segmentsIntersect(xa, ya, xb, yb, left, top, left, bottom)) return true;
    if (segmentsIntersect(xa, ya, xb, yb, right, top, right, bottom)) return true;

    return false;
  };

  const distPointToSegment = (px: number, py: number, x1: number, y1: number, x2: number, y2: number): number => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(px - x1, py - y1);
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
    const projX = x1 + t * dx;
    const projY = y1 + t * dy;
    return Math.hypot(px - projX, py - projY);
  };

  const computeOptimalPopupOffset = (
    layer: any,
    clickLatLng: L.LatLng,
    map: L.Map | null
  ): L.Point => {
    if (!map) return L.point(235, -50);
    const container = map.getContainer();
    const mapW = container?.clientWidth || 800;
    const mapH = container?.clientHeight || 600;
    const curPt = map.latLngToContainerPoint(clickLatLng);

    const popupW = 320;
    const popupH = 265;

    // Collect all visible canal linestring segments in container pixel coordinates
    const canalSegments: { x1: number; y1: number; x2: number; y2: number }[] = [];

    const extractLinePoints = (targetLayer: any) => {
      if (!targetLayer || typeof targetLayer.getLatLngs !== 'function') return;
      try {
        const raw = targetLayer.getLatLngs();
        const flat: L.LatLng[] = Array.isArray(raw)
          ? (Array.isArray(raw[0]) ? (raw as any).flat(Infinity) : raw)
          : [];
        for (let i = 0; i < flat.length - 1; i++) {
          const pt1 = map.latLngToContainerPoint(flat[i]);
          const pt2 = map.latLngToContainerPoint(flat[i + 1]);
          if (
            Math.max(pt1.x, pt2.x) >= -80 &&
            Math.min(pt1.x, pt2.x) <= mapW + 80 &&
            Math.max(pt1.y, pt2.y) >= -80 &&
            Math.min(pt1.y, pt2.y) <= mapH + 80
          ) {
            canalSegments.push({ x1: pt1.x, y1: pt1.y, x2: pt2.x, y2: pt2.y });
          }
        }
      } catch (err) {
        console.warn('Error extracting linestring points:', err);
      }
    };

    // 1. Extract from the clicked layer
    extractLinePoints(layer);

    // 2. Also extract from all other active vector layers in layerGroupRef
    if (layerGroupRef.current) {
      try {
        layerGroupRef.current.eachLayer((l: any) => {
          if (l !== layer && typeof l.getLatLngs === 'function') {
            extractLinePoints(l);
          }
        });
      } catch (_) {}
    }

    // Candidate positions:
    // Pages 3, 4, 6 were explicitly verified and praised by the user as "Ideal positioning"
    const candidateOffsets: { dx: number; dy: number; pref: number; name: string }[] = [
      // 1. East / Right Side Callouts (Window to the right of the canal & dot)
      { dx: 235, dy: -50, pref: 320, name: 'Right-Mid' },
      { dx: 240, dy: -90, pref: 300, name: 'Right-Upper' },
      { dx: 240, dy: -10, pref: 280, name: 'Right-Lower' },
      { dx: 260, dy: -60, pref: 270, name: 'Right-Far' },

      // 2. West / Left Side Callouts (Window to the left of the canal & dot)
      { dx: -235, dy: -50, pref: 320, name: 'Left-Mid' },
      { dx: -240, dy: -90, pref: 300, name: 'Left-Upper' },
      { dx: -240, dy: -10, pref: 280, name: 'Left-Lower' },
      { dx: -260, dy: -60, pref: 270, name: 'Left-Far' },

      // 3. North-East / Upper-Right
      { dx: 190, dy: -170, pref: 240, name: 'Upper-Right' },
      { dx: 210, dy: -210, pref: 220, name: 'Upper-Right-Far' },

      // 4. North-West / Upper-Left
      { dx: -190, dy: -170, pref: 240, name: 'Upper-Left' },
      { dx: -210, dy: -210, pref: 220, name: 'Upper-Left-Far' },

      // 5. North / Directly Above
      { dx: 0, dy: -200, pref: 190, name: 'Top-Center' },
      { dx: 0, dy: -240, pref: 170, name: 'Top-Far' },

      // 6. South / Directly Below (Strictly guarded: dy=330 so window is well below the dot)
      { dx: 0, dy: 330, pref: 50, name: 'Bottom-Center' },
      { dx: 200, dy: 290, pref: 40, name: 'Bottom-Right' },
      { dx: -200, dy: 290, pref: 40, name: 'Bottom-Left' }
    ];

    let bestScore = -Infinity;
    let bestOffset = L.point(235, -50);

    for (const cand of candidateOffsets) {
      // Calculate bounding box of the popup wrapper for this offset
      const boxLeft = curPt.x + cand.dx - popupW / 2;
      const boxRight = curPt.x + cand.dx + popupW / 2;
      const boxBottom = curPt.y + cand.dy;
      const boxTop = curPt.y + cand.dy - popupH;
      const boxCenterX = (boxLeft + boxRight) / 2;
      const boxCenterY = (boxTop + boxBottom) / 2;

      // 1. CRITICAL: Check if clicked dot is covered by or too close to window
      // Must maintain at least 30px clear separation from the clicked dot
      const dotInsidePaddedBox = (
        curPt.x >= boxLeft - 30 &&
        curPt.x <= boxRight + 30 &&
        curPt.y >= boxTop - 30 &&
        curPt.y <= boxBottom + 30
      );
      if (dotInsidePaddedBox) {
        continue;
      }

      // 2. Screen Viewport Margins
      const marginL = boxLeft - 20;
      const marginR = mapW - 20 - boxRight;
      const marginT = boxTop - 35;
      const marginB = mapH - 50 - boxBottom;
      const minViewportMargin = Math.min(marginL, marginR, marginT, marginB);

      let score = cand.pref;

      if (minViewportMargin < 0) {
        // Offscreen penalty: severe penalty proportional to clipping
        score += minViewportMargin * 500;
      } else {
        // Safe inside screen: bonus for comfortable margins
        score += Math.min(minViewportMargin, 60);
      }

      // 3. Canal Collision Check: Check if window covers ANY canal segment
      const PAD = 14;
      let collisionCount = 0;
      let minCanalDist = Infinity;

      for (const seg of canalSegments) {
        if (segmentIntersectsBox(seg.x1, seg.y1, seg.x2, seg.y2, boxLeft - PAD, boxTop - PAD, boxRight + PAD, boxBottom + PAD)) {
          collisionCount++;
        }
        const d = distPointToSegment(boxCenterX, boxCenterY, seg.x1, seg.y1, seg.x2, seg.y2);
        if (d < minCanalDist) {
          minCanalDist = d;
        }
      }

      if (collisionCount > 0) {
        // Severe penalty: popup window covers canal linestring!
        score -= 20000 + collisionCount * 2000;
      } else {
        // Canal is completely clear! Reward candidates that provide healthy breathing room
        if (minCanalDist !== Infinity) {
          score += Math.min(minCanalDist, 180) * 1.2;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestOffset = L.point(cand.dx, cand.dy);
      }
    }

    return bestOffset;
  };

  const updateLeaderLine = () => {
    if (!mapRef.current || !activePopupCoordsRef.current || !leaderLinePathRef.current || !containerRef.current) {
      if (leaderLinePathRef.current) {
        leaderLinePathRef.current.setAttribute('d', '');
      }
      return;
    }

    let popupWrapper: HTMLElement | null = null;
    if (activePopupInstanceRef.current) {
      const el = activePopupInstanceRef.current.getElement();
      if (el && el.isConnected) {
        popupWrapper = (el.querySelector('.leaflet-popup-content-wrapper') as HTMLElement) || (el as HTMLElement);
      }
    }

    if (!popupWrapper && containerRef.current) {
      const activeTagged = containerRef.current.querySelector('.active-attribute-popup .leaflet-popup-content-wrapper') as HTMLElement;
      if (activeTagged && activeTagged.isConnected) {
        popupWrapper = activeTagged;
      } else {
        const allWrappers = containerRef.current.querySelectorAll('.custom-leaflet-popup .leaflet-popup-content-wrapper');
        if (allWrappers.length > 0) {
          popupWrapper = allWrappers[allWrappers.length - 1] as HTMLElement;
        }
      }
    }

    if (!popupWrapper) {
      if (leaderLinePathRef.current) {
        leaderLinePathRef.current.setAttribute('d', '');
      }
      return;
    }

    if (leaderLineSvgRef.current && leaderLineSvgRef.current.style.display === 'none') {
      leaderLineSvgRef.current.style.display = 'block';
    }

    const targetPt = mapRef.current.latLngToContainerPoint(activePopupCoordsRef.current);
    const mapRect = containerRef.current.getBoundingClientRect();
    const rect = popupWrapper.getBoundingClientRect();

    const box = {
      left: rect.left - mapRect.left,
      top: rect.top - mapRect.top,
      right: rect.right - mapRect.left,
      bottom: rect.bottom - mapRect.top,
      width: rect.width,
      height: rect.height,
      centerX: (rect.left + rect.right) / 2 - mapRect.left,
      centerY: (rect.top + rect.bottom) / 2 - mapRect.top
    };

    const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));

    let p1: { x: number; y: number };
    let p2: { x: number; y: number };
    const p3 = { x: targetPt.x, y: targetPt.y };

    const STUB_LEN = 18;

    // Check directional separation between popup box and clicked target dot
    const isToRight = box.left >= targetPt.x + 10;
    const isToLeft = box.right <= targetPt.x - 10;
    const isAbove = box.bottom <= targetPt.y + 10;
    const isBelow = box.top >= targetPt.y - 10;

    if (isToRight) {
      // Window is to the RIGHT of target dot:
      // Connect to LEFT edge of window, stub extends horizontally leftwards towards target
      const anchorY = clamp(targetPt.y, box.top + 28, box.bottom - 28);
      const stub = Math.min(STUB_LEN, Math.max(8, (box.left - targetPt.x) * 0.35));
      p1 = { x: box.left, y: anchorY };
      p2 = { x: box.left - stub, y: anchorY };
    } else if (isToLeft) {
      // Window is to the LEFT of target dot:
      // Connect to RIGHT edge of window, stub extends horizontally rightwards towards target
      const anchorY = clamp(targetPt.y, box.top + 28, box.bottom - 28);
      const stub = Math.min(STUB_LEN, Math.max(8, (targetPt.x - box.right) * 0.35));
      p1 = { x: box.right, y: anchorY };
      p2 = { x: box.right + stub, y: anchorY };
    } else if (isAbove) {
      // Window is ABOVE target dot:
      // Connect to BOTTOM edge of window, stub extends vertically downwards towards target
      const anchorX = clamp(targetPt.x, box.left + 28, box.right - 28);
      const stub = Math.min(STUB_LEN, Math.max(8, (targetPt.y - box.bottom) * 0.35));
      p1 = { x: anchorX, y: box.bottom };
      p2 = { x: anchorX, y: box.bottom + stub };
    } else if (isBelow) {
      // Window is BELOW target dot:
      // Connect to TOP edge of window, stub extends vertically upwards towards target
      const anchorX = clamp(targetPt.x, box.left + 28, box.right - 28);
      const stub = Math.min(STUB_LEN, Math.max(8, (box.top - targetPt.y) * 0.35));
      p1 = { x: anchorX, y: box.top };
      p2 = { x: anchorX, y: box.top - stub };
    } else {
      // Defensive fallback if dot is near edge: connect from closest face with outward stub
      const distLeft = Math.abs(targetPt.x - box.left);
      const distRight = Math.abs(targetPt.x - box.right);
      const distTop = Math.abs(targetPt.y - box.top);
      const distBottom = Math.abs(targetPt.y - box.bottom);
      const minDist = Math.min(distLeft, distRight, distTop, distBottom);

      if (minDist === distLeft) {
        const anchorY = clamp(targetPt.y, box.top + 28, box.bottom - 28);
        p1 = { x: box.left, y: anchorY };
        p2 = { x: box.left - 12, y: anchorY };
      } else if (minDist === distRight) {
        const anchorY = clamp(targetPt.y, box.top + 28, box.bottom - 28);
        p1 = { x: box.right, y: anchorY };
        p2 = { x: box.right + 12, y: anchorY };
      } else if (minDist === distBottom) {
        const anchorX = clamp(targetPt.x, box.left + 28, box.right - 28);
        p1 = { x: box.centerX, y: box.bottom };
        p2 = { x: box.centerX, y: box.bottom + 12 };
      } else {
        const anchorX = clamp(targetPt.x, box.left + 28, box.right - 28);
        p1 = { x: box.centerX, y: box.top };
        p2 = { x: box.centerX, y: box.top - 12 };
      }
    }

    const d = `M ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} L ${p2.x.toFixed(1)} ${p2.y.toFixed(1)} L ${p3.x.toFixed(1)} ${p3.y.toFixed(1)}`;
    leaderLinePathRef.current.setAttribute('d', d);
  };

  const [currentZoom, setCurrentZoom] = useState<number>(() => {
    try {
      const savedLocStr = localStorage.getItem('ommap_last_known_location');
      if (savedLocStr) {
        const savedLoc = JSON.parse(savedLocStr);
        if (typeof savedLoc.zoom === 'number') return savedLoc.zoom;
      }
    } catch (e) {}
    return 13;
  });

  const isMapPickerActiveRef = useRef(isMapPickerActive);
  const isPoint1SetRef = useRef(isPoint1Set);
  const isPoint2SetRef = useRef(isPoint2Set);
  const pickerPt1Ref = useRef(pickerPt1);
  const pickerPt2Ref = useRef(pickerPt2);
  const activePopupCoordsRef = useRef(activePopupCoords);
  const activePopupPropsRef = useRef(activePopupProps);
  const hasAutoFitRef = useRef(false);
  const activeMeasureToolRef = useRef(activeMeasureTool);
  const onDeselectFeatureRef = useRef(onDeselectFeature);
  const onSelectFeatureRef = useRef(onSelectFeature);
  const onTriggerReportFromMapRef = useRef(onTriggerReportFromMap);
  const onSelectReportRef = useRef(onSelectReport);
  const layersRef = useRef(layers);
  const selectedFeaturePropsRef = useRef(selectedFeatureProps);

  useEffect(() => { isMapPickerActiveRef.current = isMapPickerActive; }, [isMapPickerActive]);
  useEffect(() => { isPoint1SetRef.current = isPoint1Set; }, [isPoint1Set]);
  useEffect(() => { isPoint2SetRef.current = isPoint2Set; }, [isPoint2Set]);
  useEffect(() => { pickerPt1Ref.current = pickerPt1; }, [pickerPt1]);
  useEffect(() => { pickerPt2Ref.current = pickerPt2; }, [pickerPt2]);
  useEffect(() => {
    activePopupCoordsRef.current = activePopupCoords;
    if (activePopupCoords) {
      requestAnimationFrame(() => updateLeaderLine());
      setTimeout(updateLeaderLine, 30);
      setTimeout(updateLeaderLine, 100);
      setTimeout(updateLeaderLine, 250);
    } else {
      if (leaderLinePathRef.current) {
        leaderLinePathRef.current.setAttribute('d', '');
      }
    }
  }, [activePopupCoords]);
  useEffect(() => { activePopupPropsRef.current = activePopupProps; }, [activePopupProps]);
  useEffect(() => { activeMeasureToolRef.current = activeMeasureTool; }, [activeMeasureTool]);
  useEffect(() => { onDeselectFeatureRef.current = onDeselectFeature; }, [onDeselectFeature]);
  useEffect(() => { onSelectFeatureRef.current = onSelectFeature; }, [onSelectFeature]);
  useEffect(() => { onTriggerReportFromMapRef.current = onTriggerReportFromMap; }, [onTriggerReportFromMap]);
  useEffect(() => { onSelectReportRef.current = onSelectReport; }, [onSelectReport]);
  useEffect(() => { layersRef.current = layers; }, [layers]);
  useEffect(() => { selectedFeaturePropsRef.current = selectedFeatureProps; }, [selectedFeatureProps]);

  // Update picker state when initial coordinates change or picker opens/closes
  useEffect(() => {
    if (isMapPickerActive) {
      const hasPt1 = isValidCoord(initialPickerLat1, initialPickerLng1);
      const hasPt2 = isValidCoord(initialPickerLat2, initialPickerLng2);

      if (hasPt1) {
        const p1: [number, number] = [Number(initialPickerLat1), Number(initialPickerLng1)];
        setPickerPt1(p1);
        setIsPoint1Set(true);
        isPoint1SetRef.current = true;
        pickerPt1Ref.current = p1;
      } else {
        setPickerPt1(undefined);
        setIsPoint1Set(false);
        isPoint1SetRef.current = false;
        pickerPt1Ref.current = undefined;
      }

      if (hasPt2) {
        const p2: [number, number] = [Number(initialPickerLat2), Number(initialPickerLng2)];
        setPickerPt2(p2);
        setIsPoint2Set(true);
        isPoint2SetRef.current = true;
        pickerPt2Ref.current = p2;
      } else {
        setPickerPt2(undefined);
        setIsPoint2Set(false);
        isPoint2SetRef.current = false;
        pickerPt2Ref.current = undefined;
      }

      if (hasPt1 && hasPt2) {
        const p1: [number, number] = [Number(initialPickerLat1), Number(initialPickerLng1)];
        const p2: [number, number] = [Number(initialPickerLat2), Number(initialPickerLng2)];
        const seq = ++calculationSeqRef.current;
        requestAnimationFrame(() => {
          if (seq !== calculationSeqRef.current) return;
          const pathRes = calculateCanalPathBetweenPoints(
            { lat: p1[0], lng: p1[1] },
            { lat: p2[0], lng: p2[1] },
            layers
          );
          if (seq !== calculationSeqRef.current) return;
          setPickerPathResult(pathRes);
          setPickerLocationName(pathRes.locationName);
          setPickerCanalCode(pathRes.canalCode);
          setPickerParcelId(pathRes.parcelId);
        });
      } else if (hasPt1) {
        const p1: [number, number] = [Number(initialPickerLat1), Number(initialPickerLng1)];
        const seq = ++calculationSeqRef.current;
        requestAnimationFrame(() => {
          if (seq !== calculationSeqRef.current) return;
          const feat = detectNearestGISFeature(p1[0], p1[1], layers);
          if (seq !== calculationSeqRef.current) return;
          setPickerLocationName(feat.locationName);
          setPickerCanalCode(feat.canalCode);
          setPickerParcelId(feat.parcelId);
        });
      }
    } else {
      setPickerPt1(undefined);
      setPickerPt2(undefined);
      setIsPoint1Set(false);
      setIsPoint2Set(false);
      isPoint1SetRef.current = false;
      isPoint2SetRef.current = false;
      pickerPt1Ref.current = undefined;
      pickerPt2Ref.current = undefined;
      setPickerLocationName('');
      setPickerCanalCode(undefined);
      setPickerParcelId(undefined);
      setPickerPathResult(null);
    }
  }, [isMapPickerActive, initialPickerLat1, initialPickerLng1, initialPickerLat2, initialPickerLng2]);

  const point1PropsRef = useRef<any>(null);
  const point2PropsRef = useRef<any>(null);

  const handleClearPoint2 = () => {
    setIsPoint2Set(false);
    setPickerPt2(undefined);
    isPoint2SetRef.current = false;
    pickerPt2Ref.current = undefined;
    point2PropsRef.current = null;
    setPickerPathResult(null);

    if (pickerPt1Ref.current) {
      const coords = pickerPt1Ref.current;
      const seq = ++calculationSeqRef.current;
      requestAnimationFrame(() => {
        if (seq !== calculationSeqRef.current) return;
        const feat = detectNearestGISFeature(coords[0], coords[1], layers);
        if (seq !== calculationSeqRef.current) return;
        const customName = point1PropsRef.current ? getFeatureName(point1PropsRef.current, '', coords) : '';
        const name = customName ? (feat.stationingLabel && !customName.includes('+') && !customName.startsWith('Farm ditch') ? `${customName} (${feat.stationingLabel})` : customName) : feat.locationName;
        setPickerLocationName(name);
        setPickerCanalCode(point1PropsRef.current?.canal_code || feat.canalCode);
        setPickerParcelId(point1PropsRef.current?.parcel_id || feat.parcelId);
      });
    }
  };

  const handleResetPoints = () => {
    setIsPoint1Set(false);
    setIsPoint2Set(false);
    setPickerPt1(undefined);
    setPickerPt2(undefined);
    isPoint1SetRef.current = false;
    isPoint2SetRef.current = false;
    pickerPt1Ref.current = undefined;
    pickerPt2Ref.current = undefined;
    point1PropsRef.current = null;
    point2PropsRef.current = null;
    setPickerLocationName('');
    setPickerCanalCode(undefined);
    setPickerParcelId(undefined);
    setPickerPathResult(null);
  };

  const handleSetPoint1 = (coords: [number, number], featureProps?: any) => {
    if (!coords || !isValidCoord(coords[0], coords[1])) return;

    // 1. Optimistic instant state update (0ms UI latency)
    setPickerPt1(coords);
    setIsPoint1Set(true);
    isPoint1SetRef.current = true;
    pickerPt1Ref.current = coords;
    if (featureProps) {
      point1PropsRef.current = featureProps;
    }

    if (mapRef.current && isValidCoord(coords[0], coords[1])) {
      mapRef.current.panTo(coords);
    }

    const seq = ++calculationSeqRef.current;

    // 2. Non-blocking asynchronous calculation in animation frame
    if (isPoint2SetRef.current && pickerPt2Ref.current) {
      const pt2 = pickerPt2Ref.current;
      const straightDist = Math.round(haversineDistanceMeters(coords[0], coords[1], pt2[0], pt2[1]));
      setPickerPathResult(prev => ({
        pathCoords: [coords, pt2],
        locationName: prev?.locationName || 'Canal Segment (Calculating...)',
        distanceMeters: straightDist
      }));

      requestAnimationFrame(() => {
        if (seq !== calculationSeqRef.current) return;
        const pathRes = calculateCanalPathBetweenPoints(
          { lat: coords[0], lng: coords[1] },
          { lat: pt2[0], lng: pt2[1] },
          layers,
          featureProps || point1PropsRef.current,
          point2PropsRef.current
        );
        if (seq !== calculationSeqRef.current) return;
        setPickerPathResult(pathRes);
        setPickerLocationName(pathRes.locationName);
        setPickerCanalCode(pathRes.canalCode);
        setPickerParcelId(pathRes.parcelId);
      });
    } else {
      setPickerPathResult(null);
      const optName = featureProps ? getFeatureName(featureProps, '', coords) : '';
      if (optName) {
        setPickerLocationName(optName);
        setPickerCanalCode(featureProps?.canal_code);
        setPickerParcelId(featureProps?.parcel_id);
      }

      requestAnimationFrame(() => {
        if (seq !== calculationSeqRef.current) return;
        const feat = detectNearestGISFeature(coords[0], coords[1], layers);
        if (seq !== calculationSeqRef.current) return;
        const customName = featureProps ? getFeatureName(featureProps, '', coords) : '';
        const name = customName ? (feat.stationingLabel && !customName.includes('+') && !customName.startsWith('Farm ditch') ? `${customName} (${feat.stationingLabel})` : customName) : feat.locationName;
        setPickerLocationName(name);
        setPickerCanalCode(featureProps?.canal_code || feat.canalCode);
        setPickerParcelId(featureProps?.parcel_id || feat.parcelId);
      });
    }
  };

  const handleSetPoint2 = (coords: [number, number], featureProps?: any) => {
    if (!coords || !isValidCoord(coords[0], coords[1])) return;

    // 1. Optimistic instant state update (0ms UI latency)
    setPickerPt2(coords);
    setIsPoint2Set(true);
    isPoint2SetRef.current = true;
    pickerPt2Ref.current = coords;
    if (featureProps) {
      point2PropsRef.current = featureProps;
    }

    if (mapRef.current && isValidCoord(coords[0], coords[1])) {
      mapRef.current.panTo(coords);
    }

    if (!isPoint1SetRef.current || !pickerPt1Ref.current) {
      handleSetPoint1(coords, featureProps);
      return;
    }

    const pt1 = pickerPt1Ref.current;
    const seq = ++calculationSeqRef.current;

    // Optimistic straight line path & distance
    const straightDist = Math.round(haversineDistanceMeters(pt1[0], pt1[1], coords[0], coords[1]));
    setPickerPathResult(prev => ({
      pathCoords: [pt1, coords],
      locationName: prev?.locationName || 'Canal Segment (Calculating...)',
      distanceMeters: straightDist
    }));

    // 2. Non-blocking asynchronous calculation in animation frame
    requestAnimationFrame(() => {
      if (seq !== calculationSeqRef.current) return;
      const pathRes = calculateCanalPathBetweenPoints(
        { lat: pt1[0], lng: pt1[1] },
        { lat: coords[0], lng: coords[1] },
        layers,
        point1PropsRef.current,
        featureProps || point2PropsRef.current
      );
      if (seq !== calculationSeqRef.current) return;
      setPickerPathResult(pathRes);
      setPickerLocationName(pathRes.locationName);
      setPickerCanalCode(pathRes.canalCode);
      setPickerParcelId(pathRes.parcelId);
    });
  };

  // Initialize Leaflet Map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Load last known location from localStorage or default to assigned IMO
    let initialCenter: [number, number] = [13.1000, 121.3000];
    let initialZoom = 16; // Close field level zoom instead of far regional zoom

    if (locationFilter?.imo) {
      const imoLower = locationFilter.imo.toLowerCase();
      if (imoLower.includes('palawan')) {
        initialCenter = [9.3300, 118.4200];
      } else if (imoLower.includes('occidental')) {
        initialCenter = [13.2200, 120.6100];
      } else if (imoLower.includes('mindoro') || imoLower.includes('momaro') || imoLower.includes('oriental')) {
        initialCenter = [13.1500, 121.3000];
      }
    }

    try {
      const savedLocStr = localStorage.getItem('ommap_last_known_location');
      if (savedLocStr) {
        const savedLoc = JSON.parse(savedLocStr);
        if (isValidCoord(savedLoc.lat, savedLoc.lng)) {
          initialCenter = [Number(savedLoc.lat), Number(savedLoc.lng)];
          initialZoom = Number(savedLoc.zoom) || 16;
        }
      }
    } catch (e) {
      console.warn('Failed to parse last known location:', e);
    }

    const map = L.map(containerRef.current, {
      center: initialCenter,
      zoom: initialZoom,
      zoomControl: false,
      attributionControl: true,
      preferCanvas: true
    });

    // Create Base Tile Layer immediately on map initialization
    const initialConfig = getTileConfig(basemap || 'satellite');
    const initialTile = L.tileLayer(initialConfig.url, {
      maxZoom: initialConfig.maxZoom,
      subdomains: initialConfig.subdomains,
      attribution: initialConfig.attribution,
      zIndex: 0
    }).addTo(map);
    tileLayerRef.current = initialTile;

    // Save map center & zoom on moveend
    const updateZoomAndLocation = () => {
      const center = map.getCenter();
      const zoom = map.getZoom();

      try {
        localStorage.setItem('ommap_last_known_location', JSON.stringify({
          lat: center.lat,
          lng: center.lng,
          zoom
        }));
      } catch (e) {
        console.warn('Failed to save last known location:', e);
      }
    };

    map.on('moveend', updateZoomAndLocation);
    map.on('zoomend', updateZoomAndLocation);

    // Strict GIS Layer Hierarchy Panes:
    // 1. canalsPane (z-index: 410) - All canal linestrings & polygons
    // 2. canalHighlightPane (z-index: 420) - Selected canal white border & black core line
    // 3. reportsPane (z-index: 430) - Maintenance report polylines & markers (always on top of canals)
    // 4. pickerPane (z-index: 440) - Location selector 2-point segment path & markers (always on top of canals)
    // 5. structuresPane (z-index: 450) - Structure points & markers (always on top of canals)
    // 6. measurePane (z-index: 500) - Temporary measurement tools overlay
    const canalsPane = map.createPane('canalsPane');
    canalsPane.style.zIndex = '410';
    canalsPane.style.pointerEvents = 'none';

    const canalHighlightPane = map.createPane('canalHighlightPane');
    canalHighlightPane.style.zIndex = '420';
    canalHighlightPane.style.pointerEvents = 'none';

    const reportsPane = map.createPane('reportsPane');
    reportsPane.style.zIndex = '430';
    reportsPane.style.pointerEvents = 'none';

    const pickerPane = map.createPane('pickerPane');
    pickerPane.style.zIndex = '440';
    pickerPane.style.pointerEvents = 'none';

    const structuresPane = map.createPane('structuresPane');
    structuresPane.style.zIndex = '450';
    structuresPane.style.pointerEvents = 'none';

    const measurePane = map.createPane('measurePane');
    measurePane.style.zIndex = '500';
    measurePane.style.pointerEvents = 'none';

    // Layer Groups
    selectionHighlightLayerGroupRef.current = L.layerGroup().addTo(map);
    layerGroupRef.current = L.layerGroup().addTo(map);
    pointsLayerGroupRef.current = L.layerGroup().addTo(map);
    reportsLayerGroupRef.current = L.layerGroup().addTo(map);

    measureLayerGroupRef.current = L.layerGroup().addTo(map);
    userLocLayerGroupRef.current = L.layerGroup().addTo(map);
    pickerLayerGroupRef.current = L.layerGroup().addTo(map);

    mapRef.current = map;

    // Immediately request high-accuracy GPS position on startup to pan straight to user's real-time field position
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude, accuracy } = pos.coords;
          if (mapRef.current && isValidCoord(latitude, longitude)) {
            // Philippine geographic bounds validation (Lat: 4.5 to 21.5, Lng: 116.0 to 127.0)
            if (latitude >= 4.5 && latitude <= 21.5 && longitude >= 116.0 && longitude <= 127.0) {
              mapRef.current.flyTo([latitude, longitude], 16.5, { duration: 1.2 });

              if (userLocLayerGroupRef.current) {
                userLocLayerGroupRef.current.clearLayers();

                const accCircle = L.circle([latitude, longitude], {
                  radius: accuracy || 25,
                  color: '#38bdf8',
                  weight: 1,
                  fillColor: '#38bdf8',
                  fillOpacity: 0.15
                });

                const userIcon = L.divIcon({
                  className: 'custom-user-location-marker',
                  html: `
                    <div class="relative flex items-center justify-center w-5 h-5">
                      <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                      <span class="relative inline-flex rounded-full h-3.5 w-3.5 bg-cyan-500 border-2 border-white shadow-md"></span>
                    </div>
                  `,
                  iconSize: [20, 20],
                  iconAnchor: [10, 10]
                });

                const userMarker = L.marker([latitude, longitude], { icon: userIcon });
                userLocLayerGroupRef.current.addLayer(accCircle);
                userLocLayerGroupRef.current.addLayer(userMarker);
              }

              try {
                localStorage.setItem('ommap_last_known_location', JSON.stringify({
                  lat: latitude,
                  lng: longitude,
                  zoom: 16.5
                }));
              } catch (e) {}
            }
          }
        },
        (err) => {
          console.log('Automatic startup GPS geolocation deferred or unverified:', err);
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
      );
    }

    const handleGeneralMapClick = () => {
      if (isMapPickerActiveRef.current || activeMeasureToolRef.current !== 'none') {
        return;
      }
      clearFeatureHighlight();
      activePopupInstanceRef.current = null;
      activePopupCoordsRef.current = null;
      removeClickedPointMarker();
      onDeselectFeatureRef.current?.();
    };

    const handleMapPopupOpen = (e: any) => {
      if (e?.popup) {
        activePopupInstanceRef.current = e.popup;
      }
      requestAnimationFrame(() => updateLeaderLine());
      setTimeout(updateLeaderLine, 30);
      setTimeout(updateLeaderLine, 100);
      setTimeout(updateLeaderLine, 250);
    };

    const handleMapPopupClose = (e: any) => {
      const isSwitchingFeatures = Date.now() - lastFeatureClickTimeRef.current < 450;
      if (!isSwitchingFeatures && (!e?.popup || activePopupInstanceRef.current === e.popup)) {
        clearFeatureHighlight();
        activePopupInstanceRef.current = null;
        activePopupCoordsRef.current = null;
        removeClickedPointMarker();
        if (leaderLinePathRef.current) leaderLinePathRef.current.setAttribute('d', '');
      }
    };

    map.on('click', handleGeneralMapClick);
    map.on('popupopen', handleMapPopupOpen);
    map.on('popupclose', handleMapPopupClose);
    map.on('move', updateLeaderLine);
    map.on('zoom', updateLeaderLine);
    map.on('moveend', updateLeaderLine);
    map.on('zoomend', updateLeaderLine);
    map.on('viewreset', updateLeaderLine);
    window.addEventListener('resize', updateLeaderLine);

    return () => {
      map.off('click', handleGeneralMapClick);
      map.off('popupopen', handleMapPopupOpen);
      map.off('popupclose', handleMapPopupClose);
      map.off('move', updateLeaderLine);
      map.off('zoom', updateLeaderLine);
      map.off('moveend', updateLeaderLine);
      map.off('zoomend', updateLeaderLine);
      map.off('viewreset', updateLeaderLine);
      window.removeEventListener('resize', updateLeaderLine);
      removeClickedPointMarker();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update Basemap Tiles
  useEffect(() => {
    if (!mapRef.current) return;
    const config = getTileConfig(basemap);

    if (tileLayerRef.current) {
      try {
        tileLayerRef.current.remove();
      } catch (_) {}
    }

    const newTile = L.tileLayer(config.url, {
      maxZoom: config.maxZoom,
      subdomains: config.subdomains,
      attribution: config.attribution,
      zIndex: 0
    }).addTo(mapRef.current);

    try {
      newTile.bringToBack();
    } catch (_) {}

    tileLayerRef.current = newTile;
  }, [basemap]);

  // Zoom to search target coordinates when selected from Navbar search
  useEffect(() => {
    if (mapRef.current && searchTargetCoords && isValidCoord(searchTargetCoords[0], searchTargetCoords[1])) {
      mapRef.current.flyTo(searchTargetCoords, 16, { duration: 1.2 });
    }
  }, [searchTargetCoords]);

  // Smoothly pan & focus on specific IMO area ONLY when user actively changes filter in modal
  const prevImoRef = useRef<string | undefined>(locationFilter?.imo);
  const isFirstImoMountRef = useRef(true);
  useEffect(() => {
    if (!mapRef.current) return;
    if (isFirstImoMountRef.current) {
      isFirstImoMountRef.current = false;
      prevImoRef.current = locationFilter?.imo;
      return;
    }
    const currentImo = locationFilter?.imo;
    if (currentImo && currentImo !== prevImoRef.current && currentImo !== 'All IMOs') {
      prevImoRef.current = currentImo;
      const imoLower = currentImo.toLowerCase();
      if (imoLower.includes('palawan')) {
        mapRef.current.flyTo([9.3300, 118.4200], 14, { duration: 1.2 });
      } else if (imoLower.includes('occidental')) {
        mapRef.current.flyTo([13.2200, 120.6100], 14, { duration: 1.2 });
      } else if (imoLower.includes('mindoro') || imoLower.includes('momaro') || imoLower.includes('oriental')) {
        mapRef.current.flyTo([13.1500, 121.3000], 14, { duration: 1.2 });
      }
    }
  }, [locationFilter?.imo]);

  // Handle "Your Location" button click
  const handleFlyToUserLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude, accuracy } = pos.coords;
          if (mapRef.current && isValidCoord(latitude, longitude)) {
            mapRef.current.flyTo([latitude, longitude], 17, { duration: 1.2 });

            if (userLocLayerGroupRef.current) {
              userLocLayerGroupRef.current.clearLayers();

              // Accuracy Circle
              const accCircle = L.circle([latitude, longitude], {
                radius: accuracy || 20,
                color: '#38bdf8',
                weight: 1,
                fillColor: '#38bdf8',
                fillOpacity: 0.15
              });

              // Pulsing User Location Marker (Compact Google Maps Blue Dot)
              const userIcon = L.divIcon({
                className: 'custom-user-location-marker',
                html: `
                  <div class="relative flex items-center justify-center w-5 h-5">
                    <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                    <span class="relative inline-flex rounded-full h-3.5 w-3.5 bg-cyan-500 border-2 border-white shadow-md"></span>
                  </div>
                `,
                iconSize: [20, 20],
                iconAnchor: [10, 10]
              });

              const userMarker = L.marker([latitude, longitude], { icon: userIcon });
              userLocLayerGroupRef.current.addLayer(accCircle);
              userLocLayerGroupRef.current.addLayer(userMarker);
            }

            if (isMapPickerActive) {
              handleSetPoint1([latitude, longitude]);
            }
          }
        },
        (err) => {
          console.warn('User location error:', err);
          alert('Unable to retrieve current location. Please verify location permissions on your device.');
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    }
  };



  // Render Vector GIS Layers & Field Report Markers
  useEffect(() => {
    if (!mapRef.current || !layerGroupRef.current) return;

    layerGroupRef.current.clearLayers();
    if (pointsLayerGroupRef.current) {
      pointsLayerGroupRef.current.clearLayers();
    }
    featureMapRef.current = [];
    if (selectionHighlightLayerGroupRef.current) {
      selectionHighlightLayerGroupRef.current.clearLayers();
    }
    if (highlightedLayerRef.current) {
      highlightedLayerRef.current = null;
    }
    removeClickedPointMarker();

    let allVectorBounds: L.LatLngBounds | null = null;

    // 1. Render Active GIS Vector Layers
    const isFilterActive = locationFilter && Boolean(
      (locationFilter.imo && locationFilter.imo !== 'All IMOs') ||
      (locationFilter.nis && locationFilter.nis !== 'All NIS') ||
      (locationFilter.province && locationFilter.province !== 'All Provinces') ||
      (locationFilter.activityCategory && locationFilter.activityCategory !== 'All Activities')
    );

    const getCanonicalProp = (p: any, key: 'IMO' | 'Province' | 'NIS'): string => {
      if (!p) return '';
      if (key === 'IMO') return String(p.IMO || p.imo || p.Imo || p.IMO_NAME || p.imo_name || '').trim();
      if (key === 'Province') return String(p.Province || p.province || p.PROVINCE || '').trim();
      if (key === 'NIS') return String(p.NIS || p.nis || p.Nis || p.NIS_NAME || p.nis_name || '').trim();
      return '';
    };

    // Sort layers: 1. Canals (bottom) -> 2. Structures (top)
    // Ensures structure points render ON TOP of canals naturally without blocking clicks
    const sortedLayers = [...layers].sort((a, b) => {
      const getOrder = (l: any) => {
        const isStructure = l.category === 'Structures' || l.geometryType === 'Point' || l.name.toLowerCase().includes('structure');
        return isStructure ? 2 : 1;
      };
      return getOrder(a) - getOrder(b);
    });

    sortedLayers.forEach((layer) => {
      if (layer.visible === false || !layer.data) return;

      const isCanalLayer = layer.category === 'Canals' || layer.category === 'Canal Networks' || layer.geometryType === 'LineString' || layer.name.toLowerCase().includes('canal');
      const isStructureLayer = layer.category === 'Structures' || layer.geometryType === 'Point' || layer.name.toLowerCase().includes('structure');

      try {
        const geoJsonLayer = (L as any).geoJSON(layer.data, {
          pane: isStructureLayer ? 'structuresPane' : 'canalsPane',
          smoothFactor: 1.2,
          filter: (feature: any) => {
            if (!feature || !feature.geometry || !feature.geometry.coordinates) {
              return false;
            }
            const geomType = feature?.geometry?.type || '';

            // Ignore any polygon / area geometries entirely
            if (geomType.includes('Polygon')) {
              return false;
            }

            if (!isFilterActive || !locationFilter) return true;
            const p = feature?.properties || {};

            const imoVal = getCanonicalProp(p, 'IMO');
            const provVal = getCanonicalProp(p, 'Province');
            const nisVal = getCanonicalProp(p, 'NIS');

            if (locationFilter.imo && locationFilter.imo !== 'All IMOs') {
              if (imoVal && !imoVal.toLowerCase().includes(locationFilter.imo.toLowerCase()) && !locationFilter.imo.toLowerCase().includes(imoVal.toLowerCase())) {
                return false;
              }
            }

            if (locationFilter.province && locationFilter.province !== 'All Provinces') {
              if (provVal && !provVal.toLowerCase().includes(locationFilter.province.toLowerCase()) && !locationFilter.province.toLowerCase().includes(provVal.toLowerCase())) {
                return false;
              }
            }

            if (locationFilter.nis && locationFilter.nis !== 'All NIS') {
              if (nisVal && !nisVal.toLowerCase().includes(locationFilter.nis.toLowerCase()) && !locationFilter.nis.toLowerCase().includes(nisVal.toLowerCase())) {
                return false;
              }
            }

            return true;
          },
          style: (feature) => {
            const itemStyle = classifyVectorItem(
              layer.name,
              layer.category,
              layer.subCategory,
              feature?.properties,
              feature?.geometry?.type || layer.geometryType
            );

            const opacity = 0.85;
            const color = itemStyle.color;
            const weight = itemStyle.weight;

            if (feature?.properties?.status === 'Completed') {
              return { color: '#10b981', weight: 4.5, opacity, fillColor: '#10b981', fillOpacity: opacity };
            } else if (feature?.properties?.status === 'Delayed' || feature?.properties?.priority === 'Critical') {
              return { color: '#ef4444', weight: 4.5, opacity, fillColor: '#ef4444', fillOpacity: opacity };
            } else if (feature?.properties?.status === 'Inspection Required') {
              return { color: '#f59e0b', weight: 4.5, opacity, fillColor: '#f59e0b', fillOpacity: opacity };
            }

            return { color, weight, opacity, fillColor: color, fillOpacity: opacity };
          },
          pointToLayer: (feature, latlng) => {
            if (!latlng || !isValidCoord(latlng.lat, latlng.lng)) {
              return L.circleMarker([13.1, 121.3], { radius: 0, opacity: 0, fillOpacity: 0, interactive: false, pane: 'structuresPane' });
            }

            // Structures guaranteed in Azure Blue (#0284c7) with solid white border ring
            const markerColor = BLUE_PALETTE.STRUCTURE;
            const structName = feature.properties?.name || feature.properties?.Name || feature.properties?.NAME || feature.properties?.canal_name || 'STRUCTURE';
            const structStation = feature.properties?.station || (feature.properties?.station_m !== undefined ? `STA ${formatStationingNumber(feature.properties.station_m)}` : null);
            const tooltipContent = structStation && !structName.includes(structStation)
              ? `${structName} (${structStation})`
              : structName;

            // Point marker with crisp 2px solid white border ring
            const circleMarker = L.circleMarker(latlng, {
              radius: 6,
              fillColor: markerColor,
              color: '#ffffff', // Crisp solid white border ring
              weight: 2.0,
              fillOpacity: 0.85,
              opacity: 0.85,
              interactive: true,
              pane: 'structuresPane'
            });
            circleMarker.bindTooltip(tooltipContent, { direction: 'top', opacity: 0.9, className: 'custom-map-tooltip' });
            return circleMarker;
          },
          onEachFeature: (feature, leafletLayer) => {
            const props = feature.properties || {};

            const itemStyle = classifyVectorItem(
              layer.name,
              layer.category,
              layer.subCategory,
              props,
              feature?.geometry?.type || layer.geometryType
            );

            const defaultColor = props?.status === 'Completed' ? '#10b981'
              : (props?.status === 'Delayed' || props?.priority === 'Critical') ? '#ef4444'
              : props?.status === 'Inspection Required' ? '#f59e0b'
              : itemStyle.color;

            const defaultWeight = itemStyle.weight;
            const defaultOpacity = 0.85;

            const defaultStyle = {
              color: defaultColor,
              weight: defaultWeight,
              opacity: defaultOpacity,
              fillColor: defaultColor,
              fillOpacity: defaultOpacity
            };

            featureMapRef.current.push({
              properties: props,
              layer: leafletLayer,
              defaultStyle
            });

            // Direct click handler for vector layers
            leafletLayer.on('click', (e: any) => {
              lastFeatureClickTimeRef.current = Date.now();
              if (e && e.originalEvent) {
                L.DomEvent.stopPropagation(e);
              }
              const curLatlng = e.latlng || (typeof (leafletLayer as any).getLatLng === 'function' ? (leafletLayer as any).getLatLng() : null);
              if (curLatlng && isValidCoord(curLatlng.lat, curLatlng.lng)) {
                (leafletLayer as any)._lastClickLatLng = [curLatlng.lat, curLatlng.lng];
              }
              if (isMapPickerActiveRef.current) {
                if (curLatlng && isValidCoord(curLatlng.lat, curLatlng.lng)) {
                  const isPt1Set = isPoint1SetRef.current && pickerPt1Ref.current && isValidCoord(pickerPt1Ref.current[0], pickerPt1Ref.current[1]);
                  if (!isPt1Set) {
                    handleSetPoint1([curLatlng.lat, curLatlng.lng], props);
                  } else {
                    handleSetPoint2([curLatlng.lat, curLatlng.lng], props);
                  }
                  try {
                    if (typeof (leafletLayer as any).closePopup === 'function') {
                      (leafletLayer as any).closePopup();
                    }
                  } catch (_) {}
                  return;
                }
              } else {
                // Outside location selector mode: feature click only opens the map popup.
                if (curLatlng && isValidCoord(curLatlng.lat, curLatlng.lng)) {
                  const coords: [number, number] = [curLatlng.lat, curLatlng.lng];
                  activePopupCoordsRef.current = coords;
                  const optimalOffset = computeOptimalPopupOffset(leafletLayer, L.latLng(curLatlng.lat, curLatlng.lng), mapRef.current);
                  if ((leafletLayer as any)._popup) {
                    (leafletLayer as any)._popup.options.offset = optimalOffset;
                  }
                  showClickedPointMarker(curLatlng.lat, curLatlng.lng);
                }
                // The Attribute Inspector will appear ONLY when 'Inspect Attribute Details' is clicked.
                if (selectedFeaturePropsRef.current) {
                  onDeselectFeatureRef.current?.();
                }
              }
            });

            // LAZY ON-DEMAND POPUP: Generates HTML only when the user clicks this exact feature!
            leafletLayer.bindPopup(() => {
              if (isMapPickerActiveRef.current) {
                return '';
              }
              const inspectId = Math.random().toString(36).substring(2, 9);
              (leafletLayer as any)._activeInspectId = inspectId;

              const getAttrVal = (keys: string[]): string => {
                for (const k of keys) {
                  if (props[k] !== undefined && props[k] !== null && String(props[k]).trim() !== '') {
                    return String(props[k]).trim();
                  }
                }
                if (feature) {
                  for (const k of keys) {
                    if ((feature as any)[k] !== undefined && (feature as any)[k] !== null && String((feature as any)[k]).trim() !== '') {
                      return String((feature as any)[k]).trim();
                    }
                  }
                }
                return '[blank]';
              };

              let featureCoords: [number, number] | undefined = (leafletLayer as any)._lastClickLatLng;
              if (!featureCoords) {
                if (typeof (leafletLayer as any).getLatLng === 'function') {
                  const ll = (leafletLayer as any).getLatLng();
                  if (ll) featureCoords = [ll.lat, ll.lng];
                } else if (typeof (leafletLayer as any).getBounds === 'function') {
                  const c = (leafletLayer as any).getBounds().getCenter();
                  if (c) featureCoords = [c.lat, c.lng];
                }
              }

              let featInfo: NearestGISFeatureResult | null = null;
              if (featureCoords && layersRef.current && layersRef.current.length > 0) {
                try {
                  featInfo = detectNearestGISFeature(featureCoords[0], featureCoords[1], layersRef.current, props);
                } catch (err) {
                  console.warn('Error detecting nearest GIS feature for popup:', err);
                }
              }

              const isStructure = itemStyle.isStructure || featInfo?.isStructurePoint;
              const escapeHtml = (val: any) => String(val ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m] || m));

              let resolvedName = isStructure
                ? (props.name || featInfo?.locationName || getFeatureName(props, 'Unnamed Structure', featureCoords))
                : (props.canal || featInfo?.locationName || getFeatureName(props, 'Unnamed Canal', featureCoords));

              if (itemStyle.canalType === 'Farm Ditch' && featureCoords && (!featInfo || !featInfo.locationName.startsWith('Farm ditch'))) {
                resolvedName = `Farm ditch @${featureCoords[0].toFixed(5)}, ${featureCoords[1].toFixed(5)}`;
              }

              const typeLabel = getCanalTypeLabel(itemStyle.hierarchyType, itemStyle.canalType, itemStyle.isStructure);
              const categoryLabel = itemStyle.canalCategory || 'Uncategorized';
              const coordsStr = featureCoords
                ? `${featureCoords[0].toFixed(5)}, ${featureCoords[1].toFixed(5)}`
                : 'Not available';

              const isLight = typeof document !== 'undefined' && document.documentElement.classList.contains('light');
              const headerColor = isLight ? 'text-slate-900' : 'text-white';
              const borderClass = isLight ? 'border-slate-200' : 'border-slate-700/80';
              const labelColor = isLight ? 'text-slate-500' : 'text-slate-400';
              const valColor = isLight ? 'text-slate-800' : 'text-slate-200';

              let rowsHtml = '';
              if (isStructure) {
                const structCat = props.Structure_Category || props.structure_category || props.type || featInfo?.structureCategory || 'Structure';
                const hostCanal = props.canal_name || props.Canal_Name || featInfo?.canalName || 'N/A';
                const stationStr = props.station || (props.station_m !== undefined ? `STA ${formatStationingNumber(props.station_m)}` : (featInfo?.stationingLabel || 'STA 0+000.0'));
                const takeoffStr = props.parent_takeoff_station || featInfo?.parentTakeoffStation;
                const drainageStr = props.drainage_interface || featInfo?.drainageInterface;

                rowsHtml = `
                  <div class="flex justify-between items-center gap-2">
                    <span class="${labelColor} font-medium shrink-0">Structure Category:</span>
                    <span class="font-semibold ${valColor} text-right truncate">${escapeHtml(structCat)}</span>
                  </div>
                  <div class="flex justify-between items-center gap-2">
                    <span class="${labelColor} font-medium shrink-0">Host Canal:</span>
                    <span class="font-semibold ${isLight ? 'text-sky-600' : 'text-sky-400'} text-right truncate">${escapeHtml(hostCanal)}</span>
                  </div>
                  <div class="flex justify-between items-center gap-2">
                    <span class="${labelColor} font-medium shrink-0">Station:</span>
                    <span class="font-mono font-semibold ${isLight ? 'text-emerald-700' : 'text-emerald-400'} text-right truncate">${escapeHtml(stationStr)}</span>
                  </div>
                  ${takeoffStr ? `
                    <div class="flex justify-between items-center gap-2">
                      <span class="${labelColor} font-medium shrink-0">Takeoff:</span>
                      <span class="font-mono text-[10px] ${valColor} text-right truncate" title="${escapeHtml(takeoffStr)}">${escapeHtml(takeoffStr)}</span>
                    </div>
                  ` : ''}
                  ${drainageStr ? `
                    <div class="flex justify-between items-center gap-2">
                      <span class="${labelColor} font-medium shrink-0">Drainage Interface:</span>
                      <span class="font-semibold ${isLight ? 'text-amber-700' : 'text-amber-400'} text-right truncate">${escapeHtml(drainageStr)}</span>
                    </div>
                  ` : ''}
                `;
              } else {
                const canalTypeVal = props.canaltype || props.canal_type || typeLabel;
                const liningVal = props.canal_lining || categoryLabel;
                const canalStationVal = featInfo?.stationingLabel || (props.station_no ? `${props.station_no} - ${props.station__1 || ''}` : 'N/A');
                const lengthVal = props.canal_leng ? `${Number(props.canal_leng).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m` : null;

                rowsHtml = `
                  <div class="flex justify-between items-center gap-2">
                    <span class="${labelColor} font-medium shrink-0">Canal Type:</span>
                    <span class="font-semibold ${valColor} text-right truncate">${escapeHtml(canalTypeVal)}</span>
                  </div>
                  <div class="flex justify-between items-center gap-2">
                    <span class="${labelColor} font-medium shrink-0">Lining Status:</span>
                    <span class="font-semibold ${valColor} text-right truncate">${escapeHtml(liningVal)}</span>
                  </div>
                  <div class="flex justify-between items-center gap-2">
                    <span class="${labelColor} font-medium shrink-0">Station:</span>
                    <span class="font-mono font-semibold ${isLight ? 'text-emerald-700' : 'text-emerald-400'} text-right truncate">${escapeHtml(canalStationVal)}</span>
                  </div>
                  ${lengthVal ? `
                    <div class="flex justify-between items-center gap-2">
                      <span class="${labelColor} font-medium shrink-0">Total Length:</span>
                      <span class="font-semibold ${valColor} text-right truncate">${escapeHtml(lengthVal)}</span>
                    </div>
                  ` : ''}
                `;
              }

              return `
                <div class="p-1.5 space-y-2 min-w-[240px] max-w-sm font-sans text-xs ${isLight ? 'text-slate-800' : 'text-slate-200'}">
                  <div class="border-b ${borderClass} pb-1.5 pr-6">
                    <span class="font-bold text-xs ${headerColor} leading-snug break-words block">
                      ${escapeHtml(resolvedName)}
                    </span>
                  </div>

                  <div class="space-y-1.5 py-0.5 text-[11px]">
                    ${rowsHtml}
                    <div class="flex justify-between items-center gap-2">
                      <span class="${labelColor} font-medium shrink-0">Coordinates:</span>
                      <div class="flex items-center gap-1.5 font-mono font-semibold ${valColor} shrink-0">
                        <span>${coordsStr}</span>
                        ${featureCoords ? `
                          <button
                            id="copy-coords-btn-${inspectId}"
                            type="button"
                            class="p-0.5 hover:bg-slate-700/50 rounded transition cursor-pointer text-slate-400 hover:${isLight ? 'text-slate-900' : 'text-white'} shrink-0"
                            title="Copy Coordinates (${coordsStr})"
                          >
                            <span id="copy-coords-icon-${inspectId}">
                              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                              </svg>
                            </span>
                          </button>
                        ` : ''}
                      </div>
                    </div>
                  </div>

                  <div class="flex flex-col gap-1.5 mt-2">
                    <button id="inspect-btn-${inspectId}" class="w-full bg-[#009933] hover:bg-[#00802b] text-white text-xs font-bold py-1.5 px-3 rounded-lg shadow-md transition flex items-center justify-center gap-1 cursor-pointer">
                      Inspect Attribute Details
                    </button>
                    ${!isMapPickerActiveRef.current ? `
                      <button id="create-report-btn-${inspectId}" class="w-full bg-[#166534] hover:bg-[#15803d] text-white text-xs font-bold py-1.5 px-3 rounded-lg shadow-md transition flex items-center justify-center gap-1 cursor-pointer">
                        + Create Report
                      </button>
                    ` : ''}
                  </div>
                  ${isMapPickerActiveRef.current ? `
                    <div class="flex flex-col gap-1.5 mt-2 pt-2 border-t border-slate-700/60">
                      <button id="set-pt1-btn-${inspectId}" class="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-1.5 px-3 rounded-lg text-xs transition shadow cursor-pointer flex items-center justify-center gap-1">
                        <span class="w-4 h-4 rounded-full bg-slate-950 text-amber-400 font-extrabold text-[10px] flex items-center justify-center">1</span>
                        <span>Set Point 1</span>
                      </button>
                      <button id="set-pt2-btn-${inspectId}" class="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold py-1.5 px-3 rounded-lg text-xs transition shadow cursor-pointer flex items-center justify-center gap-1">
                        <span class="w-4 h-4 rounded-full bg-slate-950 text-cyan-400 font-extrabold text-[10px] flex items-center justify-center">2</span>
                        <span>Set Point 2</span>
                      </button>
                      ${isPoint2SetRef.current ? `
                        <button id="clear-pt2-btn-${inspectId}" class="w-full bg-slate-800 hover:bg-slate-700 text-rose-300 font-bold py-1 px-2.5 rounded-lg text-[11px] transition cursor-pointer flex items-center justify-center gap-1 border border-slate-700">
                          ✕ Clear Point 2 (Single Point Mode)
                        </button>
                      ` : ''}
                      <div class="text-[10px] text-cyan-300/90 italic mt-0.5 text-center font-medium">
                        💡 Drag pins 1 &amp; 2 on map to adjust location points
                      </div>
                    </div>
                  ` : ''}
                </div>
              `;
            }, { maxWidth: 320, className: 'custom-leaflet-popup' });

            leafletLayer.on('mouseover', () => {
              if (containerRef.current) {
                containerRef.current.style.cursor = 'pointer';
              }
            });

            leafletLayer.on('mouseout', () => {
              if (containerRef.current) {
                containerRef.current.style.cursor = isMapPickerActiveRef.current ? 'crosshair' : 'default';
              }
            });

            leafletLayer.on('popupclose', (e) => {
              const isSwitchingFeatures = Date.now() - lastFeatureClickTimeRef.current < 450;
              const closingPopup = (e as any)?.popup || (leafletLayer as any)._popup;

              if (!isSwitchingFeatures && (!activePopupInstanceRef.current || activePopupInstanceRef.current === closingPopup)) {
                clearFeatureHighlight();
                activePopupInstanceRef.current = null;
                activePopupCoordsRef.current = null;
                setActivePopupProps(null);
                setActivePopupCoords(null);
                removeClickedPointMarker();
                if (leaderLinePathRef.current) leaderLinePathRef.current.setAttribute('d', '');
              }
            });

            leafletLayer.on('popupopen', (e) => {
              if (isMapPickerActiveRef.current) {
                try {
                  leafletLayer.closePopup();
                } catch (_) {}
                return;
              }

              activePopupInstanceRef.current = e.popup;
              const popupEl = e.popup?.getElement();
              if (popupEl) {
                // Clear any existing active-attribute-popup markers
                containerRef.current?.querySelectorAll('.active-attribute-popup').forEach((node) => {
                  node.classList.remove('active-attribute-popup');
                });
                popupEl.classList.add('active-attribute-popup');

                // Immediately purge any stale/dying popup elements from previous layers
                containerRef.current?.querySelectorAll('.custom-leaflet-popup').forEach((node) => {
                  if (node !== popupEl) {
                    try {
                      node.remove();
                    } catch (_) {}
                  }
                });
              }

              const inspectId = (leafletLayer as any)._activeInspectId;
              // Highlight THIS EXACT clicked Leaflet vector layer directly!
              applyFeatureHighlight(leafletLayer, defaultStyle);

              const latlng = e.popup?.getLatLng();
              const clickCoords: [number, number] | undefined = latlng
                ? [latlng.lat, latlng.lng]
                : (leafletLayer as any)._lastClickLatLng;

              if (clickCoords) {
                const optimalOffset = computeOptimalPopupOffset(leafletLayer, L.latLng(clickCoords[0], clickCoords[1]), mapRef.current);
                if (e.popup) {
                  e.popup.options.offset = optimalOffset;
                  e.popup.update();
                }
                activePopupCoordsRef.current = clickCoords;
                setActivePopupCoords(clickCoords);
                setActivePopupProps(props);
                showClickedPointMarker(clickCoords[0], clickCoords[1]);
                requestAnimationFrame(() => updateLeaderLine());
                setTimeout(updateLeaderLine, 30);
                setTimeout(updateLeaderLine, 100);
                setTimeout(updateLeaderLine, 250);
              }

              const copyCoordsBtn = document.getElementById(`copy-coords-btn-${inspectId}`);
              if (copyCoordsBtn) {
                copyCoordsBtn.onclick = (evt) => {
                  evt.stopPropagation();
                  const targetCoords = clickCoords || (leafletLayer as any)._lastClickLatLng;
                  if (!targetCoords) return;
                  const strToCopy = `${targetCoords[0].toFixed(5)}, ${targetCoords[1].toFixed(5)}`;
                  const doCopy = (text: string) => {
                    if (navigator.clipboard && window.isSecureContext) {
                      return navigator.clipboard.writeText(text);
                    } else {
                      const textArea = document.createElement('textarea');
                      textArea.value = text;
                      textArea.style.position = 'fixed';
                      textArea.style.left = '-999999px';
                      textArea.style.top = '-999999px';
                      document.body.appendChild(textArea);
                      textArea.focus();
                      textArea.select();
                      return new Promise<void>((resolve, reject) => {
                        document.execCommand('copy') ? resolve() : reject();
                        textArea.remove();
                      });
                    }
                  };

                  doCopy(strToCopy).then(() => {
                    const iconEl = document.getElementById(`copy-coords-icon-${inspectId}`);
                    if (iconEl) {
                      iconEl.innerHTML = `<svg class="w-3.5 h-3.5 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
                      setTimeout(() => {
                        const resetEl = document.getElementById(`copy-coords-icon-${inspectId}`);
                        if (resetEl) {
                          resetEl.innerHTML = `<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
                        }
                      }, 2000);
                    }
                  }).catch(err => {
                    console.warn('Failed to copy coordinates:', err);
                  });
                };
              }

              const btn = document.getElementById(`inspect-btn-${inspectId}`);
              if (btn) {
                btn.onclick = (evt) => {
                  evt.stopPropagation();
                  const targetCoords = clickCoords || (leafletLayer as any)._lastClickLatLng;
                  onSelectFeatureRef.current?.(props, layer.category, targetCoords);
                };
              }
              const createReportBtn = document.getElementById(`create-report-btn-${inspectId}`);
              if (createReportBtn) {
                createReportBtn.onclick = (evt) => {
                  evt.stopPropagation();
                  if (clickCoords) {
                    onTriggerReportFromMapRef.current?.(clickCoords[0], clickCoords[1]);
                    e.popup?.close();
                  }
                };
              }
              const btn1 = document.getElementById(`set-pt1-btn-${inspectId}`);
              if (btn1) {
                btn1.onclick = (evt) => {
                  evt.stopPropagation();
                  const curLatlng = e.popup?.getLatLng();
                  if (curLatlng) {
                    handleSetPoint1([curLatlng.lat, curLatlng.lng], props);
                    e.popup?.close();
                  }
                };
              }
              const btn2 = document.getElementById(`set-pt2-btn-${inspectId}`);
              if (btn2) {
                btn2.onclick = (evt) => {
                  evt.stopPropagation();
                  const curLatlng = e.popup?.getLatLng();
                  if (curLatlng) {
                    handleSetPoint2([curLatlng.lat, curLatlng.lng], props);
                    e.popup?.close();
                  }
                };
              }
              const btnClear2 = document.getElementById(`clear-pt2-btn-${inspectId}`);
              if (btnClear2) {
                btnClear2.onclick = (evt) => {
                  evt.stopPropagation();
                  handleClearPoint2();
                  e.popup?.close();
                };
              }
            });
          }
        });

        if (isStructureLayer) {
          pointsLayerGroupRef.current?.addLayer(geoJsonLayer);
        } else {
          layerGroupRef.current?.addLayer(geoJsonLayer);
        }
        
        try {
          const layerBounds = geoJsonLayer.getBounds();
          if (layerBounds.isValid()) {
            if (!allVectorBounds) {
              allVectorBounds = L.latLngBounds(layerBounds.getSouthWest(), layerBounds.getNorthEast());
            } else {
              allVectorBounds.extend(layerBounds);
            }
          }
        } catch (bErr) {}
      } catch (err) {
        console.error(`Error rendering GIS layer ${layer.name}:`, err);
      }
    });

    // Auto-fit to entire vector layers bounds is disabled to maintain focus on user's current GPS / last known location

  }, [layers, locationFilter?.imo, locationFilter?.nis, locationFilter?.province, locationFilter?.activityCategory]);

  // Separate Decoupled Effect: Render Field Report Segment Paths & Markers (Lightweight, near-zero overhead)
  useEffect(() => {
    if (!mapRef.current || !reportsLayerGroupRef.current) return;

    reportsLayerGroupRef.current.clearLayers();

    const maintMasterLayer = layers.find(l => l.id === 'layer-reports-maintenance');
    const operLayer = layers.find(l => l.category === 'Operations' || l.category === 'Operational Status Reports' || l.id === 'layer-reports-operational');

    const isOperVisible = operLayer ? operLayer.visible : true;

    fieldReports.forEach((report) => {
      if (!report) return;

      const isMaint = report.categoryMode === 'maintenance' || report.reportType === 'maintenance';
      let isReportVisible = true;
      let reportColor = '#f59e0b';

      if (isMaint) {
        const actName = report.maintenanceActivity || report.title || '';
        const matchingLayer = layers.find(l => 
          (l.category === 'Maintenance' || l.subCategory === 'Maintenance Reports') &&
          (l.name.toLowerCase() === actName.toLowerCase() || 
           (MAINTENANCE_ACTIVITY_CONFIG[actName] && l.id === MAINTENANCE_ACTIVITY_CONFIG[actName].id) ||
           l.name.toLowerCase().includes(actName.toLowerCase()))
        );
        if (matchingLayer) {
          isReportVisible = matchingLayer.visible;
          reportColor = matchingLayer.color || getActivityColor(actName, 'maintenance');
        } else {
          reportColor = getActivityColor(actName, 'maintenance');
        }
      } else {
        const stateName = report.operationalState || '';
        const matchingLayer = layers.find(l => 
          (l.category === 'Operations' || l.subCategory === 'Operational Status Reports') &&
          (l.name.toLowerCase() === stateName.toLowerCase() ||
           (OPERATIONAL_STATE_CONFIG[stateName] && l.id === OPERATIONAL_STATE_CONFIG[stateName].id) ||
           l.name.toLowerCase().includes(stateName.toLowerCase()))
        );
        if (matchingLayer) {
          isReportVisible = matchingLayer.visible;
          reportColor = matchingLayer.color || getActivityColor(stateName, 'operational');
        } else {
          reportColor = getActivityColor(stateName, 'operational');
        }
      }

      if (!isReportVisible) return;

      // 2. Filter by IMO
      if (locationFilter?.imo && locationFilter.imo !== 'All IMOs') {
        const repImo = (report.imoOffice || '').toLowerCase();
        const targetImo = locationFilter.imo.toLowerCase();
        if (repImo && !repImo.includes(targetImo) && !targetImo.includes(repImo)) {
          return;
        }
      }

      // 3. Filter by NIS
      if (locationFilter?.nis && locationFilter.nis !== 'All NIS') {
        const repNis = (report.nisBinding || '').toLowerCase();
        const targetNis = locationFilter.nis.toLowerCase();
        if (repNis && !repNis.includes(targetNis) && !targetNis.includes(repNis)) {
          return;
        }
      }

      // 4. Filter by Activity Category
      if (locationFilter?.activityCategory && locationFilter.activityCategory !== 'All Activities') {
        const act = (report.maintenanceActivity || report.operationalState || report.categoryMode || '').toLowerCase();
        const targetAct = locationFilter.activityCategory.toLowerCase();
        if (!act.includes(targetAct) && !targetAct.includes(act)) {
          return;
        }
      }

      const rLat = Number(report.lat);
      const rLng = Number(report.lng);
      const secLat = Number(report.secondLat);
      const secLng = Number(report.secondLng);

      const isTwoPoint = isValidCoord(secLat, secLng);

      if (isTwoPoint) {
        let coordsToRender: [number, number][] = [];
        if (report.pathCoords && Array.isArray(report.pathCoords) && report.pathCoords.length >= 2) {
          coordsToRender = report.pathCoords.filter(
            c => Array.isArray(c) && c.length >= 2 && isValidCoord(c[0], c[1])
          ) as [number, number][];
        }

        if (coordsToRender.length < 2 && isValidCoord(rLat, rLng)) {
          const computedPath = calculateCanalPathBetweenPoints(
            { lat: rLat, lng: rLng },
            { lat: secLat, lng: secLng },
            layers
          );
          coordsToRender = computedPath.pathCoords.filter(
            c => Array.isArray(c) && c.length >= 2 && isValidCoord(c[0], c[1])
          ) as [number, number][];
        }

        if (coordsToRender.length >= 2) {
          // Contrast dark casing polyline underneath (Purely decorative, non-interactive)
          const casing = L.polyline(coordsToRender, {
            color: '#0f172a',
            weight: 9,
            opacity: 0.9,
            interactive: false,
            pane: 'reportsPane'
          });
          reportsLayerGroupRef.current?.addLayer(casing);

          // Top colored polyline path (Interactive)
          const polyline = L.polyline(coordsToRender, {
            color: reportColor,
            weight: 6,
            opacity: 0.95,
            dashArray: report.status === 'In Progress' ? '6, 6' : undefined,
            interactive: true,
            pane: 'reportsPane'
          });
          polyline.on('click', (e: any) => {
            if (e && e.originalEvent) L.DomEvent.stopPropagation(e);
            if (isMapPickerActiveRef.current) return;
            onSelectReportRef.current?.(report);
          });
          polyline.on('mouseover', () => { if (containerRef.current) containerRef.current.style.cursor = 'pointer'; });
          polyline.on('mouseout', () => { if (containerRef.current) containerRef.current.style.cursor = isMapPickerActiveRef.current ? 'crosshair' : 'default'; });
          reportsLayerGroupRef.current?.addLayer(polyline);
        }

        // Draw Point 2 Marker
        const secondMarker = L.circleMarker([secLat, secLng], {
          radius: 6,
          fillColor: reportColor,
          color: '#0f172a',
          weight: 2,
          fillOpacity: 1,
          interactive: true,
          pane: 'reportsPane'
        });
        secondMarker.on('click', (e: any) => {
          if (e && e.originalEvent) L.DomEvent.stopPropagation(e);
          if (isMapPickerActiveRef.current) return;
          onSelectReportRef.current?.(report);
        });
        secondMarker.on('mouseover', () => { if (containerRef.current) containerRef.current.style.cursor = 'pointer'; });
        secondMarker.on('mouseout', () => { if (containerRef.current) containerRef.current.style.cursor = isMapPickerActiveRef.current ? 'crosshair' : 'default'; });
        reportsLayerGroupRef.current?.addLayer(secondMarker);
      }

      // Draw Point 1 Marker
      if (isValidCoord(rLat, rLng)) {
        const reportMarker = L.circleMarker([rLat, rLng], {
          radius: 7,
          fillColor: reportColor,
          color: '#ffffff',
          weight: 2,
          fillOpacity: 1,
          interactive: true,
          pane: 'reportsPane'
        });
        reportMarker.on('click', (e: any) => {
          if (e && e.originalEvent) L.DomEvent.stopPropagation(e);
          if (isMapPickerActiveRef.current) return;
          onSelectReportRef.current?.(report);
        });
        reportMarker.on('mouseover', () => { if (containerRef.current) containerRef.current.style.cursor = 'pointer'; });
        reportMarker.on('mouseout', () => { if (containerRef.current) containerRef.current.style.cursor = isMapPickerActiveRef.current ? 'crosshair' : 'default'; });
        reportsLayerGroupRef.current?.addLayer(reportMarker);
      }
    });
  }, [fieldReports, layers, locationFilter?.imo, locationFilter?.nis, locationFilter?.activityCategory]);

  // Synchronize dynamic tool cursor modes (e.g. crosshair for Pin / Measurements / Map Picker)
  useEffect(() => {
    if (!containerRef.current) return;
    if (activeMeasureTool !== 'none' || isMapPickerActive) {
      containerRef.current.style.cursor = 'crosshair';
    } else {
      containerRef.current.style.cursor = 'default';
    }
  }, [activeMeasureTool, isMapPickerActive]);

  // Parcel & Feature Border Highlight Effect (Triggers when selectedFeatureProps or activePopupProps changes)
  useEffect(() => {
    const targetProps = selectedFeatureProps || activePopupProps;

    // If no targetProps active, revert highlighted layer if any
    if (!targetProps) {
      clearFeatureHighlight();
      return;
    }

    // Check if current highlighted layer already matches targetProps
    if (highlightedLayerRef.current && highlightedLayerRef.current.layer) {
      const activeProps = (highlightedLayerRef.current.layer as any).feature?.properties || (highlightedLayerRef.current as any).properties;
      if (activeProps === targetProps) {
        return; // Already correctly highlighted!
      }
    }

    // Search featureMapRef for EXACT object reference match or strict unique key match
    const match = featureMapRef.current.find(item => {
      if (item.properties === targetProps) return true;
      const p1 = item.properties;
      const p2 = targetProps;
      if (!p1 || !p2) return false;

      // Match ONLY explicit unique identifier keys — NEVER match generic "Name" like "MOMARO"
      if (p1.lot_code && p2.lot_code && String(p1.lot_code) === String(p2.lot_code)) return true;
      if (p1.parcel_id && p2.parcel_id && String(p1.parcel_id) === String(p2.parcel_id)) return true;
      if (p1.canal_code && p2.canal_code && String(p1.canal_code) === String(p2.canal_code)) return true;
      if (p1.station_code && p2.station_code && String(p1.station_code) === String(p2.station_code)) return true;
      if (p1.id && p2.id && String(p1.id) === String(p2.id)) return true;
      if (p1.ID && p2.ID && String(p1.ID) === String(p2.ID)) return true;

      return false;
    });

    if (match && match.layer) {
      applyFeatureHighlight(match.layer, match.defaultStyle);
    }
  }, [selectedFeatureProps, activePopupProps]);

  // Handle Interactive Map Picking
  useEffect(() => {
    if (!mapRef.current || !pickerLayerGroupRef.current) return;

    pickerLayerGroupRef.current.clearLayers();

    if (!isMapPickerActive) return;

    const map = mapRef.current;

    // Draw active picker marker 1 if Point 1 is set
    if (isPoint1Set && pickerPt1 && isValidCoord(pickerPt1[0], pickerPt1[1])) {
      const iconPt1 = L.divIcon({
        className: 'picker-pt1-marker',
        html: `
          <div class="w-7 h-7 rounded-full bg-amber-500 border-2 border-white text-slate-950 flex items-center justify-center font-extrabold text-xs shadow-2xl animate-bounce">
            1
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });

      const marker1 = L.marker(pickerPt1, { icon: iconPt1, draggable: true, pane: 'pickerPane' });
      marker1.on('dragend', (e: any) => {
        const latlng = e.target.getLatLng();
        if (latlng && isValidCoord(latlng.lat, latlng.lng)) {
          handleSetPoint1([latlng.lat, latlng.lng]);
        }
      });
      pickerLayerGroupRef.current.addLayer(marker1);
    }

    // Draw active picker marker 2 & path if Point 2 is set
    if (isPoint1Set && isPoint2Set && pickerPt1 && pickerPt2 && isValidCoord(pickerPt1[0], pickerPt1[1]) && isValidCoord(pickerPt2[0], pickerPt2[1])) {
      const iconPt2 = L.divIcon({
        className: 'picker-pt2-marker',
        html: `
          <div class="w-7 h-7 rounded-full bg-cyan-500 border-2 border-white text-slate-950 flex items-center justify-center font-extrabold text-xs shadow-2xl animate-bounce">
            2
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });

      const marker2 = L.marker(pickerPt2, { icon: iconPt2, draggable: true, pane: 'pickerPane' });
      marker2.on('dragend', (e: any) => {
        const latlng = e.target.getLatLng();
        if (latlng && isValidCoord(latlng.lat, latlng.lng)) {
          handleSetPoint2([latlng.lat, latlng.lng]);
        }
      });
      pickerLayerGroupRef.current.addLayer(marker2);

      // Polyline connecting Pt 1 and Pt 2 (drawn directly from pickerPathResult without rerunning Dijkstra)
      const rawCoords = pickerPathResult?.pathCoords;
      const validPathCoords = rawCoords && rawCoords.length >= 2
        ? rawCoords.filter(c => Array.isArray(c) && c.length >= 2 && isValidCoord(c[0], c[1]))
        : [pickerPt1, pickerPt2];

      if (validPathCoords.length >= 2) {
        const pathPolyline = L.polyline(validPathCoords, {
          color: '#f59e0b',
          weight: 5,
          dashArray: '6, 6',
          pane: 'pickerPane'
        });
        pickerLayerGroupRef.current.addLayer(pathPolyline);
      }
    }

    // Direct 2-Click UX (Option 3): 1st click sets Point 1, 2nd click sets Point 2 instantly
    const handlePickerMapClick = (e: L.LeafletMouseEvent) => {
      if (!e || !e.latlng || !isValidCoord(e.latlng.lat, e.latlng.lng)) return;
      const coords: [number, number] = [e.latlng.lat, e.latlng.lng];

      const isPt1Set = isPoint1SetRef.current && pickerPt1Ref.current && isValidCoord(pickerPt1Ref.current[0], pickerPt1Ref.current[1]);
      if (!isPt1Set) {
        handleSetPoint1(coords);
      } else {
        handleSetPoint2(coords);
      }
    };

    map.on('click', handlePickerMapClick);

    return () => {
      map.off('click', handlePickerMapClick);
    };
  }, [isMapPickerActive, isPoint1Set, isPoint2Set, pickerPt1, pickerPt2, pickerPathResult]);

  const handleConfirmPick = () => {
    if (!isPoint1Set || !pickerPt1) return;
    if (onConfirmMapPick) {
      onConfirmMapPick({
        lat1: pickerPt1[0],
        lng1: pickerPt1[1],
        lat2: isPoint2Set && pickerPt2 ? pickerPt2[0] : undefined,
        lng2: isPoint2Set && pickerPt2 ? pickerPt2[1] : undefined,
        locationName: pickerLocationName,
        canalCode: pickerCanalCode,
        parcelId: pickerParcelId
      });
    }
    setIsPoint1Set(false);
    setIsPoint2Set(false);
  };

  const handleCancelPick = () => {
    setIsPoint1Set(false);
    setIsPoint2Set(false);
    if (onCancelMapPick) {
      onCancelMapPick();
    }
  };

  const handleUseCurrentGpsInPicker = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          if (isValidCoord(lat, lng)) {
            if (!isPoint1Set) {
              handleSetPoint1([lat, lng]);
            } else {
              handleSetPoint2([lat, lng]);
            }
            mapRef.current?.flyTo([lat, lng], 16);
          }
        },
        (err) => console.warn(err)
      );
    }
  };

  // Spatial Measurement Tool Event Handlers
  useEffect(() => {
    if (!mapRef.current || activeMeasureTool === 'none') {
      if (measureLayerGroupRef.current) measureLayerGroupRef.current.clearLayers();
      setMeasureCoords(prev => (prev.length > 0 ? [] : prev));
      setMeasurementResult(prev => (prev !== null ? null : prev));
      return;
    }

    const map = mapRef.current;

    const handleMapClick = (e: L.LeafletMouseEvent) => {
      if (!e || !e.latlng || !isValidCoord(e.latlng.lat, e.latlng.lng)) return;
      const newCoord: [number, number] = [e.latlng.lat, e.latlng.lng];

      if (activeMeasureTool === 'pin') {
        onTriggerReportFromMap(e.latlng.lat, e.latlng.lng);
        setActiveMeasureTool('none');
        return;
      }

      const updatedCoords = [...measureCoords, newCoord].filter(c => isValidCoord(c[0], c[1]));
      setMeasureCoords(updatedCoords);

      if (!measureLayerGroupRef.current) return;
      measureLayerGroupRef.current.clearLayers();

      if (activeMeasureTool === 'distance' && updatedCoords.length >= 1) {
        const latLngs = updatedCoords.map(c => L.latLng(c[0], c[1]));
        const polyline = L.polyline(latLngs, { color: '#38bdf8', weight: 4, dashArray: '6, 6' });
        measureLayerGroupRef.current.addLayer(polyline);

        updatedCoords.forEach((c) => {
          const vertexMarker = L.circleMarker(c, { radius: 4, color: '#38bdf8', fillColor: '#0f172a', fillOpacity: 1 });
          measureLayerGroupRef.current?.addLayer(vertexMarker);
        });

        let totalMeters = 0;
        for (let i = 0; i < updatedCoords.length - 1; i++) {
          totalMeters += L.latLng(updatedCoords[i]).distanceTo(L.latLng(updatedCoords[i + 1]));
        }

        setMeasurementResult({
          type: 'distance',
          coordinates: updatedCoords,
          distanceMeters: Math.round(totalMeters)
        });
      } else if (activeMeasureTool === 'area' && updatedCoords.length >= 3) {
        const latLngs = updatedCoords.map(c => L.latLng(c[0], c[1]));
        const polygon = L.polygon(latLngs, { color: '#10b981', weight: 3, fillColor: '#10b981', fillOpacity: 0.25 });
        measureLayerGroupRef.current.addLayer(polygon);

        const areaSqMeters = calculatePolygonArea(updatedCoords);
        setMeasurementResult({
          type: 'area',
          coordinates: updatedCoords,
          areaSqMeters: Math.round(areaSqMeters)
        });
      } else if (activeMeasureTool === 'radius' && updatedCoords.length >= 1) {
        const center = updatedCoords[0];
        const circle = L.circle(center, { radius: radiusMeters, color: '#f59e0b', weight: 2, fillColor: '#f59e0b', fillOpacity: 0.15 });
        measureLayerGroupRef.current.addLayer(circle);

        setMeasurementResult({
          type: 'radius',
          coordinates: [center],
          radiusMeters
        });
      }
    };

    map.on('click', handleMapClick);

    return () => {
      map.off('click', handleMapClick);
    };
  }, [activeMeasureTool, measureCoords, radiusMeters, onTriggerReportFromMap]);

  const calculatePolygonArea = (coords: [number, number][]): number => {
    if (coords.length < 3) return 0;
    const RADIUS = 6378137;
    let area = 0;

    for (let i = 0; i < coords.length; i++) {
      const p1 = coords[i];
      const p2 = coords[(i + 1) % coords.length];
      const rad1Lat = (p1[0] * Math.PI) / 180;
      const rad2Lat = (p2[0] * Math.PI) / 180;
      const rad1Lng = (p1[1] * Math.PI) / 180;
      const rad2Lng = (p2[1] * Math.PI) / 180;

      area += (rad2Lng - rad1Lng) * (2 + Math.sin(rad1Lat) + Math.sin(rad2Lat));
    }

    area = (Math.abs(area) * RADIUS * RADIUS) / 2;
    return area;
  };

  const pathDistanceMeters = pickerPathResult?.distanceMeters ?? (
    isPoint1Set && isPoint2Set && pickerPt1 && pickerPt2
      ? Math.round(haversineDistanceMeters(pickerPt1[0], pickerPt1[1], pickerPt2[0], pickerPt2[1]))
      : 0
  );

  const formattedDistanceStr = React.useMemo(() => {
    if (pathDistanceMeters <= 0) return '';
    if (pathDistanceMeters >= 1000) {
      return `${(pathDistanceMeters / 1000).toFixed(2)} km (${pathDistanceMeters.toLocaleString()} m)`;
    }
    return `${pathDistanceMeters.toLocaleString()} meters`;
  }, [pathDistanceMeters]);

  return (
    <div className="relative w-full h-full min-h-screen bg-slate-950 overflow-hidden">
      {/* Leaflet Map Canvas Container */}
      <div ref={containerRef} className="w-full h-full z-0" />

      {/* Floating Location Setting Panel (Bottom Center) */}
      {isMapPickerActive && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 bg-slate-900/95 backdrop-blur-xl border border-cyan-500/50 p-3.5 rounded-2xl shadow-2xl flex flex-col md:flex-row items-center justify-between gap-3 max-w-3xl w-[94%] animate-in slide-in-from-bottom-6">
          <div className="flex items-center gap-2.5 overflow-hidden w-full md:w-auto flex-1">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shrink-0">
              <MapPin className="w-5 h-5 animate-pulse" />
            </div>
            <div className="min-w-0 space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black text-cyan-400 uppercase tracking-widest block">
                  Location Selector Mode
                </span>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  {isPoint1Set && isPoint2Set ? '2-Point Segment Mode' : isPoint1Set ? 'Point 1 Set (Click for Pt 2)' : 'Click map to set Point 1'}
                </span>
                {isPoint1Set && isPoint2Set && formattedDistanceStr && (
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono flex items-center gap-1">
                    <Ruler className="w-3 h-3 text-amber-400" />
                    Distance: {formattedDistanceStr}
                  </span>
                )}
              </div>
              <p className="text-xs font-bold text-white truncate">
                {pickerLocationName || 'Click anywhere on map to drop Pin 1'}
              </p>
              <p className="text-[11px] font-medium text-cyan-300/90 leading-tight">
                {isPoint1Set && isPoint2Set
                  ? '💡 Drag pins 1 & 2 on map to fine-tune endpoints, or click to reposition Point 2.'
                  : isPoint1Set
                  ? '💡 Point 1 placed! Click anywhere along canal to set Point 2 (or drag pin 1).'
                  : '💡 Click anywhere on map to drop Point 1 immediately.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto shrink-0 justify-end">
            {/* Clear Point 2 Button */}
            {isPoint2Set && (
              <button
                type="button"
                onClick={handleClearPoint2}
                className="px-2.5 py-2 bg-slate-800 hover:bg-slate-700 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                title="Revert to single-point mode"
              >
                <span>Clear Pt 2</span>
              </button>
            )}

            {/* Reset Points Button */}
            {isPoint1Set && (
              <button
                type="button"
                onClick={handleResetPoints}
                className="px-2.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                title="Clear all points and start fresh"
              >
                <span>Reset</span>
              </button>
            )}

            {/* Accept Button */}
            <button
              type="button"
              onClick={handleConfirmPick}
              disabled={!isPoint1Set}
              className={`px-4 py-2.5 rounded-xl text-xs font-black shadow transition flex items-center justify-center gap-1.5 cursor-pointer ${
                isPoint1Set
                  ? 'bg-[#009933] hover:bg-[#00802b] text-white shadow-sm border border-[#00802b]/50 active:scale-95'
                  : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Accept Location</span>
            </button>

            {/* Cancel Button */}
            <button
              type="button"
              onClick={handleCancelPick}
              className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
            >
              <X className="w-4 h-4 text-slate-400" />
              <span>Cancel</span>
            </button>
          </div>
        </div>
      )}

      {/* Floating Map Status Overlay: Downloading & Parsing Drive GIS Data */}
      {isSyncingDrive && (
        <div className="absolute top-20 right-4 z-30 bg-slate-900/95 backdrop-blur-md border border-[#009933]/40 text-[#009933] px-3.5 py-2 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs font-bold animate-in fade-in slide-in-from-top-2">
          <div className="w-4 h-4 border-2 border-[#009933] border-t-transparent rounded-full animate-spin shrink-0" />
          <div className="flex flex-col text-left leading-tight">
            <span className="text-[10px] text-slate-400 font-normal">Syncing Google Drive GIS...</span>
            <span className="text-xs font-bold text-[#009933]">
              Downloading &amp; Parsing {syncProgress ? `(${syncProgress.current}/${syncProgress.total})` : ''}
            </span>
          </div>
        </div>
      )}

      {/* Bottom-Right Navigation & Zoom Controls Stack (Positioned comfortably above mobile bottom bar) */}
      <div className="absolute bottom-20 md:bottom-6 right-3 md:right-4 z-20 flex flex-col items-center gap-2 select-none pointer-events-auto">
        {/* "Your Location" Current Position Button */}
        <button
          type="button"
          onClick={handleFlyToUserLocation}
          className="w-10 h-10 bg-slate-900/95 hover:bg-slate-800 active:scale-95 text-[#009933] hover:text-[#00802b] border border-slate-700/80 rounded-xl shadow-2xl transition flex items-center justify-center cursor-pointer group"
          title="Your Location (Find current GPS position)"
        >
          <Crosshair className="w-5 h-5 text-[#009933] group-hover:rotate-45 transition-transform duration-200" />
        </button>

        {/* Zoom In & Zoom Out Segmented Stack (Exact Same Width as Current Position) */}
        <div className="w-10 flex flex-col rounded-xl overflow-hidden border border-slate-700/80 bg-slate-900/95 shadow-2xl">
          <button
            type="button"
            onClick={() => mapRef.current?.zoomIn()}
            className="w-full h-10 hover:bg-slate-800 active:scale-95 text-slate-200 hover:text-[#009933] transition flex items-center justify-center cursor-pointer border-b border-slate-800"
            title="Zoom in"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => mapRef.current?.zoomOut()}
            className="w-full h-10 hover:bg-slate-800 active:scale-95 text-slate-200 hover:text-[#009933] transition flex items-center justify-center cursor-pointer"
            title="Zoom out"
          >
            <Minus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Reduced Compact Basemap Switcher Widget (Positioned comfortably above mobile bottom bar) */}
      {(() => {
        const BASEMAP_OPTIONS: { id: BasemapType; label: string; icon: React.ReactNode }[] = [
          { id: 'satellite', label: 'Satellite', icon: <Globe className="w-3.5 h-3.5 text-[#009933]" /> },
          { id: 'dark', label: 'Dark Vector', icon: <Moon className="w-3.5 h-3.5 text-indigo-400" /> },
          { id: 'streets', label: 'Streets', icon: <Sun className="w-3.5 h-3.5 text-amber-400" /> }
        ];
        const activeOpt = BASEMAP_OPTIONS.find(b => b.id === basemap) || BASEMAP_OPTIONS[0];

        return (
          <div 
            className="absolute bottom-20 md:bottom-6 left-3 md:left-4 z-20"
            onMouseEnter={() => setIsBasemapExpanded(true)}
            onMouseLeave={() => setIsBasemapExpanded(false)}
          >
            {/* Popover options menu shown on hover or tap */}
            {isBasemapExpanded && (
              <div className="mb-2 bg-slate-900/95 backdrop-blur-md border border-slate-800 p-1.5 rounded-xl shadow-2xl flex flex-col gap-1 min-w-[140px] animate-in fade-in slide-in-from-bottom-2">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1 border-b border-slate-800/80 flex items-center justify-between">
                  <span>Basemap</span>
                  <span className="text-[9px] text-[#009933] font-normal">Tap to set</span>
                </div>
                {BASEMAP_OPTIONS.map((opt) => {
                  const isActive = basemap === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('🗺️ Switching Basemap to:', opt.id);
                        onBasemapChange?.(opt.id);
                        setIsBasemapExpanded(false);
                      }}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer text-left ${
                        isActive
                          ? 'bg-[#009933]/20 text-[#009933] font-bold border border-[#009933]/40 shadow-sm'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      {opt.icon}
                      <span className="flex-1">{opt.label}</span>
                      {isActive && <div className="w-1.5 h-1.5 rounded-full bg-[#009933] shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Compact Collapsed Button */}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsBasemapExpanded(!isBasemapExpanded);
              }}
              className="flex items-center gap-2 bg-slate-900/90 hover:bg-slate-800/90 backdrop-blur-md border border-slate-800 px-2.5 py-1.5 rounded-xl shadow-2xl text-xs font-semibold text-slate-200 transition cursor-pointer active:scale-95 group"
              title="Change Map Basemap (Satellite, Dark, Streets)"
            >
              <div className="p-1 rounded-md bg-slate-800 border border-slate-700/80 group-hover:border-[#009933]/40 transition shrink-0">
                {activeOpt.icon}
              </div>
              <div className="flex flex-col text-left leading-tight">
                <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Basemap</span>
                <span className="text-xs font-bold text-white">{activeOpt.label}</span>
              </div>
              <ChevronUp className={`w-3.5 h-3.5 text-slate-400 ml-1 transition-transform duration-200 ${isBasemapExpanded ? 'rotate-180 text-[#009933]' : ''}`} />
            </button>
          </div>
        );
      })()}

      {/* CAD/GIS Dynamic Elbow Leader Line Overlay */}
      <svg
        ref={leaderLineSvgRef}
        className="absolute inset-0 w-full h-full pointer-events-none z-[690] overflow-visible"
        style={{ display: activePopupCoords ? 'block' : 'none' }}
      >
        <path
          ref={leaderLinePathRef}
          d=""
          fill="none"
          stroke="#ffffff"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ filter: 'drop-shadow(0 0 3px rgba(0, 0, 0, 0.8))' }}
        />
      </svg>
    </div>
  );
};

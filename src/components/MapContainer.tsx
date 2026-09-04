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
import { detectNearestGISFeature, calculateCanalPathBetweenPoints, getFeatureName, haversineDistanceMeters } from '../utils/gisLocationUtils';
import { getIsoWeekInfo } from '../utils/weekUtils';
import { 
  STRUCTURE_BLUE_COLOR, 
  getActivityColor, 
  MAINTENANCE_ACTIVITY_CONFIG, 
  OPERATIONAL_STATE_CONFIG 
} from '../utils/activityColors';
import { 
  classifyVectorItem, 
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
  const [activePopupCoords, setActivePopupCoords] = useState<[number, number] | null>(null);
  const [activePopupProps, setActivePopupProps] = useState<any>(null);

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

  useEffect(() => { isMapPickerActiveRef.current = isMapPickerActive; }, [isMapPickerActive]);
  useEffect(() => { isPoint1SetRef.current = isPoint1Set; }, [isPoint1Set]);
  useEffect(() => { isPoint2SetRef.current = isPoint2Set; }, [isPoint2Set]);
  useEffect(() => { pickerPt1Ref.current = pickerPt1; }, [pickerPt1]);
  useEffect(() => { pickerPt2Ref.current = pickerPt2; }, [pickerPt2]);
  useEffect(() => { activePopupCoordsRef.current = activePopupCoords; }, [activePopupCoords]);
  useEffect(() => { activePopupPropsRef.current = activePopupProps; }, [activePopupProps]);

  // Update picker state when initial coordinates change
  useEffect(() => {
    if (isMapPickerActive) {
      if (isValidCoord(initialPickerLat1, initialPickerLng1)) {
        setPickerPt1([Number(initialPickerLat1), Number(initialPickerLng1)]);
        setIsPoint1Set(true);
      } else {
        setPickerPt1(undefined);
        setIsPoint1Set(false);
      }
      if (isValidCoord(initialPickerLat2, initialPickerLng2)) {
        setPickerPt2([Number(initialPickerLat2), Number(initialPickerLng2)]);
        setIsPoint2Set(true);
      } else {
        setPickerPt2(undefined);
        setIsPoint2Set(false);
      }
    } else {
      setPickerPt1(undefined);
      setPickerPt2(undefined);
      setIsPoint1Set(false);
      setIsPoint2Set(false);
      setPickerLocationName('');
    }
  }, [isMapPickerActive, initialPickerLat1, initialPickerLng1, initialPickerLat2, initialPickerLng2]);

  // Recalculate picker location details
  useEffect(() => {
    if (!isMapPickerActive || !isPoint1Set || !pickerPt1) return;

    if (!isPoint2Set || !pickerPt2) {
      const feat = detectNearestGISFeature(pickerPt1[0], pickerPt1[1], layers);
      setPickerLocationName(feat.locationName);
      setPickerCanalCode(feat.canalCode);
      setPickerParcelId(feat.parcelId);
    } else {
      const pathRes = calculateCanalPathBetweenPoints(
        { lat: pickerPt1[0], lng: pickerPt1[1] },
        { lat: pickerPt2[0], lng: pickerPt2[1] },
        layers
      );
      setPickerLocationName(pathRes.locationName);
      setPickerCanalCode(pathRes.canalCode);
      setPickerParcelId(pathRes.parcelId);
    }
  }, [pickerPt1, pickerPt2, isPoint1Set, isPoint2Set, isMapPickerActive, layers]);

  const point1PropsRef = useRef<any>(null);
  const point2PropsRef = useRef<any>(null);

  const handleClearPoint2 = () => {
    setIsPoint2Set(false);
    setPickerPt2(null);
    isPoint2SetRef.current = false;
    pickerPt2Ref.current = null;
    point2PropsRef.current = null;
    if (pickerPt1Ref.current) {
      const feat = detectNearestGISFeature(pickerPt1Ref.current[0], pickerPt1Ref.current[1], layers);
      const customName = point1PropsRef.current ? getFeatureName(point1PropsRef.current, '') : '';
      setPickerLocationName(customName || feat.locationName);
      setPickerCanalCode(point1PropsRef.current?.canal_code || feat.canalCode);
      setPickerParcelId(point1PropsRef.current?.parcel_id || feat.parcelId);
    }
  };

  const handleSetPoint1 = (coords: [number, number], featureProps?: any) => {
    if (!coords || !isValidCoord(coords[0], coords[1])) return;
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

    if (isPoint2SetRef.current && pickerPt2Ref.current) {
      const pathRes = calculateCanalPathBetweenPoints(
        { lat: coords[0], lng: coords[1] },
        { lat: pickerPt2Ref.current[0], lng: pickerPt2Ref.current[1] },
        layers,
        featureProps || point1PropsRef.current,
        point2PropsRef.current
      );
      setPickerLocationName(pathRes.locationName);
      setPickerCanalCode(pathRes.canalCode);
      setPickerParcelId(pathRes.parcelId);
    } else {
      const feat = detectNearestGISFeature(coords[0], coords[1], layers);
      const customName = featureProps ? getFeatureName(featureProps, '') : '';
      const name = customName || feat.locationName;
      setPickerLocationName(name);
      setPickerCanalCode(featureProps?.canal_code || feat.canalCode);
      setPickerParcelId(featureProps?.parcel_id || feat.parcelId);
    }
  };

  const handleSetPoint2 = (coords: [number, number], featureProps?: any) => {
    if (!coords || !isValidCoord(coords[0], coords[1])) return;
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
    } else {
      const pathRes = calculateCanalPathBetweenPoints(
        { lat: pickerPt1Ref.current[0], lng: pickerPt1Ref.current[1] },
        { lat: coords[0], lng: coords[1] },
        layers,
        point1PropsRef.current,
        featureProps || point2PropsRef.current
      );
      setPickerLocationName(pathRes.locationName);
      setPickerCanalCode(pathRes.canalCode);
      setPickerParcelId(pathRes.parcelId);
    }
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

    // Layer Groups
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

    return () => {
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

  const onSelectFeatureRef = useRef(onSelectFeature);
  useEffect(() => { onSelectFeatureRef.current = onSelectFeature; }, [onSelectFeature]);

  const onTriggerReportFromMapRef = useRef(onTriggerReportFromMap);
  useEffect(() => { onTriggerReportFromMapRef.current = onTriggerReportFromMap; }, [onTriggerReportFromMap]);

  const onSelectReportRef = useRef(onSelectReport);
  useEffect(() => { onSelectReportRef.current = onSelectReport; }, [onSelectReport]);

  // Render Vector GIS Layers & Field Report Markers
  useEffect(() => {
    if (!mapRef.current || !layerGroupRef.current) return;

    layerGroupRef.current.clearLayers();
    if (pointsLayerGroupRef.current) {
      pointsLayerGroupRef.current.clearLayers();
    }
    featureMapRef.current = [];
    if (highlightedLayerRef.current) {
      highlightedLayerRef.current = null;
    }

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
      if (!layer.visible || !layer.data) return;

      const isCanalLayer = layer.category === 'Canals' || layer.category === 'Canal Networks' || layer.geometryType === 'LineString' || layer.name.toLowerCase().includes('canal');
      const isStructureLayer = layer.category === 'Structures' || layer.geometryType === 'Point' || layer.name.toLowerCase().includes('structure');

      try {
        const geoJsonLayer = L.geoJSON(layer.data, {
          filter: (feature: any) => {
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
              layer.geometryType
            );

            const opacity = layer.opacity ?? (itemStyle.isStructure ? 1.0 : itemStyle.opacity);
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
              return L.circleMarker([13.1, 121.3], { radius: 0, opacity: 0, fillOpacity: 0, interactive: false });
            }

            // Structures guaranteed in Azure Blue (#0284c7) with solid white border ring
            const markerColor = BLUE_PALETTE.STRUCTURE;
            const stationCode = feature.properties?.Name || feature.properties?.name || feature.properties?.NAME || feature.properties?.canal_name || feature.properties?.station_name || feature.properties?.station_code || 'STRUCTURE';

            // Point marker with crisp 2px solid white border ring
            const circleMarker = L.circleMarker(latlng, {
              radius: 6,
              fillColor: markerColor,
              color: '#ffffff', // Crisp solid white border ring
              weight: 2.0,
              fillOpacity: 1.0,
              opacity: 1.0,
              interactive: true
            });
            circleMarker.bindTooltip(stationCode, { direction: 'top', opacity: 0.9, className: 'custom-map-tooltip' });
            return circleMarker;
          },
          onEachFeature: (feature, leafletLayer) => {
            const props = feature.properties || {};

            const itemStyle = classifyVectorItem(
              layer.name,
              layer.category,
              layer.subCategory,
              props,
              layer.geometryType
            );

            const defaultColor = props?.status === 'Completed' ? '#10b981'
              : (props?.status === 'Delayed' || props?.priority === 'Critical') ? '#ef4444'
              : props?.status === 'Inspection Required' ? '#f59e0b'
              : itemStyle.color;

            const defaultWeight = itemStyle.weight;
            const defaultOpacity = layer.opacity ?? (itemStyle.isStructure ? 1.0 : itemStyle.opacity);

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
              if (e && e.originalEvent) {
                L.DomEvent.stopPropagation(e);
              }
              if (isMapPickerActiveRef.current) {
                const isPt1Set = isPoint1SetRef.current && pickerPt1Ref.current && isValidCoord(pickerPt1Ref.current[0], pickerPt1Ref.current[1]);
                if (!isPt1Set) {
                  // Automatic direct assignment of Point 1 on first click without prompt
                  const curLatlng = e.latlng || (typeof (leafletLayer as any).getLatLng === 'function' ? (leafletLayer as any).getLatLng() : null);
                  if (curLatlng && isValidCoord(curLatlng.lat, curLatlng.lng)) {
                    handleSetPoint1([curLatlng.lat, curLatlng.lng], props);
                    leafletLayer.closePopup();
                    return;
                  }
                }
              }
            });

            // LAZY ON-DEMAND POPUP: Generates HTML only when the user clicks this exact feature!
            leafletLayer.bindPopup(() => {
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

              const nameVal = getAttrVal(['Name', 'name', 'NAME', 'canal_name', 'station_name', 'title', 'Title', 'label']);
              const descVal = getAttrVal(['Description', 'description', 'DESCRIPTION', 'desc', 'Desc', 'remarks', 'Remarks']);

              return `
                <div class="p-3 space-y-2 min-w-[220px] max-w-sm font-sans text-xs text-slate-200">
                  <div class="border-b border-slate-700 pb-1.5">
                    <span class="font-bold text-xs text-cyan-400 leading-snug break-words block">
                      ${nameVal !== '[blank]' ? nameVal : 'Layer Attributes'}
                    </span>
                  </div>
                  ${descVal !== '[blank]' ? `
                    <div class="space-y-1 bg-slate-950/80 p-2 rounded-lg border border-slate-800 text-[11px]">
                      <div class="flex justify-between gap-2 items-start">
                        <span class="text-slate-400 font-medium shrink-0">Description:</span>
                        <span class="font-semibold text-white break-words text-right leading-tight">${descVal}</span>
                      </div>
                    </div>
                  ` : ''}
                  <div class="flex flex-col gap-1.5 mt-2">
                    <button id="inspect-btn-${inspectId}" class="w-full bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white text-xs font-bold py-1.5 px-3 rounded-lg shadow-md transition flex items-center justify-center gap-1 cursor-pointer">
                      Inspect Attribute Details
                    </button>
                    ${!isMapPickerActiveRef.current ? `
                      <button id="create-report-btn-${inspectId}" class="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-1.5 px-3 rounded-lg shadow-md transition flex items-center justify-center gap-1 cursor-pointer">
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

            leafletLayer.on('popupclose', () => {
              try {
                if (leafletLayer && typeof (leafletLayer as any).setStyle === 'function') {
                  (leafletLayer as any).setStyle(defaultStyle);
                }
              } catch (err) {}
              if (highlightedLayerRef.current?.layer === leafletLayer) {
                highlightedLayerRef.current = null;
              }
              setActivePopupProps(null);
              setActivePopupCoords(null);
            });

            leafletLayer.on('popupopen', (e) => {
              const inspectId = (leafletLayer as any)._activeInspectId;
              // Revert previous highlighted layer if different
              if (highlightedLayerRef.current && highlightedLayerRef.current.layer !== leafletLayer) {
                try {
                  const { layer: prevLayer, defaultStyle: prevStyle } = highlightedLayerRef.current;
                  if (prevLayer && typeof prevLayer.setStyle === 'function') {
                    prevLayer.setStyle(prevStyle);
                  }
                } catch (err) {}
              }

              // Highlight THIS EXACT clicked Leaflet vector layer directly!
              try {
                if (leafletLayer && typeof (leafletLayer as any).setStyle === 'function') {
                  (leafletLayer as any).setStyle({
                    color: '#38bdf8', // Glowing cyan border stroke
                    weight: 4.5,
                    opacity: 1.0
                  });
                  if (typeof (leafletLayer as any).bringToFront === 'function') {
                    (leafletLayer as any).bringToFront();
                  }
                }
                highlightedLayerRef.current = { layer: leafletLayer, defaultStyle };
              } catch (err) {}

              const latlng = e.popup?.getLatLng();
              if (latlng) {
                setActivePopupCoords([latlng.lat, latlng.lng]);
                setActivePopupProps(props);
              }
              const btn = document.getElementById(`inspect-btn-${inspectId}`);
              if (btn) {
                btn.onclick = (evt) => {
                  evt.stopPropagation();
                  const curLatlng = e.popup?.getLatLng();
                  if (curLatlng) {
                    onSelectFeatureRef.current?.(props, layer.category, [curLatlng.lat, curLatlng.lng]);
                    e.popup?.close();
                  }
                };
              }
              const createReportBtn = document.getElementById(`create-report-btn-${inspectId}`);
              if (createReportBtn) {
                createReportBtn.onclick = (evt) => {
                  evt.stopPropagation();
                  const curLatlng = e.popup?.getLatLng();
                  if (curLatlng) {
                    onTriggerReportFromMapRef.current?.(curLatlng.lat, curLatlng.lng);
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
            interactive: false
          });
          reportsLayerGroupRef.current?.addLayer(casing);

          // Top colored polyline path (Interactive)
          const polyline = L.polyline(coordsToRender, {
            color: reportColor,
            weight: 6,
            opacity: 0.95,
            dashArray: report.status === 'In Progress' ? '6, 6' : undefined,
            interactive: true
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
          interactive: true
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
          interactive: true
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
      if (highlightedLayerRef.current) {
        try {
          const { layer, defaultStyle } = highlightedLayerRef.current;
          if (layer && typeof layer.setStyle === 'function') {
            layer.setStyle(defaultStyle);
          }
        } catch (e) {}
        highlightedLayerRef.current = null;
      }
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
      if (highlightedLayerRef.current && highlightedLayerRef.current.layer !== match.layer) {
        try {
          const { layer, defaultStyle } = highlightedLayerRef.current;
          if (layer && typeof layer.setStyle === 'function') {
            layer.setStyle(defaultStyle);
          }
        } catch (e) {}
      }

      try {
        if (typeof match.layer.setStyle === 'function') {
          match.layer.setStyle({
            color: '#38bdf8',
            weight: 4.5,
            opacity: 1.0
          });
          if (typeof match.layer.bringToFront === 'function') {
            match.layer.bringToFront();
          }
        }
        highlightedLayerRef.current = match;
      } catch (err) {
        console.warn('Error applying border highlight style:', err);
      }
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

      const marker1 = L.marker(pickerPt1, { icon: iconPt1, draggable: true });
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

      const marker2 = L.marker(pickerPt2, { icon: iconPt2, draggable: true });
      marker2.on('dragend', (e: any) => {
        const latlng = e.target.getLatLng();
        if (latlng && isValidCoord(latlng.lat, latlng.lng)) {
          handleSetPoint2([latlng.lat, latlng.lng]);
        }
      });
      pickerLayerGroupRef.current.addLayer(marker2);

      // Path connecting Pt 1 and Pt 2
      const pathRes = calculateCanalPathBetweenPoints(
        { lat: pickerPt1[0], lng: pickerPt1[1] },
        { lat: pickerPt2[0], lng: pickerPt2[1] },
        layers
      );

      const validPathCoords = pathRes.pathCoords.filter(
        c => Array.isArray(c) && c.length >= 2 && isValidCoord(c[0], c[1])
      );

      if (validPathCoords.length >= 2) {
        const pathPolyline = L.polyline(validPathCoords, {
          color: '#f59e0b',
          weight: 5,
          dashArray: '6, 6'
        });
        pickerLayerGroupRef.current.addLayer(pathPolyline);
      }
    }

    // Map click listener to set Point 1 directly or open popup for Point 2
    const handlePickerMapClick = (e: L.LeafletMouseEvent) => {
      if (!e || !e.latlng || !isValidCoord(e.latlng.lat, e.latlng.lng)) return;
      const nearestFeat = detectNearestGISFeature(e.latlng.lat, e.latlng.lng, layers);

      // Check if Point 1 is already set
      const isPt1Set = isPoint1SetRef.current && pickerPt1Ref.current && isValidCoord(pickerPt1Ref.current[0], pickerPt1Ref.current[1]);
      if (!isPt1Set) {
        // Automatic assignment on 1st click: directly set Point 1 without showing popup
        handleSetPoint1([e.latlng.lat, e.latlng.lng], nearestFeat);
        return;
      }

      // Subsequent clicks: open popup with Set Point 1 / Set Point 2 options
      const popupId = Math.random().toString(36).substring(2, 9);
      setActivePopupCoords([e.latlng.lat, e.latlng.lng]);
      setActivePopupProps(nearestFeat);

      if (mapRef.current) {
        mapRef.current.panTo(e.latlng);
      }

      const mapPopupContent = `
        <div class="p-3 space-y-2 min-w-[220px] max-w-xs font-sans text-xs text-slate-200">
          <div class="border-b border-slate-700 pb-1.5 flex items-center justify-between gap-2">
            <span class="font-black text-xs text-cyan-400 break-words leading-tight block">
              ${nearestFeat.locationName || 'Selected Location'}
            </span>
            <span class="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-mono font-bold shrink-0">
              Sta. ${nearestFeat.stationingLabel || '0+000'}
            </span>
          </div>
          <div class="space-y-1 bg-slate-950/80 p-2 rounded-lg border border-slate-800 text-[11px]">
            <div class="flex justify-between gap-2">
              <span class="text-slate-400 font-medium">Canal/Feature:</span>
              <span class="font-bold text-amber-300 truncate">${nearestFeat.nearestFeatureName || 'Canal Network'}</span>
            </div>
            <div class="flex justify-between gap-2">
              <span class="text-slate-400 font-medium">Stationing:</span>
              <span class="font-mono font-extrabold text-cyan-400">${nearestFeat.stationingLabel || '0+000'}</span>
            </div>
            <div class="flex justify-between gap-2">
              <span class="text-slate-400 font-medium">Latitude:</span>
              <span class="font-semibold text-white font-mono">${e.latlng.lat.toFixed(6)}</span>
            </div>
            <div class="flex justify-between gap-2">
              <span class="text-slate-400 font-medium">Longitude:</span>
              <span class="font-semibold text-white font-mono">${e.latlng.lng.toFixed(6)}</span>
            </div>
          </div>
          <div class="flex flex-col gap-1.5 mt-2 pt-2 border-t border-slate-700/60">
            <button id="set-pt1-map-${popupId}" class="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-1.5 px-3 rounded-lg text-xs transition shadow cursor-pointer flex items-center justify-center gap-1">
              <span class="w-4 h-4 rounded-full bg-slate-950 text-amber-400 font-extrabold text-[10px] flex items-center justify-center">1</span>
              <span>Set Point 1</span>
            </button>
            <button id="set-pt2-map-${popupId}" class="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold py-1.5 px-3 rounded-lg text-xs transition shadow cursor-pointer flex items-center justify-center gap-1">
              <span class="w-4 h-4 rounded-full bg-slate-950 text-cyan-400 font-extrabold text-[10px] flex items-center justify-center">2</span>
              <span>Set Point 2</span>
            </button>
            ${isPoint2Set ? `
              <button id="clear-pt2-map-${popupId}" class="w-full bg-slate-800 hover:bg-slate-700 text-rose-300 font-bold py-1 px-2.5 rounded-lg text-[11px] transition cursor-pointer flex items-center justify-center gap-1 border border-slate-700">
                ✕ Clear Point 2 (Single Point Mode)
              </button>
            ` : ''}
            <div class="text-[10px] text-cyan-300/90 italic mt-0.5 text-center font-medium">
              💡 Drag pins 1 &amp; 2 on map to adjust location points
            </div>
          </div>
        </div>
      `;

      const popup = L.popup({ closeButton: true, autoClose: true })
        .setLatLng(e.latlng)
        .setContent(mapPopupContent)
        .openOn(map);

      setTimeout(() => {
        const b1 = document.getElementById(`set-pt1-map-${popupId}`);
        if (b1) {
          b1.onclick = (evt) => {
            evt.stopPropagation();
            handleSetPoint1([e.latlng.lat, e.latlng.lng], nearestFeat);
            map.closePopup();
          };
        }
        const b2 = document.getElementById(`set-pt2-map-${popupId}`);
        if (b2) {
          b2.onclick = (evt) => {
            evt.stopPropagation();
            handleSetPoint2([e.latlng.lat, e.latlng.lng], nearestFeat);
            map.closePopup();
          };
        }
        const clearPt2 = document.getElementById(`clear-pt2-map-${popupId}`);
        if (clearPt2) {
          clearPt2.onclick = (evt) => {
            evt.stopPropagation();
            handleClearPoint2();
            map.closePopup();
          };
        }
      }, 50);
    };

    map.on('click', handlePickerMapClick);

    return () => {
      map.off('click', handlePickerMapClick);
    };
  }, [isMapPickerActive, isPoint1Set, isPoint2Set, pickerPt1, pickerPt2, layers]);

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

  const pathDistanceMeters = React.useMemo(() => {
    if (isPoint1Set && isPoint2Set && pickerPt1 && pickerPt2) {
      const pathRes = calculateCanalPathBetweenPoints(
        { lat: pickerPt1[0], lng: pickerPt1[1] },
        { lat: pickerPt2[0], lng: pickerPt2[1] },
        layers
      );
      if (pathRes.pathCoords && pathRes.pathCoords.length > 1) {
        let total = 0;
        for (let i = 0; i < pathRes.pathCoords.length - 1; i++) {
          total += haversineDistanceMeters(
            pathRes.pathCoords[i][0], pathRes.pathCoords[i][1],
            pathRes.pathCoords[i+1][0], pathRes.pathCoords[i+1][1]
          );
        }
        return Math.round(total);
      }
      return Math.round(haversineDistanceMeters(pickerPt1[0], pickerPt1[1], pickerPt2[0], pickerPt2[1]));
    }
    return 0;
  }, [isPoint1Set, isPoint2Set, pickerPt1, pickerPt2, layers]);

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
                  {isPoint1Set && isPoint2Set ? '2-Point Segment Mode' : isPoint1Set ? 'Point 1 Set' : 'Select Location'}
                </span>
                {isPoint1Set && isPoint2Set && formattedDistanceStr && (
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono flex items-center gap-1">
                    <Ruler className="w-3 h-3 text-amber-400" />
                    Distance: {formattedDistanceStr}
                  </span>
                )}
              </div>
              <p className="text-xs font-bold text-white truncate">
                {pickerLocationName || 'Click anywhere on map to view pop-up & set points'}
              </p>
              <p className="text-[11px] font-medium text-cyan-300/90 leading-tight">
                💡 Drag pins 1 &amp; 2 on map to adjust location points. Click pop-ups to clear or set points.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto shrink-0 justify-end">
            {/* Accept Button */}
            <button
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
    </div>
  );
};

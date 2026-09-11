import { FieldReport, GISLayer, UserRole } from '../types';

const OFFLINE_REPORTS_KEY = 'geopulse_offline_field_reports_v2';
const DOWNLOADED_WEEKS_KEY = 'geopulse_downloaded_week_keys_v1';
const CACHED_LAYERS_KEY = 'geopulse_cached_gis_layers_v1';

let inMemoryReportsCache: FieldReport[] | null = null;

export function getDownloadedWeekKeys(): string[] {
  try {
    const raw = localStorage.getItem(DOWNLOADED_WEEKS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function markWeekDownloaded(weekKey: string): void {
  try {
    const current = getDownloadedWeekKeys();
    if (!current.includes(weekKey)) {
      const updated = [...current, weekKey];
      localStorage.setItem(DOWNLOADED_WEEKS_KEY, JSON.stringify(updated));
    }
  } catch (e) {}
}

export function markWeeksDownloaded(weekKeys: string[]): void {
  try {
    const current = getDownloadedWeekKeys();
    const set = new Set([...current, ...weekKeys]);
    localStorage.setItem(DOWNLOADED_WEEKS_KEY, JSON.stringify(Array.from(set)));
  } catch (e) {}
}

export function getOfflineReports(): FieldReport[] {
  if (inMemoryReportsCache !== null && inMemoryReportsCache.length > 0) {
    return inMemoryReportsCache;
  }
  try {
    const raw = localStorage.getItem(OFFLINE_REPORTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) {
      inMemoryReportsCache = parsed;
      return parsed;
    }
    inMemoryReportsCache = [];
    return [];
  } catch (err) {
    console.warn('Failed to read offline reports from localStorage', err);
    inMemoryReportsCache = [];
    return [];
  }
}

function createLightweightReports(reports: FieldReport[]): FieldReport[] {
  return (reports || []).map(r => {
    if (r.photos && Array.isArray(r.photos) && r.photos.length > 0) {
      const lightweightPhotos = r.photos.map(p => {
        if (!p) return p;
        // Keep server URLs and thumbnails intact; omit large base64 from localStorage only (IndexedDB retains full binary)
        const isLongBase64 = typeof p.url === 'string' && p.url.startsWith('data:image/') && p.url.length > 500;
        const fallbackUrl = p.driveFileId 
          ? `/api/drive/photo/${p.driveFileId}` 
          : (p.id && (p.id.length >= 20 || !p.id.startsWith('photo-')) ? `/api/drive/photo/${p.id}` : (p.thumbnailUrl || ''));
        return {
          ...p,
          url: isLongBase64 ? fallbackUrl : (p.url || fallbackUrl),
          dataUrl: undefined,
          sourceDataUrl: undefined
        };
      });
      const fallbackPhotoUrl = r.photos[0]?.driveFileId 
        ? `/api/drive/photo/${r.photos[0]?.driveFileId}` 
        : (r.photos[0]?.id && (r.photos[0]?.id.length >= 20 || !r.photos[0]?.id.startsWith('photo-')) ? `/api/drive/photo/${r.photos[0]?.id}` : undefined);
      return { 
        ...r, 
        photos: lightweightPhotos,
        photoUrl: (typeof r.photoUrl === 'string' && r.photoUrl.startsWith('data:image/') && r.photoUrl.length > 500) ? fallbackPhotoUrl : (r.photoUrl || fallbackPhotoUrl)
      };
    }
    return r;
  });
}

export function saveOfflineReports(reports: FieldReport[]): void {
  const safeReports = Array.isArray(reports) ? reports : [];
  
  // Maintain full-fidelity objects with all base64 photos in memory
  if (inMemoryReportsCache && inMemoryReportsCache.length > 0) {
    // Preserve any existing full base64 images if incoming report has empty URLs
    const memoryMap = new Map<string, FieldReport>();
    inMemoryReportsCache.forEach(mr => memoryMap.set(mr.id, mr));
    
    inMemoryReportsCache = safeReports.map(r => {
      const existing = memoryMap.get(r.id);
      if (existing && existing.photos && r.photos) {
        const mergedPhotos = r.photos.map((p, pIdx) => {
          const ep = existing.photos?.[pIdx] || existing.photos?.find(x => x.id === p.id);
          if ((!p.url || p.url === '') && ep && ep.url && ep.url.startsWith('data:image/')) {
            return { ...p, url: ep.url, dataUrl: ep.dataUrl || ep.url, sourceDataUrl: ep.sourceDataUrl };
          }
          return p;
        });
        return { ...r, photos: mergedPhotos };
      }
      return r;
    });
  } else {
    inMemoryReportsCache = safeReports;
  }

  // 1. Always save lightweight version to localStorage (prevent quota overflow)
  const lightweight = createLightweightReports(inMemoryReportsCache || safeReports);
  try {
    localStorage.setItem(OFFLINE_REPORTS_KEY, JSON.stringify(lightweight));
  } catch (err) {
    // If localStorage quota is tight, remove old cached layers to free space
    try {
      localStorage.removeItem(CACHED_LAYERS_KEY);
      localStorage.setItem(OFFLINE_REPORTS_KEY, JSON.stringify(lightweight));
    } catch (fallbackErr) {
      try {
        const unsyncedOnly = (inMemoryReportsCache || safeReports).filter(r => !r.synced);
        localStorage.setItem(OFFLINE_REPORTS_KEY, JSON.stringify(createLightweightReports(unsyncedOnly)));
      } catch (e) {}
    }
  }

  // 2. Persist full fidelity reports with all high-res photos to IndexedDB (500MB+ capacity)
  saveCachedReportsDB(inMemoryReportsCache || safeReports).catch(err => {
    console.warn('IndexedDB async save reports notice:', err);
  });
}

export function addOfflineReport(report: FieldReport): FieldReport[] {
  const current = getOfflineReports();
  const updated = [report, ...current];
  saveOfflineReports(updated);
  return updated;
}

export function markReportsSynced(syncedIds: string[]): FieldReport[] {
  const current = getOfflineReports();
  const updated = current.map(r => syncedIds.includes(r.id) ? { ...r, synced: true } : r);
  saveOfflineReports(updated);
  return updated;
}

export function isMockLayer(layer: any): boolean {
  if (!layer) return true;
  const id = layer.id || '';
  const name = layer.name || '';
  return (
    id === 'layer-structures' ||
    id === 'layer-canals-main' ||
    id === 'layer-momaro-canals' ||
    id === 'layer-momaro-parcels' ||
    id === 'layer-om-canals' ||
    id === 'layer-palawan-canals' ||
    name === 'Irrigation Structures & Control Gates' ||
    name === 'Canal Line Networks' ||
    id.startsWith('drive-meta-') ||
    name.includes('(Drive Sync Required)')
  );
}

export function getCachedLayers(): GISLayer[] | null {
  try {
    const raw = localStorage.getItem(CACHED_LAYERS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const clean = parsed.filter(l => !isMockLayer(l));
    return clean;
  } catch (err) {
    console.warn('Failed to read cached layers', err);
    return null;
  }
}

export function saveCachedLayers(layers: GISLayer[]): void {
  const clean = (layers || []).filter(l => !isMockLayer(l));
  // Save full GeoJSON layers to IndexedDB (500MB+ capacity)
  saveCachedLayersDB(clean).catch(err => {
    console.warn('IndexedDB save cached layers error:', err);
  });

  // Keep localStorage clean by saving only metadata summary (id, name, category, geometryType, color, opacity, visible, count)
  try {
    const lightweightLayers = clean.map(l => ({
      id: l.id,
      name: l.name,
      category: l.category,
      geometryType: l.geometryType,
      color: l.color,
      opacity: l.opacity,
      visible: l.visible,
      featureCount: l.featureCount || (l.data?.features ? l.data.features.length : 0)
    }));
    localStorage.setItem(CACHED_LAYERS_KEY, JSON.stringify(lightweightLayers));
  } catch (err) {
    // If localStorage is tight, remove layer cache key completely as layers are safe in IndexedDB
    try {
      localStorage.removeItem(CACHED_LAYERS_KEY);
    } catch (e) {}
  }
}

// IndexedDB for large GIS Layer vector datasets (500MB+), Field Reports, and Manifest Metadata
const DB_NAME = 'GeoPulseGISDB_v4';
const DB_VERSION = 2;
const STORE_LAYERS = 'gis_layers';
const STORE_REPORTS = 'offline_reports';
const STORE_METADATA = 'manifest_metadata';
const LAST_OVERHAUL_KEY = 'nia_last_system_overhaul_timestamp';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB not supported'));
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event: any) => {
      const db = event.target.result as IDBDatabase;
      if (!db.objectStoreNames.contains(STORE_LAYERS)) {
        db.createObjectStore(STORE_LAYERS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_REPORTS)) {
        db.createObjectStore(STORE_REPORTS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_METADATA)) {
        db.createObjectStore(STORE_METADATA, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getManifestMetadataDB(key: string = 'master_manifest'): Promise<any | null> {
  try {
    const db = await openDB();
    if (!db.objectStoreNames.contains(STORE_METADATA)) return null;
    const tx = db.transaction(STORE_METADATA, 'readonly');
    const store = tx.objectStore(STORE_METADATA);
    return new Promise((resolve) => {
      const req = store.get(key);
      req.onsuccess = () => {
        resolve(req.result ? req.result.data : null);
      };
      req.onerror = () => resolve(null);
    });
  } catch (err) {
    return null;
  }
}

export async function saveManifestMetadataDB(key: string, data: any): Promise<void> {
  try {
    const db = await openDB();
    if (!db.objectStoreNames.contains(STORE_METADATA)) return;
    const tx = db.transaction(STORE_METADATA, 'readwrite');
    const store = tx.objectStore(STORE_METADATA);
    await new Promise<void>((resolve, reject) => {
      const req = store.put({ key, data, updatedAt: new Date().toISOString() });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to save manifest metadata to IndexedDB:', err);
  }
}

export async function deleteCachedReportDB(reportId: string): Promise<void> {
  try {
    // 1. Remove from in-memory cache
    if (inMemoryReportsCache) {
      inMemoryReportsCache = inMemoryReportsCache.filter(r => r.id !== reportId);
    }
    // 2. Remove from localStorage
    const local = getOfflineReports().filter(r => r.id !== reportId);
    try {
      localStorage.setItem(OFFLINE_REPORTS_KEY, JSON.stringify(createLightweightReports(local)));
    } catch (_) {}
    // 3. Remove from IndexedDB
    const db = await openDB();
    if (!db.objectStoreNames.contains(STORE_REPORTS)) return;
    const tx = db.transaction(STORE_REPORTS, 'readwrite');
    const store = tx.objectStore(STORE_REPORTS);
    await new Promise<void>((resolve, reject) => {
      const req = store.delete(reportId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to delete report from IndexedDB:', err);
  }
}

export async function clearAllLocalDataDB(): Promise<void> {
  try {
    inMemoryReportsCache = [];
    try {
      localStorage.removeItem(OFFLINE_REPORTS_KEY);
      localStorage.removeItem(DOWNLOADED_WEEKS_KEY);
      localStorage.removeItem(CACHED_LAYERS_KEY);
      localStorage.removeItem('ommap_cached_gis_layers');
    } catch (_) {}

    const db = await openDB();
    const stores = [STORE_LAYERS, STORE_REPORTS, STORE_METADATA];
    for (const s of stores) {
      if (db.objectStoreNames.contains(s)) {
        try {
          const tx = db.transaction(s, 'readwrite');
          const store = tx.objectStore(s);
          await new Promise<void>((resolve) => {
            const req = store.clear();
            req.onsuccess = () => resolve();
            req.onerror = () => resolve();
          });
        } catch (_) {}
      }
    }
  } catch (err) {
    console.warn('Failed to completely clear local IndexedDB:', err);
  }
}

export function getLastOverhaulTimestamp(): string | null {
  try {
    return localStorage.getItem(LAST_OVERHAUL_KEY);
  } catch (_) {
    return null;
  }
}

export function setLastOverhaulTimestamp(timestampIso: string = new Date().toISOString()): void {
  try {
    localStorage.setItem(LAST_OVERHAUL_KEY, timestampIso);
  } catch (_) {}
}

export function isOverhaulAllowedToday(userRole?: UserRole): { allowed: boolean; lastRun: string | null; formattedDate: string | null; isExempt: boolean } {
  try {
    const isExempt = Boolean(userRole && ['Developer', 'RO Admin', 'RO Evaluator'].includes(userRole));
    const lastIso = getLastOverhaulTimestamp();
    if (!lastIso) {
      return { allowed: true, lastRun: null, formattedDate: null, isExempt };
    }
    const lastDate = new Date(lastIso);
    if (isNaN(lastDate.getTime())) {
      return { allowed: true, lastRun: null, formattedDate: null, isExempt };
    }
    const now = new Date();
    const isSameDay = lastDate.getFullYear() === now.getFullYear() &&
                      lastDate.getMonth() === now.getMonth() &&
                      lastDate.getDate() === now.getDate();

    const formattedDate = lastDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    return {
      allowed: isExempt ? true : !isSameDay,
      lastRun: lastIso,
      formattedDate,
      isExempt
    };
  } catch (_) {
    return { allowed: true, lastRun: null, formattedDate: null, isExempt: false };
  }
}

export async function getCachedReportsDB(): Promise<FieldReport[] | null> {
  try {
    const db = await openDB();
    if (!db.objectStoreNames.contains(STORE_REPORTS)) return null;
    const tx = db.transaction(STORE_REPORTS, 'readonly');
    const store = tx.objectStore(STORE_REPORTS);
    return new Promise((resolve) => {
      const req = store.getAll();
      req.onsuccess = () => {
        const reports = req.result as FieldReport[];
        if (reports && reports.length > 0) {
          inMemoryReportsCache = reports;
          resolve(reports);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch (err) {
    console.warn('IndexedDB read for reports failed', err);
    return null;
  }
}

export async function saveCachedReportsDB(reports: FieldReport[]): Promise<void> {
  const safeReports = Array.isArray(reports) ? reports : [];
  try {
    const db = await openDB();
    if (!db.objectStoreNames.contains(STORE_REPORTS)) return;

    // Read existing stored records to preserve base64 images if incoming report has empty URLs
    const existingRecords = await new Promise<FieldReport[]>((resolve) => {
      try {
        const readTx = db.transaction(STORE_REPORTS, 'readonly');
        const readStore = readTx.objectStore(STORE_REPORTS);
        const req = readStore.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      } catch (_) {
        resolve([]);
      }
    });

    const existingMap = new Map<string, FieldReport>();
    existingRecords.forEach(er => existingMap.set(er.id, er));

    const mergedReports = safeReports.map(r => {
      const existing = existingMap.get(r.id);
      if (existing && existing.photos && r.photos) {
        const mergedPhotos = r.photos.map((p, pIdx) => {
          const ep = existing.photos?.[pIdx] || existing.photos?.find(x => x.id === p.id);
          if ((!p.url || p.url === '') && ep && ep.url && ep.url.startsWith('data:image/')) {
            return { ...p, url: ep.url, dataUrl: ep.dataUrl || ep.url, sourceDataUrl: ep.sourceDataUrl };
          }
          return p;
        });
        return { ...r, photos: mergedPhotos };
      }
      return r;
    });

    const tx = db.transaction(STORE_REPORTS, 'readwrite');
    const store = tx.objectStore(STORE_REPORTS);

    await new Promise<void>((resolve, reject) => {
      const clearReq = store.clear();
      clearReq.onsuccess = () => {
        if (!mergedReports || mergedReports.length === 0) return resolve();
        let addedCount = 0;
        let hasError = false;
        mergedReports.forEach(r => {
          const addReq = store.put(r);
          addReq.onsuccess = () => {
            addedCount++;
            if (addedCount === mergedReports.length && !hasError) resolve();
          };
          addReq.onerror = () => {
            hasError = true;
            reject(addReq.error);
          };
        });
      };
      clearReq.onerror = () => reject(clearReq.error);
    });
  } catch (err) {
    console.warn('IndexedDB save for field reports error', err);
  }
}

export async function getCachedLayersDB(): Promise<GISLayer[] | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_LAYERS, 'readonly');
    const store = tx.objectStore(STORE_LAYERS);
    return new Promise((resolve) => {
      const req = store.getAll();
      req.onsuccess = () => {
        const layers = req.result as GISLayer[];
        if (layers && layers.length > 0) {
          const clean = layers.filter(l => !isMockLayer(l));
          resolve(clean.length > 0 ? clean : null);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(getCachedLayers());
    });
  } catch (err) {
    console.warn('IndexedDB read failed, falling back to localStorage', err);
    return getCachedLayers();
  }
}

export async function saveCachedLayersDB(layers: GISLayer[]): Promise<void> {
  const clean = (layers || []).filter(l => !isMockLayer(l));
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_LAYERS, 'readwrite');
    const store = tx.objectStore(STORE_LAYERS);

    await new Promise<void>((resolve, reject) => {
      const clearReq = store.clear();
      clearReq.onsuccess = () => {
        if (!clean || clean.length === 0) return resolve();
        let addedCount = 0;
        let hasError = false;
        clean.forEach(l => {
          const addReq = store.put(l);
          addReq.onsuccess = () => {
            addedCount++;
            if (addedCount === clean.length && !hasError) resolve();
          };
          addReq.onerror = () => {
            hasError = true;
            reject(addReq.error);
          };
        });
      };
      clearReq.onerror = () => reject(clearReq.error);
    });
  } catch (err) {
    console.warn('IndexedDB write failed, trying localStorage fallback', err);
    saveCachedLayers(clean);
  }
}

export async function syncOfflineQueueToServer(): Promise<{ syncedCount: number; errors: any[] }> {
  // Try IndexedDB first for complete photo records, fallback to in-memory/localStorage
  let allReports = await getCachedReportsDB();
  if (!allReports || allReports.length === 0) {
    allReports = getOfflineReports();
  }
  const unsynced = allReports.filter(r => !r.synced);

  if (unsynced.length === 0) {
    return { syncedCount: 0, errors: [] };
  }

  try {
    const res = await fetch('/api/reports/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reports: unsynced })
    });

    if (!res.ok) {
      throw new Error(`Server returned status ${res.status}`);
    }

    const data = await res.json();
    const syncedIds = unsynced.map(r => r.id);
    markReportsSynced(syncedIds);

    return { syncedCount: syncedIds.length, errors: [] };
  } catch (err) {
    console.warn('Network or server unreachable for offline sync', err);
    return { syncedCount: 0, errors: [err] };
  }
}

export async function clearAllLayersDB(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_LAYERS, 'readwrite');
    const store = tx.objectStore(STORE_LAYERS);
    await new Promise<void>((resolve) => {
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  } catch (err) {}
  try {
    localStorage.removeItem('ommap_cached_gis_layers');
  } catch (e) {}
}


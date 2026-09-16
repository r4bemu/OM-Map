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
      // Deduplicate by ID: if any entry for report.id is synced, keep the synced copy
      const map = new Map<string, FieldReport>();
      for (const r of parsed) {
        if (!r || !r.id) continue;
        const existing = map.get(r.id);
        if (!existing) {
          map.set(r.id, r);
        } else if (r.synced && !existing.synced) {
          map.set(r.id, r);
        }
      }
      const clean = Array.from(map.values());
      inMemoryReportsCache = clean;
      return clean;
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
        // Keep server URLs and thumbnails intact; for synced reports, replace large base64 with Drive CDN URL
        const isLongBase64 = typeof p.url === 'string' && p.url.startsWith('data:image/') && p.url.length > 500;
        const cleanDriveId = p.driveFileId || (p.id && (p.id.length >= 20 || !p.id.startsWith('photo-')) ? p.id : undefined);
        const fallbackUrl = cleanDriveId 
          ? `https://drive.google.com/thumbnail?id=${cleanDriveId.replace(/^photo_/, '')}&sz=w1200` 
          : (p.thumbnailUrl || (p.driveFileId ? `/api/drive/photo/${p.driveFileId}` : ''));
        return {
          ...p,
          url: fallbackUrl ? fallbackUrl : p.url,
          dataUrl: undefined,
          sourceDataUrl: undefined
        };
      });
      const firstDriveId = r.photos[0]?.driveFileId || (r.photos[0]?.id && (r.photos[0]?.id.length >= 20 || !r.photos[0]?.id.startsWith('photo-')) ? r.photos[0]?.id : undefined);
      const fallbackPhotoUrl = firstDriveId 
        ? `https://drive.google.com/thumbnail?id=${firstDriveId.replace(/^photo_/, '')}&sz=w1200` 
        : (r.photos[0]?.thumbnailUrl || undefined);
      return { 
        ...r, 
        photos: lightweightPhotos,
        photoUrl: fallbackPhotoUrl ? fallbackPhotoUrl : r.photoUrl
      };
    }
    return r;
  });
}

export function saveOfflineReports(reports: FieldReport[]): void {
  const safeReports = Array.isArray(reports) ? reports : [];
  
  // Maintain full-fidelity objects with all base64 photos in memory
  if (inMemoryReportsCache && inMemoryReportsCache.length > 0) {
    // Preserve any existing full base64 images if incoming report has non-base64 or empty URLs
    const memoryMap = new Map<string, FieldReport>();
    inMemoryReportsCache.forEach(mr => memoryMap.set(mr.id, mr));
    
    inMemoryReportsCache = safeReports.map(r => {
      const existing = memoryMap.get(r.id);
      if (existing && existing.photos && r.photos) {
        const mergedPhotos = r.photos.map((p, pIdx) => {
          const ep = existing.photos?.[pIdx] || existing.photos?.find(x => x.id === p.id);
          const pHasB64 = (typeof p.url === 'string' && p.url.startsWith('data:image/')) || (typeof p.dataUrl === 'string' && p.dataUrl.startsWith('data:image/'));
          const epHasB64 = (typeof ep?.url === 'string' && ep.url.startsWith('data:image/')) || (typeof ep?.dataUrl === 'string' && ep.dataUrl.startsWith('data:image/'));
          const rawId = p.driveFileId || (p.id && p.id.length >= 20 && !p.id.startsWith('photo-') ? p.id : undefined);
          const cleanId = rawId ? normalizePhotoKey(rawId) : (p.id ? normalizePhotoKey(p.id) : undefined);
          const syncB64 = cleanId ? getCachedPhotoSync(cleanId) : (p.id ? getCachedPhotoSync(p.id) : null);

          if (!pHasB64) {
            if (epHasB64) {
              const b64 = (ep!.url?.startsWith('data:image/') ? ep!.url : ep!.dataUrl)!;
              return { ...p, url: b64, dataUrl: b64, sourceDataUrl: ep?.sourceDataUrl || p.sourceDataUrl };
            } else if (syncB64) {
              return { ...p, url: syncB64, dataUrl: syncB64, sourceDataUrl: p.sourceDataUrl };
            }
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

  // 3. Auto-cache any embedded base64 photos into STORE_PHOTOS
  try {
    const list = inMemoryReportsCache || safeReports;
    list.forEach(r => {
      if (Array.isArray(r.photos)) {
        r.photos.forEach(p => {
          if (!p) return;
          const rawId = p.driveFileId || (p.id && p.id.length >= 20 && !p.id.startsWith('photo-') ? p.id : undefined);
          const cleanId = rawId ? normalizePhotoKey(rawId) : (p.id ? normalizePhotoKey(p.id) : undefined);
          const photoId = p.id ? normalizePhotoKey(p.id) : undefined;
          const dataUrl = (typeof p.url === 'string' && p.url.startsWith('data:image/')) 
            ? p.url 
            : (typeof p.dataUrl === 'string' && p.dataUrl.startsWith('data:image/') ? p.dataUrl : undefined);
          if (cleanId && dataUrl) {
            saveCachedPhotoDB(cleanId, dataUrl).catch(() => {});
          }
          if (photoId && photoId !== cleanId && dataUrl) {
            saveCachedPhotoDB(photoId, dataUrl).catch(() => {});
          }
        });
      }
      if (r.photoUrl && typeof r.photoUrl === 'string' && r.photoUrl.startsWith('data:image/')) {
        saveCachedPhotoDB(`${r.id}_cover`, r.photoUrl).catch(() => {});
      }
    });
  } catch (_) {}
}

export function addOfflineReport(report: FieldReport): FieldReport[] {
  const current = getOfflineReports();
  // Filter out any existing report with the same ID to avoid stale unsynced duplicates
  const filtered = current.filter(r => r.id !== report.id);
  const updated = [report, ...filtered];
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
const DB_VERSION = 3;
const STORE_LAYERS = 'gis_layers';
const STORE_REPORTS = 'offline_reports';
const STORE_METADATA = 'manifest_metadata';
const STORE_PHOTOS = 'offline_photos';
const LAST_OVERHAUL_KEY = 'nia_last_system_overhaul_timestamp';

const inMemoryPhotoCache = new Map<string, string>();

export function normalizePhotoKey(key: string): string {
  if (!key) return '';
  return String(key).replace(/^photo_/, '').trim();
}

export function getCachedPhotoSync(photoKey: string): string | null {
  if (!photoKey) return null;
  const clean = normalizePhotoKey(photoKey);
  return inMemoryPhotoCache.get(clean) || inMemoryPhotoCache.get(photoKey) || null;
}

export async function getCachedPhotoDB(photoKey: string): Promise<string | null> {
  if (!photoKey) return null;
  const clean = normalizePhotoKey(photoKey);
  if (inMemoryPhotoCache.has(clean)) {
    return inMemoryPhotoCache.get(clean)!;
  }
  if (inMemoryPhotoCache.has(photoKey)) {
    return inMemoryPhotoCache.get(photoKey)!;
  }

  try {
    const db = await openDB();
    if (!db.objectStoreNames.contains(STORE_PHOTOS)) return null;
    const tx = db.transaction(STORE_PHOTOS, 'readonly');
    const store = tx.objectStore(STORE_PHOTOS);
    return new Promise((resolve) => {
      const req = store.get(clean);
      req.onsuccess = () => {
        if (req.result && req.result.dataUrl) {
          inMemoryPhotoCache.set(clean, req.result.dataUrl);
          resolve(req.result.dataUrl);
        } else if (photoKey !== clean) {
          const req2 = store.get(photoKey);
          req2.onsuccess = () => {
            if (req2.result && req2.result.dataUrl) {
              inMemoryPhotoCache.set(clean, req2.result.dataUrl);
              resolve(req2.result.dataUrl);
            } else {
              resolve(null);
            }
          };
          req2.onerror = () => resolve(null);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch (err) {
    return null;
  }
}

export async function saveCachedPhotoDB(photoKey: string, dataUrl: string): Promise<void> {
  if (!photoKey || !dataUrl) return;
  const clean = normalizePhotoKey(photoKey);
  inMemoryPhotoCache.set(clean, dataUrl);
  if (photoKey !== clean) inMemoryPhotoCache.set(photoKey, dataUrl);

  try {
    const db = await openDB();
    if (!db.objectStoreNames.contains(STORE_PHOTOS)) return;
    const tx = db.transaction(STORE_PHOTOS, 'readwrite');
    const store = tx.objectStore(STORE_PHOTOS);
    await new Promise<void>((resolve, reject) => {
      const req = store.put({
        id: clean,
        dataUrl,
        updatedAt: new Date().toISOString()
      });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn(`Failed to save photo ${clean} to IndexedDB:`, err);
  }
}

export async function getAllCachedPhotoKeysDB(): Promise<string[]> {
  try {
    const db = await openDB();
    if (!db.objectStoreNames.contains(STORE_PHOTOS)) return [];
    const tx = db.transaction(STORE_PHOTOS, 'readonly');
    const store = tx.objectStore(STORE_PHOTOS);
    return new Promise((resolve) => {
      const req = store.getAllKeys();
      req.onsuccess = () => {
        const keys = (req.result || []).map(k => String(k));
        resolve(keys);
      };
      req.onerror = () => resolve([]);
    });
  } catch (err) {
    return [];
  }
}

export async function preloadCachedPhotosIntoMemory(limit: number = 1000): Promise<void> {
  try {
    const db = await openDB();
    if (!db.objectStoreNames.contains(STORE_PHOTOS)) return;
    const tx = db.transaction(STORE_PHOTOS, 'readonly');
    const store = tx.objectStore(STORE_PHOTOS);
    await new Promise<void>((resolve) => {
      const req = store.openCursor();
      let count = 0;
      req.onsuccess = (e: any) => {
        const cursor = e.target.result;
        if (cursor && count < limit) {
          const val = cursor.value;
          if (val && val.id && val.dataUrl) {
            inMemoryPhotoCache.set(val.id, val.dataUrl);
            const clean = normalizePhotoKey(val.id);
            if (clean !== val.id) {
              inMemoryPhotoCache.set(clean, val.dataUrl);
            }
          }
          count++;
          cursor.continue();
        } else {
          resolve();
        }
      };
      req.onerror = () => resolve();
    });
  } catch (err) {}
}

export async function cacheReportPhotosClient(
  reports: FieldReport[],
  onProgress?: (done: number, total: number) => void
): Promise<number> {
  if (!Array.isArray(reports) || reports.length === 0) return 0;

  const candidates: { key: string; urls: string[]; reportId: string }[] = [];
  const seenKeys = new Set<string>();

  for (const rep of reports) {
    if (!rep || !Array.isArray(rep.photos)) continue;
    for (const p of rep.photos) {
      if (!p) continue;
      const rawId = p.driveFileId || (p.id && p.id.length >= 20 && !p.id.startsWith('photo-') ? p.id : undefined);
      const cleanId = rawId ? normalizePhotoKey(rawId) : (p.id ? normalizePhotoKey(p.id) : undefined);
      if (!cleanId) continue;
      if (seenKeys.has(cleanId)) continue;
      seenKeys.add(cleanId);

      // If photo already has data:image base64, save to IndexedDB immediately
      if (typeof p.url === 'string' && p.url.startsWith('data:image/')) {
        await saveCachedPhotoDB(cleanId, p.url);
        continue;
      }
      if (typeof p.dataUrl === 'string' && p.dataUrl.startsWith('data:image/')) {
        await saveCachedPhotoDB(cleanId, p.dataUrl);
        continue;
      }

      if (inMemoryPhotoCache.has(cleanId)) continue;

      // Same-origin proxy is the primary, reliable mechanism that avoids browser CORS errors
      const urls: string[] = [
        `/api/drive/photo/${cleanId}`
      ];
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        urls.push(`https://drive.google.com/thumbnail?id=${cleanId}&sz=w1200`);
      }
      candidates.push({ key: cleanId, urls, reportId: rep.id });
    }
  }

  if (candidates.length === 0) return 0;

  const existingKeys = new Set(await getAllCachedPhotoKeysDB());
  const toFetch = candidates.filter(c => !existingKeys.has(c.key));

  if (toFetch.length === 0) return 0;

  let completed = 0;
  const total = toFetch.length;
  onProgress?.(0, total);

  const CONCURRENCY = 4;
  let index = 0;

  const worker = async () => {
    while (index < toFetch.length) {
      const current = toFetch[index++];
      let cached = false;

      for (const u of current.urls) {
        try {
          const res = await fetch(u, { mode: 'cors' });
          if (res.ok) {
            const blob = await res.blob();
            if (blob.size > 500) {
              const dataUrl = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
              });
              if (dataUrl && dataUrl.startsWith('data:image/')) {
                await saveCachedPhotoDB(current.key, dataUrl);
                cached = true;
                break;
              }
            }
          }
        } catch (_) {}
      }

      completed++;
      onProgress?.(completed, total);
    }
  };

  const workers = Array.from({ length: Math.min(CONCURRENCY, toFetch.length) }, () => worker());
  await Promise.all(workers);

  return completed;
}

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
      if (!db.objectStoreNames.contains(STORE_PHOTOS)) {
        db.createObjectStore(STORE_PHOTOS, { keyPath: 'id' });
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
    inMemoryPhotoCache.clear();
    try {
      localStorage.removeItem(OFFLINE_REPORTS_KEY);
      localStorage.removeItem(DOWNLOADED_WEEKS_KEY);
      localStorage.removeItem(CACHED_LAYERS_KEY);
      localStorage.removeItem('ommap_cached_gis_layers');
    } catch (_) {}

    const db = await openDB();
    const stores = [STORE_LAYERS, STORE_REPORTS, STORE_METADATA, STORE_PHOTOS];
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
        const rawReports = req.result as FieldReport[];
        if (rawReports && rawReports.length > 0) {
          // Hydrate with any synchronous in-memory cached photos
          const reports = rawReports.map(r => {
            if (Array.isArray(r.photos) && r.photos.length > 0) {
              const hydratedPhotos = r.photos.map(p => {
                if (!p) return p;
                const pHasB64 = (typeof p.url === 'string' && p.url.startsWith('data:image/')) || (typeof p.dataUrl === 'string' && p.dataUrl.startsWith('data:image/'));
                if (pHasB64) return p;
                const rawId = p.driveFileId || (p.id && p.id.length >= 20 && !p.id.startsWith('photo-') ? p.id : undefined);
                const cleanId = rawId ? normalizePhotoKey(rawId) : (p.id ? normalizePhotoKey(p.id) : undefined);
                const syncB64 = cleanId ? getCachedPhotoSync(cleanId) : (p.id ? getCachedPhotoSync(p.id) : null);
                if (syncB64) {
                  return { ...p, url: syncB64, dataUrl: syncB64 };
                }
                return p;
              });
              return { ...r, photos: hydratedPhotos };
            }
            return r;
          });
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

    // Read existing stored records to preserve base64 images if incoming report has non-base64 or empty URLs
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
          const pHasB64 = (typeof p.url === 'string' && p.url.startsWith('data:image/')) || (typeof p.dataUrl === 'string' && p.dataUrl.startsWith('data:image/'));
          const epHasB64 = (typeof ep?.url === 'string' && ep.url.startsWith('data:image/')) || (typeof ep?.dataUrl === 'string' && ep.dataUrl.startsWith('data:image/'));
          const rawId = p.driveFileId || (p.id && p.id.length >= 20 && !p.id.startsWith('photo-') ? p.id : undefined);
          const cleanId = rawId ? normalizePhotoKey(rawId) : (p.id ? normalizePhotoKey(p.id) : undefined);
          const syncB64 = cleanId ? getCachedPhotoSync(cleanId) : (p.id ? getCachedPhotoSync(p.id) : null);

          if (!pHasB64) {
            if (epHasB64) {
              const b64 = (ep!.url?.startsWith('data:image/') ? ep!.url : ep!.dataUrl)!;
              return { ...p, url: b64, dataUrl: b64, sourceDataUrl: ep?.sourceDataUrl || p.sourceDataUrl };
            } else if (syncB64) {
              return { ...p, url: syncB64, dataUrl: syncB64, sourceDataUrl: p.sourceDataUrl };
            }
          }
          return p;
        });
        return { ...r, photos: mergedPhotos };
      }
      return r;
    });

    inMemoryReportsCache = mergedReports;

    // Auto-cache any base64 photos into STORE_PHOTOS
    mergedReports.forEach(r => {
      if (Array.isArray(r.photos)) {
        r.photos.forEach(p => {
          if (!p) return;
          const rawId = p.driveFileId || (p.id && p.id.length >= 20 && !p.id.startsWith('photo-') ? p.id : undefined);
          const cleanId = rawId ? normalizePhotoKey(rawId) : (p.id ? normalizePhotoKey(p.id) : undefined);
          const photoId = p.id ? normalizePhotoKey(p.id) : undefined;
          const dataUrl = (typeof p.url === 'string' && p.url.startsWith('data:image/')) 
            ? p.url 
            : (typeof p.dataUrl === 'string' && p.dataUrl.startsWith('data:image/') ? p.dataUrl : undefined);
          if (cleanId && dataUrl) {
            saveCachedPhotoDB(cleanId, dataUrl).catch(() => {});
          }
          if (photoId && photoId !== cleanId && dataUrl) {
            saveCachedPhotoDB(photoId, dataUrl).catch(() => {});
          }
        });
      }
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

export async function syncOfflineQueueToServer(driveToken?: string | null): Promise<{ syncedCount: number; errors: any[] }> {
  // Try IndexedDB first for complete photo records, fallback to in-memory/localStorage
  let allReports = await getCachedReportsDB();
  if (!allReports || allReports.length === 0) {
    allReports = getOfflineReports();
  }
  const unsynced = allReports.filter(r => !r.synced);

  if (unsynced.length === 0) {
    return { syncedCount: 0, errors: [] };
  }

  let syncedCount = 0;
  const errors: any[] = [];
  const successfullySyncedIds: string[] = [];

  // 1. Try server batch upload first
  try {
    const res = await fetch('/api/reports/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reports: unsynced })
    });

    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.syncedIds)) {
        successfullySyncedIds.push(...data.syncedIds);
        syncedCount += data.syncedIds.length;
      } else {
        const syncedIds = unsynced.map(r => r.id);
        successfullySyncedIds.push(...syncedIds);
        syncedCount += syncedIds.length;
      }
    }
  } catch (err) {
    console.warn('Backend server batch sync unreachable, attempting direct Apps Script relay:', err);
  }

  // 2. Fallback: Direct Permanent Google Apps Script Relay Upload for remaining unsynced reports
  const remainingUnsynced = unsynced.filter(r => !successfullySyncedIds.includes(r.id));
  if (remainingUnsynced.length > 0) {
    try {
      const { uploadReportViaAppsScriptClient } = await import('../lib/googleDriveService');
      for (const rep of remainingUnsynced) {
        try {
          const directRes = await uploadReportViaAppsScriptClient(rep);
          if (directRes && directRes.success) {
            successfullySyncedIds.push(rep.id);
            syncedCount++;
          }
        } catch (dErr) {
          console.warn(`Direct Apps Script upload failed for report ${rep.id}:`, dErr);
          errors.push(dErr);
        }
      }
    } catch (importErr) {
      console.warn('Could not import googleDriveService for offline queue sync:', importErr);
      errors.push(importErr);
    }
  }

  if (successfullySyncedIds.length > 0) {
    markReportsSynced(successfullySyncedIds);
  }

  return { syncedCount, errors };
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


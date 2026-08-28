import { FieldReport, GISLayer } from '../types';

export interface DomainProgress {
    domain: 'outbox' | 'reports' | 'layers';
    total: number;
    completed: number;
    status: 'idle' | 'syncing' | 'completed' | 'error';
    message?: string;
}

export interface ParallelSyncReport {
    success: boolean;
    durationMs: number;
    reportsUpdated: number;
    layersUpdated: number;
    outboxFlushed: number;
    errors: string[];
}

export interface PendingUploadItem {
    id: string;
    data: Partial<FieldReport>;
    timestamp: string;
}

export interface ManifestItem {
    id: string;
    updatedAt?: string;
    uploadedAt?: string;
    createdAt?: string;
    sizeBytes?: number;
}

// ============================================================================
// STANDALONE TYPE-SAFE INDEXEDDB & CACHE ADAPTERS
// ============================================================================

const DB_NAME = 'NIA_OM_OFFLINE_DB';
const DB_VERSION = 1;
const STORE_REPORTS = 'reports';
const STORE_LAYERS = 'layers';
const STORE_OUTBOX = 'outbox';

function openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        if (typeof indexedDB === 'undefined') {
            return reject(new Error('IndexedDB is not available'));
        }
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE_REPORTS)) {
                db.createObjectStore(STORE_REPORTS, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(STORE_LAYERS)) {
                db.createObjectStore(STORE_LAYERS, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(STORE_OUTBOX)) {
                db.createObjectStore(STORE_OUTBOX, { keyPath: 'id' });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

export async function getLocalReports(): Promise<FieldReport[]> {
    try {
        const db = await openDatabase();
        return new Promise((resolve) => {
            const tx = db.transaction(STORE_REPORTS, 'readonly');
            const store = tx.objectStore(STORE_REPORTS);
            const req = store.getAll();
            req.onsuccess = () => {
                const results = req.result as FieldReport[];
                if (results && results.length > 0) return resolve(results);
                // LocalStorage fallback
                try {
                    const raw = localStorage.getItem('nia_offline_reports');
                    resolve(raw ? JSON.parse(raw) : []);
                } catch (_) {
                    resolve([]);
                }
            };
            req.onerror = () => resolve([]);
        });
    } catch (_) {
        try {
            const raw = localStorage.getItem('nia_offline_reports');
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    }
}

export async function saveLocalReports(reports: FieldReport[]): Promise<void> {
    try {
        localStorage.setItem('nia_offline_reports', JSON.stringify(reports));
        const db = await openDatabase();
        const tx = db.transaction(STORE_REPORTS, 'readwrite');
        const store = tx.objectStore(STORE_REPORTS);
        store.clear();
        for (const r of reports) {
            store.put(r);
        }
    } catch (err) {
        console.warn('Failed saving local reports to IndexedDB:', err);
    }
}

export async function getLocalLayers(): Promise<GISLayer[]> {
    try {
        const db = await openDatabase();
        return new Promise((resolve) => {
            const tx = db.transaction(STORE_LAYERS, 'readonly');
            const store = tx.objectStore(STORE_LAYERS);
            const req = store.getAll();
            req.onsuccess = () => {
                const results = req.result as GISLayer[];
                if (results && results.length > 0) return resolve(results);
                try {
                    const raw = localStorage.getItem('nia_offline_layers');
                    resolve(raw ? JSON.parse(raw) : []);
                } catch (_) {
                    resolve([]);
                }
            };
            req.onerror = () => resolve([]);
        });
    } catch (_) {
        try {
            const raw = localStorage.getItem('nia_offline_layers');
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    }
}

export async function saveLocalLayers(layers: GISLayer[]): Promise<void> {
    try {
        localStorage.setItem('nia_offline_layers', JSON.stringify(layers));
        const db = await openDatabase();
        const tx = db.transaction(STORE_LAYERS, 'readwrite');
        const store = tx.objectStore(STORE_LAYERS);
        store.clear();
        for (const l of layers) {
            store.put(l);
        }
    } catch (err) {
        console.warn('Failed saving local layers to IndexedDB:', err);
    }
}

export async function getPendingOutbox(): Promise<PendingUploadItem[]> {
    try {
        const db = await openDatabase();
        return new Promise((resolve) => {
            const tx = db.transaction(STORE_OUTBOX, 'readonly');
            const store = tx.objectStore(STORE_OUTBOX);
            const req = store.getAll();
            req.onsuccess = () => {
                const results = req.result as PendingUploadItem[];
                if (results && results.length > 0) return resolve(results);
                try {
                    const raw = localStorage.getItem('nia_pending_outbox');
                    resolve(raw ? JSON.parse(raw) : []);
                } catch (_) {
                    resolve([]);
                }
            };
            req.onerror = () => resolve([]);
        });
    } catch (_) {
        try {
            const raw = localStorage.getItem('nia_pending_outbox');
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    }
}

export async function removePendingOutboxItem(id: string): Promise<void> {
    try {
        const db = await openDatabase();
        const tx = db.transaction(STORE_OUTBOX, 'readwrite');
        tx.objectStore(STORE_OUTBOX).delete(id);
        const raw = localStorage.getItem('nia_pending_outbox');
        if (raw) {
            const list: PendingUploadItem[] = JSON.parse(raw);
            localStorage.setItem('nia_pending_outbox', JSON.stringify(list.filter(i => i.id !== id)));
        }
    } catch (err) {
        console.warn('Failed removing outbox item:', err);
    }
}

// ============================================================================
// CONCURRENCY POOL WORKER
// ============================================================================

export async function runConcurrentPool<T, R>(
    items: T[],
    workerFn: (item: T) => Promise<R>,
    concurrency = 4,
    onProgress?: (completed: number, total: number) => void
): Promise<R[]> {
    if (items.length === 0) return [];
    const results: R[] = new Array(items.length);
    let currentIndex = 0;
    let completedCount = 0;

    const worker = async () => {
        while (currentIndex < items.length) {
            const idx = currentIndex++;
            try {
                results[idx] = await workerFn(items[idx]);
            } catch (err) {
                console.warn(`Worker failed on item index ${idx}:`, err);
            } finally {
                completedCount++;
                if (onProgress) onProgress(completedCount, items.length);
            }
        }
    };

    const pool = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
    await Promise.all(pool);
    return results;
}

// ============================================================================
// 3-TRACK PARALLEL PIPELINE IMPLEMENTATION
// ============================================================================

/**
 * Track 1: Parallel Outbox Sync (Push local drafts concurrently)
 */
async function syncOutboxTrack(
    onProgress?: (p: DomainProgress) => void
): Promise<{ flushed: number; error?: string }> {
    try {
        const pending: PendingUploadItem[] = await getPendingOutbox();
        if (pending.length === 0) {
            onProgress?.({ domain: 'outbox', total: 0, completed: 0, status: 'completed', message: 'No pending local edits' });
            return { flushed: 0 };
        }

        onProgress?.({ domain: 'outbox', total: pending.length, completed: 0, status: 'syncing', message: `Uploading ${pending.length} local edits...` });

        let flushed = 0;
        await runConcurrentPool<PendingUploadItem, void>(
            pending,
            async (item: PendingUploadItem) => {
                const res = await fetch(`/api/reports/${item.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(item.data)
                });
                if (res.ok) {
                    await removePendingOutboxItem(item.id);
                    flushed++;
                }
            },
            3,
            (completed, total) => {
                onProgress?.({ domain: 'outbox', total, completed, status: 'syncing', message: `Pushed ${completed}/${total} edits` });
            }
        );

        onProgress?.({ domain: 'outbox', total: pending.length, completed: flushed, status: 'completed', message: `Pushed ${flushed} edits ✓` });
        return { flushed };
    } catch (err: any) {
        onProgress?.({ domain: 'outbox', total: 0, completed: 0, status: 'error', message: err?.message || 'Outbox sync failed' });
        return { flushed: 0, error: err?.message };
    }
}

/**
 * Track 2: Parallel Reports Delta Sync (Header / Manifest Diffing)
 */
async function syncReportsTrack(
    onProgress?: (p: DomainProgress) => void
): Promise<{ updated: number; error?: string }> {
    try {
        onProgress?.({ domain: 'reports', total: 1, completed: 0, status: 'syncing', message: 'Checking cloud reports manifest...' });

        const localReports = await getLocalReports();
        const localMap = new Map<string, FieldReport>(localReports.map(r => [r.id, r]));

        // Check manifest
        const res = await fetch('/api/reports/manifest');
        if (!res.ok) {
            // Fallback: full reports list
            const fullRes = await fetch('/api/reports');
            if (!fullRes.ok) throw new Error(`Reports endpoint returned ${fullRes.status}`);
            const cloudReports: FieldReport[] = await fullRes.json();
            await saveLocalReports(cloudReports);
            onProgress?.({ domain: 'reports', total: cloudReports.length, completed: cloudReports.length, status: 'completed', message: `Synced ${cloudReports.length} reports ✓` });
            return { updated: cloudReports.length };
        }

        const cloudManifest: ManifestItem[] = await res.json();

        // Determine missing or outdated reports
        const neededIds = cloudManifest
            .filter((item: ManifestItem) => {
                const local = localMap.get(item.id);
                const cloudTime = item.updatedAt || item.createdAt || '';
                const localTime = (local as any)?.updatedAt || local?.createdAt || '';
                return !local || new Date(cloudTime) > new Date(localTime || 0);
            })
            .map((item: ManifestItem) => item.id);

        if (neededIds.length === 0) {
            onProgress?.({ domain: 'reports', total: localReports.length, completed: localReports.length, status: 'completed', message: 'All reports up to date ✓' });
            return { updated: 0 };
        }

        onProgress?.({ domain: 'reports', total: neededIds.length, completed: 0, status: 'syncing', message: `Downloading ${neededIds.length} delta reports...` });

        // Concurrent Download Pool (4 parallel streams)
        const fetchedReports = await runConcurrentPool<string, FieldReport | null>(
            neededIds,
            async (id: string) => {
                const rRes = await fetch(`/api/reports/${id}`);
                return rRes.ok ? ((await rRes.json()) as FieldReport) : null;
            },
            4,
            (completed, total) => {
                onProgress?.({ domain: 'reports', total, completed, status: 'syncing', message: `Fetched ${completed}/${total} reports` });
            }
        );

        fetchedReports.filter((r): r is FieldReport => r !== null).forEach((rep: FieldReport) => {
            localMap.set(rep.id, rep);
        });

        const consolidated = Array.from(localMap.values());
        await saveLocalReports(consolidated);

        onProgress?.({ domain: 'reports', total: neededIds.length, completed: neededIds.length, status: 'completed', message: `Updated ${neededIds.length} reports ✓` });
        return { updated: neededIds.length };
    } catch (err: any) {
        onProgress?.({ domain: 'reports', total: 0, completed: 0, status: 'error', message: err?.message || 'Reports sync failed' });
        return { updated: 0, error: err?.message };
    }
}

/**
 * Track 3: Parallel GIS Layers Sync (4x Concurrent Download Pool)
 */
async function syncLayersTrack(
    onProgress?: (p: DomainProgress) => void
): Promise<{ updated: number; error?: string }> {
    try {
        onProgress?.({ domain: 'layers', total: 1, completed: 0, status: 'syncing', message: 'Checking GIS layers manifest...' });

        const localLayers = await getLocalLayers();
        const localMap = new Map<string, GISLayer>(localLayers.map(l => [l.id, l]));

        const res = await fetch('/api/layers/manifest');
        if (!res.ok) {
            const fullRes = await fetch('/api/layers');
            if (!fullRes.ok) throw new Error(`Layers endpoint returned ${fullRes.status}`);
            const cloudLayers: GISLayer[] = await fullRes.json();
            await saveLocalLayers(cloudLayers);
            onProgress?.({ domain: 'layers', total: cloudLayers.length, completed: cloudLayers.length, status: 'completed', message: `Synced ${cloudLayers.length} GIS layers ✓` });
            return { updated: cloudLayers.length };
        }

        const cloudManifest: ManifestItem[] = await res.json();

        const neededLayers: ManifestItem[] = cloudManifest.filter((cloud: ManifestItem) => {
            const local = localMap.get(cloud.id);
            const cloudUploaded = cloud.uploadedAt || cloud.updatedAt || '';
            return !local || !local.data || new Date(cloudUploaded) > new Date(local.uploadedAt || 0);
        });

        if (neededLayers.length === 0) {
            onProgress?.({ domain: 'layers', total: localLayers.length, completed: localLayers.length, status: 'completed', message: 'All GIS layers up to date ✓' });
            return { updated: 0 };
        }

        onProgress?.({ domain: 'layers', total: neededLayers.length, completed: 0, status: 'syncing', message: `Downloading ${neededLayers.length} GIS layers (4x parallel)...` });

        // Download layers concurrently in batches of 4
        const downloadedLayers = await runConcurrentPool<ManifestItem, GISLayer | null>(
            neededLayers,
            async (item: ManifestItem) => {
                const lRes = await fetch(`/api/layers/${item.id}`);
                return lRes.ok ? ((await lRes.json()) as GISLayer) : null;
            },
            4,
            (completed, total) => {
                onProgress?.({ domain: 'layers', total, completed, status: 'syncing', message: `Fetched ${completed}/${total} GIS layers` });
            }
        );

        downloadedLayers.filter((l): l is GISLayer => l !== null).forEach((layer: GISLayer) => {
            localMap.set(layer.id, layer);
        });

        const consolidated = Array.from(localMap.values());
        await saveLocalLayers(consolidated);

        onProgress?.({ domain: 'layers', total: neededLayers.length, completed: neededLayers.length, status: 'completed', message: `Updated ${neededLayers.length} GIS layers ✓` });
        return { updated: neededLayers.length };
    } catch (err: any) {
        onProgress?.({ domain: 'layers', total: 0, completed: 0, status: 'error', message: err?.message || 'Layers sync failed' });
        return { updated: 0, error: err?.message };
    }
}

/**
 * Main Parallel Sync Coordinator: Fires all 3 domains simultaneously
 */
export async function executeParallelSync(
    onProgress?: (domainProgress: Record<string, DomainProgress>) => void
): Promise<ParallelSyncReport> {
    const startTime = performance.now();
    const progressMap: Record<string, DomainProgress> = {
        outbox: { domain: 'outbox', total: 0, completed: 0, status: 'idle' },
        reports: { domain: 'reports', total: 0, completed: 0, status: 'idle' },
        layers: { domain: 'layers', total: 0, completed: 0, status: 'idle' }
    };

    const updateDomain = (p: DomainProgress) => {
        progressMap[p.domain] = p;
        onProgress?.({ ...progressMap });
    };

    // 🔥 ALL 3 DOMAINS RUN IN PARALLEL CONCURRENTLY
    const [outboxResult, reportsResult, layersResult] = await Promise.allSettled([
        syncOutboxTrack(updateDomain),
        syncReportsTrack(updateDomain),
        syncLayersTrack(updateDomain)
    ]);

    const durationMs = Math.round(performance.now() - startTime);
    const errors: string[] = [];

    let outboxFlushed = 0;
    let reportsUpdated = 0;
    let layersUpdated = 0;

    if (outboxResult.status === 'fulfilled' && !outboxResult.value.error) {
        outboxFlushed = outboxResult.value.flushed;
    } else if (outboxResult.status === 'rejected') {
        errors.push(`Outbox: ${outboxResult.reason}`);
    }

    if (reportsResult.status === 'fulfilled' && !reportsResult.value.error) {
        reportsUpdated = reportsResult.value.updated;
    } else if (reportsResult.status === 'rejected') {
        errors.push(`Reports: ${reportsResult.reason}`);
    }

    if (layersResult.status === 'fulfilled' && !layersResult.value.error) {
        layersUpdated = layersResult.value.updated;
    } else if (layersResult.status === 'rejected') {
        errors.push(`Layers: ${layersResult.reason}`);
    }

    return {
        success: errors.length === 0,
        durationMs,
        outboxFlushed,
        reportsUpdated,
        layersUpdated,
        errors
    };
}
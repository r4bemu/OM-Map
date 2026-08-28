import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  disableNetwork
} from 'firebase/firestore';
import fs from 'fs';
import path from 'path';
import { INITIAL_GIS_LAYERS, INITIAL_FIELD_REPORTS } from '../data/sampleLayers.js';

// Load config from environment variables or safe defaults for Cloud Run
const firebaseConfig: any = {
  projectId: process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT_ID || 'perfect-volt-1t3g1',
  apiKey: process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY || 'AIzaSyD14vGu6jiO5qkAuKDIlPXcsheWurxJfFo',
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || 'perfect-volt-1t3g1.firebaseapp.com',
  firestoreDatabaseId: process.env.FIRESTORE_DATABASE_ID || process.env.FIRESTORE_DB || '(default)'
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const db = getFirestore(
  app,
  firebaseConfig.firestoreDatabaseId || '(default)'
);

// Server uses local persistent file storage (persistent_reports.json) and Google Drive
// Keep isQuotaExhausted = true to prevent SDK hanging on disabled network
let isQuotaExhausted = true;

try {
  disableNetwork(db).catch(() => {});
} catch (e) {}

const CHUNK_SIZE_BYTES = 400 * 1024; // 400KB chunk size

function handleFirestoreError(actionName: string, err: any) {
  const msg = String(err?.message || err?.code || err || '');
  const code = String(err?.code || '');
  if (
    msg.includes('Quota limit exceeded') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('resource-exhausted') ||
    msg.includes('quota') ||
    msg.includes('Quota exceeded') ||
    msg.includes('NOT_FOUND') ||
    msg.includes('not-found') ||
    msg.includes('5 NOT_FOUND') ||
    code === 'not-found' ||
    code === '5'
  ) {
    if (!isQuotaExhausted) {
      isQuotaExhausted = true;
      try {
        disableNetwork(db).catch(() => {});
      } catch (e) {}
      console.warn('⚠️ Firestore backend not provisioned or quota reached. Disabled Firestore network sync; seamlessly using local server disk storage fallback.');
    }
  } else {
    console.error(`Firestore ${actionName} error:`, err);
  }
}

/**
 * Helper to deserialize layer from Firestore doc
 */
async function reconstructLayerFromDoc(docData: any, localBackupLayers: any[] = []): Promise<any> {
  const layer = { ...docData };
  const localMatch = localBackupLayers.find((l: any) => l.id === layer.id);

  // If local disk backup already has valid features, prefer local data to avoid unnecessary chunk fetches & quota usage
  if (localMatch && localMatch.data && Array.isArray(localMatch.data.features) && localMatch.data.features.length > 0) {
    layer.data = localMatch.data;
    delete layer.isChunked;
    delete layer.totalChunks;
    delete layer.dataJson;
    return layer;
  }

  if (layer.isChunked) {
    try {
      const chunksCol = collection(db, 'gis_layers', layer.id, 'chunks');
      const chunksSnap = await getDocs(chunksCol);
      const chunkDocs = chunksSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      chunkDocs.sort((a: any, b: any) => (a.index || 0) - (b.index || 0));

      if (layer.totalChunks && chunkDocs.length !== layer.totalChunks) {
        console.warn(`Layer ${layer.id} chunk count mismatch: expected ${layer.totalChunks}, found ${chunkDocs.length}`);
        if (localMatch && localMatch.data) {
          layer.data = localMatch.data;
        } else {
          layer.data = { type: 'FeatureCollection', features: [] };
        }
      } else {
        const fullJsonStr = chunkDocs.map((c: any) => c.chunkStr || '').join('');
        layer.data = JSON.parse(fullJsonStr);
      }
    } catch (err) {
      handleFirestoreError(`reconstruct chunked layer ${layer.id}`, err);
      if (localMatch && localMatch.data) {
        layer.data = localMatch.data;
      } else {
        layer.data = { type: 'FeatureCollection', features: [] };
      }
    } finally {
      delete layer.isChunked;
      delete layer.totalChunks;
    }
  } else if (typeof layer.dataJson === 'string') {
    try {
      layer.data = JSON.parse(layer.dataJson);
      delete layer.dataJson;
    } catch (e) {
      console.warn(`Could not parse dataJson for layer ${layer.id}:`, e);
      if (localMatch && localMatch.data) {
        layer.data = localMatch.data;
      } else {
        layer.data = { type: 'FeatureCollection', features: [] };
      }
    }
  } else if (!layer.data) {
    if (localMatch && localMatch.data) {
      layer.data = localMatch.data;
    } else {
      layer.data = { type: 'FeatureCollection', features: [] };
    }
  }

  // Ensure data object is valid and protect local dataset from empty override
  if (!layer.data || typeof layer.data !== 'object') {
    if (localMatch && localMatch.data && Array.isArray(localMatch.data.features) && localMatch.data.features.length > 0) {
      layer.data = localMatch.data;
    } else {
      layer.data = { type: 'FeatureCollection', features: [] };
    }
  } else if ((!layer.data.features || layer.data.features.length === 0) && localMatch?.data?.features?.length > 0) {
    layer.data = localMatch.data;
  }

  return layer;
}

function deduplicateStoreItems<T extends { id: string }>(items: T[]): T[] {
  if (!Array.isArray(items)) return [];
  const map = new Map<string, T>();
  for (const item of items) {
    if (item && item.id) {
      map.set(item.id, item);
    }
  }
  return Array.from(map.values());
}

/**
 * Get all GIS Layers from Firestore.
 * Falls back to localBackupLayers if Firestore errors (e.g. Quota Exceeded).
 */
export async function getFirestoreLayers(localBackupLayers: any[] = []): Promise<any[]> {
  const isMockLayer = (l: any) =>
    l.id === 'layer-structures' ||
    l.id === 'layer-canals-main' ||
    l.name === 'Irrigation Structures & Control Gates' ||
    l.name === 'Canal Line Networks';

  if (isQuotaExhausted) {
    const filteredLocal = (localBackupLayers.length > 0 ? localBackupLayers : INITIAL_GIS_LAYERS).filter(l => !isMockLayer(l));
    return deduplicateStoreItems(filteredLocal);
  }

  try {
    const layersCol = collection(db, 'gis_layers');
    const snapshot = await getDocs(layersCol);

    if (snapshot.empty) {
      const filteredLocal = (localBackupLayers.length > 0 ? localBackupLayers : INITIAL_GIS_LAYERS).filter(l => !isMockLayer(l));
      return deduplicateStoreItems(filteredLocal);
    }

    const rawLayers: any[] = [];
    for (const d of snapshot.docs) {
      if (d.id === 'layer-structures' || d.id === 'layer-canals-main') {
        // Purge mock layers from Firestore if present
        deleteFirestoreLayer(d.id).catch(() => {});
        continue;
      }
      const data = d.data();
      const reconstructed = await reconstructLayerFromDoc(data, localBackupLayers);
      if (!isMockLayer(reconstructed)) {
        rawLayers.push(reconstructed);
      } else {
        deleteFirestoreLayer(reconstructed.id).catch(() => {});
      }
    }

    // Merge any local layers that might not be in Firestore yet
    for (const locL of localBackupLayers) {
      if (!isMockLayer(locL) && !rawLayers.some(l => l.id === locL.id)) {
        rawLayers.push(locL);
      }
    }

    const layers = deduplicateStoreItems(rawLayers);

    layers.sort((a, b) => {
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      return new Date(b.uploadedAt || 0).getTime() - new Date(a.uploadedAt || 0).getTime();
    });

    return layers;
  } catch (err) {
    handleFirestoreError('getLayers', err);
    const filteredLocal = (localBackupLayers.length > 0 ? localBackupLayers : INITIAL_GIS_LAYERS).filter(l => !isMockLayer(l));
    return deduplicateStoreItems(filteredLocal);
  }
}

/**
 * Save or update a single GIS Layer in Firestore. Handles large payloads via chunking.
 */
export async function saveFirestoreLayer(layer: any): Promise<void> {
  if (isQuotaExhausted) return;
  if (!layer || layer.id === 'layer-structures' || layer.id === 'layer-canals-main' || layer.name === 'Irrigation Structures & Control Gates' || layer.name === 'Canal Line Networks') {
    return;
  }

  try {
    const layerId = layer.id || `layer-${Date.now()}`;
    const dataJsonStr = JSON.stringify(layer.data || { type: 'FeatureCollection', features: [] });
    const isLarge = dataJsonStr.length > CHUNK_SIZE_BYTES;

    const docRef = doc(db, 'gis_layers', layerId);

    const baseMetadata: any = {
      id: layerId,
      name: layer.name || 'Custom Layer',
      category: layer.category || 'Custom Uploads',
      visible: layer.visible ?? true,
      color: layer.color || '#3b82f6',
      opacity: layer.opacity ?? 0.8,
      featureCount: layer.featureCount || (layer.data?.features ? layer.data.features.length : 0),
      geometryType: layer.geometryType || 'Mixed',
      uploadedAt: layer.uploadedAt || new Date().toISOString(),
      isDefault: layer.isDefault ?? false,
      sizeBytes: layer.sizeBytes || dataJsonStr.length
    };

    if (isLarge) {
      baseMetadata.isChunked = true;
      const numChunks = Math.ceil(dataJsonStr.length / CHUNK_SIZE_BYTES);
      baseMetadata.totalChunks = numChunks;

      await setDoc(docRef, baseMetadata, { merge: true });

      for (let i = 0; i < numChunks; i++) {
        const chunkStr = dataJsonStr.substring(i * CHUNK_SIZE_BYTES, (i + 1) * CHUNK_SIZE_BYTES);
        const chunkRef = doc(db, 'gis_layers', layerId, 'chunks', `chunk_${i}`);
        await setDoc(chunkRef, { index: i, chunkStr });
      }
    } else {
      baseMetadata.isChunked = false;
      baseMetadata.dataJson = dataJsonStr;
      await setDoc(docRef, baseMetadata, { merge: true });
    }
  } catch (err) {
    handleFirestoreError(`saveLayer ${layer.id}`, err);
  }
}

/**
 * Update lightweight metadata for a layer (e.g. visibility, opacity, color)
 */
export async function updateFirestoreLayer(layerId: string, updates: any): Promise<void> {
  if (isQuotaExhausted) return;

  try {
    const docRef = doc(db, 'gis_layers', layerId);
    await updateDoc(docRef, updates);
  } catch (err) {
    handleFirestoreError(`updateLayer ${layerId}`, err);
  }
}

/**
 * Delete a GIS Layer and its chunks from Firestore
 */
export async function deleteFirestoreLayer(layerId: string): Promise<void> {
  if (isQuotaExhausted) return;

  try {
    const chunksCol = collection(db, 'gis_layers', layerId, 'chunks');
    const chunksSnap = await getDocs(chunksCol);
    for (const cDoc of chunksSnap.docs) {
      await deleteDoc(doc(db, 'gis_layers', layerId, 'chunks', cDoc.id));
    }
    const docRef = doc(db, 'gis_layers', layerId);
    await deleteDoc(docRef);
  } catch (err) {
    handleFirestoreError(`deleteLayer ${layerId}`, err);
  }
}

/**
 * Get all Field Reports from Firestore.
 * Falls back to localBackupReports if Firestore errors (e.g. Quota Exceeded).
 */
export async function getFirestoreReports(localBackupReports: any[] = []): Promise<any[]> {
  if (isQuotaExhausted) {
    return deduplicateStoreItems(localBackupReports.length > 0 ? localBackupReports : INITIAL_FIELD_REPORTS);
  }

  try {
    const reportsCol = collection(db, 'field_reports');
    const snapshot = await getDocs(reportsCol);

    if (snapshot.empty) {
      return deduplicateStoreItems(localBackupReports.length > 0 ? localBackupReports : INITIAL_FIELD_REPORTS);
    }

    const rawReports: any[] = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

    // Merge any local reports not present in Firestore
    for (const locR of localBackupReports) {
      if (!rawReports.some(r => r.id === locR.id)) {
        rawReports.push(locR);
      }
    }

    const reports = deduplicateStoreItems(rawReports);

    reports.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

    return reports;
  } catch (err) {
    handleFirestoreError('getReports', err);
    return deduplicateStoreItems(localBackupReports.length > 0 ? localBackupReports : INITIAL_FIELD_REPORTS);
  }
}

/**
 * Save or update a Field Report in Firestore
 */
export async function saveFirestoreReport(report: any): Promise<any> {
  const reportId = report.id || `rep-${Date.now()}`;

  const cleanReport: any = {
    ...report,
    id: reportId,
    title: report.title || 'Field Work Update',
    reportType: report.reportType || 'desilting_work',
    lat: Number(report.lat) || 0,
    lng: Number(report.lng) || 0,
    canalSegment: report.canalSegment || '',
    parcelId: report.parcelId || '',
    completionPercent: Number(report.completionPercent) || 0,
    desiltingVolumeM3: Number(report.desiltingVolumeM3) || 0,
    status: report.status || 'In Progress',
    remarks: report.remarks || '',
    reporterName: report.reporterName || 'NIA Field Personnel',
    reporterRole: report.reporterRole || 'Field Personnel',
    approvalStatus: report.approvalStatus || 'Pending_PreApproval',
    currentTier: report.currentTier || 'Pending_NIS_Preparer',
    preApprovedBy: report.preApprovedBy || null,
    createdAt: report.createdAt || new Date().toISOString(),
    synced: true,
    photoUrl: report.photoUrl || '',
    photos: Array.isArray(report.photos) ? report.photos : (report.photoUrl ? [{ id: 'p1', url: report.photoUrl, stage: 'Photo' }] : []),
    tierHistory: Array.isArray(report.tierHistory) ? report.tierHistory : [],
    revisions: Array.isArray(report.revisions) ? report.revisions : [],
    hazardSeverity: report.hazardSeverity || null
  };

  if (isQuotaExhausted) {
    return cleanReport;
  }

  try {
    const docRef = doc(db, 'field_reports', reportId);
    await setDoc(docRef, cleanReport, { merge: true });
  } catch (err) {
    handleFirestoreError(`saveReport ${reportId}`, err);
  }

  return cleanReport;
}

/**
 * Batch save multiple field reports into Firestore
 */
export async function batchSaveFirestoreReports(reportsList: any[]): Promise<number> {
  let count = 0;
  for (const rep of reportsList) {
    await saveFirestoreReport(rep);
    count++;
  }
  return count;
}

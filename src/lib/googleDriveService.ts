import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, User } from 'firebase/auth';
import { FieldReport } from '../types';
import { generateWmrReportId } from '../utils/reportIdGenerator';

const metaEnv = typeof import.meta !== 'undefined' && (import.meta as any).env ? (import.meta as any).env : {};

const firebaseConfig = {
  apiKey: metaEnv.VITE_FIREBASE_API_KEY || 'AIzaSyD14vGu6jiO5qkAuKDIlPXcsheWurxJfFo',
  authDomain: metaEnv.VITE_FIREBASE_AUTH_DOMAIN || 'perfect-volt-1t3g1.firebaseapp.com',
  projectId: metaEnv.VITE_FIREBASE_PROJECT_ID || 'perfect-volt-1t3g1',
  appId: metaEnv.VITE_FIREBASE_APP_ID || '1:518397636928:web:7b708bba2ab7be69c14aa5',
};

// Reuse or initialize Firebase app
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/drive');
provider.addScope('https://www.googleapis.com/auth/drive.file');
provider.addScope('https://www.googleapis.com/auth/drive.readonly');
provider.addScope('https://www.googleapis.com/auth/drive.metadata.readonly');
provider.addScope('https://www.googleapis.com/auth/forms.body');
provider.addScope('https://www.googleapis.com/auth/forms.responses.readonly');

const DRIVE_TOKEN_KEY = 'nia_client_drive_token';

let isSigningIn = false;
let cachedAccessToken: string | null = (() => {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(DRIVE_TOKEN_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.token && parsed.expiresAt && Date.now() < parsed.expiresAt) {
        return parsed.token;
      }
    }
  } catch (_) {}
  return null;
})();

export const saveClientDriveToken = (token: string, expiresInSeconds: number = 3600) => {
  cachedAccessToken = token;
  try {
    const expiresAt = Date.now() + (expiresInSeconds * 1000) - 60000;
    localStorage.setItem(DRIVE_TOKEN_KEY, JSON.stringify({ token, expiresAt }));
  } catch (_) {}
};

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      const token = getAccessToken();
      if (token) {
        if (onAuthSuccess) onAuthSuccess(user, token);
      } else if (!isSigningIn) {
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      try { localStorage.removeItem(DRIVE_TOKEN_KEY); } catch (_) {}
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to obtain access token with Google Drive permissions');
    }

    saveClientDriveToken(credential.accessToken, 3600);
    return { user: result.user, accessToken: credential.accessToken };
  } catch (error: any) {
    console.error('Google Sign-In Error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = (): string | null => {
  if (cachedAccessToken) return cachedAccessToken;
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(DRIVE_TOKEN_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.token && parsed.expiresAt && Date.now() < parsed.expiresAt) {
        cachedAccessToken = parsed.token;
        return parsed.token;
      } else {
        localStorage.removeItem(DRIVE_TOKEN_KEY);
      }
    }
  } catch (_) {}
  return null;
};

export const logoutGoogle = async () => {
  await signOut(auth);
  cachedAccessToken = null;
  try { localStorage.removeItem(DRIVE_TOKEN_KEY); } catch (_) {}
};

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  size?: string;
}

// Fetch list of GIS / JSON / KML files from Google Drive
export const listDriveGISFiles = async (accessToken: string): Promise<DriveFileItem[]> => {
  const query = "(mimeType = 'application/json' or mimeType = 'application/geo+json' or name contains '.json' or name contains '.geojson' or name contains '.kml') and trashed = false";
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,modifiedTime,size)&pageSize=50&orderBy=modifiedTime desc`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google Drive API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return data.files || [];
};

// Download file content from Google Drive
export const downloadDriveFile = async (accessToken: string, fileId: string): Promise<string> => {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!res.ok) {
    throw new Error(`Failed to download file from Google Drive (${res.status})`);
  }

  return await res.text();
};

// Find or create a specific folder in Drive
export const getOrCreateFolder = async (
  accessToken: string,
  folderName: string = 'GeoPulse_GIS_Exports',
  parentFolderId?: string
): Promise<string> => {
  let q = `mimeType = 'application/vnd.google-apps.folder' and name = '${folderName}' and trashed = false`;
  if (parentFolderId) {
    q += ` and '${parentFolderId}' in parents`;
  }

  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (res.ok) {
    const data = await res.json();
    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }
  }

  // Create folder
  const folderMetadata: any = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder'
  };
  if (parentFolderId) {
    folderMetadata.parents = [parentFolderId];
  }

  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(folderMetadata)
  });

  if (!createRes.ok) {
    throw new Error(`Failed to create folder "${folderName}" in Google Drive`);
  }

  const folderData = await createRes.json();
  return folderData.id;
};

// Upload text or JSON file into a specific Google Drive folder
export const uploadFileToFolder = async (
  accessToken: string,
  folderId: string,
  fileName: string,
  content: string,
  mimeType: string = 'text/plain'
): Promise<DriveFileItem> => {
  const metadata = {
    name: fileName,
    mimeType,
    parents: [folderId]
  };

  const boundary = '-------314159265358979323846';
  const delimiter = "\r\n--" + boundary + "\r\n";
  const close_delim = "\r\n--" + boundary + "--";

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    `Content-Type: ${mimeType}\r\n\r\n` +
    content +
    close_delim;

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body: multipartRequestBody
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to upload file to Google Drive folder: ${err}`);
  }

  return await res.json();
};

// Upload binary data (e.g. decoded photo image) into a specific Google Drive folder
export const makeDriveItemPublic = async (accessToken: string, fileId: string): Promise<boolean> => {
  try {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions?supportsAllDrives=true`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        role: 'reader',
        type: 'anyone'
      })
    });
    return res.ok;
  } catch (_) {
    return false;
  }
};

export const uploadBinaryToFolder = async (
  accessToken: string,
  folderId: string,
  fileName: string,
  binaryData: Uint8Array,
  mimeType: string = 'image/jpeg'
): Promise<DriveFileItem> => {
  const metadata = {
    name: fileName,
    mimeType,
    parents: [folderId]
  };

  const boundary = '-------314159265358979323846';
  const delimiter = "\r\n--" + boundary + "\r\n";
  const close_delim = "\r\n--" + boundary + "--";

  const header = delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    `Content-Type: ${mimeType}\r\n\r\n`;

  const headerBytes = new TextEncoder().encode(header);
  const footerBytes = new TextEncoder().encode(close_delim);

  const combinedBlob = new Blob([headerBytes, binaryData, footerBytes], {
    type: `multipart/related; boundary=${boundary}`
  });

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body: combinedBlob
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to upload image binary to Google Drive: ${err}`);
  }

  const data = await res.json();
  if (data?.id) {
    makeDriveItemPublic(accessToken, data.id).catch(() => {});
  }
  return data;
};

// Upload GeoJSON layer / file to Google Drive
export const uploadFileToDrive = async (
  accessToken: string,
  fileName: string,
  content: string,
  mimeType: string = 'application/geo+json'
): Promise<DriveFileItem> => {
  const folderId = await getOrCreateFolder(accessToken, 'GeoPulse_GIS_Exports');
  return uploadFileToFolder(accessToken, folderId, fileName, content, mimeType);
};

// Designated Google Drive Folders per IMO
export const IMO_MAINTENANCE_FOLDER_IDS: Record<string, string> = {
  'MOMARO': '1zZoIVyjo_E-mGOax-_mfTHV8ep3FveSb',
  'Mindoro Oriental-Marinduque-Romblon IMO': '1zZoIVyjo_E-mGOax-_mfTHV8ep3FveSb',
  'Occidental Mindoro': '1EUAFseU-S5laT0oxRIEwBuXRgppqOUUf',
  'Occidental Mindoro IMO': '1EUAFseU-S5laT0oxRIEwBuXRgppqOUUf',
  'Palawan': '1bzraus7QiL8U3ZDSwLfgfLvdc1G5yMKB',
  'Palawan IMO': '1bzraus7QiL8U3ZDSwLfgfLvdc1G5yMKB'
};

export const getDesignatedFolderForImo = (imoOffice?: string): string => {
  if (!imoOffice) return '1zZoIVyjo_E-mGOax-_mfTHV8ep3FveSb';
  const lower = imoOffice.toLowerCase();
  if (lower.includes('palawan') || lower.includes('pimo')) return '1bzraus7QiL8U3ZDSwLfgfLvdc1G5yMKB';
  if (lower.includes('occidental') || lower.includes('mindoro occ') || lower.includes('oimo')) return '1EUAFseU-S5laT0oxRIEwBuXRgppqOUUf';
  return '1zZoIVyjo_E-mGOax-_mfTHV8ep3FveSb';
};

export const uploadMaintenanceReportToDrive = async (
  accessToken: string,
  report: FieldReport,
  parentFolderName?: string
): Promise<{ folderId: string; summaryFile: DriveFileItem; photoCount: number; updatedReport: FieldReport }> => {
  // Strict Safety Guard: Never upload mock field reports to Google Drive
  if (report?.id?.startsWith('mock-') || (report as any)?.isMock || String(report?.id).includes('mock')) {
    return { folderId: '', summaryFile: { id: '', name: 'mock_bypassed' } as any, photoCount: 0, updatedReport: report };
  }

  // 1. Determine designated IMO folder
  const parentFolderId = parentFolderName || getDesignatedFolderForImo(report.imoOffice);

  // 2. Create subfolder for this specific maintenance report: {Report ID}_{Sanitized Title (Max 30 chars)}
  const safeTitle = (report.title || 'Maintenance_Report').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30);
  const reportId = report.id || generateWmrReportId(report.nisBinding, report.imoOffice);
  const reportFolderName = `${reportId}_${safeTitle}`;
  const reportFolderId = await getOrCreateFolder(accessToken, reportFolderName, parentFolderId);

  // 3. Upload Photo Files into reportFolderId FIRST to capture Google Drive File IDs
  let photoCount = 0;
  const photosList = Array.isArray(report.photos) && report.photos.length > 0 
    ? report.photos 
    : (report.photoUrl ? [{ id: 'p1', url: report.photoUrl, stage: 'During' as const }] : []);

  const updatedPhotos: any[] = [];

  for (let i = 0; i < photosList.length; i++) {
    const photo = { ...photosList[i] };
    const stageName = (photo.stage || 'Photo').replace(/[^a-zA-Z0-9]/g, '');

    if (photo.url && photo.url.startsWith('data:image/')) {
      try {
        const matches = photo.url.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
        if (matches) {
          const mimeType = matches[1];
          const base64Data = matches[2];
          const byteCharacters = atob(base64Data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let j = 0; j < byteCharacters.length; j++) {
            byteNumbers[j] = byteCharacters.charCodeAt(j);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const ext = mimeType.split('/')[1] || 'png';
          const photoFileName = `Photo_${i + 1}_${stageName}.${ext}`;

          const uploadedItem = await uploadBinaryToFolder(accessToken, reportFolderId, photoFileName, byteArray, mimeType);
          if (uploadedItem?.id) {
            photo.id = uploadedItem.id;
            photo.driveFileId = uploadedItem.id;
            photo.url = `https://drive.google.com/thumbnail?id=${uploadedItem.id}&sz=w1200`;
            photo.thumbnailUrl = `https://drive.google.com/thumbnail?id=${uploadedItem.id}&sz=w1200`;
          }
          photoCount++;
        }
      } catch (e) {
        console.warn('Failed to upload base64 photo to Drive:', e);
      }
    } else if (photo.url) {
      const refFileName = `Photo_${i + 1}_Link.txt`;
      const linkContent = `Photo Stage: ${photo.stage || 'N/A'}\nCaptured At: ${photo.capturedAt || 'N/A'}\nURL: ${photo.url}`;
      await uploadFileToFolder(accessToken, reportFolderId, refFileName, linkContent, 'text/plain');
      photoCount++;
    }
    updatedPhotos.push(photo);
  }

  const updatedReport: FieldReport = {
    ...report,
    photos: updatedPhotos,
    photoUrl: updatedPhotos[0]?.url || report.photoUrl,
    synced: true
  };

  // 4. Format Human-Readable Text Summary Document
  const textSummary = `
===================================================================
GEOPULSE GIS O&M SYSTEM - FIELD MAINTENANCE & STATUS REPORT
===================================================================
Report ID:         ${updatedReport.id}
Report Title:      ${updatedReport.title}
Report Category:   ${updatedReport.categoryMode || updatedReport.reportType}
Status:            ${updatedReport.status}
Created At:        ${new Date(updatedReport.createdAt).toLocaleString()} (${updatedReport.createdAt})

-------------------------------------------------------------------
1. LOCATION & SPATIAL DATA
-------------------------------------------------------------------
Location Name:     ${updatedReport.locationName || 'N/A'}
Canal Segment:     ${updatedReport.canalSegment || 'N/A'}
Parcel ID:         ${updatedReport.parcelId || 'N/A'}
Latitude (GPS):    ${updatedReport.lat ?? 'N/A'}
Longitude (GPS):   ${updatedReport.lng ?? 'N/A'}
${updatedReport.secondLat !== undefined ? `Second Latitude:   ${updatedReport.secondLat}\n` : ''}${updatedReport.secondLng !== undefined ? `Second Longitude:  ${updatedReport.secondLng}\n` : ''}
-------------------------------------------------------------------
2. FIELD PARTICULARS & MAINTENANCE METRICS
-------------------------------------------------------------------
Maintenance Activity:  ${updatedReport.maintenanceActivity || 'N/A'}
Desilting Volume:      ${updatedReport.desiltingVolumeM3 ? `${updatedReport.desiltingVolumeM3} m³` : 'N/A'}
Completion Rate:       ${updatedReport.completionPercent !== undefined ? `${updatedReport.completionPercent}%` : 'N/A'}

-------------------------------------------------------------------
3. HYDROLOGICAL & OPERATIONAL VARIABLES
-------------------------------------------------------------------
Operational State:     ${updatedReport.operationalState || 'N/A'}
Water Level Gauge:     ${updatedReport.waterLevelMeters !== undefined ? `${updatedReport.waterLevelMeters} meters` : 'N/A'}
Discharge Flow Rate:   ${updatedReport.dischargeFlowM3s !== undefined ? `${updatedReport.dischargeFlowM3s} m³/s` : 'N/A'}
Gate Opening:          ${updatedReport.gateOpeningCm !== undefined ? `${updatedReport.gateOpeningCm} cm` : 'N/A'}
Water Quality:         ${updatedReport.waterQuality || 'N/A'}
Service Area:          ${updatedReport.beneficiaryServiceArea || 'N/A'}
Operational Incident:  ${updatedReport.operationalIncident || 'N/A'}

-------------------------------------------------------------------
4. INSPECTOR & STAFF METRICS
-------------------------------------------------------------------
Reporter Name:     ${updatedReport.reporterName}
Reporter Role:     ${updatedReport.reporterRole}
Sync Status:       Synced to Google Drive

-------------------------------------------------------------------
5. REMARKS & FIELD NOTES
-------------------------------------------------------------------
${updatedReport.remarks || 'No additional remarks.'}

-------------------------------------------------------------------
6. ATTACHED INSPECTION PHOTOS
-------------------------------------------------------------------
Total Photos: ${updatedReport.photos ? updatedReport.photos.length : (updatedReport.photoUrl ? 1 : 0)}
(Individual photo files are stored directly inside this Google Drive folder)
===================================================================
`.trim();

  // 5. Upload Text Summary file
  const summaryFileName = `Summary_${updatedReport.id}.txt`;
  const summaryFile = await uploadFileToFolder(accessToken, reportFolderId, summaryFileName, textSummary, 'text/plain');

  // 6. Upload Full JSON Raw Data file (with populated Drive URLs and IDs)
  const jsonFileName = `Data_${updatedReport.id}.json`;
  await uploadFileToFolder(accessToken, reportFolderId, jsonFileName, JSON.stringify(updatedReport, null, 2), 'application/json');

  return { folderId: reportFolderId, summaryFile, photoCount, updatedReport };
};

// Delete file from Google Drive (Requires user confirmation before calling)
export const deleteDriveFile = async (accessToken: string, fileId: string): Promise<void> => {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!res.ok) {
    throw new Error(`Failed to delete file from Google Drive (${res.status})`);
  }
};

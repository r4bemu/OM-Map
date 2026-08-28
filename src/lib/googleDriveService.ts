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

let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        // Token lost from memory (page refresh), user needs to click sign in to get fresh token with scopes
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
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

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Google Sign-In Error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const logoutGoogle = async () => {
  await signOut(auth);
  cachedAccessToken = null;
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

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
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

  return await res.json();
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

// Upload complete Maintenance / Field Report (text, variables, GPS, and photos) to Google Drive folder
export const uploadMaintenanceReportToDrive = async (
  accessToken: string,
  report: FieldReport,
  parentFolderName?: string
): Promise<{ folderId: string; summaryFile: DriveFileItem; photoCount: number }> => {
  // Strict Safety Guard: Never upload mock field reports to Google Drive
  if (report?.id?.startsWith('mock-') || (report as any)?.isMock || String(report?.id).includes('mock')) {
    return { folderId: '', summaryFile: { id: '', name: 'mock_bypassed' } as any, photoCount: 0 };
  }

  // 1. Determine designated IMO folder
  const parentFolderId = parentFolderName || getDesignatedFolderForImo(report.imoOffice);

  // 2. Create subfolder for this specific maintenance report: {Report ID}_{Sanitized Title (Max 30 chars)}
  const safeTitle = (report.title || 'Maintenance_Report').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30);
  const reportId = report.id || generateWmrReportId(report.nisBinding, report.imoOffice);
  const reportFolderName = `${reportId}_${safeTitle}`;
  const reportFolderId = await getOrCreateFolder(accessToken, reportFolderName, parentFolderId);

  // 3. Format Human-Readable Text Summary Document
  const textSummary = `
===================================================================
GEOPULSE GIS O&M SYSTEM - FIELD MAINTENANCE & STATUS REPORT
===================================================================
Report ID:         ${report.id}
Report Title:      ${report.title}
Report Category:   ${report.categoryMode || report.reportType}
Status:            ${report.status}
Created At:        ${new Date(report.createdAt).toLocaleString()} (${report.createdAt})

-------------------------------------------------------------------
1. LOCATION & SPATIAL DATA
-------------------------------------------------------------------
Location Name:     ${report.locationName || 'N/A'}
Canal Segment:     ${report.canalSegment || 'N/A'}
Parcel ID:         ${report.parcelId || 'N/A'}
Latitude (GPS):    ${report.lat ?? 'N/A'}
Longitude (GPS):   ${report.lng ?? 'N/A'}
${report.secondLat !== undefined ? `Second Latitude:   ${report.secondLat}\n` : ''}${report.secondLng !== undefined ? `Second Longitude:  ${report.secondLng}\n` : ''}
-------------------------------------------------------------------
2. FIELD PARTICULARS & MAINTENANCE METRICS
-------------------------------------------------------------------
Maintenance Activity:  ${report.maintenanceActivity || 'N/A'}
Desilting Volume:      ${report.desiltingVolumeM3 ? `${report.desiltingVolumeM3} m³` : 'N/A'}
Completion Rate:       ${report.completionPercent !== undefined ? `${report.completionPercent}%` : 'N/A'}

-------------------------------------------------------------------
3. HYDROLOGICAL & OPERATIONAL VARIABLES
-------------------------------------------------------------------
Operational State:     ${report.operationalState || 'N/A'}
Water Level Gauge:     ${report.waterLevelMeters !== undefined ? `${report.waterLevelMeters} meters` : 'N/A'}
Discharge Flow Rate:   ${report.dischargeFlowM3s !== undefined ? `${report.dischargeFlowM3s} m³/s` : 'N/A'}
Gate Opening:          ${report.gateOpeningCm !== undefined ? `${report.gateOpeningCm} cm` : 'N/A'}
Water Quality:         ${report.waterQuality || 'N/A'}
Service Area:          ${report.beneficiaryServiceArea || 'N/A'}
Operational Incident:  ${report.operationalIncident || 'N/A'}

-------------------------------------------------------------------
4. INSPECTOR & STAFF METRICS
-------------------------------------------------------------------
Reporter Name:     ${report.reporterName}
Reporter Role:     ${report.reporterRole}
Sync Status:       ${report.synced ? 'Synced to Server' : 'Local Queue'}

-------------------------------------------------------------------
5. REMARKS & FIELD NOTES
-------------------------------------------------------------------
${report.remarks || 'No additional remarks.'}

-------------------------------------------------------------------
6. ATTACHED INSPECTION PHOTOS
-------------------------------------------------------------------
Total Photos: ${report.photos ? report.photos.length : (report.photoUrl ? 1 : 0)}
(Individual photo files are stored directly inside this Google Drive folder)
===================================================================
`.trim();

  // 4. Upload Text Summary file
  const summaryFileName = `Summary_${report.id}.txt`;
  const summaryFile = await uploadFileToFolder(accessToken, reportFolderId, summaryFileName, textSummary, 'text/plain');

  // 5. Upload Full JSON Raw Data file
  const jsonFileName = `Data_${report.id}.json`;
  await uploadFileToFolder(accessToken, reportFolderId, jsonFileName, JSON.stringify(report, null, 2), 'application/json');

  // 6. Upload Photo Files into reportFolderId
  let photoCount = 0;
  const photosList = report.photos || (report.photoUrl ? [{ id: 'p1', url: report.photoUrl, stage: 'During' as const }] : []);

  for (let i = 0; i < photosList.length; i++) {
    const photo = photosList[i];
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
          const stageName = (photo.stage || 'Photo').replace(/[^a-zA-Z0-9]/g, '');
          const photoFileName = `Photo_${i + 1}_${stageName}.${ext}`;

          await uploadBinaryToFolder(accessToken, reportFolderId, photoFileName, byteArray, mimeType);
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
  }

  return { folderId: reportFolderId, summaryFile, photoCount };
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

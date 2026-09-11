import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { generateWmrReportId } from '../utils/reportIdGenerator.js';
import {
  loadLocalManifest,
  saveLocalManifest,
  computeManifestHash,
  findRemoteManifestInFolder,
  downloadRemoteManifest,
  uploadOrUpdateRemoteManifest,
  ReportManifestEntry,
  DriveManifest
} from './driveManifest.js';

// Automatically load environment variables if not already loaded
if (typeof (process as any).loadEnvFile === 'function') {
  try {
    (process as any).loadEnvFile();
  } catch (e) {}
}

const DATA_DIR = process.env.USER_DATA_DIR || path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) {}
}
const TOKEN_FILE_PATH = path.join(DATA_DIR, 'persistent_drive_token.json');

// Designated Google Drive Folders per IMO for Maintenance & Operational Reports
export const IMO_DESIGNATED_FOLDERS: Record<string, string> = {
  'MOMARO': '1zZoIVyjo_E-mGOax-_mfTHV8ep3FveSb',
  'Mindoro Oriental-Marinduque-Romblon IMO': '1zZoIVyjo_E-mGOax-_mfTHV8ep3FveSb',
  'Occidental Mindoro': '1EUAFseU-S5laT0oxRIEwBuXRgppqOUUf',
  'Occidental Mindoro IMO': '1EUAFseU-S5laT0oxRIEwBuXRgppqOUUf',
  'Palawan': '1bzraus7QiL8U3ZDSwLfgfLvdc1G5yMKB',
  'Palawan IMO': '1bzraus7QiL8U3ZDSwLfgfLvdc1G5yMKB'
};

export function getDesignatedFolderForImo(imoOffice?: string): string {
  if (!imoOffice) return '1zZoIVyjo_E-mGOax-_mfTHV8ep3FveSb';
  const lower = imoOffice.toLowerCase();
  if (lower.includes('palawan') || lower.includes('pimo')) {
    return '1bzraus7QiL8U3ZDSwLfgfLvdc1G5yMKB';
  }
  if (lower.includes('occidental') || lower.includes('mindoro occ') || lower.includes('oimo')) {
    return '1EUAFseU-S5laT0oxRIEwBuXRgppqOUUf';
  }
  return '1zZoIVyjo_E-mGOax-_mfTHV8ep3FveSb';
}

let inMemoryToken: string | null = process.env.GOOGLE_DRIVE_ACCESS_TOKEN || null;
let tokenExpiresAt: number = 0;

// Try loading persisted token on startup
try {
  if (fs.existsSync(TOKEN_FILE_PATH)) {
    const raw = fs.readFileSync(TOKEN_FILE_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed.accessToken) {
      inMemoryToken = parsed.accessToken;
      if (parsed.expiresAt) {
        tokenExpiresAt = parsed.expiresAt;
      }
    }
  }
} catch (e) {
  console.warn('Failed to load persistent_drive_token.json:', e);
}

export function saveServerDriveToken(token: string, expiresInSeconds: number = 3600): void {
  inMemoryToken = token;
  tokenExpiresAt = Date.now() + (expiresInSeconds * 1000) - 60000; // Expire 1 min early for safety

  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(TOKEN_FILE_PATH, JSON.stringify({
      accessToken: token,
      expiresAt: tokenExpiresAt,
      updatedAt: new Date().toISOString()
    }, null, 2));
  } catch (err) {
    console.error('Failed to persist Drive token:', err);
  }
}

export function getServerDriveToken(): string | null {
  return inMemoryToken || process.env.GOOGLE_DRIVE_ACCESS_TOKEN || null;
}

async function getServiceAccountToken(): Promise<string | null> {
  const possiblePaths = [
    path.join(process.cwd(), 'service_account.json'),
    path.join(DATA_DIR, 'service_account.json')
  ];
  let keyContent = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '';
  if (!keyContent) {
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        try {
          keyContent = fs.readFileSync(p, 'utf-8');
          break;
        } catch (_) {}
      }
    }
  }
  if (!keyContent) return null;

  try {
    const key = JSON.parse(keyContent);
    if (!key.client_email || !key.private_key) return null;

    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'RS256', typ: 'JWT' };
    const payload = {
      iss: key.client_email,
      scope: 'https://www.googleapis.com/auth/drive',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now
    };
    const base64Url = (str: string) => Buffer.from(str).toString('base64url');
    const signInput = base64Url(JSON.stringify(header)) + '.' + base64Url(JSON.stringify(payload));
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(signInput);
    const signature = signer.sign(key.private_key, 'base64url');
    const assertion = signInput + '.' + signature;

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion
      })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.access_token) {
        saveServerDriveToken(data.access_token, data.expires_in || 3500);
        return data.access_token;
      }
    } else {
      console.warn('Service Account token refresh response:', await res.text());
    }
  } catch (err: any) {
    console.warn('Service Account token generation failed:', err.message);
  }
  return null;
}

export async function getOrRefreshServerDriveToken(providedToken?: string): Promise<string | null> {
  if (providedToken) return providedToken;

  // Return cached in-memory token if still valid
  if (inMemoryToken && Date.now() < tokenExpiresAt) {
    return inMemoryToken;
  }

  // 1. Try Service Account Key (Permanent, Machine-to-Machine)
  const saToken = await getServiceAccountToken();
  if (saToken) {
    return saToken;
  }

  // 2. Fallback to OAuth 2.0 refresh token
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (clientId && clientSecret && refreshToken) {
    try {
      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token'
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.access_token) {
          saveServerDriveToken(data.access_token, data.expires_in || 3500);
          return data.access_token;
        }
      } else {
        console.warn('Failed to refresh token using GOOGLE_REFRESH_TOKEN:', await res.text());
      }
    } catch (err) {
      console.warn('Error auto-refreshing Google Drive token:', err);
    }
  }

  return getServerDriveToken();
}

export function getTargetFolderId(): string {
  return '1zZoIVyjo_E-mGOax-_mfTHV8ep3FveSb';
}

// Find or create a specific folder in Google Drive using REST API
export async function getOrCreateFolderOnDrive(
  accessToken: string,
  folderName: string,
  parentFolderId?: string
): Promise<string> {
  let q = `mimeType = 'application/vnd.google-apps.folder' and name = '${folderName.replace(/'/g, "\\'")}' and trashed = false`;
  if (parentFolderId) {
    q += ` and '${parentFolderId}' in parents`;
  }

  try {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&supportsAllDrives=true&includeItemsFromAllDrives=true`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (res.ok) {
      const data = await res.json();
      if (data.files && data.files.length > 0) {
        return data.files[0].id;
      }
    }
  } catch (e) {}

  // Create subfolder
  const folderMetadata: any = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder'
  };
  if (parentFolderId) {
    folderMetadata.parents = [parentFolderId];
  }

  const createRes = await fetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(folderMetadata)
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Failed to create subfolder "${folderName}" in Google Drive: ${errText}`);
  }

  const folderData = await createRes.json();
  // Grant public read permission to folder
  makeDriveFilePublic(accessToken, folderData.id).catch(() => {});
  return folderData.id;
}

// Automatically grant public read permissions to any Drive asset for seamless cross-client CDN streaming
export async function makeDriveFilePublic(accessToken: string, fileId: string): Promise<boolean> {
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
  } catch (err) {
    return false;
  }
}

// Upload text file into a specific Drive folder
export async function uploadTextFileToFolder(
  accessToken: string,
  folderId: string,
  fileName: string,
  content: string,
  mimeType: string = 'text/plain'
) {
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

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body: multipartRequestBody
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Drive text upload failed: ${errText}`);
  }

  const data = await res.json();
  if (data?.id) {
    makeDriveFilePublic(accessToken, data.id).catch(() => {});
  }
  return data;
}

// Upload binary buffer (e.g., photo) into a specific Drive folder
export async function uploadBinaryToFolder(
  accessToken: string,
  folderId: string,
  fileName: string,
  buffer: Buffer,
  mimeType: string = 'image/jpeg',
  extraMetadata?: { description?: string; appProperties?: Record<string, string> }
) {
  const metadata: any = {
    name: fileName,
    mimeType,
    parents: [folderId]
  };

  if (extraMetadata?.description) {
    metadata.description = extraMetadata.description;
  }
  if (extraMetadata?.appProperties) {
    metadata.appProperties = extraMetadata.appProperties;
  }

  const boundary = '-------314159265358979323846';
  const delimiter = "\r\n--" + boundary + "\r\n";
  const close_delim = "\r\n--" + boundary + "--";

  const header = delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    `Content-Type: ${mimeType}\r\n\r\n`;

  const headerBytes = Buffer.from(header, 'utf-8');
  const footerBytes = Buffer.from(close_delim, 'utf-8');
  const combinedBuffer = Buffer.concat([headerBytes, buffer, footerBytes]);

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body: combinedBuffer
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Drive binary upload failed: ${errText}`);
  }

  const data = await res.json();
  if (data?.id) {
    makeDriveFilePublic(accessToken, data.id).catch(() => {});
  }
  return data;
}

// Upload a complete field report directly into the designated Google Drive IMO folder
export async function uploadReportToTargetDriveFolder(
  report: any,
  providedToken?: string
): Promise<{ success: boolean; reportFolderId: string; photoCount: number; message: string }> {
  // Strict Safety Guard: Never upload mock field reports to Google Drive
  if (report?.id?.startsWith('mock-') || report?.isMock || String(report?.id).includes('mock')) {
    return {
      success: true,
      reportFolderId: '',
      photoCount: 0,
      message: 'Mock field report strictly bypassed from Google Drive upload.'
    };
  }

  const accessToken = await getOrRefreshServerDriveToken(providedToken);

  if (!accessToken) {
    console.warn('⚠️ Google Drive Access Token not available on server. Report saved locally.');
    return {
      success: false,
      reportFolderId: '',
      photoCount: 0,
      message: 'Server Google Drive sync token not active. Report saved to local database.'
    };
  }

  try {
    // Route to the designated IMO folder:
    // MOMARO: "1zZoIVyjo_E-mGOax-_mfTHV8ep3FveSb"
    // Occidental Mindoro: "1EUAFseU-S5laT0oxRIEwBuXRgppqOUUf"
    // Palawan: "1bzraus7QiL8U3ZDSwLfgfLvdc1G5yMKB"
    const imoOffice = report.imoOffice || 'Mindoro Oriental-Marinduque-Romblon IMO';
    const parentFolderId = getDesignatedFolderForImo(imoOffice);

    console.log(`📁 Routing report ${report.id} to designated Google Drive folder for ${imoOffice} (${parentFolderId})`);

    // 1. Create subfolder for this specific report inside target Drive folder: {Report ID}_{Sanitized Title (Max 30 chars)}
    const safeTitle = (report.title || 'Report').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30);
    const reportId = report.id || generateWmrReportId(report.nisBinding, report.imoOffice);
    const reportFolderName = `${reportId}_${safeTitle}`;
    const reportFolderId = await getOrCreateFolderOnDrive(accessToken, reportFolderName, parentFolderId);

    // 2. Format Human-Readable Text Summary Document
    const textSummary = `
===================================================================
NATIONAL IRRIGATION ADMINISTRATION (NIA) REGION IV-B
O&M FIELD MAINTENANCE & OPERATIONAL REPORT
===================================================================
Report ID:         ${report.id}
Report Title:      ${report.title}
Report Category:   ${report.categoryMode || report.reportType || 'Field Inspection'}
IMO Office:        ${imoOffice}
NIS Binding:       ${report.nisBinding || 'N/A'}
Status:            ${report.status || 'Submitted'}
Approval Status:   ${report.approvalStatus || 'Pending_PreApproval'}
Created At:        ${new Date(report.createdAt || Date.now()).toLocaleString()} (${report.createdAt})

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
Accomplishment Dist:   ${report.segmentDistanceFormatted || (report.segmentDistanceMeters ? `${report.segmentDistanceMeters.toLocaleString()} m` : 'N/A')}
Estimated Depth:       ${report.depthMeters !== undefined ? `${report.depthMeters} m` : 'N/A'}
Estimated Width:       ${report.widthMeters !== undefined ? `${report.widthMeters} m` : 'N/A'}
Sand Pile Height (H):  ${report.sandPileHeightMeters !== undefined ? `${report.sandPileHeightMeters} m` : 'N/A'}
Painting Area:         ${report.paintedAreaSqm !== undefined ? `${report.paintedAreaSqm} m²` : 'N/A'}
Calculated Volume:     ${report.calculatedVolumeM3 !== undefined ? `${report.calculatedVolumeM3} m³` : (report.desiltingVolumeM3 ? `${report.desiltingVolumeM3} m³` : 'N/A')}
Dimension Details:     ${report.dimensionDetailsFormatted || 'N/A'}
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
4. INSPECTOR & SUBMISSION DETAILS
-------------------------------------------------------------------
Reporter Name:     ${report.reporterName || 'NIA Field Personnel'}
Reporter Role:     ${report.reporterRole || 'Field Personnel'}
Pre-Approved By:   ${report.preApprovedBy || 'Pending'} (${report.preApprovedAt || 'N/A'})
Final Approved By: ${report.approvedBy || 'Pending'} (${report.approvedAt || 'N/A'})

-------------------------------------------------------------------
5. REMARKS & FIELD NOTES
-------------------------------------------------------------------
${report.remarks || 'No additional remarks provided.'}

-------------------------------------------------------------------
6. ATTACHED INSPECTION PHOTOS
-------------------------------------------------------------------
Total Photos: ${report.photos ? report.photos.length : (report.photoUrl ? 1 : 0)}
===================================================================
`;

    // 3. Upload ALL Attached High-Resolution Inspection Photos FIRST & Pre-Cache on Disk
    let photoCount = 0;
    const photosList = Array.isArray(report.photos) && report.photos.length > 0 
      ? report.photos 
      : (report.photoUrl ? [{ id: 'p1', url: report.photoUrl, stage: 'Photo' }] : []);

    const DRIVE_CACHE_DIR = path.join(DATA_DIR, 'drive_cache');
    if (!fs.existsSync(DRIVE_CACHE_DIR)) {
      try { fs.mkdirSync(DRIVE_CACHE_DIR, { recursive: true }); } catch (e) {}
    }

    const updatedPhotos: any[] = [];

    for (let i = 0; i < photosList.length; i++) {
      const photo = { ...photosList[i] };
      if (!photo || !photo.url) {
        updatedPhotos.push(photo);
        continue;
      }

      const stageName = ((photo.stage || ('Stage_' + (i + 1))) as string).replace(/[^a-zA-Z0-9]/g, '');
      const photoImo = photo.imoOffice || report.imoOffice || imoOffice;
      const photoLoc = photo.locationName || report.locationName || 'Irrigation Facility';
      const photoCanal = photo.canalSegment || report.canalSegment || '';
      const photoParcel = photo.parcelId || report.parcelId || '';
      const photoLat = photo.lat ?? report.lat ?? '';
      const photoLng = photo.lng ?? report.lng ?? '';
      const capturedDate = photo.capturedAt || report.createdAt || new Date().toISOString();

      const photoDescription = 'NIA O&M Field Photo | IMO: ' + photoImo + ' | Location: ' + photoLoc + (photoCanal ? ' | Canal: ' + photoCanal : '') + (photoParcel ? ' | Parcel: ' + photoParcel : '') + ' | GPS: ' + photoLat + ', ' + photoLng + ' | Stage: ' + (photo.stage || 'During') + ' | Captured: ' + capturedDate;

      const photoAppProps: Record<string, string> = {
        imoOffice: String(photoImo),
        locationName: String(photoLoc),
        canalSegment: String(photoCanal),
        parcelId: String(photoParcel),
        reportId: String(report.id || ''),
        stage: String(photo.stage || 'During'),
        lat: String(photoLat),
        lng: String(photoLng),
        capturedAt: String(capturedDate)
      };

      let uploadedDriveFile: any = null;
      let rawImageBuffer: Buffer | null = null;

      if (photo.url.startsWith('data:image/')) {
        try {
          const matches = photo.url.match(/^data:(image\/[^;]+);base64,([\s\S]+)$/);
          if (matches) {
            const rawMime = matches[1].toLowerCase();
            const cleanBase64 = matches[2].replace(/[\r\n\s]/g, '');
            rawImageBuffer = Buffer.from(cleanBase64, 'base64');
            
            let ext = 'jpeg';
            if (rawMime.includes('png')) ext = 'png';
            else if (rawMime.includes('webp')) ext = 'webp';
            else if (rawMime.includes('gif')) ext = 'gif';
            else if (rawMime.includes('heic')) ext = 'heic';
            else if (rawMime.includes('jpg') || rawMime.includes('jpeg')) ext = 'jpg';

            const photoFileName = 'Photo_' + (i + 1) + '_' + stageName + '.' + ext;
            uploadedDriveFile = await uploadBinaryToFolder(accessToken, reportFolderId, photoFileName, rawImageBuffer, rawMime, {
              description: photoDescription,
              appProperties: photoAppProps
            });
            photoCount++;
            console.log('[Photo Upload] Successfully uploaded Photo ' + (i + 1) + '/' + photosList.length + ' (' + stageName + ') to Drive folder ' + reportFolderId);
          }
        } catch (e) {
          console.warn('[Photo Upload] Failed to upload base64 photo ' + (i + 1) + ' to Drive:', e);
        }
      } else if (photo.url.startsWith('http://') || photo.url.startsWith('https://')) {
        try {
          const imgRes = await fetch(photo.url);
          if (imgRes.ok) {
            const arrayBuffer = await imgRes.arrayBuffer();
            rawImageBuffer = Buffer.from(arrayBuffer);
            const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
            let ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';

            const photoFileName = 'Photo_' + (i + 1) + '_' + stageName + '.' + ext;
            uploadedDriveFile = await uploadBinaryToFolder(accessToken, reportFolderId, photoFileName, rawImageBuffer, contentType, {
              description: photoDescription,
              appProperties: photoAppProps
            });
            photoCount++;
            console.log('[Photo Upload] Successfully uploaded remote photo ' + (i + 1) + '/' + photosList.length + ' to Drive folder ' + reportFolderId);
          }
        } catch (e) {
          console.warn('[Photo Upload] Failed to upload remote photo ' + (i + 1) + ' to Drive:', e);
        }
      }

      if (uploadedDriveFile && uploadedDriveFile.id) {
        const fileId = uploadedDriveFile.id;
        photo.id = fileId;
        photo.driveFileId = fileId;
        photo.url = 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w1200';
        photo.thumbnailUrl = uploadedDriveFile.thumbnailLink || ('https://drive.google.com/thumbnail?id=' + fileId + '&sz=w1200');

        // Pre-cache on disk immediately
        if (rawImageBuffer && rawImageBuffer.length > 0) {
          try {
            fs.writeFileSync(path.join(DRIVE_CACHE_DIR, 'photo_' + fileId + '.bin'), rawImageBuffer);
          } catch (_) {}
        }
      }

      updatedPhotos.push(photo);
    }

    report.photos = updatedPhotos;
    if (updatedPhotos[0]?.url) {
      report.photoUrl = updatedPhotos[0].url;
    }

    // 4. Upload Human-Readable Audit Summary Text File & Raw Data JSON (with populated Drive File IDs)
    const summaryFileName = 'Summary_' + report.id + '.txt';
    await uploadTextFileToFolder(accessToken, reportFolderId, summaryFileName, textSummary, 'text/plain');

    const jsonFileName = 'Data_' + report.id + '.json';
    await uploadTextFileToFolder(accessToken, reportFolderId, jsonFileName, JSON.stringify(report, null, 2), 'application/json');

    // 5. Update local and remote Drive Manifest for instant single-request sync
    try {
      const localManifest = loadLocalManifest() || {
        version: 1,
        lastUpdated: new Date().toISOString(),
        hash: '',
        totalReports: 0,
        reportsIndex: {}
      };

      localManifest.reportsIndex[report.id] = {
        id: report.id,
        folderId: reportFolderId,
        folderName: 'wmr-' + report.id,
        imoOffice: String(report.imoOffice || imoOffice),
        nisBinding: report.nisBinding,
        modifiedTime: new Date().toISOString(),
        photoCount,
        title: report.title,
        status: report.status
      };
      localManifest.totalReports = Object.keys(localManifest.reportsIndex).length;
      localManifest.version = (localManifest.version || 0) + 1;
      localManifest.lastUpdated = new Date().toISOString();
      localManifest.hash = computeManifestHash(localManifest.reportsIndex);

      saveLocalManifest(localManifest);

      // Asynchronously upload/update manifest in the target IMO folder (non-blocking)
      findRemoteManifestInFolder(accessToken, parentFolderId).then(existing => {
        uploadOrUpdateRemoteManifest(accessToken, parentFolderId, localManifest, existing?.id);
      }).catch(e => console.warn('Manifest drive upload notice:', e));
    } catch (mErr) {
      console.warn('Local manifest update notice:', mErr);
    }

    console.log('[Drive Sync] Completed Google Drive sync for Report ' + report.title + '. Folder ID: ' + reportFolderId + ', Uploaded Photos: ' + photoCount);
    return {
      success: true,
      reportFolderId,
      photoCount,
      message: 'Report and ' + photoCount + ' photo(s) successfully backed up to designated Google Drive folder for ' + imoOffice + '.'
    };
  } catch (err: any) {
    console.error('❌ Error uploading report to Google Drive:', err);
    return {
      success: false,
      reportFolderId: '',
      photoCount: 0,
      message: 'Failed to upload to Google Drive: ' + (err.message || err)
    };
  }
}

// List all vector GIS files (KMZ, KML, GeoJSON) in a specific Drive folder
export async function listDriveGISFilesInFolder(
  accessToken: string,
  folderId: string
): Promise<Array<{ id: string; name: string; mimeType: string; size?: string; modifiedTime?: string }>> {
  const query = "'" + folderId + "' in parents and trashed = false";
  const url = 'https://www.googleapis.com/drive/v3/files?q=' + encodeURIComponent(query) + '&fields=files(id,name,mimeType,size,modifiedTime)&pageSize=100&supportsAllDrives=true&includeItemsFromAllDrives=true';

  const res = await fetch(url, {
    headers: { Authorization: 'Bearer ' + accessToken }
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error('Drive list error: ' + err);
  }

  const data = await res.json();
  const allFiles = data.files || [];

  return allFiles.filter((f: any) => {
    const name = (f.name || '').toLowerCase();
    return name.endsWith('.kmz') || 
           name.endsWith('.kml') || 
           name.endsWith('.geojson') || 
           name.endsWith('.json') ||
           f.mimeType === 'application/vnd.google-earth.kmz' ||
           f.mimeType === 'application/vnd.google-earth.kml+xml' ||
           f.mimeType === 'application/geo+json' ||
           f.mimeType === 'application/json';
  });
}

// Download binary buffer of a Drive file
export async function downloadDriveBinaryBuffer(
  accessToken: string,
  fileId: string
): Promise<Buffer> {
  const url = 'https://www.googleapis.com/drive/v3/files/' + fileId + '?alt=media&supportsAllDrives=true';
  const res = await fetch(url, {
    headers: { Authorization: 'Bearer ' + accessToken }
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error('Failed to download Drive file ' + fileId + ': ' + err);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// Download text of a Drive file
export async function downloadDriveFileText(
  accessToken: string,
  fileId: string
): Promise<string> {
  const url = 'https://www.googleapis.com/drive/v3/files/' + fileId + '?alt=media&supportsAllDrives=true';
  const res = await fetch(url, {
    headers: { Authorization: 'Bearer ' + accessToken }
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error('Failed to download Drive text file ' + fileId + ': ' + err);
  }

  return await res.text();
}

// Helper to parse human-readable Summary text into a complete FieldReport object
export function parseSummaryToReport(
  text: string,
  folderName: string,
  files: any[],
  imoName: string
): any {
  const lines = text.split('\n');
  const getVal = (prefix: string): string | undefined => {
    const line = lines.find(l => l.toLowerCase().startsWith(prefix.toLowerCase()));
    if (!line) return undefined;
    const parts = line.split(':');
    if (parts.length < 2) return undefined;
    const val = parts.slice(1).join(':').trim();
    return val === 'N/A' || val === 'Pending' ? undefined : val;
  };

  const imoOffice = getVal('IMO Office:') || imoName;
  const nisBinding = getVal('NIS Binding:');

  const extractedIdFromFolder = folderName.startsWith('Report_')
    ? folderName.replace(/^Report_/, '').split('_')[0]
    : folderName.split('_')[0];
  const id = getVal('Report ID:') || (extractedIdFromFolder?.startsWith('wmr-') || extractedIdFromFolder?.startsWith('rep-') ? extractedIdFromFolder : generateWmrReportId(nisBinding, imoOffice));
  const title = getVal('Report Title:') || 'Field Inspection Report';
  const categoryMode = (getVal('Report Category:')?.toLowerCase().includes('oper') ? 'operational' : 'maintenance');
  const status = getVal('Status:') || 'Completed';
  const approvalStatus = getVal('Approval Status:') || 'Pending_PreApproval';
  
  const rawCreatedAt = getVal('Created At:');
  let createdAt = new Date().toISOString();
  if (rawCreatedAt) {
    const match = rawCreatedAt.match(/\(([^)]+)\)/);
    if (match) createdAt = match[1];
    else {
      const d = new Date(rawCreatedAt);
      if (!isNaN(d.getTime())) createdAt = d.toISOString();
    }
  }

  const locationName = getVal('Location Name:');
  const canalSegment = getVal('Canal Segment:');
  const parcelId = getVal('Parcel ID:');
  const lat = parseFloat(getVal('Latitude (GPS):') || '0') || undefined;
  const lng = parseFloat(getVal('Longitude (GPS):') || '0') || undefined;
  const secondLat = parseFloat(getVal('Second Latitude:') || '0') || undefined;
  const secondLng = parseFloat(getVal('Second Longitude:') || '0') || undefined;

  const maintenanceActivity = getVal('Maintenance Activity:');
  const segmentDistStr = getVal('Accomplishment Dist:');
  let segmentDistanceMeters: number | undefined = undefined;
  if (segmentDistStr) {
    const m = segmentDistStr.match(/([0-9.,]+)/);
    if (m) segmentDistanceMeters = parseFloat(m[1].replace(/,/g, ''));
  }
  const depthMeters = parseFloat(getVal('Estimated Depth:') || '0') || undefined;
  const widthMeters = parseFloat(getVal('Estimated Width:') || '0') || undefined;
  const sandPileHeightMeters = parseFloat(getVal('Sand Pile Height (H):') || '0') || undefined;
  const paintedAreaSqm = parseFloat(getVal('Painting Area:') || '0') || undefined;
  const calculatedVolumeM3 = parseFloat(getVal('Calculated Volume:') || '0') || undefined;
  const dimensionDetailsFormatted = getVal('Dimension Details:');
  const completionPercent = parseInt(getVal('Completion Rate:') || '0', 10) || undefined;

  const operationalState = getVal('Operational State:');
  const waterLevelMeters = parseFloat(getVal('Water Level Gauge:') || '0') || undefined;
  const dischargeFlowM3s = parseFloat(getVal('Discharge Flow Rate:') || '0') || undefined;
  const gateOpeningCm = parseFloat(getVal('Gate Opening:') || '0') || undefined;
  const waterQuality = getVal('Water Quality:');
  const beneficiaryServiceArea = getVal('Service Area:');
  const operationalIncident = getVal('Operational Incident:');

  const reporterName = getVal('Reporter Name:') || 'NIA Field Personnel';
  const reporterRole = getVal('Reporter Role:') || 'Field Personnel';
  const preApprovedBy = getVal('Pre-Approved By:');
  const approvedBy = getVal('Final Approved By:');

  let remarks = '';
  const remIdx = lines.findIndex(l => l.includes('5. REMARKS & FIELD NOTES'));
  const nextIdx = lines.findIndex(l => l.includes('6. ATTACHED INSPECTION PHOTOS'));
  if (remIdx !== -1 && nextIdx !== -1 && nextIdx > remIdx + 2) {
    remarks = lines.slice(remIdx + 2, nextIdx - 1).join('\n').trim();
    if (remarks === 'No additional remarks provided.' || remarks === 'No additional remarks.') remarks = '';
  }

  // Parse attached photos
  const photoFiles = files
    .filter(f => f.mimeType?.startsWith('image/') || /\.(jpe?g|png|webp|heic)$/i.test(f.name))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  const photos = photoFiles.map((pf, idx) => {
    let stage: 'Before' | 'During' | 'After' = 'During';
    const lowerName = pf.name.toLowerCase();
    if (lowerName.includes('before')) stage = 'Before';
    else if (lowerName.includes('after')) stage = 'After';

    return {
      id: pf.id,
      url: '/api/drive/photo/' + pf.id,
      driveFileId: pf.id,
      thumbnailUrl: pf.thumbnailLink,
      stage,
      caption: stage + ' Activity Documentation #' + (idx + 1),
      capturedAt: createdAt,
      locationName,
      canalSegment,
      lat,
      lng
    };
  });

  return {
    id,
    title,
    reportType: categoryMode,
    categoryMode,
    imoOffice,
    nisBinding,
    status,
    approvalStatus,
    createdAt,
    lat: lat || 13.0,
    lng: lng || 121.0,
    secondLat,
    secondLng,
    locationName,
    canalSegment,
    parcelId,
    segmentDistanceMeters,
    segmentDistanceFormatted: segmentDistStr,
    depthMeters,
    widthMeters,
    sandPileHeightMeters,
    paintedAreaSqm,
    calculatedVolumeM3,
    desiltingVolumeM3: calculatedVolumeM3,
    dimensionDetailsFormatted,
    completionPercent,
    maintenanceActivity,
    operationalState,
    waterLevelMeters,
    dischargeFlowM3s,
    gateOpeningCm,
    waterQuality,
    beneficiaryServiceArea,
    operationalIncident,
    reporterName,
    reporterRole,
    preApprovedBy,
    approvedBy,
    remarks,
    synced: true,
    photos,
    photoUrl: photos[0]?.url
  };
}

function isDevTestReport(r: any): boolean {
  if (!r) return true;
  const id = String(r.id || '').toLowerCase();
  return id.startsWith('mock-') ||
         id === 'report-1' ||
         r.isMock === true;
}

// Helper to load reports from server filesystem
function loadServerReportsInternal(): any[] {
  try {
    const p1 = path.join(DATA_DIR, 'persistent_reports.json');
    const p2 = path.join(DATA_DIR, 'reports.json');
    const reportsFile = fs.existsSync(p1) ? p1 : p2;
    if (fs.existsSync(reportsFile)) {
      const content = fs.readFileSync(reportsFile, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        return parsed.filter((r: any) => !isDevTestReport(r));
      }
    }
  } catch (err) {
    console.warn('Failed to read persistent reports file:', err);
  }
  return [];
}

// Helper to save reports to server filesystem
function saveServerReportsInternal(reportsList: any[]): void {
  try {
    const map = new Map<string, any>();
    for (const r of reportsList) {
      if (r && r.id && !isDevTestReport(r)) map.set(r.id, r);
    }
    const cleanList = Array.from(map.values());
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const p1 = path.join(DATA_DIR, 'persistent_reports.json');
    const p2 = path.join(DATA_DIR, 'reports.json');
    fs.writeFileSync(p1, JSON.stringify(cleanList, null, 2), 'utf-8');
    fs.writeFileSync(p2, JSON.stringify(cleanList, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save persistent reports to file:', err);
  }
}

let driveReportsCache: any[] = [];
let driveReportsCacheTime = 0;
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes cache

// Discover and fetch field reports from Google Drive with 1-Request Manifest Verification
export async function fetchReportsFromAllDriveFolders(
  providedToken?: string,
  forceRefresh: boolean = false,
  targetImo?: string
): Promise<any[]> {
  const isImoSpecific = Boolean(targetImo && targetImo !== 'All IMOs' && targetImo !== 'Regional Office IV-B');

  const filterByImo = (list: any[]) => {
    if (!isImoSpecific || !targetImo) return list;
    const lower = targetImo.toLowerCase();
    const isMOMARO = (str: string) => str.includes('momaro') || str.includes('oriental') || str.includes('marinduque') || str.includes('romblon');
    const isOccidental = (str: string) => str.includes('occidental') || str.includes('omimo');
    const isPalawan = (str: string) => str.includes('palawan') || str.includes('pimo') || str.includes('palimo');

    return list.filter(r => {
      const rImo = (r.imoOffice || '').toLowerCase();
      if (isMOMARO(lower) && isMOMARO(rImo)) return true;
      if (isOccidental(lower) && isOccidental(rImo)) return true;
      if (isPalawan(lower) && isPalawan(rImo)) return true;
      return rImo.includes(lower) || lower.includes(rImo);
    });
  };

  const now = Date.now();
  if (!forceRefresh && driveReportsCache.length > 0 && (now - driveReportsCacheTime < CACHE_TTL_MS)) {
    return filterByImo(driveReportsCache);
  }

  const token = await getOrRefreshServerDriveToken(providedToken);
  if (!token) {
    console.warn('⚠️ No Google Drive token available to fetch reports.');
    return filterByImo(driveReportsCache);
  }

  const DRIVE_CACHE_DIR = path.join(DATA_DIR, 'drive_cache');
  if (!fs.existsSync(DRIVE_CACHE_DIR)) {
    try { fs.mkdirSync(DRIVE_CACHE_DIR, { recursive: true }); } catch (e) {}
  }

  try {
    let folders: Record<string, string> = {
      'Mindoro Oriental-Marinduque-Romblon IMO': '1zZoIVyjo_E-mGOax-_mfTHV8ep3FveSb',
      'Occidental Mindoro IMO': '1EUAFseU-S5laT0oxRIEwBuXRgppqOUUf',
      'Palawan IMO': '1bzraus7QiL8U3ZDSwLfgfLvdc1G5yMKB'
    };

    if (isImoSpecific && targetImo) {
      const lower = targetImo.toLowerCase();
      const filtered: Record<string, string> = {};
      if (lower.includes('momaro') || lower.includes('oriental') || lower.includes('marinduque') || lower.includes('romblon')) {
        filtered['Mindoro Oriental-Marinduque-Romblon IMO'] = '1zZoIVyjo_E-mGOax-_mfTHV8ep3FveSb';
      } else if (lower.includes('occidental') || lower.includes('omimo')) {
        filtered['Occidental Mindoro IMO'] = '1EUAFseU-S5laT0oxRIEwBuXRgppqOUUf';
      } else if (lower.includes('palawan') || lower.includes('pimo') || lower.includes('palimo')) {
        filtered['Palawan IMO'] = '1bzraus7QiL8U3ZDSwLfgfLvdc1G5yMKB';
      }
      if (Object.keys(filtered).length > 0) {
        folders = filtered;
      }
    }

    const localBackup = loadServerReportsInternal();
    const localManifest = loadLocalManifest();

    // -------------------------------------------------------------
    // STEP 1: FAST 1-REQUEST MANIFEST VERIFICATION ACROSS DRIVE (if NOT forceRefresh)
    // -------------------------------------------------------------
    if (!forceRefresh) {
      const manifestResults = await Promise.all(
        Object.entries(folders).map(async ([imoName, folderId]) => {
          const remote = await findRemoteManifestInFolder(token, folderId);
          if (remote) {
            const downloaded = await downloadRemoteManifest(token, remote.id);
            return { imoName, folderId, remoteManifest: downloaded, remoteFileId: remote.id };
          }
          return { imoName, folderId, remoteManifest: null, remoteFileId: undefined };
        })
      );

      const validRemoteManifests = manifestResults.filter(r => r.remoteManifest !== null);

      if (validRemoteManifests.length > 0) {
        const combinedReportsIndex: Record<string, ReportManifestEntry> = {};
        for (const vm of validRemoteManifests) {
          if (vm.remoteManifest && vm.remoteManifest.reportsIndex) {
            Object.assign(combinedReportsIndex, vm.remoteManifest.reportsIndex);
          }
        }

        const remoteHash = computeManifestHash(combinedReportsIndex);
        const localHash = localManifest?.hash;
        const localReportIds = new Set(localBackup.map((r: any) => r.id));

        // Fast Path: Hashes match & all reports present in local disk cache
        if (remoteHash === localHash && localBackup.length >= Object.keys(combinedReportsIndex).length) {
          console.log('⚡ Instant Sync: Drive manifest hash (' + remoteHash + ') matches local cache. 0 deep API calls needed!');
          driveReportsCache = localBackup;
          driveReportsCacheTime = Date.now();
          return filterByImo(driveReportsCache);
        }
      }
    }

    // -------------------------------------------------------------
    // STEP 2: COMPLETE DRIVE CRAWL & PHOTO LOCAL CACHING
    // -------------------------------------------------------------
    console.log('🔄 Performing thorough Google Drive folder inspection & photo cache synchronization...');
    const fetchedReports: any[] = [];
    const newManifestIndex: Record<string, ReportManifestEntry> = {};

    await Promise.all(Object.entries(folders).map(async ([imoName, folderId]) => {
      try {
        const q = "'" + folderId + "' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false";
        const url = 'https://www.googleapis.com/drive/v3/files?q=' + encodeURIComponent(q) + '&fields=files(id,name)&pageSize=100&supportsAllDrives=true&includeItemsFromAllDrives=true';
        const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
        if (!res.ok) return;
        const data = await res.json();
        const isDevTestFolder = (name: string) => {
          const lower = name.toLowerCase();
          return lower.startsWith('mock-') ||
                 lower === 'mock' ||
                 lower === '__test__';
        };

        const subfolders = (data.files || []).filter((f: any) => 
          !isDevTestFolder(f.name) && (
            f.name.startsWith('wmr-') || 
            f.name.startsWith('WMR-') || 
            f.name.startsWith('rep-') || 
            f.name.startsWith('Report_') || 
            f.name.toLowerCase().includes('report') || 
            /^\d{6,}_/.test(f.name) ||
            f.name.includes('_')
          )
        );

        await Promise.all(subfolders.map(async (sub: any) => {
          try {
            const subQ = "'" + sub.id + "' in parents and trashed = false";
            const subUrl = 'https://www.googleapis.com/drive/v3/files?q=' + encodeURIComponent(subQ) + '&fields=files(id,name,mimeType,thumbnailLink,size)&pageSize=50&supportsAllDrives=true&includeItemsFromAllDrives=true';
            const subRes = await fetch(subUrl, { headers: { Authorization: 'Bearer ' + token } });
            if (!subRes.ok) return;
            const subData = await subRes.json();
            const files = subData.files || [];

            const imageFiles = files
              .filter((f: any) => f.mimeType?.startsWith('image/') || /\.(jpe?g|png|webp|heic)$/i.test(f.name))
              .sort((a: any, b: any) => a.name.localeCompare(b.name, undefined, { numeric: true }));

            // Pre-cache all discovered images to disk if missing
            await Promise.all(imageFiles.map(async (img: any) => {
              const cacheDest = path.join(DRIVE_CACHE_DIR, 'photo_' + img.id + '.bin');
              if (!fs.existsSync(cacheDest) || fs.statSync(cacheDest).size === 0) {
                try {
                  const buf = await downloadDriveBinaryBuffer(token, img.id);
                  if (buf && buf.length > 0) {
                    fs.writeFileSync(cacheDest, buf);
                  }
                } catch (_) {}
              }
            }));

            const dataJson = files.find((f: any) => f.name.startsWith('Data_') && f.name.endsWith('.json'));
            if (dataJson) {
              const jsonText = await downloadDriveFileText(token, dataJson.id);
              const parsed = JSON.parse(jsonText);
              if (parsed && parsed.id) {
                parsed.photos = imageFiles.map((pf: any, idx: number) => {
                  let stage: 'Before' | 'During' | 'After' = 'During';
                  const lowerName = pf.name.toLowerCase();
                  if (lowerName.includes('before')) stage = 'Before';
                  else if (lowerName.includes('after')) stage = 'After';

                  return {
                    id: pf.id,
                    url: '/api/drive/photo/' + pf.id,
                    driveFileId: pf.id,
                    thumbnailUrl: pf.thumbnailLink,
                    stage,
                    caption: stage + ' Activity Documentation #' + (idx + 1),
                    capturedAt: parsed.createdAt || new Date().toISOString(),
                    locationName: parsed.locationName,
                    canalSegment: parsed.canalSegment,
                    lat: parsed.lat,
                    lng: parsed.lng
                  };
                });
                parsed.photoUrl = parsed.photos[0]?.url;
                parsed.synced = true;
                fetchedReports.push(parsed);

                newManifestIndex[parsed.id] = {
                  id: parsed.id,
                  folderId: sub.id,
                  folderName: sub.name,
                  imoOffice: imoName,
                  nisBinding: parsed.nisBinding,
                  modifiedTime: parsed.createdAt || new Date().toISOString(),
                  dataFileId: dataJson.id,
                  title: parsed.title,
                  status: parsed.status
                };
                return;
              }
            }

            const summaryFile = files.find((f: any) => f.name.startsWith('Summary_') && f.name.endsWith('.txt'));
            if (summaryFile) {
              const sumText = await downloadDriveFileText(token, summaryFile.id);
              const report = parseSummaryToReport(sumText, sub.name, files, imoName);
              if (report && report.id) {
                fetchedReports.push(report);
                newManifestIndex[report.id] = {
                  id: report.id,
                  folderId: sub.id,
                  folderName: sub.name,
                  imoOffice: imoName,
                  nisBinding: report.nisBinding,
                  modifiedTime: report.createdAt || new Date().toISOString(),
                  title: report.title,
                  status: report.status
                };
              }
            }
          } catch (subErr) {
            console.warn('Error reading subfolder ' + sub.name + ':', subErr);
          }
        }));
      } catch (fErr) {
        console.warn('Error reading IMO folder ' + imoName + ':', fErr);
      }
    }));

    const mergedMap = new Map<string, any>();
    [...localBackup, ...fetchedReports].forEach(r => { if (r && r.id) mergedMap.set(r.id, r); });
    const merged = Array.from(mergedMap.values());
    saveServerReportsInternal(merged);
    driveReportsCache = merged;
    driveReportsCacheTime = Date.now();

    // Create and upload manifest
    const manifest: DriveManifest = {
      version: (localManifest?.version || 0) + 1,
      lastUpdated: new Date().toISOString(),
      hash: computeManifestHash(newManifestIndex),
      totalReports: Object.keys(newManifestIndex).length,
      reportsIndex: newManifestIndex
    };
    saveLocalManifest(manifest);

    Object.values(folders).forEach(fId => {
      uploadOrUpdateRemoteManifest(token, fId, manifest).catch(e => console.warn('Drive manifest upload notice:', e));
    });

    console.log('✅ Google Drive sync complete with ' + merged.length + ' total reports.');
    return filterByImo(driveReportsCache);
  } catch (err) {
    console.error('Error fetching reports from Google Drive:', err);
    return filterByImo(driveReportsCache);
  }
}

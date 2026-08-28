import fs from 'fs';
import path from 'path';

export interface ReportManifestEntry {
  id: string;
  folderId: string;
  folderName: string;
  imoOffice: string;
  nisBinding?: string;
  modifiedTime: string;
  dataFileId?: string;
  photoCount?: number;
  title?: string;
  status?: string;
}

export interface DriveManifest {
  version: number;
  lastUpdated: string;
  hash: string;
  totalReports: number;
  reportsIndex: Record<string, ReportManifestEntry>;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const LOCAL_MANIFEST_PATH = path.join(DATA_DIR, 'drive_manifest.json');

export function computeManifestHash(reportsIndex: Record<string, ReportManifestEntry>): string {
  const keys = Object.keys(reportsIndex).sort();
  const raw = keys.map(k => `${k}:${reportsIndex[k].modifiedTime || ''}:${reportsIndex[k].dataFileId || ''}`).join('|');
  let hash = 5381;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) + hash) + raw.charCodeAt(i);
    hash = hash & hash;
  }
  return `v${keys.length}_h${Math.abs(hash).toString(36)}`;
}

export function loadLocalManifest(): DriveManifest | null {
  try {
    if (fs.existsSync(LOCAL_MANIFEST_PATH)) {
      const raw = fs.readFileSync(LOCAL_MANIFEST_PATH, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Failed to read local drive_manifest.json:', e);
  }
  return null;
}

export function saveLocalManifest(manifest: DriveManifest): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(LOCAL_MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to save local drive_manifest.json:', e);
  }
}

/**
 * Searches for nia_drive_manifest.json in a specific Google Drive folder
 */
export async function findRemoteManifestInFolder(
  accessToken: string,
  folderId: string
): Promise<{ id: string; modifiedTime?: string } | null> {
  try {
    const q = `'${folderId}' in parents and name = 'nia_drive_manifest.json' and trashed = false`;
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,modifiedTime)&pageSize=1&supportsAllDrives=true&includeItemsFromAllDrives=true`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.files && data.files.length > 0) {
      return { id: data.files[0].id, modifiedTime: data.files[0].modifiedTime };
    }
    return null;
  } catch (err) {
    console.warn(`Error checking remote manifest in folder ${folderId}:`, err);
    return null;
  }
}

/**
 * Downloads and parses the remote DriveManifest from Google Drive
 */
export async function downloadRemoteManifest(
  accessToken: string,
  fileId: string
): Promise<DriveManifest | null> {
  try {
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) return null;
    const jsonText = await res.text();
    return JSON.parse(jsonText);
  } catch (err) {
    console.warn(`Error downloading remote manifest ${fileId}:`, err);
    return null;
  }
}

/**
 * Updates an existing manifest file on Google Drive or creates a new one
 */
export async function uploadOrUpdateRemoteManifest(
  accessToken: string,
  folderId: string,
  manifest: DriveManifest,
  existingFileId?: string
): Promise<string | null> {
  const content = JSON.stringify(manifest, null, 2);

  if (existingFileId) {
    try {
      const patchUrl = `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=media&supportsAllDrives=true`;
      const patchRes = await fetch(patchUrl, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8'
        },
        body: content
      });
      if (patchRes.ok) {
        return existingFileId;
      }
    } catch (e) {
      console.warn('Failed to patch manifest file, creating new:', e);
    }
  }

  try {
    const boundary = '-------314159265358979323846';
    const delimiter = '\r\n--' + boundary + '\r\n';
    const close_delim = '\r\n--' + boundary + '--';
    const metadata = {
      name: 'nia_drive_manifest.json',
      mimeType: 'application/json',
      parents: [folderId]
    };

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
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

    if (res.ok) {
      const data = await res.json();
      return data.id;
    }
  } catch (err) {
    console.warn('Failed to upload new remote manifest:', err);
  }
  return null;
}

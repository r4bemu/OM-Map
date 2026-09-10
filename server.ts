import express from 'express';
import compression from 'compression';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = typeof import.meta !== 'undefined' && import.meta.url ? fileURLToPath(import.meta.url) : '';
const __dirname = __filename ? path.dirname(__filename) : (typeof (globalThis as any).__dirname === 'string' ? (globalThis as any).__dirname : process.cwd());

// Ensure environment variables are loaded on server startup
if (typeof (process as any).loadEnvFile === 'function') {
  try {
    (process as any).loadEnvFile('.env.local');
  } catch (e) {}
  try {
    (process as any).loadEnvFile('.env');
  } catch (e) {}
}

import { INITIAL_GIS_LAYERS, INITIAL_FIELD_REPORTS } from './src/data/sampleLayers.js';
import { MOCK_FIELD_REPORTS_2026 } from './src/data/mockFieldReports2026.js';
import { DEFAULT_AUTH_USERS } from './src/config/authUsers.js';
import {
  getFirestoreLayers,
  saveFirestoreLayer,
  updateFirestoreLayer,
  deleteFirestoreLayer,
  getFirestoreReports,
  saveFirestoreReport,
  batchSaveFirestoreReports
} from './src/lib/firebaseStore.js';
import {
  saveServerDriveToken,
  getServerDriveToken,
  getOrRefreshServerDriveToken,
  getTargetFolderId,
  uploadReportToTargetDriveFolder,
  listDriveGISFilesInFolder,
  downloadDriveBinaryBuffer,
  downloadDriveFileText,
  getDesignatedFolderForImo,
  fetchReportsFromAllDriveFolders,
  IMO_DESIGNATED_FOLDERS
} from './src/lib/serverDriveUploader.js';
import { generateWmrReportId } from './src/utils/reportIdGenerator.js';
import { getFridayEndingWeekInfo, isReportInWeek } from './src/utils/weekUtils.js';
import { sanitizeLayerToBlueHierarchy } from './src/utils/canalLayerClassifier.js';

const DATA_DIR = process.env.USER_DATA_DIR || path.join(process.cwd(), 'data');
const DRIVE_CACHE_DIR = path.join(DATA_DIR, 'drive_cache');
const PHOTOS_DIR = path.join(DATA_DIR, 'photos');
const LAYERS_FILE = path.join(DATA_DIR, 'persistent_layers.json');
const REPORTS_FILE = path.join(DATA_DIR, 'persistent_reports.json');
const USERS_FILE = path.join(DATA_DIR, 'persistent_users.json');
const PENDING_USERS_FILE = path.join(DATA_DIR, 'pending_users.json');
const REQUESTS_FILE = path.join(DATA_DIR, 'access_requests.json');

const INITIAL_SEED_REQUESTS = [
  {
    id: 'req-sample-01',
    email: 'engr.reyes.mimaropa@gmail.com',
    firstName: 'Ronaldo',
    middleInitial: 'P.',
    lastName: 'Reyes',
    extensionName: '',
    fullName: 'Ronaldo P. Reyes',
    contactNumber: '0917-542-8901',
    designation: 'Senior Irrigation Engineer',
    requestedOffice: 'Mindoro Oriental-Marinduque-Romblon IMO',
    requestedRole: 'IMO Reviewer',
    requestedNisList: ['Baco-Bucayao RIS', 'Mag-asawang Tubig RIS'],
    status: 'pending',
    submittedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&h=120&fit=crop&crop=face'
  },
  {
    id: 'req-sample-02',
    email: 'maria.santos.nia@gmail.com',
    firstName: 'Maria Elena',
    middleInitial: 'V.',
    lastName: 'Santos',
    extensionName: '',
    fullName: 'Maria Elena V. Santos',
    contactNumber: '0928-876-1234',
    designation: 'Water Resources Facilities Technician',
    requestedOffice: 'Occidental Mindoro IMO',
    requestedRole: 'Field Personnel',
    requestedNisList: ['Mamburao RIS', 'Amnay RIS', 'Patrick RIS'],
    status: 'pending',
    submittedAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&h=120&fit=crop&crop=face'
  },
  {
    id: 'req-sample-03',
    email: 'alvin.delacruz.palawan@gmail.com',
    firstName: 'Alvin',
    middleInitial: 'G.',
    lastName: 'Dela Cruz',
    extensionName: 'Jr.',
    fullName: 'Alvin G. Dela Cruz, Jr.',
    contactNumber: '0918-334-9988',
    designation: 'Principal Engineer A',
    requestedOffice: 'Palawan IMO',
    requestedRole: 'IMO Reviewer',
    requestedNisList: ['Malatgao RIS', 'Batang-Batang RIS'],
    status: 'approved',
    submittedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    reviewedAt: new Date(Date.now() - 86400000).toISOString(),
    reviewedBy: 'Division Manager (Palawan IMO)',
    reviewedByRole: 'IMO Evaluator',
    assignedRole: 'IMO Reviewer',
    assignedOffice: 'Palawan IMO',
    assignedNis: 'Malatgao RIS, Batang-Batang RIS',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&h=120&fit=crop&crop=face'
  }
];

function getAccessRequests(): any[] {
  ensureDataDir();
  try {
    if (!fs.existsSync(REQUESTS_FILE)) {
      safeWriteJsonSync(REQUESTS_FILE, INITIAL_SEED_REQUESTS);
      return INITIAL_SEED_REQUESTS;
    }
    const raw = fs.readFileSync(REQUESTS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch (e) {
    console.error('Failed to read access requests:', e);
  }
  return [];
}

function saveAccessRequests(requests: any[]) {
  try {
    safeWriteJsonSync(REQUESTS_FILE, requests);
  } catch (e) {
    console.error('Failed to save access requests:', e);
  }
}

function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DRIVE_CACHE_DIR)) {
      fs.mkdirSync(DRIVE_CACHE_DIR, { recursive: true });
    }
    if (!fs.existsSync(PHOTOS_DIR)) {
      fs.mkdirSync(PHOTOS_DIR, { recursive: true });
    }
  } catch (err) {
    console.error('Failed to create data directories:', err);
  }
}

function normalizeServerUserRole(role?: string | null): string {
  if (!role) return 'Viewer';
  const r = role.trim();
  if (r === 'RO Admin') return 'RO Admin';
  if (r === 'IMO Admin') return 'IMO Admin';
  if (r === 'NIS In-Charge' || r === 'NIS In-charge') return 'IMO Reviewer';
  if (r === 'NIS Preparer') return 'IMO Preparer';
  return r;
}

function loadPendingUsers(): any[] {
  ensureDataDir();
  if (fs.existsSync(PENDING_USERS_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(PENDING_USERS_FILE, 'utf-8'));
      if (Array.isArray(data)) return data;
    } catch (_) {}
  }
  return [];
}

function savePendingUsersToFile(pendingList: any[]) {
  try {
    safeWriteJsonSync(PENDING_USERS_FILE, pendingList);
  } catch (err) {
    console.error('Failed to save pending users to file:', err);
  }
}

// Seed initial dataset files from bundled app directories if not yet in USER_DATA_DIR
function seedInitialData() {
  try {
    const seedCandidates = [
      path.join(__dirname, '../data'),
      path.join(__dirname, 'data'),
      path.join(process.cwd(), 'data')
    ];
    const targetFiles = [
      'drive_manifest.json',
      'persistent_reports.json',
      'reports.json',
      'persistent_users.json',
      'persistent_layers.json'
    ];

    for (const seedDir of seedCandidates) {
      if (fs.existsSync(seedDir)) {
        for (const file of targetFiles) {
          const dest = path.join(DATA_DIR, file);
          const src = path.join(seedDir, file);
          if (!fs.existsSync(dest) && fs.existsSync(src)) {
            try {
              fs.copyFileSync(src, dest);
              console.log(`📦 Seeded ${file} from ${src} to ${dest}`);
            } catch (copyErr) {}
          }
        }
        break;
      }
    }
  } catch (e) {}
}

seedInitialData();

function saveBase64PhotoToDisk(photoId: string, base64Url: string, driveFileId?: string) {
  if (!base64Url || !base64Url.startsWith('data:image/')) return;
  try {
    ensureDataDir();
    const matches = base64Url.match(/^data:(image\/[^;]+);base64,([\s\S]+)$/);
    if (matches) {
      const cleanBase64 = matches[2].replace(/[\r\n\s]/g, '');
      const imageBuffer = Buffer.from(cleanBase64, 'base64');
      const photoPath = path.join(PHOTOS_DIR, `${photoId}.jpg`);
      fs.writeFileSync(photoPath, imageBuffer);

      if (driveFileId) {
        const driveCachePath = path.join(DRIVE_CACHE_DIR, `photo_${driveFileId}.bin`);
        fs.writeFileSync(driveCachePath, imageBuffer);
      }
    }
  } catch (e) {
    console.warn(`Could not save photo ${photoId} to disk cache:`, e);
  }
}

function deduplicateById<T extends { id: string }>(items: T[]): T[] {
  if (!Array.isArray(items)) return [];
  const map = new Map<string, T>();
  for (const item of items) {
    if (item && item.id) {
      map.set(item.id, item);
    }
  }
  return Array.from(map.values());
}

function getImageMimeType(buf: Buffer): string {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (buf.length >= 12 && buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP') return 'image/webp';
  if (buf.length >= 6 && (buf.subarray(0, 6).toString() === 'GIF87a' || buf.subarray(0, 6).toString() === 'GIF89a')) return 'image/gif';
  return 'image/jpeg';
}

function matchesImoOffice(reportImo?: string, targetImo?: string): boolean {
  if (!targetImo || targetImo === 'All IMOs' || targetImo === 'Regional Office IV-B') return true;
  if (!reportImo) return true;

  const r = reportImo.toLowerCase();
  const t = targetImo.toLowerCase();

  const isMOMARO = (str: string) => str.includes('momaro') || str.includes('oriental') || str.includes('marinduque') || str.includes('romblon');
  const isOccidental = (str: string) => str.includes('occidental');
  const isPalawan = (str: string) => str.includes('palawan');

  if (isMOMARO(t) && isMOMARO(r)) return true;
  if (isOccidental(t) && isOccidental(r)) return true;
  if (isPalawan(t) && isPalawan(r)) return true;

  return r.includes(t) || t.includes(r);
}

function safeWriteJsonSync(filePath: string, data: any) {
  ensureDataDir();
  const tmpPath = `${filePath}.${Date.now()}.${Math.random().toString(36).substring(2)}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data), 'utf-8');
  fs.renameSync(tmpPath, filePath);
}

function isMockLayer(layer: any): boolean {
  if (!layer) return true;
  const id = layer.id || '';
  const name = layer.name || '';
  const category = layer.category || '';
  const geomType = layer.geometryType || '';
  const hasFeatures = layer.data && Array.isArray(layer.data.features) && layer.data.features.length > 0;
  return (
    geomType === 'Polygon' ||
    category === 'Parcels' ||
    category === 'Land Parcels' ||
    name.toLowerCase().includes('parcel') ||
    id.toLowerCase().includes('parcel') ||
    id === 'layer-structures' ||
    id === 'layer-canals-main' ||
    id === 'layer-momaro-canals' ||
    id === 'layer-momaro-parcels' ||
    id === 'layer-om-canals' ||
    id === 'layer-palawan-canals' ||
    name === 'Irrigation Structures & Control Gates' ||
    name === 'Canal Line Networks' ||
    id.startsWith('drive-meta-') ||
    name.includes('(Drive Sync Required)') ||
    !hasFeatures
  );
}

function loadSavedLayers() {
  try {
    ensureDataDir();
    if (fs.existsSync(LAYERS_FILE)) {
      const content = fs.readFileSync(LAYERS_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const clean = deduplicateById(parsed).filter(l => !isMockLayer(l)).map(l => sanitizeLayerToBlueHierarchy(l));
        if (clean.length > 0) return clean;
      }
    }
  } catch (err) {
    console.warn('Failed to read persistent layers file (recovering with defaults):', err);
  }
  const defaultLayers = [...INITIAL_GIS_LAYERS].filter(l => !isMockLayer(l)).map(l => sanitizeLayerToBlueHierarchy(l));
  try {
    safeWriteJsonSync(LAYERS_FILE, defaultLayers);
  } catch (e) {}
  return defaultLayers;
}

function saveLayersToFile(layersList: any[]) {
  try {
    const cleanList = deduplicateById(layersList).filter(l => !isMockLayer(l)).map(l => sanitizeLayerToBlueHierarchy(l));
    safeWriteJsonSync(LAYERS_FILE, cleanList);
  } catch (err) {
    console.error('Failed to save persistent layers to file:', err);
  }
}

function loadSavedReports() {
  try {
    ensureDataDir();
    if (fs.existsSync(REPORTS_FILE)) {
      const content = fs.readFileSync(REPORTS_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        return deduplicateById(parsed.filter((r: any) => !r.id?.startsWith('mock-') && r.id !== 'report-1' && !r.isMock));
      }
    }
  } catch (err) {
    console.warn('Failed to read persistent reports file:', err);
  }
  return [];
}

function saveReportsToFile(reportsList: any[]) {
  try {
    const cleanList = deduplicateById(reportsList);
    safeWriteJsonSync(REPORTS_FILE, cleanList);
  } catch (err) {
    console.error('Failed to save persistent reports to file:', err);
  }
}

function loadSavedUsers(): any[] {
  ensureDataDir();
  if (fs.existsSync(USERS_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
      if (Array.isArray(data) && data.length > 0) {
        let hasChanges = false;
        const defaultMap = new Map();
        DEFAULT_AUTH_USERS.forEach((u: any) => defaultMap.set(u.id, u));

        const normalized = data.map((u: any) => {
          const normRole = normalizeServerUserRole(u.role);
          const def = defaultMap.get(u.id);
          if (def) {
            return {
              ...def,
              passcode: u.passcode || def.passcode,
              imoOffice: u.imoOffice || def.imoOffice,
              nisBinding: u.nisBinding || def.nisBinding,
              email: u.email || def.email,
              googleId: u.googleId || def.googleId
            };
          }
          if (normRole !== u.role) {
            hasChanges = true;
            return {
              ...u,
              role: normRole
            };
          }
          return u;
        });

        const seenIds = new Set(normalized.map((u: any) => u.id));
        DEFAULT_AUTH_USERS.forEach((u: any) => {
          if (!seenIds.has(u.id)) {
            normalized.push(u);
            hasChanges = true;
          }
        });

        if (hasChanges) {
          saveUsersToFile(normalized);
        }
        return normalized;
      }
    } catch (err) {
      console.warn('Failed to parse persistent_users.json, resetting to defaults:', err);
    }
  }
  try {
    safeWriteJsonSync(USERS_FILE, DEFAULT_AUTH_USERS);
  } catch (e) {}
  return DEFAULT_AUTH_USERS;
}

function saveUsersToFile(usersList: any[]) {
  try {
    safeWriteJsonSync(USERS_FILE, usersList);
  } catch (err) {
    console.error('Failed to save persistent users to file:', err);
  }
}

export async function createApp() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8080;

  // Gzip / Brotli compression for lightning-fast responses & preventing large payload limits
  app.use(compression());

  // Support large GIS GeoJSON payloads (up to 70MB)
  app.use(express.json({ limit: '70mb' }));
  app.use(express.urlencoded({ extended: true, limit: '70mb' }));

  // Enable CORS for external portal handshakes
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });

  // File-backed persistent data store
  let layers = loadSavedLayers();
  let reports = loadSavedReports();

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      serverTime: new Date().toISOString(),
      hasDriveRefreshToken: Boolean(process.env.GOOGLE_REFRESH_TOKEN),
      hasDriveAccessToken: Boolean(process.env.GOOGLE_DRIVE_ACCESS_TOKEN)
    });
  });

  // User Accounts Management Endpoints (Persistent Server Store)
  app.get('/api/users', (req, res) => {
    try {
      const currentUsers = loadSavedUsers();
      res.json({ users: currentUsers });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to load users' });
    }
  });

  app.post('/api/users', (req, res) => {
    try {
      const newUser = req.body;
      if (!newUser || !newUser.username || !newUser.passcode || !newUser.name || !newUser.role) {
        return res.status(400).json({ error: 'Name, username, role, and passcode are required.' });
      }

      const currentUsers = loadSavedUsers();
      const trimmedUsername = newUser.username.trim().toLowerCase();

      if (currentUsers.some((u: any) => u.username.toLowerCase() === trimmedUsername)) {
        return res.status(409).json({ error: `User with username '@${newUser.username}' already exists.` });
      }

      const cleanUser = {
        id: newUser.id || `usr-${Date.now()}`,
        username: newUser.username.trim(),
        name: newUser.name.trim(),
        role: newUser.role,
        passcode: newUser.passcode.trim(),
        imoOffice: newUser.imoOffice || 'Regional Office IV-B',
        nisBinding: newUser.nisBinding || 'All NIS',
        designation: newUser.designation || `${newUser.role} - ${newUser.imoOffice || 'MIMAROPA'}`
      };

      const updatedUsers = [...currentUsers, cleanUser];
      saveUsersToFile(updatedUsers);
      res.json({ success: true, user: cleanUser, users: updatedUsers });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to create user' });
    }
  });

  app.put('/api/users/:id', (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    try {
      const currentUsers = loadSavedUsers();
      const idx = currentUsers.findIndex((u: any) => u.id === id || u.username.toLowerCase() === id.toLowerCase());

      if (idx === -1) {
        return res.status(404).json({ error: `User ${id} not found.` });
      }

      currentUsers[idx] = {
        ...currentUsers[idx],
        ...updates
      };

      saveUsersToFile(currentUsers);
      res.json({ success: true, user: currentUsers[idx], users: currentUsers });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to update user' });
    }
  });

  app.delete('/api/users/:id', (req, res) => {
    const { id } = req.params;
    try {
      if (id === 'usr-dev-01' || id === 'dev_master') {
        return res.status(403).json({ error: 'Master Developer account cannot be deleted.' });
      }

      const currentUsers = loadSavedUsers();
      const filtered = currentUsers.filter((u: any) => u.id !== id && u.username.toLowerCase() !== id.toLowerCase());

      saveUsersToFile(filtered);
      res.json({ success: true, message: `User ${id} removed.`, users: filtered });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to delete user' });
    }
  });

  app.post('/api/users/reset', (req, res) => {
    try {
      saveUsersToFile(DEFAULT_AUTH_USERS);
      res.json({ success: true, message: 'All accounts reset to factory defaults.', users: DEFAULT_AUTH_USERS });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to reset users' });
    }
  });

  // Pending Google Account Admissions Endpoints
  app.get('/api/users/pending', (req, res) => {
    try {
      const pending = loadPendingUsers();
      res.json({ pending });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to load pending users' });
    }
  });

  app.post('/api/users/pending', (req, res) => {
    try {
      const pendingUser = req.body;
      if (!pendingUser || !pendingUser.email) {
        return res.status(400).json({ error: 'Email is required' });
      }
      const pending = loadPendingUsers();
      const existingIdx = pending.findIndex((u: any) => u.email?.toLowerCase() === pendingUser.email.toLowerCase());
      if (existingIdx !== -1) {
        pending[existingIdx] = { ...pending[existingIdx], ...pendingUser };
      } else {
        pending.unshift(pendingUser);
      }
      savePendingUsersToFile(pending);
      res.json({ success: true, pendingUser, pending });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to save pending user' });
    }
  });

  app.post('/api/users/admit', (req, res) => {
    try {
      const admittedUser = req.body;
      if (!admittedUser || !admittedUser.role || !admittedUser.name) {
        return res.status(400).json({ error: 'User data is required' });
      }
      // Remove from pending
      const pending = loadPendingUsers();
      const filteredPending = pending.filter((u: any) => u.id !== admittedUser.id && (!admittedUser.email || u.email?.toLowerCase() !== admittedUser.email.toLowerCase()));
      savePendingUsersToFile(filteredPending);

      // Add/update active users
      const currentUsers = loadSavedUsers();
      const idx = currentUsers.findIndex((u: any) => u.id === admittedUser.id || (admittedUser.email && u.email?.toLowerCase() === admittedUser.email.toLowerCase()));
      if (idx !== -1) {
        currentUsers[idx] = { ...currentUsers[idx], ...admittedUser, isAdmitted: true };
      } else {
        currentUsers.push({ ...admittedUser, isAdmitted: true });
      }
      saveUsersToFile(currentUsers);
      res.json({ success: true, user: admittedUser, users: currentUsers, pending: filteredPending });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to admit user' });
    }
  });

  app.delete('/api/users/pending/:id', (req, res) => {
    const { id } = req.params;
    try {
      const pending = loadPendingUsers();
      const filtered = pending.filter((u: any) => u.id !== id);
      savePendingUsersToFile(filtered);
      res.json({ success: true, message: `Pending user ${id} removed.`, pending: filtered });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to remove pending user' });
    }
  });

  // Access Requests Management Endpoints
  app.get('/api/access-requests', (req, res) => {
    try {
      const requests = getAccessRequests();
      res.json(requests);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch access requests' });
    }
  });

  app.get('/api/access-requests/user/:email', (req, res) => {
    try {
      const email = req.params.email.toLowerCase().trim();
      const requests = getAccessRequests();
      const reqItem = requests.find((r: any) => r.email?.toLowerCase().trim() === email);
      if (!reqItem) {
        return res.status(404).json({ error: 'No access request found for this email.' });
      }
      res.json(reqItem);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch user access request' });
    }
  });

  app.post('/api/access-requests', (req, res) => {
    try {
      const data = req.body;
      if (!data.email || !data.firstName || !data.lastName || !data.contactNumber || !data.requestedOffice) {
        return res.status(400).json({ error: 'Missing required fields: email, firstName, lastName, contactNumber, requestedOffice' });
      }

      const requests = getAccessRequests();
      const email = data.email.toLowerCase().trim();
      const existingIndex = requests.findIndex((r: any) => r.email?.toLowerCase().trim() === email);

      const fn = data.firstName.trim();
      const mi = data.middleInitial ? `${data.middleInitial.trim().replace('.', '')}.` : '';
      const ln = data.lastName.trim();
      const ext = data.extensionName?.trim() ? `, ${data.extensionName.trim()}` : '';
      const fullName = [fn, mi, ln].filter(Boolean).join(' ') + ext;

      const newRequest = {
        id: existingIndex >= 0 ? requests[existingIndex].id : `req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        email: email,
        firstName: fn,
        middleInitial: data.middleInitial?.trim() || '',
        lastName: ln,
        extensionName: data.extensionName?.trim() || '',
        fullName: fullName,
        contactNumber: data.contactNumber.trim(),
        designation: data.designation?.trim() || 'Senior Irrigation Engineer',
        requestedOffice: data.requestedOffice,
        requestedApps: Array.isArray(data.requestedApps) ? data.requestedApps : ['Maintenance and Status of Irrigation Facilities'],
        requestedRole: data.requestedRole || 'Field Personnel',
        requestedNisList: Array.isArray(data.requestedNisList) ? data.requestedNisList : ['All NIS'],
        status: 'pending',
        submittedAt: new Date().toISOString(),
        avatar: data.avatar || undefined,
        uid: data.uid || undefined
      };

      if (existingIndex >= 0) {
        requests[existingIndex] = { ...requests[existingIndex], ...newRequest, status: 'pending' };
      } else {
        requests.unshift(newRequest);
      }

      saveAccessRequests(requests);
      res.json({ success: true, request: newRequest });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to submit access request' });
    }
  });

  app.post('/api/access-requests/:id/approve', (req, res) => {
    try {
      const { id } = req.params;
      const { assignedRole, assignedOffice, assignedNis, reviewerName, reviewerRole } = req.body;

      const normRole = normalizeServerUserRole(reviewerRole);
      if (normRole !== 'Developer' && normRole !== 'RO Admin' && normRole !== 'IMO Admin') {
        return res.status(403).json({ error: 'Access Denied: Only Office Administrators and the Developer can grant access requests.' });
      }

      const requests = getAccessRequests();
      const index = requests.findIndex((r: any) => r.id === id);
      if (index === -1) {
        return res.status(404).json({ error: 'Request not found' });
      }

      const item = requests[index];

      // Disallow IMO Admin from granting Regional or Developer roles
      if (normRole === 'IMO Admin') {
        if (assignedRole === 'RO Admin' || assignedRole === 'RO Evaluator' || assignedRole === 'RO Reviewer' || assignedRole === 'RO Preparer' || assignedRole === 'Developer') {
          return res.status(403).json({ error: 'Access Denied: IMO Administrators can only grant roles within their IMO office jurisdiction.' });
        }
      }

      item.status = 'approved';
      item.assignedRole = assignedRole || item.requestedRole || 'IMO Reviewer';
      item.assignedOffice = assignedOffice || item.requestedOffice || 'Regional Office IV-B';
      item.assignedNis = assignedNis || (item.requestedNisList?.length ? item.requestedNisList.join(', ') : 'All NIS');
      item.reviewedAt = new Date().toISOString();
      item.reviewedBy = reviewerName || 'Authorized Administrator';
      item.reviewedByRole = reviewerRole || 'RO Admin';
      item.rejectionReason = undefined;

      requests[index] = item;
      saveAccessRequests(requests);

      res.json({ success: true, request: item });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to approve request' });
    }
  });

  app.post('/api/access-requests/:id/reject', (req, res) => {
    try {
      const { id } = req.params;
      const { rejectionReason, reviewerName, reviewerRole } = req.body;

      const normRole = normalizeServerUserRole(reviewerRole);
      if (normRole !== 'Developer' && normRole !== 'RO Admin' && normRole !== 'IMO Admin') {
        return res.status(403).json({ error: 'Access Denied: Only Office Administrators and the Developer can decline access requests.' });
      }

      const requests = getAccessRequests();
      const index = requests.findIndex((r: any) => r.id === id);
      if (index === -1) {
        return res.status(404).json({ error: 'Request not found' });
      }

      const item = requests[index];
      item.status = 'rejected';
      item.rejectionReason = rejectionReason || 'Information verification incomplete or jurisdiction mismatch.';
      item.reviewedAt = new Date().toISOString();
      item.reviewedBy = reviewerName || 'Authorized Administrator';
      item.reviewedByRole = reviewerRole || 'RO Admin';

      requests[index] = item;
      saveAccessRequests(requests);

      res.json({ success: true, request: item });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to reject request' });
    }
  });

  app.post('/api/access-requests/:id/revoke', (req, res) => {
    try {
      const { id } = req.params;
      const requests = getAccessRequests();
      const index = requests.findIndex((r: any) => r.id === id);
      if (index === -1) {
        return res.status(404).json({ error: 'Request not found' });
      }

      requests[index].status = 'pending';
      requests[index].reviewedAt = new Date().toISOString();
      requests[index].rejectionReason = 'Access suspended pending administrative re-evaluation.';
      saveAccessRequests(requests);

      res.json({ success: true, request: requests[index] });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to revoke request' });
    }
  });

  app.get('/api/approved-users', (req, res) => {
    try {
      const requests = getAccessRequests();
      const approved = requests.filter((r: any) => r.status === 'approved');
      const users = approved.map((r: any) => {
        const email = r.email.toLowerCase().trim();
        const username = email.split('@')[0].replace(/[^a-z0-9_]/g, '_');
        return {
          id: `usr-gauth-${r.id}`,
          username: username,
          name: r.fullName,
          role: r.assignedRole || r.requestedRole || 'Field Personnel',
          passcode: 'GOOGLE_AUTH_SSO',
          imoOffice: r.assignedOffice || r.requestedOffice,
          nisBinding: r.assignedNis || (r.requestedNisList?.join(', ') || 'All NIS'),
          designation: r.designation,
          contactNumber: r.contactNumber,
          avatar: r.avatar,
          email: email,
          provider: 'google',
          createdAt: r.reviewedAt || r.submittedAt
        };
      });
      res.json(users);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to get approved users' });
    }
  });

  // Reset persistent layers on server to default initial state (for cold debugging)
  app.post('/api/layers/reset', (req, res) => {
    try {
      safeWriteJsonSync(LAYERS_FILE, INITIAL_GIS_LAYERS.filter(l => !isMockLayer(l)));
      if (fs.existsSync(DRIVE_CACHE_DIR)) {
        const files = fs.readdirSync(DRIVE_CACHE_DIR);
        for (const file of files) {
          try { fs.unlinkSync(path.join(DRIVE_CACHE_DIR, file)); } catch (e) {}
        }
      }
      res.json({ success: true, message: 'Server layers catalog and Drive disk cache reset to defaults' });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to reset layers' });
    }
  });

  // Purge all temporary mock reports from server data
  app.post('/api/mock-reports/purge', (req, res) => {
    try {
      const current = loadSavedReports();
      const purged = current.filter((r: any) => !r.id?.startsWith('mock-') && !r.isMock);
      saveReportsToFile(purged);
      res.json({ success: true, message: 'Purged all temporary mock field reports from server data store.', remainingCount: purged.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to purge mock reports' });
    }
  });

  // Get all GIS Layers (Scoped by IMO if user is assigned to an IMO)
  app.get('/api/layers', async (req, res) => {
    try {
      const requestedImo = req.query.imo as string | undefined;
      const userRole = (req.query.role as string) || 'Viewer';

      const localBackup = loadSavedLayers();
      const firestoreLayers = await getFirestoreLayers(localBackup);
      let allLayers = firestoreLayers && firestoreLayers.length > 0 ? firestoreLayers : localBackup;

      if (requestedImo && requestedImo !== 'All IMOs' && requestedImo !== 'Regional Office IV-B') {
        allLayers = allLayers.filter((l: any) => {
          if (!l.imoOffice) return true; // Keep non-IMO custom layers
          return matchesImoOffice(l.imoOffice, requestedImo);
        });
      }

      res.json({ layers: allLayers });
    } catch (err: any) {
      console.warn('Falling back to local layers:', err);
      res.json({ layers: loadSavedLayers() });
    }
  });

  // Upload or Add a GIS Layer
  app.post('/api/layers', async (req, res) => {
    try {
      const newLayer = req.body;
      if (!newLayer || !newLayer.name || !newLayer.data) {
        return res.status(400).json({ error: 'Invalid layer payload. Name and GeoJSON data required.' });
      }

      if (isMockLayer(newLayer)) {
        return res.json({ success: true, message: 'Mock layer ignored.' });
      }

      const layerWithId = {
        id: newLayer.id || `layer-${Date.now()}`,
        name: newLayer.name,
        category: newLayer.category || 'Custom Uploads',
        visible: newLayer.visible ?? true,
        color: newLayer.color || '#3b82f6',
        opacity: newLayer.opacity ?? 0.8,
        data: newLayer.data,
        featureCount: newLayer.featureCount || (newLayer.data.features ? newLayer.data.features.length : 0),
        geometryType: newLayer.geometryType || 'Mixed',
        uploadedAt: newLayer.uploadedAt || new Date().toISOString(),
        isDefault: false,
        sizeBytes: newLayer.sizeBytes || 0
      };

      await saveFirestoreLayer(layerWithId);
      saveLayersToFile([layerWithId, ...loadSavedLayers()]);

      res.json({ success: true, layer: layerWithId });
    } catch (err: any) {
      console.error('Failed to save layer:', err);
      res.status(500).json({ error: err.message || 'Failed to process layer upload' });
    }
  });

  // Update GIS Layer properties (visible, opacity, color, etc.)
  app.put('/api/layers/:id', async (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    try {
      await updateFirestoreLayer(id, updates);
      res.json({ success: true, message: `Layer ${id} updated.` });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to update layer' });
    }
  });

  // Delete custom GIS Layer
  app.delete('/api/layers/:id', async (req, res) => {
    const { id } = req.params;
    try {
      await deleteFirestoreLayer(id);
      const currentLocal = loadSavedLayers().filter((l: any) => l.id !== id);
      saveLayersToFile(currentLocal);
      res.json({ success: true, message: `Layer ${id} deleted.` });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to delete layer' });
    }
  });

  // Get Field Reports & Photos (Filtered strictly by user role, assigned IMO, and Two-Tier Approval Status)
  app.get('/api/reports', async (req, res) => {
    try {
      const userRole = (req.query.role as string) || 'Viewer';
      const requestedImo = req.query.imo as string | undefined;
      const clientToken = req.headers['x-google-drive-token'] as string | undefined;

      const localBackup = loadSavedReports();
      const firestoreReports = await getFirestoreReports(localBackup);
      let driveReports: any[] = [];
      try {
        driveReports = await fetchReportsFromAllDriveFolders(clientToken, false, requestedImo);
      } catch (dErr) {
        console.warn('Google Drive reports fetch fallback:', dErr);
      }

      // Combine cloud Drive reports, Firestore cloud database reports, and local backup reports (Drive reports take precedence)
      let filteredReports = deduplicateById([...localBackup, ...firestoreReports, ...driveReports]);

      if (userRole === 'Viewer') {
        filteredReports = filteredReports.filter((r: any) => {
          const isApproved = r.approvalStatus === 'Approved' || (!r.approvalStatus && r.status === 'Completed');
          if (!isApproved) return false;
          if (requestedImo && requestedImo !== 'All IMOs' && requestedImo !== 'Regional Office IV-B') {
            return matchesImoOffice(r.imoOffice, requestedImo);
          }
          return true;
        });
      } else if (requestedImo && requestedImo !== 'All IMOs' && requestedImo !== 'Regional Office IV-B') {
        filteredReports = filteredReports.filter((r: any) => matchesImoOffice(r.imoOffice, requestedImo));
      }

      // Time Scope Filter (current_and_prev_week, past_4_weeks, past_3_months, all)
      const timeScope = (req.query.timeScope as string) || 'all';
      const requestedWeekKey = req.query.weekKey as string | undefined;

      if (requestedWeekKey && requestedWeekKey !== 'all') {
        filteredReports = filteredReports.filter((r: any) => isReportInWeek(r, requestedWeekKey));
      } else if (timeScope !== 'all') {
        const now = new Date();
        let cutoff: Date | null = null;

        if (timeScope === 'current_and_prev_week') {
          const curInfo = getFridayEndingWeekInfo(now);
          const prevInfo = getFridayEndingWeekInfo(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
          cutoff = prevInfo.startSaturday;
          filteredReports = filteredReports.filter((r: any) => {
            if (!r.createdAt) return true;
            return isReportInWeek(r, curInfo.key) || isReportInWeek(r, prevInfo.key);
          });
        } else if (timeScope === 'past_4_weeks') {
          cutoff = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
        } else if (timeScope === 'past_3_months') {
          cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        }

        if (cutoff && timeScope !== 'current_and_prev_week') {
          filteredReports = filteredReports.filter((r: any) => {
            if (!r.createdAt) return true;
            const d = new Date(r.createdAt);
            if (isNaN(d.getTime())) return true;
            return d >= cutoff!;
          });
        }
      }

      res.json({ reports: filteredReports });
    } catch (err: any) {
      console.warn('Falling back to local reports:', err);
      res.json({ reports: loadSavedReports() });
    }
  });

  // Get list of all available report weeks on server for the user's role & IMO scope
  app.get('/api/reports/available-weeks', async (req, res) => {
    try {
      const userRole = (req.query.role as string) || 'Viewer';
      const requestedImo = req.query.imo as string | undefined;

      const localBackup = loadSavedReports();
      const firestoreReports = await getFirestoreReports(localBackup);
      let filteredReports = deduplicateById([...firestoreReports, ...localBackup]);

      if (userRole === 'Viewer') {
        filteredReports = filteredReports.filter((r: any) => {
          const isApproved = r.approvalStatus === 'Approved' || (!r.approvalStatus && r.status === 'Completed');
          if (!isApproved) return false;
          const targetImo = requestedImo && requestedImo !== 'All IMOs' ? requestedImo : 'MOMARO';
          return matchesImoOffice(r.imoOffice, targetImo);
        });
      } else if (requestedImo && requestedImo !== 'All IMOs' && requestedImo !== 'Regional Office IV-B') {
        filteredReports = filteredReports.filter((r: any) => matchesImoOffice(r.imoOffice, requestedImo));
      }

      // Group by Friday-ending week key
      const weekMap = new Map<string, { key: string; label: string; startDate: string; endDate: string; reportCount: number; isCurrentWeek?: boolean; isPrevWeek?: boolean }>();

      filteredReports.forEach((r: any) => {
        if (!r.createdAt) return;
        const info = getFridayEndingWeekInfo(r.createdAt);

        const existing = weekMap.get(info.key);
        if (existing) {
          existing.reportCount += 1;
        } else {
          weekMap.set(info.key, {
            key: info.key,
            label: info.label,
            startDate: info.startDate,
            endDate: info.endDate,
            reportCount: 1,
            isCurrentWeek: info.isCurrentWeek,
            isPrevWeek: info.isPrevWeek
          });
        }
      });

      const weeks = Array.from(weekMap.values()).sort((a, b) => b.key.localeCompare(a.key));
      res.json({ weeks, totalReports: filteredReports.length });
    } catch (err: any) {
      console.warn('Failed to aggregate available weeks:', err);
      res.json({ weeks: [], totalReports: 0 });
    }
  });

  // Update Field Report Approval Pipeline State (Pre-Approve, Final Approve, Reject)
  app.put('/api/reports/:id/approval', async (req, res) => {
    try {
      const { id } = req.params;
      const { action, authorizerName, authorizerRole, reason } = req.body;

      const currentReports = loadSavedReports();
      const reportIndex = currentReports.findIndex((r: any) => r.id === id);
      if (reportIndex === -1) {
        return res.status(404).json({ error: 'Report not found' });
      }

      const targetReport = { ...currentReports[reportIndex] };

      if (action === 'pre_approve') {
        targetReport.approvalStatus = 'PreApproved';
        targetReport.preApprovedBy = authorizerName || 'IMO Reviewer';
        targetReport.preApprovedAt = new Date().toISOString();
      } else if (action === 'final_approve') {
        targetReport.approvalStatus = 'Approved';
        targetReport.approvedBy = authorizerName || (authorizerRole?.startsWith('RO') ? 'RO Evaluator' : 'IMO Evaluator');
        targetReport.approvedAt = new Date().toISOString();
      } else if (action === 'reject') {
        targetReport.approvalStatus = 'Rejected';
        targetReport.rejectionReason = reason || 'Requires revision';
      }

      currentReports[reportIndex] = targetReport;
      saveReportsToFile(currentReports);
      try {
        await saveFirestoreReport(targetReport);
      } catch (e) {}

      res.json({ success: true, report: targetReport });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to update approval status' });
    }
  });

  // Advance Report to Next Institutional Approval Tier
  app.put('/api/reports/:id/advance-tier', async (req, res) => {
    try {
      const { id } = req.params;
      const { nextTier, actorName, actorId, actorRole, comments } = req.body;

      const currentReports = loadSavedReports();
      const reportIndex = currentReports.findIndex((r: any) => r.id === id);
      if (reportIndex === -1) {
        return res.status(404).json({ error: 'Report not found' });
      }

      const targetReport = { ...currentReports[reportIndex] };
      const nowIso = new Date().toISOString();

      targetReport.currentTier = nextTier;

      if (nextTier === 'Approved_RO_Admin') {
        targetReport.approvalStatus = 'Approved';
        targetReport.approvedBy = actorName || 'RO Admin';
        targetReport.approvedAt = nowIso;
      } else if (nextTier === 'Pending_NIS_InCharge') {
        targetReport.approvalStatus = 'PreApproved';
        targetReport.preApprovedBy = actorName || 'NIS Preparer';
        targetReport.preApprovedAt = nowIso;
      }

      // Log into Tier History
      const history = Array.isArray(targetReport.tierHistory) ? [...targetReport.tierHistory] : [];
      history.push({
        id: `th-${Date.now()}`,
        tier: nextTier,
        action: nextTier === 'Approved_RO_Admin' ? 'approved' : (nextTier === 'Pending_NIS_InCharge' ? 'pre_approved' : 'forwarded'),
        actorName: actorName || 'Institutional Officer',
        actorId,
        actorRole: actorRole || 'Developer',
        timestamp: nowIso,
        comments
      });
      targetReport.tierHistory = history;

      currentReports[reportIndex] = targetReport;
      saveReportsToFile(currentReports);
      try {
        await saveFirestoreReport(targetReport);
      } catch (e) {}

      res.json({ success: true, report: targetReport });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to advance report tier' });
    }
  });

  // Submit a New Revision for an Existing Report
  app.post('/api/reports/:id/revisions', async (req, res) => {
    try {
      const { id } = req.params;
      const { snapshot, changeSummary, createdBy, createdById, createdRole } = req.body;

      const currentReports = loadSavedReports();
      const reportIndex = currentReports.findIndex((r: any) => r.id === id);
      if (reportIndex === -1) {
        return res.status(404).json({ error: 'Report not found' });
      }

      const targetReport = { ...currentReports[reportIndex] };
      const nowIso = new Date().toISOString();

      // Ensure existing revisions list is populated
      const existingRevisions = Array.isArray(targetReport.revisions) && targetReport.revisions.length > 0
        ? [...targetReport.revisions]
        : [{
            revisionNumber: 1,
            createdAt: targetReport.createdAt || nowIso,
            createdBy: targetReport.reporterName || 'Field Personnel',
            createdById: targetReport.submittedByUserId,
            createdRole: targetReport.submittedByRole || 'Field Personnel',
            changeSummary: 'Initial field submission',
            snapshot: { ...targetReport }
          }];

      const nextRevNumber = existingRevisions.length + 1;
      const newRevEntry = {
        revisionNumber: nextRevNumber,
        createdAt: nowIso,
        createdBy: createdBy || 'Field Personnel',
        createdById,
        createdRole: createdRole || 'Field Personnel',
        changeSummary: changeSummary || `Revision v${nextRevNumber} submitted`,
        snapshot: { ...snapshot }
      };

      existingRevisions.push(newRevEntry);
      targetReport.revisions = existingRevisions;
      targetReport.activeRevisionNumber = nextRevNumber;
      targetReport.revisionNumber = nextRevNumber;

      // Update targetReport top-level fields with new snapshot values
      Object.assign(targetReport, snapshot);

      // Reset tier back to initial reviewer queue
      targetReport.currentTier = 'Pending_NIS_Preparer';
      targetReport.approvalStatus = 'Pending_PreApproval';

      // Log into Tier History
      const history = Array.isArray(targetReport.tierHistory) ? [...targetReport.tierHistory] : [];
      history.push({
        id: `th-${Date.now()}`,
        tier: 'Pending_NIS_Preparer',
        action: 'revised',
        actorName: createdBy || 'Field Personnel',
        actorId: createdById,
        actorRole: createdRole || 'Field Personnel',
        timestamp: nowIso,
        comments: changeSummary,
        revisionNumber: nextRevNumber
      });
      targetReport.tierHistory = history;

      currentReports[reportIndex] = targetReport;
      saveReportsToFile(currentReports);
      try {
        await saveFirestoreReport(targetReport);
      } catch (e) {}

      res.json({ success: true, report: targetReport });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to submit report revision' });
    }
  });

  // Return Report for Submitter Revision with Feedback
  app.put('/api/reports/:id/return-revision', async (req, res) => {
    try {
      const { id } = req.params;
      const { reason, actorName, actorId, actorRole } = req.body;

      const currentReports = loadSavedReports();
      const reportIndex = currentReports.findIndex((r: any) => r.id === id);
      if (reportIndex === -1) {
        return res.status(404).json({ error: 'Report not found' });
      }

      const targetReport = { ...currentReports[reportIndex] };
      const nowIso = new Date().toISOString();

      targetReport.currentTier = 'Returned_For_Revision';
      targetReport.approvalStatus = 'Rejected';
      targetReport.rejectionReason = reason || 'Discrepancies identified; please revise.';

      const history = Array.isArray(targetReport.tierHistory) ? [...targetReport.tierHistory] : [];
      history.push({
        id: `th-${Date.now()}`,
        tier: 'Returned_For_Revision',
        action: 'returned_for_revision',
        actorName: actorName || 'Reviewer',
        actorId,
        actorRole: actorRole || 'Developer',
        timestamp: nowIso,
        comments: reason
      });
      targetReport.tierHistory = history;

      currentReports[reportIndex] = targetReport;
      saveReportsToFile(currentReports);
      try {
        await saveFirestoreReport(targetReport);
      } catch (e) {}

      res.json({ success: true, report: targetReport });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to return report for revision' });
    }
  });

  // Query Photos from Google Drive filtered by assigned user IMO
  app.get('/api/drive/photos', async (req, res) => {
    try {
      const userRole = (req.query.role as string) || 'Viewer';
      const requestedImo = req.query.imo as string | undefined;
      const clientToken = req.headers['x-google-drive-token'] as string | undefined;

      const accessToken = await getOrRefreshServerDriveToken(clientToken);
      if (!accessToken) {
        return res.json({ photos: [], message: 'Drive token not active' });
      }

      // Determine allowed IMO
      let targetImo = requestedImo;
      if (userRole === 'Viewer') {
        targetImo = 'MOMARO';
      }

      // Query reports from local cache/DB to retrieve all photos associated with this IMO
      const localReports = loadSavedReports();
      let matchedPhotos: any[] = [];

      localReports.forEach((rep: any) => {
        const repImo = (rep.imoOffice || '').toLowerCase();
        const matchesImo = (!targetImo || targetImo === 'All IMOs')
          ? true
          : targetImo === 'MOMARO'
            ? (repImo.includes('momaro') || repImo.includes('mindoro oriental') || !repImo)
            : (repImo.includes(targetImo.toLowerCase()) || targetImo.toLowerCase().includes(repImo));

        if (matchesImo && Array.isArray(rep.photos)) {
          rep.photos.forEach((p: any) => {
            matchedPhotos.push({
              ...p,
              reportId: rep.id,
              reportTitle: rep.title,
              imoOffice: rep.imoOffice || targetImo,
              locationName: p.locationName || rep.locationName,
              canalSegment: p.canalSegment || rep.canalSegment,
              parcelId: p.parcelId || rep.parcelId,
              lat: p.lat ?? rep.lat,
              lng: p.lng ?? rep.lng,
              createdAt: p.capturedAt || rep.createdAt
            });
          });
        }
      });

      res.json({ photos: matchedPhotos, count: matchedPhotos.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch Drive photos' });
    }
  });

  // Check Google Drive Backend Upload Status
  app.get('/api/drive/status', async (req, res) => {
    const token = await getOrRefreshServerDriveToken();
    const folderId = getTargetFolderId();
    const hasRefreshToken = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN);
    res.json({
      active: !!token,
      hasRefreshToken,
      mode: hasRefreshToken ? 'Long-Term Auto Refresh Token (Active)' : token ? 'Session Access Token' : 'Inactive',
      targetFolderId: folderId,
      driveFolderUrl: `https://drive.google.com/drive/folders/${folderId}`
    });
  });

  // Store Google Drive OAuth token on backend to empower unauthenticated public uploads
  app.post('/api/drive/sync-token', (req, res) => {
    const { accessToken } = req.body;
    if (!accessToken) {
      return res.status(400).json({ error: 'accessToken is required' });
    }
    saveServerDriveToken(accessToken);
    res.json({
      success: true,
      message: 'Server Google Drive access token updated. Unauthenticated public submissions will now auto-upload to Google Drive!',
      targetFolderId: getTargetFolderId()
    });
  });

  // IMO Google Drive Folder Constants (with Standard Short Names)
  const IMO_DRIVE_FOLDERS = [
    {
      id: '1LdKe-iTgeF_nEy-eRcJwkYAqmj0DwEm0',
      name: 'Mindoro Oriental-Marinduque-Romblon IMO',
      shortCode: 'MOMARO IMO'
    },
    {
      id: '1IBqpIgac41KSVc3UBq-xONJVxyNwjX_0',
      name: 'Occidental Mindoro IMO',
      shortCode: 'OMIMO'
    },
    {
      id: '1xqXBkJAscqqCDgQRFbCAyQh46baehrQ1',
      name: 'Palawan IMO',
      shortCode: 'PALIMO'
    }
  ];

  const getShortImoName = (imoName?: string): string => {
    if (!imoName) return '';
    const lower = imoName.toLowerCase();
    if (lower.includes('momaro') || lower.includes('oriental') || lower.includes('marinduque') || lower.includes('romblon')) {
      return 'MOMARO IMO';
    }
    if (lower.includes('occidental') || lower.includes('omimo')) {
      return 'OMIMO';
    }
    if (lower.includes('palawan') || lower.includes('pimo') || lower.includes('palimo')) {
      return 'PALIMO';
    }
    return imoName;
  };

  // Fetch GIS files metadata and content from the 3 IMO Google Drive folders with RBAC
  app.get('/api/drive/imo-layers', async (req, res) => {
    try {
      const userRole = (req.query.role as string) || 'Viewer';
      const requestedImo = req.query.imo as string | undefined;
      const clientToken = req.headers['x-google-drive-token'] as string | undefined;

      const accessToken = await getOrRefreshServerDriveToken(clientToken);

      // RBAC & Jurisdiction Permission Logic:
      // - IMO Users (IMO Admin, IMO Evaluator, IMO Reviewer, IMO Preparer, Field Personnel): Strictly restricted to their designated IMO folder
      // - Regional Roles (Developer, RO Admin, RO Evaluator, RO Reviewer, RO Preparer): Permitted across all 3 IMO folders, or filtered by requested IMO
      // - Viewer: Restricted to MOMARO IMO by default or specific requested IMO
      let permittedFolders = [...IMO_DRIVE_FOLDERS];
      const isImoScopedRole = ['IMO Admin', 'IMO Evaluator', 'IMO Reviewer', 'IMO Preparer', 'Field Personnel'].includes(userRole);

      if (requestedImo && requestedImo !== 'All IMOs' && requestedImo !== 'Regional Office IV-B') {
        const filtered = permittedFolders.filter(f => matchesImoOffice(f.name, requestedImo) || matchesImoOffice(f.shortCode, requestedImo));
        if (filtered.length > 0) {
          permittedFolders = filtered;
        }
      } else if (isImoScopedRole || userRole === 'Viewer') {
        permittedFolders = IMO_DRIVE_FOLDERS.filter(f => f.shortCode === 'MOMARO IMO');
      }

      const allDriveLayers: any[] = [];
      const liveDriveIds = new Set<string>();

      for (const folder of permittedFolders) {
        try {
          const files = await listDriveGISFilesInFolder(accessToken || '', folder.id);

          files.forEach((file) => {
            const fileId = `drive-${file.id}`;
            liveDriveIds.add(fileId);

            const fnLower = file.name.toLowerCase();
            let subCat: 'Parcels' | 'Main Canals' | 'Lateral Canals' | 'Other Unclassified Canals' | 'Structures' = 'Other Unclassified Canals';
            let parentCat: 'Canals' | 'Parcels' | 'Structures' = 'Canals';
            let fixedColor = '#1e40af'; // Fixed Dark Blue for Other Unclassified Canals

            if (fnLower.includes('parcel') || fnLower.includes('lot') || fnLower.includes('irrigated')) {
              subCat = 'Parcels';
              parentCat = 'Parcels';
              fixedColor = '#10b981';
            } else if (fnLower.includes('structure') || fnLower.includes('gate') || fnLower.includes('dam') || fnLower.includes('turnout') || fnLower.includes('point')) {
              subCat = 'Structures';
              parentCat = 'Structures';
              fixedColor = '#f59e0b';
            } else if (fnLower.includes('main canal') || fnLower.includes('main_canal') || fnLower.includes('main') || fnLower.includes('mc')) {
              subCat = 'Main Canals';
              parentCat = 'Canals';
              fixedColor = '#38bdf8'; // Fixed Light Blue for Main Canals
            } else if (fnLower.includes('lateral') || fnLower.includes('lat_') || fnLower.includes('lat')) {
              subCat = 'Lateral Canals';
              parentCat = 'Canals';
              fixedColor = '#2563eb'; // Fixed Blue for Lateral Canals
            } else {
              subCat = 'Other Unclassified Canals';
              parentCat = 'Canals';
              fixedColor = '#1e40af'; // Fixed Dark Blue for Other Unclassified Canals
            }

            // Layer Name Format: Short IMO Name - (GIS Data Category) e.g. MOMARO IMO - Main Canals, OMIMO - Main Canals, PIMO - Main Canals
            const shortImo = getShortImoName(folder.shortCode || folder.name);
            const layerName = `${shortImo} - ${subCat}`;
            const defaultOpacity = parentCat === 'Parcels' ? 0.30 : 0.90;

            allDriveLayers.push({
              id: fileId,
              driveFileId: file.id,
              driveModifiedTime: file.modifiedTime || new Date().toISOString(),
              name: layerName,
              fileName: file.name,
              category: parentCat,
              subCategory: subCat,
              visible: true,
              color: fixedColor,
              opacity: defaultOpacity,
              sizeBytes: file.size ? parseInt(file.size, 10) : 0,
              uploadedAt: file.modifiedTime || new Date().toISOString(),
              imoOffice: folder.name,
              driveFolderId: folder.id,
              mimeType: file.mimeType,
              source: 'Google Drive'
            });
          });
        } catch (fErr) {
          console.warn(`Error fetching Drive files for folder ${folder.name}:`, fErr);
        }
      }

      res.json({
        success: true,
        userRole,
        permittedFolderCount: permittedFolders.length,
        layers: allDriveLayers
      });
    } catch (err: any) {
      console.error('IMO Drive layers endpoint error:', err);
      res.status(500).json({ error: err.message || 'Failed to fetch Drive IMO layers' });
    }
  });

function ensureDriveCacheDir() {
  if (!fs.existsSync(DRIVE_CACHE_DIR)) {
    try { fs.mkdirSync(DRIVE_CACHE_DIR, { recursive: true }); } catch (e) {}
  }
}

async function getOrFetchDriveFileBuffer(fileId: string, accessToken?: string): Promise<Buffer> {
  ensureDriveCacheDir();
  const cachePath = path.join(DRIVE_CACHE_DIR, `${fileId}.bin`);
  if (fs.existsSync(cachePath)) {
    try {
      const stats = fs.statSync(cachePath);
      // Cache valid for 24 hours if size > 0
      if (Date.now() - stats.mtimeMs < 24 * 60 * 60 * 1000 && stats.size > 0) {
        return fs.readFileSync(cachePath);
      }
    } catch (e) {}
  }

  const buffer = await downloadDriveBinaryBuffer(accessToken || '', fileId);
  if (buffer && buffer.length > 0) {
    try {
      fs.writeFileSync(cachePath, buffer);
    } catch (e) {}
  }
  return buffer;
}

  // Download raw file binary/text from Google Drive by file ID with server disk caching
  app.get('/api/drive/file/:fileId', async (req, res) => {
    try {
      const { fileId } = req.params;
      const clientToken = req.headers['x-google-drive-token'] as string | undefined;
      const accessToken = await getOrRefreshServerDriveToken(clientToken);

      const buffer = await getOrFetchDriveFileBuffer(fileId, accessToken || undefined);
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
      res.send(buffer);
    } catch (err: any) {
      console.error(`Error streaming Drive file ${req.params.fileId}:`, err);
      res.status(500).json({ error: err.message || 'Failed to download file from Drive' });
    }
  });

  // Clear server-side Drive feature cache while PRESERVING custom layer configurations and inspection photos
  app.post('/api/drive/clear-cache', (req, res) => {
    try {
      // 1. Delete cached raw vector files in DRIVE_CACHE_DIR (preserve photo_*.bin files)
      if (fs.existsSync(DRIVE_CACHE_DIR)) {
        const files = fs.readdirSync(DRIVE_CACHE_DIR);
        for (const file of files) {
          if (!file.startsWith('photo_')) {
            try {
              fs.unlinkSync(path.join(DRIVE_CACHE_DIR, file));
            } catch (e) {}
          }
        }
      }

      // 2. Evict vector feature geometries from persistent_layers.json while PRESERVING layer settings (color, opacity, visibility, name)
      if (fs.existsSync(LAYERS_FILE)) {
        try {
          const content = fs.readFileSync(LAYERS_FILE, 'utf-8');
          const layers = JSON.parse(content);
          if (Array.isArray(layers)) {
            const stripped = layers.map((l: any) => {
              if (l.source === 'Google Drive' || l.driveFileId || (l.id && String(l.id).startsWith('drive-'))) {
                return {
                  ...l,
                  data: { type: 'FeatureCollection', features: [] },
                  featureCount: 0
                };
              }
              return l;
            });
            safeWriteJsonSync(LAYERS_FILE, stripped);
          }
        } catch (e) {}
      }

      res.json({ 
        success: true, 
        message: 'Google Drive vector feature cache evicted! All layer configurations & color settings preserved.' 
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to clear Drive cache' });
    }
  });

  // Stream Local Inspection Photos by Photo ID
  app.get('/api/photos/:photoId', (req, res) => {
    try {
      const { photoId } = req.params;
      ensureDataDir();
      const possiblePaths = [
        path.join(DRIVE_CACHE_DIR, `photo_${photoId}.bin`),
        path.join(PHOTOS_DIR, `${photoId}.jpg`),
        path.join(PHOTOS_DIR, `${photoId}.png`),
        path.join(PHOTOS_DIR, `${photoId}.bin`),
        path.join(DRIVE_CACHE_DIR, `${photoId}.bin`)
      ];

      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          const stats = fs.statSync(p);
          if (stats.size > 0) {
            const buf = fs.readFileSync(p);
            const mimeType = getImageMimeType(buf);
            res.setHeader('Content-Type', mimeType);
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
            return res.send(buf);
          }
        }
      }

      res.status(404).json({ error: 'Photo not found in local cache' });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to stream local photo' });
    }
  });

  // Stream & Cache Google Drive Field Report Photos (with Resilient Disk-First & Base64 Fallback)
  app.get('/api/drive/photo/:fileId', async (req, res) => {
    try {
      const { fileId } = req.params;
      ensureDataDir();

      // 1. FAST PATH: Check if already present in local disk cache (NO token or network needed!)
      const possibleDiskPaths = [
        path.join(DRIVE_CACHE_DIR, `photo_${fileId}.bin`),
        path.join(DRIVE_CACHE_DIR, `${fileId}.bin`),
        path.join(PHOTOS_DIR, `${fileId}.jpg`),
        path.join(PHOTOS_DIR, `${fileId}.png`),
        path.join(PHOTOS_DIR, `${fileId}.bin`)
      ];

      for (const cachedPath of possibleDiskPaths) {
        if (fs.existsSync(cachedPath)) {
          try {
            const stats = fs.statSync(cachedPath);
            if (stats.size > 0) {
              const buf = fs.readFileSync(cachedPath);
              const mimeType = getImageMimeType(buf);
              res.setHeader('Content-Type', mimeType);
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
              return res.send(buf);
            }
          } catch (_) {}
        }
      }

      // 2. SECONDARY PATH: Check if any report in memory/disk has this photo in base64 format
      const localReports = loadSavedReports();
      for (const r of localReports) {
        if (Array.isArray(r.photos)) {
          for (const p of r.photos) {
            if ((p.driveFileId === fileId || p.id === fileId || p.url?.includes(fileId)) && p.url?.startsWith('data:image/')) {
              saveBase64PhotoToDisk(fileId, p.url, fileId);
              const cached = path.join(DRIVE_CACHE_DIR, `photo_${fileId}.bin`);
              if (fs.existsSync(cached)) {
                const buf = fs.readFileSync(cached);
                const mimeType = getImageMimeType(buf);
                res.setHeader('Content-Type', mimeType);
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
                return res.send(buf);
              }
            }
          }
        }
        if (r.photoUrl?.startsWith('data:image/') && (r.id === fileId || r.photoUrl.includes(fileId))) {
          saveBase64PhotoToDisk(fileId, r.photoUrl, fileId);
          const cached = path.join(DRIVE_CACHE_DIR, `photo_${fileId}.bin`);
          if (fs.existsSync(cached)) {
            const buf = fs.readFileSync(cached);
            const mimeType = getImageMimeType(buf);
            res.setHeader('Content-Type', mimeType);
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
            return res.send(buf);
          }
        }
      }

      // 3. TERTIARY PATH: Fetch from Google Drive API if token is valid
      const clientToken = req.headers['x-google-drive-token'] as string | undefined;
      const token = await getOrRefreshServerDriveToken(clientToken);

      if (token) {
        try {
          const buffer = await downloadDriveBinaryBuffer(token, fileId);
          if (buffer && buffer.length > 0) {
            const cachedPhotoPath = path.join(DRIVE_CACHE_DIR, `photo_${fileId}.bin`);
            try {
              fs.writeFileSync(cachedPhotoPath, buffer);
            } catch (_) {}
            const mimeType = getImageMimeType(buffer);
            res.setHeader('Content-Type', mimeType);
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
            return res.send(buffer);
          }
        } catch (dlErr) {
          console.warn(`Drive download failed for ${fileId}:`, dlErr);
        }
      }

      res.status(404).json({ error: 'Photo not found or inaccessible' });
    } catch (err: any) {
      console.warn(`Failed to stream Drive photo ${req.params.fileId}:`, err.message);
      res.status(404).json({ error: 'Photo not found or inaccessible' });
    }
  });

  // Force-Refresh and Sync All Field Reports from Google Drive IMO Folders
  app.post('/api/drive/sync-reports', async (req, res) => {
    try {
      const clientToken = req.headers['x-google-drive-token'] as string | undefined;
      const targetImo = (req.query.imo as string) || req.body?.imo || req.body?.targetImo;
      const driveReports = await fetchReportsFromAllDriveFolders(clientToken, true, targetImo);
      const localBackup = loadSavedReports();
      const merged = deduplicateById([...localBackup, ...driveReports]);
      saveReportsToFile(merged);
      res.json({ success: true, count: merged.length, reports: merged });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Drive report sync failed' });
    }
  });

  // Create Field Report (Unauthenticated user submission allowed)
  app.post('/api/reports', async (req, res) => {
    try {
      const reportData = req.body;
      const clientToken = req.headers['x-google-drive-token'] as string | undefined;

      const reportId = reportData.id || generateWmrReportId(reportData.nisBinding, reportData.imoOffice);
      const fullReport = { ...reportData, id: reportId };

      // Cache all attached base64 photos to server disk immediately
      if (Array.isArray(fullReport.photos)) {
        fullReport.photos.forEach((p: any, idx: number) => {
          if (p.url?.startsWith('data:image/')) {
            const photoKey = p.id || `${reportId}_${idx + 1}`;
            saveBase64PhotoToDisk(photoKey, p.url, p.driveFileId);
          }
        });
      }
      if (fullReport.photoUrl?.startsWith('data:image/')) {
        saveBase64PhotoToDisk(`${reportId}_cover`, fullReport.photoUrl);
      }

      const currentReports = loadSavedReports();
      saveReportsToFile([fullReport, ...currentReports.filter((r: any) => r.id !== fullReport.id)]);

      // Background upload report, variables & photos directly to target Google Drive folder
      uploadReportToTargetDriveFolder(fullReport, clientToken)
        .then(result => {
          if (result?.success) {
            console.log(`✅ Google Drive auto-sync success for ${fullReport.id}: Folder ${result.reportFolderId}, Photos: ${result.photoCount}`);
          } else {
            console.warn(`⚠️ Google Drive auto-sync note for ${fullReport.id}: ${result?.message}`);
          }
        })
        .catch(driveErr => {
          console.warn('Background Google Drive upload warning:', driveErr);
        });

      res.json({ success: true, report: fullReport, message: 'Report saved and Google Drive sync started' });
    } catch (err: any) {
      console.error('Failed to submit report:', err);
      res.status(500).json({ error: err.message || 'Failed to submit report' });
    }
  });

  // Batch Sync Offline Field Reports
  app.post('/api/reports/batch', async (req, res) => {
    try {
      const { reports: incoming } = req.body;
      const clientToken = req.headers['x-google-drive-token'] as string | undefined;

      if (!Array.isArray(incoming)) {
        return res.status(400).json({ error: 'Payload must include an array of reports' });
      }

      // Cache any base64 photos
      incoming.forEach((rep: any) => {
        if (Array.isArray(rep.photos)) {
          rep.photos.forEach((p: any, idx: number) => {
            if (p.url?.startsWith('data:image/')) {
              const photoKey = p.id || `${rep.id}_${idx + 1}`;
              saveBase64PhotoToDisk(photoKey, p.url, p.driveFileId);
            }
          });
        }
      });

      const currentReports = loadSavedReports();
      const mergedMap = new Map();
      currentReports.forEach((r: any) => mergedMap.set(r.id, r));
      incoming.forEach((r: any) => mergedMap.set(r.id, r));
      const updatedReports = Array.from(mergedMap.values());
      saveReportsToFile(updatedReports);

      // Trigger Drive uploads in background for incoming batch
      incoming.forEach((rep: any) => {
        uploadReportToTargetDriveFolder(rep, clientToken).catch(err => {
          console.warn(`Background Drive batch upload error for ${rep.id}:`, err);
        });
      });

      res.json({
        success: true,
        syncedCount: incoming.length,
        totalReports: updatedReports.length
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Batch sync failed' });
    }
  });

  // Ensure no stale browser cache for development assets & root document
  app.use((req, res, next) => {
    if (req.path === '/' || req.path.endsWith('.html') || req.path.startsWith('/src/')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    next();
  });

  // Production static file serving vs Vite Middleware for Development
  const isProduction = process.env.NODE_ENV === 'production' || process.env.K_SERVICE !== undefined || !fs.existsSync(path.join(process.cwd(), 'src', 'main.tsx'));

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        watch: {
          ignored: [
            '**/data/**',
            '**/.git/**',
            '**/persistent_*.*',
            '**/*.json',
            '**/dist/**',
            '**/.gemini/**'
          ]
        }
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const candidates = [
      __dirname,
      path.join(__dirname, 'dist'),
      path.join(process.cwd(), 'dist'),
      path.join(__dirname, '../dist'),
      path.join(__dirname, '../../dist'),
      process.cwd()
    ];
    let distPath = path.join(process.cwd(), 'dist');
    for (const c of candidates) {
      if (fs.existsSync(path.join(c, 'index.html'))) {
        distPath = c;
        break;
      }
    }
    console.log('Serving production static assets from:', distPath);

    app.use(express.static(distPath, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html') || filePath.endsWith('sw.js') || filePath.endsWith('manifest.json')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        }
      }
    }));
    app.get('*', (req, res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send(`Application index.html not found. Looked in: ${indexPath}`);
      }
    });
  }

  return app;
}

const isMainModule = process.argv[1] && (
  process.argv[1].endsWith('server.ts') ||
  process.argv[1].endsWith('server.js') ||
  process.argv[1].endsWith('server.cjs')
);

if (isMainModule) {
  createApp().then(app => {
    const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8080;
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server listening on http://0.0.0.0:${PORT}`);
    });
  }).catch(err => {
    console.error('Server startup failed:', err);
  });
}

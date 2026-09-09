import { AuthUser, UserRole, AccessRequest } from '../types';
import { normalizeUserRole } from '../utils/approvalHierarchyEngine';

export const IMO_LIST = [
  'Mindoro Oriental-Marinduque-Romblon IMO',
  'Occidental Mindoro IMO',
  'Palawan IMO'
] as const;

export const IMO_NIS_MAPPING: Record<string, string[]> = {
  'Mindoro Oriental-Marinduque-Romblon IMO': [
    'Baco-Bucayao RIS',
    'Mag-asawang Tubig RIS',
    'Pula RIS',
    'Bongabong RIS',
    'Pagbahan RIS'
  ],
  'Occidental Mindoro IMO': [
    'Mamburao RIS',
    'Amnay RIS',
    'Patrick RIS',
    'Lumintao RIS',
    'Monpong RIS'
  ],
  'Palawan IMO': [
    'Malatgao RIS',
    'Batang-Batang RIS',
    'Malinao RIS',
    'Inagawan RIS',
    'Panitian RIS'
  ]
};

export const CANONICAL_IMO_OFFICES = [
  'All IMOs',
  'Mindoro Oriental-Marinduque-Romblon IMO',
  'Occidental Mindoro IMO',
  'Palawan IMO'
] as const;

export function getPermittedNisList(imoOffice?: string): string[] {
  if (!imoOffice || imoOffice === 'All IMOs' || imoOffice === 'Regional Office IV-B') {
    return ['All NIS'];
  }
  const imo = imoOffice.trim();
  if (imo.includes('MOMARO') || imo.includes('Oriental') || imo.includes('Marinduque') || imo.includes('Romblon')) {
    return IMO_NIS_MAPPING['Mindoro Oriental-Marinduque-Romblon IMO'];
  }
  if (imo.includes('Occidental')) {
    return IMO_NIS_MAPPING['Occidental Mindoro IMO'];
  }
  if (imo.includes('Palawan')) {
    return IMO_NIS_MAPPING['Palawan IMO'];
  }
  return ['All NIS'];
}

export function getNisOptionsForImo(imoOffice?: string): string[] {
  if (!imoOffice || imoOffice === 'All IMOs' || imoOffice === 'Regional Office IV-B') {
    return ['All NIS'];
  }
  return ['All NIS', ...getPermittedNisList(imoOffice)];
}

export const DEFAULT_AUTH_USERS: AuthUser[] = [
  // ==========================================
  // 1. MASTER DEVELOPER ACCOUNT (1 Account)
  // ==========================================
  {
    id: 'usr-dev-01',
    username: 'dev_master',
    name: 'Lead Systems Architect (Developer)',
    role: 'Developer',
    passcode: 'DEV9824X',
    imoOffice: 'All IMOs',
    nisBinding: 'All NIS',
    designation: 'Master Systems Administrator - Regional Wide'
  },

  // ==========================================
  // 2. REGIONAL OFFICE (RO) ACCOUNTS (4 Accounts)
  // ==========================================
  {
    id: 'usr-ro-admin-01',
    username: 'ro_admin',
    name: 'Executive Administrator (Regional Office)',
    role: 'RO Admin',
    passcode: 'ROA9910R',
    imoOffice: 'All IMOs',
    nisBinding: 'All NIS',
    designation: 'Regional Office Executive Admin & Access Gatekeeper'
  },
  {
    id: 'usr-ro-adm-01',
    username: 'ro_evaluator',
    name: 'Division Manager (Regional Office)',
    role: 'RO Evaluator',
    passcode: 'ROA7721R',
    imoOffice: 'All IMOs',
    nisBinding: 'All NIS',
    designation: 'Regional Office Division Manager & Evaluator'
  },
  {
    id: 'usr-ro-eva-01',
    username: 'ro_reviewer',
    name: 'Regional Report Reviewer',
    role: 'RO Reviewer',
    passcode: 'ROE5534R',
    imoOffice: 'All IMOs',
    nisBinding: 'All NIS',
    designation: 'Regional O&M Report Reviewer'
  },
  {
    id: 'usr-ro-pre-01',
    username: 'ro_preparer',
    name: 'Regional Report Preparer',
    role: 'RO Preparer',
    passcode: 'ROP9912R',
    imoOffice: 'All IMOs',
    nisBinding: 'All NIS',
    designation: 'Regional O&M Report Preparer'
  },

  // ==========================================
  // 3. IMO ADMIN & EVALUATOR ACCOUNTS (6 Accounts: 2 per IMO)
  // ==========================================
  {
    id: 'usr-imo-adm-momaro',
    username: 'admin_momaro',
    name: 'IMO Administrator (MOMARO IMO)',
    role: 'IMO Admin',
    passcode: 'ADM8810M',
    imoOffice: 'Mindoro Oriental-Marinduque-Romblon IMO',
    nisBinding: 'All NIS',
    designation: 'MOMARO IMO Administrator & Access Gatekeeper'
  },
  {
    id: 'usr-adm-02',
    username: 'evaluator_momaro',
    name: 'Division Manager (MOMARO IMO)',
    role: 'IMO Evaluator',
    passcode: 'MOM8841A',
    imoOffice: 'Mindoro Oriental-Marinduque-Romblon IMO',
    nisBinding: 'MOMARO Systems',
    designation: 'MOMARO IMO Division Manager & Evaluator'
  },
  {
    id: 'usr-imo-adm-occmindoro',
    username: 'admin_occmindoro',
    name: 'IMO Administrator (Occ. Mindoro IMO)',
    role: 'IMO Admin',
    passcode: 'ADM4410O',
    imoOffice: 'Occidental Mindoro IMO',
    nisBinding: 'All NIS',
    designation: 'Occidental Mindoro IMO Administrator & Access Gatekeeper'
  },
  {
    id: 'usr-adm-03',
    username: 'evaluator_occmindoro',
    name: 'Division Manager (Occ. Mindoro IMO)',
    role: 'IMO Evaluator',
    passcode: 'OCC4419A',
    imoOffice: 'Occidental Mindoro IMO',
    nisBinding: 'Occidental Mindoro Systems',
    designation: 'Occidental Mindoro IMO Division Manager & Evaluator'
  },
  {
    id: 'usr-imo-adm-palawan',
    username: 'admin_palawan',
    name: 'IMO Administrator (Palawan IMO)',
    role: 'IMO Admin',
    passcode: 'ADM5510P',
    imoOffice: 'Palawan IMO',
    nisBinding: 'All NIS',
    designation: 'Palawan IMO Administrator & Access Gatekeeper'
  },
  {
    id: 'usr-adm-04',
    username: 'evaluator_palawan',
    name: 'Division Manager (Palawan IMO)',
    role: 'IMO Evaluator',
    passcode: 'PAL5523A',
    imoOffice: 'Palawan IMO',
    nisBinding: 'Palawan Systems',
    designation: 'Palawan IMO Division Manager & Evaluator'
  },

  // ==========================================
  // 4. IMO REVIEWER ACCOUNTS (15 Accounts: 5 per IMO)
  // ==========================================
  // MOMARO IMO (5 IMO Reviewers)
  {
    id: 'usr-eng-mom-01',
    username: 'reviewer_momaro_1',
    name: 'IMO Reviewer MOMARO 01',
    role: 'IMO Reviewer',
    passcode: 'ENG8101M',
    imoOffice: 'Mindoro Oriental-Marinduque-Romblon IMO',
    nisBinding: 'Baco-Bucayao RIS',
    designation: 'Principal IMO Reviewer - Baco-Bucayao RIS'
  },
  {
    id: 'usr-eng-mom-02',
    username: 'reviewer_momaro_2',
    name: 'IMO Reviewer MOMARO 02',
    role: 'IMO Reviewer',
    passcode: 'ENG8102M',
    imoOffice: 'Mindoro Oriental-Marinduque-Romblon IMO',
    nisBinding: 'Mag-asawang Tubig RIS',
    designation: 'Senior IMO Reviewer - Mag-asawang Tubig RIS'
  },
  {
    id: 'usr-eng-mom-03',
    username: 'reviewer_momaro_3',
    name: 'IMO Reviewer MOMARO 03',
    role: 'IMO Reviewer',
    passcode: 'ENG8103M',
    imoOffice: 'Mindoro Oriental-Marinduque-Romblon IMO',
    nisBinding: 'Pula RIS',
    designation: 'Supervising IMO Reviewer - Pula RIS'
  },
  {
    id: 'usr-eng-mom-04',
    username: 'reviewer_momaro_4',
    name: 'IMO Reviewer MOMARO 04',
    role: 'IMO Reviewer',
    passcode: 'ENG8104M',
    imoOffice: 'Mindoro Oriental-Marinduque-Romblon IMO',
    nisBinding: 'Bongabong RIS',
    designation: 'Lead IMO Reviewer - Bongabong RIS'
  },
  {
    id: 'usr-eng-mom-05',
    username: 'reviewer_momaro_5',
    name: 'IMO Reviewer MOMARO 05',
    role: 'IMO Reviewer',
    passcode: 'ENG8105M',
    imoOffice: 'Mindoro Oriental-Marinduque-Romblon IMO',
    nisBinding: 'Pagbahan RIS',
    designation: 'Field IMO Reviewer - Pagbahan RIS'
  },

  // Occidental Mindoro IMO (5 IMO Reviewers)
  {
    id: 'usr-eng-occ-01',
    username: 'reviewer_occmindoro_1',
    name: 'IMO Reviewer Occ. Mindoro 01',
    role: 'IMO Reviewer',
    passcode: 'ENG9201O',
    imoOffice: 'Occidental Mindoro IMO',
    nisBinding: 'Mamburao RIS',
    designation: 'Principal IMO Reviewer - Mamburao RIS'
  },
  {
    id: 'usr-eng-occ-02',
    username: 'reviewer_occmindoro_2',
    name: 'IMO Reviewer Occ. Mindoro 02',
    role: 'IMO Reviewer',
    passcode: 'ENG9202O',
    imoOffice: 'Occidental Mindoro IMO',
    nisBinding: 'Amnay RIS',
    designation: 'Senior IMO Reviewer - Amnay RIS'
  },
  {
    id: 'usr-eng-occ-03',
    username: 'reviewer_occmindoro_3',
    name: 'IMO Reviewer Occ. Mindoro 03',
    role: 'IMO Reviewer',
    passcode: 'ENG9203O',
    imoOffice: 'Occidental Mindoro IMO',
    nisBinding: 'Patrick RIS',
    designation: 'Supervising IMO Reviewer - Patrick RIS'
  },
  {
    id: 'usr-eng-occ-04',
    username: 'reviewer_occmindoro_4',
    name: 'IMO Reviewer Occ. Mindoro 04',
    role: 'IMO Reviewer',
    passcode: 'ENG9204O',
    imoOffice: 'Occidental Mindoro IMO',
    nisBinding: 'Lumintao RIS',
    designation: 'Lead IMO Reviewer - Lumintao RIS'
  },
  {
    id: 'usr-eng-occ-05',
    username: 'reviewer_occmindoro_5',
    name: 'IMO Reviewer Occ. Mindoro 05',
    role: 'IMO Reviewer',
    passcode: 'ENG9205O',
    imoOffice: 'Occidental Mindoro IMO',
    nisBinding: 'Monpong RIS',
    designation: 'Field IMO Reviewer - Monpong RIS'
  },

  // Palawan IMO (5 IMO Reviewers)
  {
    id: 'usr-eng-pal-01',
    username: 'reviewer_palawan_1',
    name: 'IMO Reviewer Palawan 01',
    role: 'IMO Reviewer',
    passcode: 'ENG7301P',
    imoOffice: 'Palawan IMO',
    nisBinding: 'Malatgao RIS',
    designation: 'Principal IMO Reviewer - Malatgao RIS'
  },
  {
    id: 'usr-eng-pal-02',
    username: 'reviewer_palawan_2',
    name: 'IMO Reviewer Palawan 02',
    role: 'IMO Reviewer',
    passcode: 'ENG7302P',
    imoOffice: 'Palawan IMO',
    nisBinding: 'Batang-Batang RIS',
    designation: 'Senior IMO Reviewer - Batang-Batang RIS'
  },
  {
    id: 'usr-eng-pal-03',
    username: 'reviewer_palawan_3',
    name: 'IMO Reviewer Palawan 03',
    role: 'IMO Reviewer',
    passcode: 'ENG7303P',
    imoOffice: 'Palawan IMO',
    nisBinding: 'Malinao RIS',
    designation: 'Supervising IMO Reviewer - Malinao RIS'
  },
  {
    id: 'usr-eng-pal-04',
    username: 'reviewer_palawan_4',
    name: 'IMO Reviewer Palawan 04',
    role: 'IMO Reviewer',
    passcode: 'ENG7304P',
    imoOffice: 'Palawan IMO',
    nisBinding: 'Inagawan RIS',
    designation: 'Lead IMO Reviewer - Inagawan RIS'
  },
  {
    id: 'usr-eng-pal-05',
    username: 'reviewer_palawan_5',
    name: 'IMO Reviewer Palawan 05',
    role: 'IMO Reviewer',
    passcode: 'ENG7305P',
    imoOffice: 'Palawan IMO',
    nisBinding: 'Panitian RIS',
    designation: 'Field IMO Reviewer - Panitian RIS'
  },

  // ==========================================
  // 5. IMO PREPARER ACCOUNTS (15 Accounts: 5 per IMO)
  // ==========================================
  // MOMARO IMO (5 IMO Preparers)
  {
    id: 'usr-prep-mom-01',
    username: 'prep_momaro_1',
    name: 'IMO Preparer MOMARO 01',
    role: 'IMO Preparer',
    passcode: 'NPR8101M',
    imoOffice: 'Mindoro Oriental-Marinduque-Romblon IMO',
    nisBinding: 'Baco-Bucayao RIS',
    designation: 'IMO Report Preparer - Baco-Bucayao RIS'
  },
  {
    id: 'usr-prep-mom-02',
    username: 'prep_momaro_2',
    name: 'IMO Preparer MOMARO 02',
    role: 'IMO Preparer',
    passcode: 'NPR8102M',
    imoOffice: 'Mindoro Oriental-Marinduque-Romblon IMO',
    nisBinding: 'Mag-asawang Tubig RIS',
    designation: 'IMO Report Preparer - Mag-asawang Tubig RIS'
  },
  {
    id: 'usr-prep-mom-03',
    username: 'prep_momaro_3',
    name: 'IMO Preparer MOMARO 03',
    role: 'IMO Preparer',
    passcode: 'NPR8103M',
    imoOffice: 'Mindoro Oriental-Marinduque-Romblon IMO',
    nisBinding: 'Pula RIS',
    designation: 'IMO Report Preparer - Pula RIS'
  },
  {
    id: 'usr-prep-mom-04',
    username: 'prep_momaro_4',
    name: 'IMO Preparer MOMARO 04',
    role: 'IMO Preparer',
    passcode: 'NPR8104M',
    imoOffice: 'Mindoro Oriental-Marinduque-Romblon IMO',
    nisBinding: 'Bongabong RIS',
    designation: 'IMO Report Preparer - Bongabong RIS'
  },
  {
    id: 'usr-prep-mom-05',
    username: 'prep_momaro_5',
    name: 'IMO Preparer MOMARO 05',
    role: 'IMO Preparer',
    passcode: 'NPR8105M',
    imoOffice: 'Mindoro Oriental-Marinduque-Romblon IMO',
    nisBinding: 'Pagbahan RIS',
    designation: 'IMO Report Preparer - Pagbahan RIS'
  },

  // Occidental Mindoro IMO (5 IMO Preparers)
  {
    id: 'usr-prep-occ-01',
    username: 'prep_occmindoro_1',
    name: 'IMO Preparer Occ. Mindoro 01',
    role: 'IMO Preparer',
    passcode: 'NPR9201O',
    imoOffice: 'Occidental Mindoro IMO',
    nisBinding: 'Mamburao RIS',
    designation: 'IMO Report Preparer - Mamburao RIS'
  },
  {
    id: 'usr-prep-occ-02',
    username: 'prep_occmindoro_2',
    name: 'IMO Preparer Occ. Mindoro 02',
    role: 'IMO Preparer',
    passcode: 'NPR9202O',
    imoOffice: 'Occidental Mindoro IMO',
    nisBinding: 'Amnay RIS',
    designation: 'IMO Report Preparer - Amnay RIS'
  },
  {
    id: 'usr-prep-occ-03',
    username: 'prep_occmindoro_3',
    name: 'IMO Preparer Occ. Mindoro 03',
    role: 'IMO Preparer',
    passcode: 'NPR9203O',
    imoOffice: 'Occidental Mindoro IMO',
    nisBinding: 'Patrick RIS',
    designation: 'IMO Report Preparer - Patrick RIS'
  },
  {
    id: 'usr-prep-occ-04',
    username: 'prep_occmindoro_4',
    name: 'IMO Preparer Occ. Mindoro 04',
    role: 'IMO Preparer',
    passcode: 'NPR9204O',
    imoOffice: 'Occidental Mindoro IMO',
    nisBinding: 'Lumintao RIS',
    designation: 'IMO Report Preparer - Lumintao RIS'
  },
  {
    id: 'usr-prep-occ-05',
    username: 'prep_occmindoro_5',
    name: 'IMO Preparer Occ. Mindoro 05',
    role: 'IMO Preparer',
    passcode: 'NPR9205O',
    imoOffice: 'Occidental Mindoro IMO',
    nisBinding: 'Monpong RIS',
    designation: 'IMO Report Preparer - Monpong RIS'
  },

  // Palawan IMO (5 IMO Preparers)
  {
    id: 'usr-prep-pal-01',
    username: 'prep_palawan_1',
    name: 'IMO Preparer Palawan 01',
    role: 'IMO Preparer',
    passcode: 'NPR7301P',
    imoOffice: 'Palawan IMO',
    nisBinding: 'Malatgao RIS',
    designation: 'IMO Report Preparer - Malatgao RIS'
  },
  {
    id: 'usr-prep-pal-02',
    username: 'prep_palawan_2',
    name: 'IMO Preparer Palawan 02',
    role: 'IMO Preparer',
    passcode: 'NPR7302P',
    imoOffice: 'Palawan IMO',
    nisBinding: 'Batang-Batang RIS',
    designation: 'IMO Report Preparer - Batang-Batang RIS'
  },
  {
    id: 'usr-prep-pal-03',
    username: 'prep_palawan_3',
    name: 'IMO Preparer Palawan 03',
    role: 'IMO Preparer',
    passcode: 'NPR7303P',
    imoOffice: 'Palawan IMO',
    nisBinding: 'Malinao RIS',
    designation: 'IMO Report Preparer - Malinao RIS'
  },
  {
    id: 'usr-prep-pal-04',
    username: 'prep_palawan_4',
    name: 'IMO Preparer Palawan 04',
    role: 'IMO Preparer',
    passcode: 'NPR7304P',
    imoOffice: 'Palawan IMO',
    nisBinding: 'Inagawan RIS',
    designation: 'IMO Report Preparer - Inagawan RIS'
  },
  {
    id: 'usr-prep-pal-05',
    username: 'prep_palawan_5',
    name: 'IMO Preparer Palawan 05',
    role: 'IMO Preparer',
    passcode: 'NPR7305P',
    imoOffice: 'Palawan IMO',
    nisBinding: 'Panitian RIS',
    designation: 'IMO Report Preparer - Panitian RIS'
  },

  // ==========================================
  // 6. FIELD PERSONNEL ACCOUNTS (45 Accounts: 15 per IMO)
  // ==========================================
  // MOMARO IMO (15 Field Personnel)
  ...Array.from({ length: 15 }, (_, i) => {
    const idx = i + 1;
    const pad = idx.toString().padStart(2, '0');
    return {
      id: `usr-fld-mom-${pad}`,
      username: `field_momaro_${idx}`,
      name: `Field Inspector MOMARO ${pad}`,
      role: 'Field Personnel' as UserRole,
      passcode: `FLD81${pad}M`,
      imoOffice: 'Mindoro Oriental-Marinduque-Romblon IMO',
      nisBinding: 'All NIS',
      designation: 'MOMARO Field Crowdsource Inspector'
    };
  }),

  // Occidental Mindoro IMO (15 Field Personnel)
  ...Array.from({ length: 15 }, (_, i) => {
    const idx = i + 1;
    const pad = idx.toString().padStart(2, '0');
    return {
      id: `usr-fld-occ-${pad}`,
      username: `field_occmindoro_${idx}`,
      name: `Field Inspector Occ. Mindoro ${pad}`,
      role: 'Field Personnel' as UserRole,
      passcode: `FLD92${pad}O`,
      imoOffice: 'Occidental Mindoro IMO',
      nisBinding: 'All NIS',
      designation: 'Occidental Mindoro Field Crowdsource Inspector'
    };
  }),

  // Palawan IMO (15 Field Personnel)
  ...Array.from({ length: 15 }, (_, i) => {
    const idx = i + 1;
    const pad = idx.toString().padStart(2, '0');
    return {
      id: `usr-fld-pal-${pad}`,
      username: `field_palawan_${idx}`,
      name: `Field Inspector Palawan ${pad}`,
      role: 'Field Personnel' as UserRole,
      passcode: `FLD73${pad}P`,
      imoOffice: 'Palawan IMO',
      nisBinding: 'All NIS',
      designation: 'Palawan Field Crowdsource Inspector'
    };
  }),

  // ==========================================
  // 7. VIEWER ACCOUNTS (4 Accounts: 1 Regional + 3 IMOs)
  // ==========================================
  {
    id: 'usr-view-01',
    username: 'viewer_regional',
    name: 'Regional Office Public Auditor',
    role: 'Viewer',
    passcode: 'VIEW401R',
    imoOffice: 'Regional Office IV-B',
    nisBinding: 'All NIS',
    designation: 'Regional Office Public Auditor / Viewer'
  },
  {
    id: 'usr-view-02',
    username: 'viewer_momaro',
    name: 'MOMARO IMO Public Auditor',
    role: 'Viewer',
    passcode: 'VIEW402M',
    imoOffice: 'Mindoro Oriental-Marinduque-Romblon IMO',
    nisBinding: 'MOMARO Systems',
    designation: 'MOMARO IMO Public Auditor / Viewer'
  },
  {
    id: 'usr-view-03',
    username: 'viewer_occmindoro',
    name: 'Occidental Mindoro IMO Public Auditor',
    role: 'Viewer',
    passcode: 'VIEW403O',
    imoOffice: 'Occidental Mindoro IMO',
    nisBinding: 'Occidental Mindoro Systems',
    designation: 'Occidental Mindoro IMO Public Auditor / Viewer'
  },
  {
    id: 'usr-view-04',
    username: 'viewer_palawan',
    name: 'Palawan IMO Public Auditor',
    role: 'Viewer',
    passcode: 'VIEW404P',
    imoOffice: 'Palawan IMO',
    nisBinding: 'Palawan Systems',
    designation: 'Palawan IMO Public Auditor / Viewer'
  }
];

export const STORAGE_USERS_KEY = 'ommap_registered_users_v4';
export const STORAGE_SESSION_KEY = 'ommap_auth_session';
export const STORAGE_PENDING_KEY = 'ommap_pending_google_admissions';

let memoryUsersCache: AuthUser[] | null = null;
let memoryPendingCache: AuthUser[] | null = null;

export function getAuthUsers(): AuthUser[] {
  if (memoryUsersCache && memoryUsersCache.length > 0) {
    return memoryUsersCache;
  }

  try {
    // Clean out legacy storage versions to prevent stale role names
    try {
      localStorage.removeItem('ommap_registered_users_v3');
      localStorage.removeItem('ommap_registered_users_v2');
      localStorage.removeItem('ommap_registered_users');
    } catch (_) {}

    const raw = localStorage.getItem(STORAGE_USERS_KEY);
    if (raw) {
      const parsed: AuthUser[] = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const defaultMap = new Map<string, AuthUser>();
        DEFAULT_AUTH_USERS.forEach(u => defaultMap.set(u.id, u));

        const result: AuthUser[] = [];
        const seenIds = new Set<string>();

        // Process stored users: if it is a default account, adopt latest canonical name, role, username & designation
        parsed.forEach(u => {
          seenIds.add(u.id);
          const def = defaultMap.get(u.id);
          if (def) {
            result.push({
              ...def,
              passcode: u.passcode || def.passcode,
              imoOffice: u.imoOffice || def.imoOffice,
              nisBinding: u.nisBinding || def.nisBinding,
              email: u.email || def.email,
              googleId: u.googleId || def.googleId
            });
          } else if (u.id.startsWith('usr-custom-') || u.id.startsWith('usr-google-')) {
            result.push({
              ...u,
              role: normalizeUserRole(u.role)
            });
          }
        });

        // Add any missing default users
        DEFAULT_AUTH_USERS.forEach(u => {
          if (!seenIds.has(u.id)) {
            result.push(u);
          }
        });

        memoryUsersCache = result;
        return memoryUsersCache;
      }
    }
  } catch (e) {}

  memoryUsersCache = DEFAULT_AUTH_USERS;
  return DEFAULT_AUTH_USERS;
}

export function authenticateUser(userIdOrUsername: string, passcode: string): AuthUser | null {
  if (!userIdOrUsername || !passcode) return null;
  const cleanId = userIdOrUsername.trim().toLowerCase().replace(/^@/, '');
  const cleanCode = passcode.trim().toUpperCase();
  const users = getAuthUsers();
  const user = users.find(u => 
    (u.username.toLowerCase() === cleanId || u.id.toLowerCase() === cleanId) &&
    u.passcode.toUpperCase() === cleanCode
  );
  return user || null;
}

export async function fetchRemoteAuthUsers(): Promise<AuthUser[]> {
  try {
    const [resUsers, resApproved] = await Promise.all([
      fetch('/api/users').catch(() => null),
      fetch('/api/approved-users').catch(() => null)
    ]);

    let list: AuthUser[] = [];
    if (resUsers && resUsers.ok) {
      const data = await resUsers.json();
      list = Array.isArray(data) ? data : (data && Array.isArray(data.users) ? data.users : []);
    }

    if (resApproved && resApproved.ok) {
      const approvedUsers = await resApproved.json();
      if (Array.isArray(approvedUsers)) {
        approvedUsers.forEach((au: AuthUser) => {
          if (!list.some(u => u.id === au.id || (au.email && u.email?.toLowerCase() === au.email.toLowerCase()))) {
            list.push(au);
          }
        });
      }
    }

    if (Array.isArray(list) && list.length > 0) {
      const defaultMap = new Map<string, AuthUser>();
      DEFAULT_AUTH_USERS.forEach(u => defaultMap.set(u.id, u));

      const normalized = list.map((u: AuthUser) => {
        const def = defaultMap.get(u.id);
        if (def) {
          return {
            ...def,
            passcode: u.passcode || def.passcode,
            imoOffice: u.imoOffice || def.imoOffice,
            nisBinding: u.nisBinding || def.nisBinding
          };
        }
        return {
          ...u,
          role: normalizeUserRole(u.role)
        };
      });
      saveAuthUsers(normalized);
      return normalized;
    }
  } catch (e) {}
  return getAuthUsers();
}

export function saveAuthUsers(users: AuthUser[]): void {
  memoryUsersCache = users;
  try {
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(users));
  } catch (e) {}
}

export async function updateUserPasscode(userId: string, newPasscode: string): Promise<boolean> {
  if (!userId || !newPasscode) return false;
  const users = getAuthUsers();
  const idx = users.findIndex(u => u.id === userId);
  if (idx === -1) return false;

  users[idx] = {
    ...users[idx],
    passcode: newPasscode.trim().toUpperCase()
  };

  saveAuthUsers(users);

  try {
    await fetch(`/api/users/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode: newPasscode.trim().toUpperCase() })
    });
  } catch (e) {}

  return true;
}

export async function updateUserScope(
  userId: string,
  scopeOrImo: string | { name?: string; role?: UserRole; imoOffice?: string; nisBinding?: string; designation?: string },
  nisBinding?: string
): Promise<boolean> {
  if (!userId) return false;
  const users = getAuthUsers();
  const idx = users.findIndex(u => u.id === userId);
  if (idx === -1) return false;

  let updates: Partial<AuthUser> = {};
  if (typeof scopeOrImo === 'object') {
    updates = scopeOrImo;
  } else {
    updates = {
      imoOffice: scopeOrImo,
      nisBinding: nisBinding || 'All NIS'
    };
  }

  users[idx] = {
    ...users[idx],
    ...updates
  };

  saveAuthUsers(users);

  try {
    await fetch(`/api/users/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
  } catch (e) {}

  return true;
}

export async function createNewUser(userData: Omit<AuthUser, 'id'>): Promise<AuthUser> {
  const users = getAuthUsers();
  const newId = `usr-custom-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
  const newUser: AuthUser = {
    id: newId,
    ...userData,
    role: normalizeUserRole(userData.role),
    passcode: userData.passcode.trim().toUpperCase()
  };

  users.push(newUser);
  saveAuthUsers(users);

  try {
    await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newUser)
    });
  } catch (e) {}

  return newUser;
}

export const createNewUserAccount = createNewUser;

export async function deleteUserAccount(userId: string): Promise<boolean> {
  if (!userId || userId === 'usr-dev-01') return false;
  const users = getAuthUsers();
  const filtered = users.filter(u => u.id !== userId);
  if (filtered.length === users.length) return false;

  saveAuthUsers(filtered);

  try {
    await fetch(`/api/users/${userId}`, {
      method: 'DELETE'
    });
  } catch (e) {}

  return true;
}

export function resetDefaultUsers(): void {
  memoryUsersCache = DEFAULT_AUTH_USERS;
  try {
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(DEFAULT_AUTH_USERS));
  } catch (e) {}
}

export const resetAuthUsersToDefault = resetDefaultUsers;

/**
 * Detects and ingests incoming SSO tokens from the Central Login Portal
 */
export function consumeIncomingAuthToken(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const authToken = params.get('auth_token');
    const authUserParam = params.get('auth_user');
    const authRoleParam = params.get('auth_role');
    const authNameParam = params.get('auth_name');
    const authOfficeParam = params.get('auth_office');
    const authDesigParam = params.get('auth_desig');
    const authPhoneParam = params.get('auth_phone');
    const authEmailParam = params.get('auth_email');

    let ingestedUser: AuthUser | null = null;

    if (authToken) {
      try {
        const jsonStr = decodeURIComponent(
          atob(authToken)
            .split('')
            .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
            .join('')
        );
        const payload = JSON.parse(jsonStr);
        if (payload && (payload.u || payload.id)) {
          const matchedUser = getAuthUsers().find(
            u => u.username.toLowerCase() === (payload.u || '').toLowerCase() || u.id === payload.id
          );
          if (matchedUser) {
            ingestedUser = {
              ...matchedUser,
              name: payload.name || matchedUser.name,
              role: normalizeUserRole(payload.role || payload.r || matchedUser.role),
              imoOffice: payload.imo || matchedUser.imoOffice,
              nisBinding: payload.nis || matchedUser.nisBinding,
              designation: payload.desig || matchedUser.designation,
              contactNumber: payload.phone || matchedUser.contactNumber,
              email: payload.email || matchedUser.email,
              avatar: payload.avatar || matchedUser.avatar
            };
          } else {
            // Provision user from SSO payload
            ingestedUser = {
              id: payload.id || `usr-sso-${Date.now()}`,
              username: payload.u || (payload.email ? payload.email.split('@')[0] : 'sso_user'),
              name: payload.name || 'Authorized NIA Personnel',
              role: normalizeUserRole(payload.role || payload.r || 'Viewer'),
              passcode: 'SSO_AUTHORIZED',
              imoOffice: payload.imo || 'Regional Office IV-B',
              nisBinding: payload.nis || 'All NIS',
              designation: payload.desig || 'NIA Officer',
              contactNumber: payload.phone || '',
              email: payload.email || '',
              avatar: payload.avatar || ''
            };
          }
        }
      } catch (tokenErr) {
        console.warn('[SSO Ingestion] Failed to decode token:', tokenErr);
      }
    } else if (authUserParam) {
      const matchedUser = getAuthUsers().find(
        u => u.username.toLowerCase() === authUserParam.toLowerCase() || u.id === authUserParam
      );
      if (matchedUser) {
        ingestedUser = {
          ...matchedUser,
          role: authRoleParam ? normalizeUserRole(authRoleParam) : matchedUser.role,
          name: authNameParam || matchedUser.name,
          imoOffice: authOfficeParam || matchedUser.imoOffice,
          designation: authDesigParam || matchedUser.designation,
          contactNumber: authPhoneParam || matchedUser.contactNumber,
          email: authEmailParam || matchedUser.email
        };
      }
    }

    if (ingestedUser) {
      saveAuthSession(ingestedUser);
      // Clean URL params without reloading
      const url = new URL(window.location.href);
      url.searchParams.delete('auth_token');
      url.searchParams.delete('auth_user');
      url.searchParams.delete('auth_role');
      url.searchParams.delete('auth_name');
      url.searchParams.delete('auth_office');
      url.searchParams.delete('auth_desig');
      url.searchParams.delete('auth_phone');
      url.searchParams.delete('auth_email');
      window.history.replaceState({}, document.title, url.pathname + (url.search ? url.search : ''));
      return ingestedUser;
    }
  } catch (e) {
    console.warn('[SSO Ingestion] Exception:', e);
  }
  return null;
}

export function getSavedAuthSession(): AuthUser | null {
  // Check for incoming SSO token first
  const ssoUser = consumeIncomingAuthToken();
  if (ssoUser) return ssoUser;

  try {
    const raw = localStorage.getItem(STORAGE_SESSION_KEY);
    if (raw) {
      const user = JSON.parse(raw);
      if (user && user.id) {
        const def = DEFAULT_AUTH_USERS.find(d => d.id === user.id);
        const updated: AuthUser = {
          ...user,
          name: def?.name || user.name,
          username: def?.username || user.username,
          designation: def?.designation || user.designation,
          role: normalizeUserRole(user.role)
        };
        return updated;
      }
    }
  } catch (e) {}
  return null;
}

export function saveAuthSession(user: AuthUser): void {
  try {
    const def = DEFAULT_AUTH_USERS.find(d => d.id === user.id);
    const norm = { 
      ...user, 
      name: def?.name || user.name,
      username: def?.username || user.username,
      designation: def?.designation || user.designation,
      role: normalizeUserRole(user.role) 
    };
    localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(norm));
  } catch (e) {}
}

export function clearAuthSession(): void {
  try {
    localStorage.removeItem(STORAGE_SESSION_KEY);
  } catch (e) {}
}

/**
 * Finds if an admitted user exists matching the Google account's email or googleId
 */
export function findUserByGoogleAuth(email: string, googleId?: string): AuthUser | null {
  if (!email && !googleId) return null;
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanGId = (googleId || '').trim();
  const users = getAuthUsers();

  const matched = users.find(u => {
    if (cleanEmail && u.email && u.email.toLowerCase() === cleanEmail) return true;
    if (cleanGId && u.googleId && u.googleId === cleanGId) return true;
    // Also match if username equals email or email username prefix matches username
    if (cleanEmail && (u.username.toLowerCase() === cleanEmail || u.id.toLowerCase() === cleanEmail)) return true;
    return false;
  });

  return matched || null;
}

/**
 * Retrieves pending Google admission requests
 */
export function getPendingGoogleAdmissions(): AuthUser[] {
  if (memoryPendingCache) return memoryPendingCache;
  try {
    const raw = localStorage.getItem(STORAGE_PENDING_KEY);
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        memoryPendingCache = list;
        return list;
      }
    }
  } catch (_) {}
  memoryPendingCache = [];
  return [];
}

export function savePendingGoogleAdmissions(pending: AuthUser[]): void {
  memoryPendingCache = pending;
  try {
    localStorage.setItem(STORAGE_PENDING_KEY, JSON.stringify(pending));
  } catch (_) {}
}

/**
 * Handles incoming Google Sign-In: returns admitted user or creates a pending admission request
 */
export async function requestGoogleAdmission(googleInfo: {
  email: string;
  name: string;
  avatar?: string;
  googleId?: string;
}): Promise<{ status: 'admitted' | 'pending'; user: AuthUser }> {
  // 1. Check if user is already admitted
  const existing = findUserByGoogleAuth(googleInfo.email, googleInfo.googleId);
  if (existing) {
    // Update avatar/googleId if missing
    if (googleInfo.avatar && !existing.avatar) {
      existing.avatar = googleInfo.avatar;
      saveAuthUsers(getAuthUsers());
    }
    return { status: 'admitted', user: existing };
  }

  // 2. Check or create in pending admissions list
  const pendingList = getPendingGoogleAdmissions();
  const cleanEmail = googleInfo.email.trim().toLowerCase();
  let pendingUser = pendingList.find(u => u.email?.toLowerCase() === cleanEmail || (googleInfo.googleId && u.googleId === googleInfo.googleId));

  if (!pendingUser) {
    const safeUsername = cleanEmail.split('@')[0].replace(/[^a-z0-9_]/gi, '_').toLowerCase();
    pendingUser = {
      id: `usr-google-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      username: safeUsername,
      name: googleInfo.name || safeUsername,
      role: 'Viewer',
      passcode: 'GOOGLE_AUTH',
      imoOffice: 'Pending Assignment',
      nisBinding: 'Pending Assignment',
      avatar: googleInfo.avatar,
      designation: 'Google Account (Pending Admission)',
      email: googleInfo.email,
      googleId: googleInfo.googleId,
      isAdmitted: false,
      createdAt: new Date().toISOString()
    };
    pendingList.unshift(pendingUser);
    savePendingGoogleAdmissions(pendingList);

    // Sync pending admission to server if available
    try {
      await fetch('/api/users/pending', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pendingUser)
      });
    } catch (_) {}
  }

  return { status: 'pending', user: pendingUser };
}

/**
 * Admits a pending Google account and assigns role, IMO, and NIS bindings
 */
export async function admitGoogleUser(
  userId: string,
  assignment: {
    role: UserRole;
    imoOffice: string;
    nisBinding?: string;
    designation?: string;
    passcode?: string;
  }
): Promise<AuthUser> {
  const pendingList = getPendingGoogleAdmissions();
  const pendingIdx = pendingList.findIndex(u => u.id === userId);
  const pending = pendingIdx !== -1 ? pendingList[pendingIdx] : null;

  const users = getAuthUsers();
  const admittedUser: AuthUser = {
    id: pending ? pending.id : userId,
    username: pending?.username || `user_${Date.now()}`,
    name: pending?.name || 'Authorized User',
    role: normalizeUserRole(assignment.role),
    passcode: assignment.passcode || pending?.passcode || 'GOOGLE_AUTH',
    imoOffice: assignment.imoOffice,
    nisBinding: assignment.nisBinding || 'All NIS',
    designation: assignment.designation || `${assignment.role} - ${assignment.imoOffice}`,
    avatar: pending?.avatar,
    email: pending?.email,
    googleId: pending?.googleId,
    isAdmitted: true,
    createdAt: pending?.createdAt || new Date().toISOString()
  };

  // Remove from pending
  if (pendingIdx !== -1) {
    pendingList.splice(pendingIdx, 1);
    savePendingGoogleAdmissions(pendingList);
  }

  // Add to active users
  const existingIdx = users.findIndex(u => u.id === admittedUser.id || (admittedUser.email && u.email?.toLowerCase() === admittedUser.email.toLowerCase()));
  if (existingIdx !== -1) {
    users[existingIdx] = admittedUser;
  } else {
    users.push(admittedUser);
  }
  saveAuthUsers(users);

  // Sync to server
  try {
    await fetch('/api/users/admit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(admittedUser)
    });
  } catch (_) {}

  return admittedUser;
}

/**
 * Rejects / removes a pending Google account admission request
 */
export async function rejectPendingGoogleAdmission(userId: string): Promise<boolean> {
  const pendingList = getPendingGoogleAdmissions();
  const filtered = pendingList.filter(u => u.id !== userId);
  savePendingGoogleAdmissions(filtered);

  try {
    await fetch(`/api/users/pending/${userId}`, {
      method: 'DELETE'
    });
  } catch (_) {}

  return true;
}

// ==========================================
// ACCESS REQUESTS & JURISDICTION HELPERS
// ==========================================

export function canUserManageRequests(user?: AuthUser | null): boolean {
  if (!user) return false;
  return (
    user.role === 'Developer' ||
    user.role === 'RO Admin' ||
    user.role === 'IMO Admin'
  );
}

export function isMasterAdmin(user: AuthUser | null): boolean {
  return user?.role === 'Developer';
}

export function isRegionalAdmin(user: AuthUser | null): boolean {
  return user?.role === 'RO Admin';
}

export function isImoAdmin(user: AuthUser | null): boolean {
  return user?.role === 'IMO Admin';
}

export function getAdminJurisdictionLabel(user: AuthUser | null): string {
  if (!user) return 'None';
  if (user.role === 'Developer') return 'Master Jurisdiction (All Regional & IMOs)';
  if (user.role === 'RO Admin') return 'Regional Office & All IMOs Jurisdiction';
  if (user.role === 'IMO Admin') {
    return `${user.imoOffice || 'IMO'} Jurisdiction`;
  }
  return 'Unauthorized / Non-Admin Role';
}

export function filterRequestsForAdmin(user: AuthUser | null, requests: AccessRequest[]): AccessRequest[] {
  if (!user || !canUserManageRequests(user)) return [];
  if (user.role === 'Developer' || user.role === 'RO Admin') {
    return requests;
  }
  // IMO Admin: only requests for their designated IMO
  const adminImo = (user.imoOffice || '').toLowerCase();
  return requests.filter(r => {
    const reqOffice = (r.requestedOffice || '').toLowerCase();
    return reqOffice.includes(adminImo) || adminImo.includes(reqOffice);
  });
}

// Storage key for client-side offline sync
const STORAGE_REQUESTS_KEY = 'ommap_access_requests_v3';

export async function fetchAccessRequestsApi(): Promise<AccessRequest[]> {
  try {
    const res = await fetch('/api/access-requests');
    if (res.ok) {
      const data = await res.json();
      try { localStorage.setItem(STORAGE_REQUESTS_KEY, JSON.stringify(data)); } catch (_) {}
      return data;
    }
  } catch (e) {
    console.warn('Network request failed, falling back to localStorage cache:', e);
  }

  try {
    const cached = localStorage.getItem(STORAGE_REQUESTS_KEY);
    if (cached) return JSON.parse(cached);
  } catch (e) {}

  return [];
}

export async function fetchUserAccessRequestApi(email: string): Promise<AccessRequest | null> {
  if (!email) return null;
  try {
    const res = await fetch(`/api/access-requests/user/${encodeURIComponent(email.toLowerCase().trim())}`);
    if (res.ok) {
      return await res.json();
    }
  } catch (_) {}

  const requests = await fetchAccessRequestsApi();
  return requests.find(r => r.email?.toLowerCase().trim() === email.toLowerCase().trim()) || null;
}

export async function submitAccessRequestApi(payload: Partial<AccessRequest>): Promise<{ success: boolean; request?: AccessRequest; error?: string }> {
  try {
    const res = await fetch('/api/access-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const data = await res.json();
      await fetchAccessRequestsApi();
      return data;
    } else {
      const err = await res.json();
      return { success: false, error: err.error || 'Failed to submit access request' };
    }
  } catch (e: any) {
    // Fallback: client-side mock save if offline
    const requests = await fetchAccessRequestsApi();
    const newReq: AccessRequest = {
      id: `req-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      email: payload.email || '',
      firstName: payload.firstName || '',
      middleInitial: payload.middleInitial || '',
      lastName: payload.lastName || '',
      extensionName: payload.extensionName || '',
      fullName: payload.fullName || `${payload.firstName} ${payload.lastName}`,
      contactNumber: payload.contactNumber || '',
      designation: payload.designation || 'Authorized NIA Personnel',
      requestedOffice: payload.requestedOffice || 'Regional Office IV-B',
      requestedRole: payload.requestedRole || 'Field Personnel',
      requestedApps: payload.requestedApps || ['Maintenance and Status of Irrigation Facilities'],
      requestedNisList: payload.requestedNisList || ['All NIS'],
      status: 'pending',
      submittedAt: new Date().toISOString(),
      avatar: payload.avatar,
      uid: payload.uid,
    };
    requests.unshift(newReq);
    try { localStorage.setItem(STORAGE_REQUESTS_KEY, JSON.stringify(requests)); } catch (_) {}
    return { success: true, request: newReq };
  }
}

export async function approveAccessRequestApi(
  id: string,
  payload: {
    assignedRole: UserRole;
    assignedOffice: string;
    assignedNis: string;
    reviewerName: string;
    reviewerRole: UserRole;
  }
): Promise<{ success: boolean; request?: AccessRequest; error?: string }> {
  try {
    const res = await fetch(`/api/access-requests/${id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const data = await res.json();
      await fetchAccessRequestsApi();
      await fetchRemoteAuthUsers();
      return data;
    }
  } catch (e) {
    console.warn('API error during approval:', e);
  }

  // Fallback client local storage
  const requests = await fetchAccessRequestsApi();
  const index = requests.findIndex(r => r.id === id);
  if (index !== -1) {
    requests[index] = {
      ...requests[index],
      status: 'approved',
      assignedRole: payload.assignedRole,
      assignedOffice: payload.assignedOffice,
      assignedNis: payload.assignedNis,
      reviewedAt: new Date().toISOString(),
      reviewedBy: payload.reviewerName,
      reviewedByRole: payload.reviewerRole,
    };
    try { localStorage.setItem(STORAGE_REQUESTS_KEY, JSON.stringify(requests)); } catch (_) {}
    return { success: true, request: requests[index] };
  }

  return { success: false, error: 'Request not found' };
}

export async function rejectAccessRequestApi(
  id: string,
  payload: {
    rejectionReason: string;
    reviewerName: string;
    reviewerRole: UserRole;
  }
): Promise<{ success: boolean; request?: AccessRequest; error?: string }> {
  try {
    const res = await fetch(`/api/access-requests/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const data = await res.json();
      await fetchAccessRequestsApi();
      return data;
    }
  } catch (e) {}

  const requests = await fetchAccessRequestsApi();
  const index = requests.findIndex(r => r.id === id);
  if (index !== -1) {
    requests[index] = {
      ...requests[index],
      status: 'rejected',
      rejectionReason: payload.rejectionReason,
      reviewedAt: new Date().toISOString(),
      reviewedBy: payload.reviewerName,
      reviewedByRole: payload.reviewerRole,
    };
    try { localStorage.setItem(STORAGE_REQUESTS_KEY, JSON.stringify(requests)); } catch (_) {}
    return { success: true, request: requests[index] };
  }

  return { success: false, error: 'Request not found' };
}

export async function revokeAccessRequestApi(id: string): Promise<{ success: boolean; request?: AccessRequest }> {
  try {
    const res = await fetch(`/api/access-requests/${id}/revoke`, { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      await fetchAccessRequestsApi();
      return data;
    }
  } catch (e) {}

  const requests = await fetchAccessRequestsApi();
  const index = requests.findIndex(r => r.id === id);
  if (index !== -1) {
    requests[index].status = 'pending';
    requests[index].reviewedAt = new Date().toISOString();
    requests[index].rejectionReason = 'Access suspended pending review.';
    try { localStorage.setItem(STORAGE_REQUESTS_KEY, JSON.stringify(requests)); } catch (_) {}
    return { success: true, request: requests[index] };
  }

  return { success: false };
}

export async function fetchApprovedUsersApi(): Promise<AuthUser[]> {
  try {
    const res = await fetch('/api/approved-users');
    if (res.ok) {
      return await res.json();
    }
  } catch (_) {}
  return [];
}


import { AuthUser, UserRole } from '../types';
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
  // 2. REGIONAL OFFICE (RO) ACCOUNTS (3 Accounts)
  // ==========================================
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
  // 3. IMO EVALUATOR ACCOUNTS (3 Accounts: 1 per IMO)
  // ==========================================
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

export const STORAGE_USERS_KEY = 'ommap_registered_users_v3';
export const STORAGE_SESSION_KEY = 'ommap_auth_session';

let memoryUsersCache: AuthUser[] | null = null;

export function getAuthUsers(): AuthUser[] {
  if (memoryUsersCache && memoryUsersCache.length > 0) {
    return memoryUsersCache;
  }

  try {
    // Clean out legacy storage versions to prevent stale role names
    try {
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
              nisBinding: u.nisBinding || def.nisBinding
            });
          } else if (u.id.startsWith('usr-custom-')) {
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
    const res = await fetch('/api/users');
    if (res.ok) {
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data && Array.isArray(data.users) ? data.users : []);
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

export function getSavedAuthSession(): AuthUser | null {
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

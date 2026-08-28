import { AuthUser } from '../types';
import { getSavedAuthSession } from '../config/authUsers';

export interface ReportSignatory {
  name: string;
  title: string;
}

export interface WmrSignatoriesConfig {
  preparedByName: string;
  preparedByTitle: string;
  reviewedByName: string;
  reviewedByTitle: string;
  notedByName: string;
  notedByTitle: string;
  initialsNote?: string;
  documentNo?: string;
  customFootnote?: string;
}

export interface PhotoDocSignatoriesConfig {
  preparedByName: string;
  preparedByTitle: string;
  reviewedByName: string;
  reviewedByTitle: string;
  notedByName: string;
  notedByTitle: string;
  documentNo?: string;
  customFootnote?: string;
}

export interface InspectionReportSignatoriesConfig {
  preparedByName: string;
  preparedByTitle: string;
  verifiedByName: string;
  verifiedByTitle: string;
  approvedByName: string;
  approvedByTitle: string;
  documentNo?: string;
  customFootnote?: string;
}

export interface UserSignatoriesProfile {
  userId: string;
  updatedAt: string;
  wmr: WmrSignatoriesConfig;
  photoDoc: PhotoDocSignatoriesConfig;
  inspectionReport: InspectionReportSignatoriesConfig;
}

export const DEFAULT_WMR_SIGNATORIES: WmrSignatoriesConfig = {
  preparedByName: 'ROME MINA RIVERA',
  preparedByTitle: 'Senior Engineer A',
  reviewedByName: 'AVE JANE V. ALVARADO',
  reviewedByTitle: 'Supervising Engineer A',
  notedByName: 'LOWELL L. LOZANO',
  notedByTitle: 'Division Manager A',
  initialsNote: 'MLRN -\nLMM -',
  documentNo: 'NIA-RO4B-EOD-OPS-INT-Form691 Rev.01',
  customFootnote: ''
};

export const DEFAULT_PHOTO_DOC_SIGNATORIES: PhotoDocSignatoriesConfig = {
  preparedByName: 'ROME MINA RIVERA',
  preparedByTitle: 'Senior Engineer A',
  reviewedByName: 'AVE JANE V. ALVARADO',
  reviewedByTitle: 'Supervising Engineer A',
  notedByName: 'LOWELL L. LOZANO',
  notedByTitle: 'Division Manager A',
  documentNo: 'NIA-RO4B-EOD-OPS-INT-Form691 Rev.01',
  customFootnote: ''
};

export const DEFAULT_INSPECTION_SIGNATORIES: InspectionReportSignatoriesConfig = {
  preparedByName: 'ROME MINA RIVERA',
  preparedByTitle: 'Water Resource Officer',
  verifiedByName: 'AVE JANE V. ALVARADO',
  verifiedByTitle: 'Supervising Engineer A',
  approvedByName: 'LOWELL L. LOZANO',
  approvedByTitle: 'Division Manager A',
  documentNo: 'NIA-RO4B-EOD-OPS-INT-Form691 Rev.01',
  customFootnote: ''
};

export function getDefaultSignatoriesForUser(user?: AuthUser | null): UserSignatoriesProfile {
  const u = user || getSavedAuthSession();
  const userName = u?.name || 'ROME MINA RIVERA';
  const userDesig = u?.designation || (u?.role === 'Field Personnel' ? 'Water Resource Officer' : 'NIS In-Charge');

  return {
    userId: u?.id || 'default_user',
    updatedAt: new Date().toISOString(),
    wmr: {
      ...DEFAULT_WMR_SIGNATORIES,
      preparedByName: userName,
      preparedByTitle: userDesig
    },
    photoDoc: {
      ...DEFAULT_PHOTO_DOC_SIGNATORIES,
      preparedByName: userName,
      preparedByTitle: userDesig
    },
    inspectionReport: {
      ...DEFAULT_INSPECTION_SIGNATORIES,
      preparedByName: userName,
      preparedByTitle: userDesig
    }
  };
}

const STORAGE_PREFIX = 'ommap_signatories_profile_';

export function getUserSignatories(userId?: string, user?: AuthUser | null): UserSignatoriesProfile {
  const activeUser = user || getSavedAuthSession();
  const targetId = userId || activeUser?.id || 'default_user';

  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${targetId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.wmr && parsed.photoDoc && parsed.inspectionReport) {
        return {
          ...getDefaultSignatoriesForUser(activeUser),
          ...parsed,
          userId: targetId
        };
      }
    }
  } catch (e) {
    console.warn(`Failed to read signatories profile for ${targetId}:`, e);
  }

  // Fallback to active user's generated defaults
  return getDefaultSignatoriesForUser(activeUser);
}

export function saveUserSignatories(userId: string, profile: UserSignatoriesProfile): void {
  const targetId = userId || 'default_user';
  try {
    const dataToSave = {
      ...profile,
      userId: targetId,
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem(`${STORAGE_PREFIX}${targetId}`, JSON.stringify(dataToSave));
    window.dispatchEvent(new CustomEvent('ommap_signatories_updated', { detail: dataToSave }));
  } catch (e) {
    console.error(`Failed to save signatories profile for ${targetId}:`, e);
  }
}

export function resetUserSignatoriesToDefault(userId: string, user?: AuthUser | null): UserSignatoriesProfile {
  const targetId = userId || 'default_user';
  const defaults = getDefaultSignatoriesForUser(user);
  saveUserSignatories(targetId, defaults);
  return defaults;
}

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

/**
 * Normalizes office identifiers to one of the 4 institutional tiers:
 * MOMARO, OMIMO, PALIMO, or RO (Regional Office)
 */
export function resolveOfficeKey(imoOffice?: string): 'MOMARO' | 'OMIMO' | 'PALIMO' | 'RO' {
  if (!imoOffice) return 'RO';
  const lower = imoOffice.toLowerCase();
  if (lower.includes('palawan') || lower.includes('palimo') || lower.includes('pimo')) {
    return 'PALIMO';
  }
  if (lower.includes('occidental') || lower.includes('omimo')) {
    return 'OMIMO';
  }
  if (lower.includes('momaro') || lower.includes('oriental') || lower.includes('marinduque') || lower.includes('romblon')) {
    return 'MOMARO';
  }
  return 'RO';
}

/**
 * Returns default Field Maintenance & Physical Accomplishment Report signatories
 * based on Office and National Irrigation System (NIS).
 */
export function getDefaultFieldReportSignatories(
  imoOffice?: string,
  nisBinding?: string,
  fallbackReporterName?: string,
  fallbackReporterDesig?: string
): {
  preparedByName: string;
  preparedByTitle: string;
  reviewedByName: string;
  reviewedByTitle: string;
  approvedByName: string;
  approvedByTitle: string;
} {
  const officeKey = resolveOfficeKey(imoOffice);
  const nisLower = (nisBinding || '').toLowerCase();

  const preparedByName = fallbackReporterName || 'Field Personnel';
  const preparedByTitle = fallbackReporterDesig || 'Water Resource Officer';

  if (officeKey === 'MOMARO') {
    // Check Cantingas RIS
    if (nisLower.includes('cantingas')) {
      return {
        preparedByName,
        preparedByTitle,
        reviewedByName: 'Michelle F. Abila',
        reviewedByTitle: 'Engineer A',
        approvedByName: 'Ma. Viola Aiko M. Matibag',
        approvedByTitle: 'Senior Engineer A / OIC, NIA Romblon PIO'
      };
    }

    // Check Pula RIS, Bansud RIS, Bongabong River Irrigation Project
    if (nisLower.includes('pula') || nisLower.includes('bansud') || nisLower.includes('bongabong')) {
      return {
        preparedByName,
        preparedByTitle,
        reviewedByName: 'Benedict Santi S. Perez',
        reviewedByTitle: 'Senior Engineer A',
        approvedByName: '',
        approvedByTitle: ''
      };
    }

    // Baco - Bucayao RIS, Mag-Asawang Tubig RIS, or default MOMARO
    return {
      preparedByName,
      preparedByTitle,
      reviewedByName: 'Aljohn L. Soco',
      reviewedByTitle: 'Foreman A',
      approvedByName: 'Daniel Angelo M. Malabanan',
      approvedByTitle: 'Principal Engineer A'
    };
  }

  if (officeKey === 'OMIMO') {
    // Occidental Mindoro (ALL NIS)
    return {
      preparedByName,
      preparedByTitle,
      reviewedByName: 'May Hyacinthe Anne N. Pechon',
      reviewedByTitle: 'Engineer A',
      approvedByName: 'Emelito V. Urriquia',
      approvedByTitle: 'Senior Engineer A / OIC, Engineering and Operations'
    };
  }

  if (officeKey === 'PALIMO') {
    // Palawan (ALL NIS)
    return {
      preparedByName,
      preparedByTitle,
      reviewedByName: 'Rachelle Anne E. Evangelista',
      reviewedByTitle: 'Engineering Assistant B',
      approvedByName: 'Mia Queennie B. Arpon',
      approvedByTitle: 'Supervising Engineer A'
    };
  }

  // Regional Office / Default Fallback
  return {
    preparedByName,
    preparedByTitle,
    reviewedByName: 'Ave Jane V. Alvarado',
    reviewedByTitle: 'Supervising Engineer A',
    approvedByName: 'Edgard Laurenz M. Geronimo',
    approvedByTitle: 'Principal Engineer C'
  };
}

/**
 * Returns default WMR (Form 691) signatories based on Office and NIS.
 */
export function getDefaultWmrSignatories(
  imoOffice?: string,
  nisBinding?: string
): WmrSignatoriesConfig {
  const officeKey = resolveOfficeKey(imoOffice);
  const nisLower = (nisBinding || '').toLowerCase();

  if (officeKey === 'MOMARO') {
    if (nisLower.includes('cantingas')) {
      return {
        preparedByName: 'Michelle F. Abila',
        preparedByTitle: 'Engineer A',
        reviewedByName: 'Ma. Viola Aiko M. Matibag',
        reviewedByTitle: 'Senior Engineer A / OIC, NIA Romblon PIO',
        notedByName: 'Maria Victoria O. Malenab',
        notedByTitle: 'Division Manager A',
        initialsNote: 'MLRN -\nLMM -',
        documentNo: 'NIA-RO4B-EOD-OPS-INT-Form691 Rev.01',
        customFootnote: ''
      };
    }

    if (nisLower.includes('pula') || nisLower.includes('bansud') || nisLower.includes('bongabong')) {
      return {
        preparedByName: 'Benedict Santi S. Perez',
        preparedByTitle: 'Senior Engineer A',
        reviewedByName: '',
        reviewedByTitle: '',
        notedByName: 'Maria Victoria O. Malenab',
        notedByTitle: 'Division Manager A',
        initialsNote: 'MLRN -\nLMM -',
        documentNo: 'NIA-RO4B-EOD-OPS-INT-Form691 Rev.01',
        customFootnote: ''
      };
    }

    return {
      preparedByName: 'Aljohn L. Soco',
      preparedByTitle: 'Foreman A',
      reviewedByName: 'Daniel Angelo M. Malabanan',
      reviewedByTitle: 'Principal Engineer A',
      notedByName: 'Maria Victoria O. Malenab',
      notedByTitle: 'Division Manager A',
      initialsNote: 'MLRN -\nLMM -',
      documentNo: 'NIA-RO4B-EOD-OPS-INT-Form691 Rev.01',
      customFootnote: ''
    };
  }

  if (officeKey === 'OMIMO') {
    return {
      preparedByName: 'May Hyacinthe Anne N. Pechon',
      preparedByTitle: 'Engineer A',
      reviewedByName: 'Emelito V. Urriquia',
      reviewedByTitle: 'Senior Engineer A / OIC, Engineering and Operations',
      notedByName: 'Mary Grace B. Cartagena',
      notedByTitle: 'Division Manager A',
      initialsNote: 'MLRN -\nLMM -',
      documentNo: 'NIA-RO4B-EOD-OPS-INT-Form691 Rev.01',
      customFootnote: ''
    };
  }

  if (officeKey === 'PALIMO') {
    return {
      preparedByName: 'Rachelle Anne E. Evangelista',
      preparedByTitle: 'Engineering Assistant B',
      reviewedByName: 'Mia Queennie B. Arpon',
      reviewedByTitle: 'Supervising Engineer A',
      notedByName: 'Nimrod B. Maceda',
      notedByTitle: 'Acting Senior Engineer A',
      initialsNote: 'MLRN -\nLMM -',
      documentNo: 'NIA-RO4B-EOD-OPS-INT-Form691 Rev.01',
      customFootnote: ''
    };
  }

  // Regional Office
  return {
    preparedByName: 'Rei Immanuel A. Maminta',
    preparedByTitle: 'Supervising Engineer A',
    reviewedByName: 'Ave Jane V. Alvarado',
    reviewedByTitle: 'Supervising Engineer A',
    notedByName: 'Edgard Laurenz M. Geronimo',
    notedByTitle: 'Principal Engineer C',
    initialsNote: 'MLRN -\nLMM -',
    documentNo: 'NIA-RO4B-EOD-OPS-INT-Form691 Rev.01',
    customFootnote: ''
  };
}

/**
 * Returns default Photo Documentation signatories based on Office and NIS.
 */
export function getDefaultPhotoDocSignatories(
  imoOffice?: string,
  nisBinding?: string
): PhotoDocSignatoriesConfig {
  const wmr = getDefaultWmrSignatories(imoOffice, nisBinding);
  return {
    preparedByName: wmr.preparedByName,
    preparedByTitle: wmr.preparedByTitle,
    reviewedByName: wmr.reviewedByName,
    reviewedByTitle: wmr.reviewedByTitle,
    notedByName: wmr.notedByName,
    notedByTitle: wmr.notedByTitle,
    documentNo: wmr.documentNo,
    customFootnote: wmr.customFootnote
  };
}

export const DEFAULT_WMR_SIGNATORIES: WmrSignatoriesConfig = getDefaultWmrSignatories('RO');
export const DEFAULT_PHOTO_DOC_SIGNATORIES: PhotoDocSignatoriesConfig = getDefaultPhotoDocSignatories('RO');
export const DEFAULT_INSPECTION_SIGNATORIES: InspectionReportSignatoriesConfig = {
  preparedByName: 'Field Personnel',
  preparedByTitle: 'Water Resource Officer',
  verifiedByName: 'Ave Jane V. Alvarado',
  verifiedByTitle: 'Supervising Engineer A',
  approvedByName: 'Edgard Laurenz M. Geronimo',
  approvedByTitle: 'Principal Engineer C',
  documentNo: 'NIA-RO4B-EOD-OPS-INT-Form691 Rev.01',
  customFootnote: ''
};

export function getDefaultSignatoriesForUser(user?: AuthUser | null): UserSignatoriesProfile {
  const u = user || getSavedAuthSession();
  const imo = u?.imoOffice;
  const nis = u?.nisBinding;

  const wmrDefaults = getDefaultWmrSignatories(imo, nis);
  const photoDocDefaults = getDefaultPhotoDocSignatories(imo, nis);
  const fieldDefaults = getDefaultFieldReportSignatories(
    imo,
    nis,
    u?.name,
    u?.designation || (u?.role === 'Field Personnel' ? 'Water Resource Officer' : 'NIS In-Charge')
  );

  return {
    userId: u?.id || 'default_user',
    updatedAt: new Date().toISOString(),
    wmr: wmrDefaults,
    photoDoc: photoDocDefaults,
    inspectionReport: {
      preparedByName: fieldDefaults.preparedByName,
      preparedByTitle: fieldDefaults.preparedByTitle,
      verifiedByName: fieldDefaults.reviewedByName,
      verifiedByTitle: fieldDefaults.reviewedByTitle,
      approvedByName: fieldDefaults.approvedByName,
      approvedByTitle: fieldDefaults.approvedByTitle,
      documentNo: 'NIA-RO4B-EOD-OPS-INT-Form691 Rev.01',
      customFootnote: ''
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

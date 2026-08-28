export interface AppConfigurations {
  photoResolutionCapBytes: number;
  photoMaxDimensionPx: number;
  autoGpsTagging: boolean;
  mapDefaultStartupView: 'user_location' | 'all_layers';
}

export const DEFAULT_CONFIGURATIONS: AppConfigurations = {
  photoResolutionCapBytes: 300 * 1024, // 300 KB (Recommended standard)
  photoMaxDimensionPx: 1400, // 1400 x 1050 px (Standard Form 691 4:3 aspect)
  autoGpsTagging: true,
  mapDefaultStartupView: 'user_location'
};

export const RESOLUTION_CAP_OPTIONS = [
  { 
    value: 200 * 1024, 
    label: '200 KB — Fast Mobile / Satellite Sync', 
    desc: 'Optimized for slow field cellular connections and rapid syncing.' 
  },
  { 
    value: 300 * 1024, 
    label: '300 KB — Recommended (Balanced Standard)', 
    desc: 'Official Form 691 standard with crisp stamp overlay and clean clarity.' 
  },
  { 
    value: 500 * 1024, 
    label: '500 KB — High Resolution', 
    desc: 'Retains fine hydraulic details, gate markings, and concrete fissures.' 
  },
  { 
    value: 1024 * 1024, 
    label: '1 MB — Ultra HD Documentation', 
    desc: 'Maximum sharpness for structural engineering inspections.' 
  },
  { 
    value: 0, 
    label: 'Unlimited — Original Uncompressed File', 
    desc: 'Retains raw camera file without byte-size capping (uses higher storage).' 
  }
];

export const DIMENSION_OPTIONS = [
  { value: 1400, label: '1400 × 1050 px (Standard 4:3 Form 691)' },
  { value: 1920, label: '1920 × 1440 px (Full HD 4:3)' },
  { value: 2560, label: '2560 × 1920 px (2K Quad HD)' },
  { value: 0, label: 'Original Native Resolution' }
];

export const CONFIG_STORAGE_KEY = 'ommap_app_configurations_v1';

export function getSavedConfigurations(): AppConfigurations {
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_CONFIGURATIONS, ...parsed };
    }
  } catch (e) {
    console.warn('Failed to load configurations from localStorage', e);
  }
  return DEFAULT_CONFIGURATIONS;
}

export function saveConfigurations(config: AppConfigurations): void {
  try {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
    window.dispatchEvent(new CustomEvent('ommap_configurations_updated', { detail: config }));
  } catch (e) {
    console.warn('Failed to save configurations to localStorage', e);
  }
}

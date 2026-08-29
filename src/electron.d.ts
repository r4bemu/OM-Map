export interface UpdateStatusPayload {
  status: 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';
  version?: string;
  percent?: number;
  error?: string;
}

export interface ElectronAPI {
  isDesktopApp?: boolean;
  getAppVersion: () => Promise<string>;
  checkForUpdates: () => Promise<any>;
  quitAndInstallUpdate: () => Promise<void>;
  onUpdateStatus: (callback: (payload: UpdateStatusPayload) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
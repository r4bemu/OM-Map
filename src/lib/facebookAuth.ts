import { AuthUser } from '../types';

export interface FacebookUserProfile {
  id: string;
  name: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  picture?: string;
  accessToken?: string;
}

const STORAGE_FACEBOOK_APP_ID_KEY = 'ommap_meta_app_id';
const metaEnv = typeof import.meta !== 'undefined' && (import.meta as any).env ? (import.meta as any).env : {};

// Default Meta App ID for OM-Map portal
export const DEFAULT_FACEBOOK_APP_ID = metaEnv.VITE_FACEBOOK_APP_ID || '2266325060823137';

export function getStoredFacebookAppId(): string {
  try {
    const custom = localStorage.getItem(STORAGE_FACEBOOK_APP_ID_KEY);
    if (custom && custom.trim()) return custom.trim();
  } catch (_) {}
  return DEFAULT_FACEBOOK_APP_ID;
}

export function saveStoredFacebookAppId(appId: string): void {
  try {
    if (appId && appId.trim()) {
      localStorage.setItem(STORAGE_FACEBOOK_APP_ID_KEY, appId.trim());
    } else {
      localStorage.removeItem(STORAGE_FACEBOOK_APP_ID_KEY);
    }
  } catch (_) {}
}

let fbInitPromise: Promise<void> | null = null;
let isInitialized = false;

/**
 * Ensures Meta JavaScript SDK is loaded into document
 */
export function loadFacebookSdk(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if ((window as any).FB) return Promise.resolve();
  if (fbInitPromise) return fbInitPromise;

  fbInitPromise = new Promise((resolve, reject) => {
    // Add fb-root container required by Facebook SDK
    if (!document.getElementById('fb-root')) {
      const fbRoot = document.createElement('div');
      fbRoot.id = 'fb-root';
      document.body.appendChild(fbRoot);
    }

    const existingScript = document.getElementById('facebook-jssdk');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve());
      existingScript.addEventListener('error', (e) => reject(e));
      return;
    }

    const script = document.createElement('script');
    script.id = 'facebook-jssdk';
    script.src = 'https://connect.facebook.net/en_US/sdk.js';
    script.async = true;
    script.defer = true;
    script.crossOrigin = 'anonymous';

    script.onload = () => {
      resolve();
    };
    script.onerror = () => {
      fbInitPromise = null;
      reject(new Error('Unable to connect to Facebook authentication server. Please check your network or ad-blocker settings.'));
    };

    document.head.appendChild(script);
  });

  return fbInitPromise;
}

/**
 * Initializes Meta SDK with current App ID
 */
export async function initFacebookClient(appIdOverride?: string): Promise<void> {
  await loadFacebookSdk();
  const FB = (window as any).FB;
  if (!FB) throw new Error('Meta Facebook SDK failed to initialize.');

  const appId = appIdOverride || getStoredFacebookAppId();
  if (!isInitialized) {
    FB.init({
      appId: appId.trim(),
      cookie: true,
      xfbml: true,
      version: 'v20.0'
    });
    isInitialized = true;
  }
}

/**
 * Triggers native Facebook OAuth dialog and retrieves user profile details
 */
export async function triggerFacebookSignIn(appIdOverride?: string): Promise<FacebookUserProfile> {
  await initFacebookClient(appIdOverride);
  const FB = (window as any).FB;

  return new Promise((resolve, reject) => {
    FB.login(
      (response: any) => {
        if (!response || !response.authResponse) {
          if (response?.status === 'not_authorized') {
            return reject(new Error('Access was not authorized in Facebook.'));
          }
          return reject(new Error('Facebook sign-in was cancelled or popup was closed.'));
        }

        const authResponse = response.authResponse;
        const accessToken = authResponse.accessToken;

        // Fetch user profile from Meta Graph API
        FB.api(
          '/me',
          { fields: 'id,name,first_name,last_name,email,picture.width(200).height(200)' },
          (profileRes: any) => {
            if (!profileRes || profileRes.error) {
              return reject(new Error(profileRes?.error?.message || 'Failed to retrieve Facebook profile.'));
            }

            const pictureUrl = profileRes.picture?.data?.url;
            resolve({
              id: profileRes.id,
              name: profileRes.name || `${profileRes.first_name || ''} ${profileRes.last_name || ''}`.trim(),
              first_name: profileRes.first_name,
              last_name: profileRes.last_name,
              email: profileRes.email || '',
              picture: pictureUrl,
              accessToken
            });
          }
        );
      },
      { scope: 'public_profile,email', return_scopes: true }
    );
  });
}

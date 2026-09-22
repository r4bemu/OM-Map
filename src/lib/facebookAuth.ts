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
      console.warn('[Facebook SDK] Failed to load sdk.js from Facebook CDN. Fallback popup will be used.');
      resolve(); // Resolve anyway so fallback direct OAuth popup can take over without crashing
    };

    document.head.appendChild(script);
  });

  return fbInitPromise;
}

/**
 * Initializes Meta SDK with current App ID
 */
export async function initFacebookClient(appIdOverride?: string): Promise<void> {
  const appId = appIdOverride || getStoredFacebookAppId();
  try {
    await loadFacebookSdk();
    const FB = (window as any).FB;
    if (!FB) return;

    if (!isInitialized) {
      FB.init({
        appId: appId.trim(),
        cookie: true,
        status: true,
        xfbml: false,
        version: 'v20.0'
      });
      isInitialized = true;
      console.log('✅ Meta Facebook JavaScript SDK initialized successfully.');
    }
  } catch (err) {
    console.warn('[Facebook SDK Init Notice]', err);
  }
}

/**
 * Fetches user profile directly from Meta Graph API using the granted access token.
 * Uses direct fetch (with fallback to FB.api) and always supplies the access token explicitly
 * to avoid any third-party cookie restrictions or iframe messaging blocks in modern browsers.
 */
export async function fetchFacebookUserProfile(accessToken: string, userId?: string): Promise<FacebookUserProfile> {
  // 1. Direct REST fetch to Graph API with bearer access_token in query string
  try {
    const graphUrl = `https://graph.facebook.com/v20.0/me?fields=id,name,first_name,last_name,email,picture.width(200).height(200)&access_token=${encodeURIComponent(accessToken)}`;
    const res = await fetch(graphUrl);
    if (res.ok) {
      const data = await res.json();
      if (data && data.id && !data.error) {
        const pictureUrl = data.picture?.data?.url || `https://graph.facebook.com/${data.id}/picture?type=large`;
        const profileName = data.name || [data.first_name, data.last_name].filter(Boolean).join(' ') || 'Facebook User';
        return {
          id: data.id,
          name: profileName,
          first_name: data.first_name,
          last_name: data.last_name,
          email: data.email || '',
          picture: pictureUrl,
          accessToken
        };
      }
    }
  } catch (fetchErr) {
    console.warn('[Facebook Auth] Direct Graph API fetch notice, trying FB.api fallback:', fetchErr);
  }

  // 2. Fallback to FB.api with explicit access_token parameter
  const FB = (window as any).FB;
  if (FB && typeof FB.api === 'function') {
    return new Promise((resolve, reject) => {
      FB.api(
        '/me',
        { 
          fields: 'id,name,first_name,last_name,email,picture.width(200).height(200)',
          access_token: accessToken 
        },
        (res: any) => {
          if (res && res.id && !res.error) {
            const pictureUrl = res.picture?.data?.url || `https://graph.facebook.com/${res.id}/picture?type=large`;
            const profileName = res.name || [res.first_name, res.last_name].filter(Boolean).join(' ') || 'Facebook User';
            resolve({
              id: res.id,
              name: profileName,
              first_name: res.first_name,
              last_name: res.last_name,
              email: res.email || '',
              picture: pictureUrl,
              accessToken
            });
          } else {
            reject(new Error(res?.error?.message || 'Failed to retrieve Facebook profile.'));
          }
        }
      );
    });
  }

  throw new Error('Unable to retrieve profile from Facebook Graph API.');
}

/**
 * Direct OAuth Dialog popup that opens Facebook OAuth endpoint with response_type=token.
 * Does not depend on the Facebook JavaScript SDK, third-party cookies, or cross-window postMessage,
 * making it completely resilient across all browsers, privacy extensions, and ad-blockers.
 */
export async function triggerDirectFacebookOAuthPopup(appId: string): Promise<FacebookUserProfile> {
  return new Promise((resolve, reject) => {
    const width = 600;
    const height = 700;
    const left = Math.max(0, (window.screenX || 0) + ((window.outerWidth || window.innerWidth) - width) / 2);
    const top = Math.max(0, (window.screenY || 0) + ((window.outerHeight || window.innerHeight) - height) / 2);

    // Using origin with trailing slash as configured in Meta OAuth Redirect URIs
    const redirectUri = window.location.origin + '/';
    const oauthUrl = `https://www.facebook.com/v20.0/dialog/oauth?client_id=${encodeURIComponent(appId.trim())}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token,granted_scopes&scope=public_profile,email&display=popup`;

    const popup = window.open(
      oauthUrl,
      'FacebookOAuthLogin',
      `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,status=yes`
    );

    if (!popup) {
      return reject(new Error('Facebook sign-in popup was blocked by your browser. Please allow popups for this site.'));
    }

    let isDone = false;

    const interval = setInterval(async () => {
      try {
        if (popup.closed) {
          clearInterval(interval);
          if (!isDone) {
            reject(new Error('Facebook sign-in was cancelled or popup was closed.'));
          }
          return;
        }

        // When the popup redirects back to redirectUri, it is now on the same origin
        if (popup.location && popup.location.origin === window.location.origin) {
          const hash = popup.location.hash || '';
          const search = popup.location.search || '';

          if (hash.includes('access_token=') || search.includes('access_token=')) {
            isDone = true;
            clearInterval(interval);
            const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : search);
            const token = params.get('access_token');
            popup.close();

            if (token) {
              try {
                const profile = await fetchFacebookUserProfile(token);
                resolve(profile);
              } catch (e) {
                reject(e);
              }
            } else {
              reject(new Error('No access token returned from Facebook authorization.'));
            }
          } else if (hash.includes('error=') || search.includes('error=')) {
            isDone = true;
            clearInterval(interval);
            const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : search);
            const errorReason = params.get('error_description') || params.get('error_message') || params.get('error') || 'Facebook authorization failed.';
            popup.close();
            reject(new Error(errorReason));
          }
        }
      } catch (_crossOriginBlocked) {
        // Expected while popup is browsing facebook.com domains
      }
    }, 200);
  });
}

/**
 * Triggers native Facebook OAuth and retrieves user profile details.
 * Integrates both the official JavaScript SDK and the Direct OAuth Dialog fallback.
 */
export async function triggerFacebookSignIn(appIdOverride?: string): Promise<FacebookUserProfile> {
  const appId = (appIdOverride || getStoredFacebookAppId()).trim();
  await initFacebookClient(appId);
  const FB = (window as any).FB;

  // If Facebook JavaScript SDK failed to load (ad blocker, network issue), immediately use direct OAuth popup
  if (!FB || typeof FB.login !== 'function') {
    console.log('[Facebook Auth] Meta JS SDK unavailable; using direct OAuth popup fallback.');
    return triggerDirectFacebookOAuthPopup(appId);
  }

  return new Promise((resolve, reject) => {
    try {
      FB.login(
        async (response: any) => {
          console.log('[Facebook Auth] FB.login response received:', response);

          let authResponse = response?.authResponse;

          // If authResponse is not present in initial callback (e.g. 2FA delay or timing),
          // check FB.getLoginStatus with true (force fresh server check)
          if (!authResponse || !authResponse.accessToken) {
            try {
              authResponse = await new Promise((resStatus) => {
                FB.getLoginStatus((statusRes: any) => {
                  console.log('[Facebook Auth] getLoginStatus check result:', statusRes);
                  resStatus(statusRes?.authResponse || null);
                }, true);
              });
            } catch (err) {
              console.warn('[Facebook Auth] getLoginStatus error:', err);
            }
          }

          // If we got an access token from the SDK
          if (authResponse && authResponse.accessToken) {
            try {
              const profile = await fetchFacebookUserProfile(authResponse.accessToken, authResponse.userID);
              return resolve(profile);
            } catch (fetchErr) {
              return reject(fetchErr);
            }
          }

          // If user explicitly cancelled or declined authorization
          if (response?.status === 'not_authorized') {
            return reject(new Error('Access was not authorized in Facebook.'));
          }

          // If SDK popup closed without yielding a token (e.g. cross-origin postMessage blocked),
          // seamlessly fallback to direct OAuth popup dialog!
          console.log('[Facebook Auth] SDK did not return authResponse; attempting direct OAuth popup fallback...');
          try {
            const profile = await triggerDirectFacebookOAuthPopup(appId);
            return resolve(profile);
          } catch (fallbackErr: any) {
            return reject(fallbackErr);
          }
        },
        { scope: 'public_profile,email', return_scopes: true }
      );
    } catch (sdkErr) {
      console.warn('[Facebook Auth] FB.login exception, trying direct OAuth popup:', sdkErr);
      triggerDirectFacebookOAuthPopup(appId).then(resolve).catch(reject);
    }
  });
}

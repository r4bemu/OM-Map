import { AuthUser, UserRole } from '../types';
import { getAuthUsers } from '../config/authUsers';

export interface GoogleUserProfile {
  email: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  sub?: string;
}

const STORAGE_GOOGLE_CLIENT_ID_KEY = 'ommap_gcp_oauth_client_id';
const metaEnv = typeof import.meta !== 'undefined' && (import.meta as any).env ? (import.meta as any).env : {};

// Default Google Cloud OAuth 2.0 Client ID (Can be customized by Admin in settings)
export const DEFAULT_GOOGLE_CLIENT_ID = 
  metaEnv.VITE_GOOGLE_CLIENT_ID || 
  '518397636928-5ia1margooh50oi5ohsgmgdlf292ll1k.apps.googleusercontent.com';

export function getStoredGoogleClientId(): string {
  try {
    const custom = localStorage.getItem(STORAGE_GOOGLE_CLIENT_ID_KEY);
    if (custom && custom.trim()) return custom.trim();
  } catch (e) {}
  return DEFAULT_GOOGLE_CLIENT_ID;
}

export function saveStoredGoogleClientId(clientId: string): void {
  try {
    if (clientId && clientId.trim()) {
      localStorage.setItem(STORAGE_GOOGLE_CLIENT_ID_KEY, clientId.trim());
    } else {
      localStorage.removeItem(STORAGE_GOOGLE_CLIENT_ID_KEY);
    }
  } catch (e) {}
}

/**
 * Ensures Google Identity Services (GIS) script is loaded on the page
 */
export function loadGisScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window !== 'undefined' && (window as any).google?.accounts) {
      return resolve();
    }
    const existing = document.getElementById('google-gis-sdk');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', (e) => reject(e));
      return;
    }
    const script = document.createElement('script');
    script.id = 'google-gis-sdk';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = (err) => reject(err);
    document.head.appendChild(script);
  });
}

/**
 * Decodes a Google ID token (JWT) safely in the browser without external network calls
 */
export function decodeGoogleIdToken(token: string): GoogleUserProfile {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) throw new Error('Invalid JWT payload structure');
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const data = JSON.parse(jsonPayload);
    return {
      email: data.email,
      name: data.name,
      given_name: data.given_name,
      family_name: data.family_name,
      picture: data.picture,
      sub: data.sub
    };
  } catch (e: any) {
    throw new Error(e.message || 'Failed to decode Google ID token');
  }
}

/**
 * Initializes Google Identity Services ID Token (Sign In With Google) flow
 */
export async function initGoogleIdClient(
  onSuccess: (profile: GoogleUserProfile) => void,
  clientIdOverride?: string
): Promise<void> {
  await loadGisScript();
  const clientId = clientIdOverride || getStoredGoogleClientId();

  try {
    const google = (window as any).google;
    if (google?.accounts?.id) {
      google.accounts.id.initialize({
        client_id: clientId,
        callback: (response: any) => {
          if (response?.credential) {
            try {
              const profile = decodeGoogleIdToken(response.credential);
              onSuccess(profile);
            } catch (err) {
              console.error('Failed to parse Google ID token credential:', err);
            }
          }
        },
        auto_select: false,
        cancel_on_tap_outside: true,
      });
    }
  } catch (err) {
    console.warn('Google Identity Services ID client initialization warning:', err);
  }
}

/**
 * Renders the official Google Sign-In Button into any DOM container
 */
export async function renderGoogleSignInButton(
  container: HTMLElement,
  onSuccess: (profile: GoogleUserProfile) => void,
  isLight: boolean = false,
  clientIdOverride?: string
): Promise<void> {
  await initGoogleIdClient(onSuccess, clientIdOverride);
  try {
    const google = (window as any).google;
    if (google?.accounts?.id && container) {
      google.accounts.id.renderButton(container, {
        type: 'standard',
        theme: isLight ? 'outline' : 'filled_black',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        logo_alignment: 'left',
        width: 340,
      });
    }
  } catch (err) {
    console.warn('Could not render standard Google button:', err);
  }
}

/**
 * Triggers the native Google OAuth Popup using Google Identity Services (GIS)
 * and retrieves user info directly from Google OAuth2 endpoints.
 */
export async function triggerGoogleGisSignIn(clientIdOverride?: string): Promise<GoogleUserProfile> {
  await loadGisScript();

  const clientId = clientIdOverride || getStoredGoogleClientId();

  return new Promise((resolve, reject) => {
    try {
      const google = (window as any).google;
      if (!google?.accounts) {
        return reject(new Error('Google Identity Services SDK not loaded'));
      }

      // Try ID Token client prompt if available
      if (google.accounts.id) {
        google.accounts.id.initialize({
          client_id: clientId,
          callback: (response: any) => {
            if (response?.credential) {
              try {
                const profile = decodeGoogleIdToken(response.credential);
                return resolve(profile);
              } catch (err) {
                // fallback to oauth2 token client
              }
            }
          },
        });
      }

      if (google.accounts.oauth2) {
        const client = google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'email profile openid',
          prompt: 'select_account',
          callback: async (tokenResponse: any) => {
            if (tokenResponse.error) {
              return reject(tokenResponse);
            }
            if (tokenResponse.access_token) {
              try {
                // Fetch user details from Google UserInfo endpoint
                const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                  headers: {
                    Authorization: `Bearer ${tokenResponse.access_token}`
                  }
                });
                if (userInfoRes.ok) {
                  const profile: GoogleUserProfile = await userInfoRes.json();
                  resolve(profile);
                } else {
                  reject(new Error('Failed to fetch profile details from Google'));
                }
              } catch (fetchErr) {
                reject(fetchErr);
              }
            }
          },
          error_callback: (err: any) => {
            reject(err);
          }
        });

        client.requestAccessToken();
      } else {
        reject(new Error('Google Identity Services OAuth2 token client not available'));
      }
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Creates or matches an AuthUser session from Google user profile info
 */
export function createGoogleUserSession(
  profile: GoogleUserProfile,
  customRole: UserRole = 'IMO Reviewer',
  customImo: string = 'Mindoro Oriental-Marinduque-Romblon IMO'
): AuthUser {
  const cleanEmail = profile.email.trim().toLowerCase();
  const username = cleanEmail.split('@')[0].replace(/[^a-z0-9_]/g, '_');
  const allUsers = getAuthUsers();

  // Match preconfigured accounts if email or username aligns
  const matchedUser = allUsers.find(
    (u) =>
      (u.email && u.email.toLowerCase() === cleanEmail) ||
      u.username.toLowerCase() === username
  );

  if (matchedUser) {
    return {
      ...matchedUser,
      name: profile.name || matchedUser.name,
      avatar: profile.picture || matchedUser.avatar,
      email: cleanEmail,
      provider: 'google'
    };
  }

  return {
    id: `usr-gauth-${Math.abs(cleanEmail.split('').reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0)).toString(36)}`,
    username: username,
    name: profile.name || cleanEmail,
    role: customRole,
    passcode: 'GOOGLE_AUTH_SSO',
    imoOffice: customImo,
    nisBinding: 'All NIS',
    designation: `${customRole} (Google SSO - ${cleanEmail})`,
    avatar: profile.picture,
    email: cleanEmail,
    provider: 'google'
  };
}

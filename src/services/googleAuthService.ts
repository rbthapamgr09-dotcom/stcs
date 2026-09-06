import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  User as FirebaseUser,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// OAuth Scopes strictly matching required Google Workspace permissions
export const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
];

export interface GoogleAuthUser {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
}

const CUSTOM_FIREBASE_CONFIG_KEY = 'nepal_payroll_custom_firebase_config';
const CUSTOM_OAUTH_CLIENT_ID_KEY = 'nepal_payroll_custom_oauth_client_id';

export const getCustomOAuthClientId = (): string | null => {
  try {
    return localStorage.getItem(CUSTOM_OAUTH_CLIENT_ID_KEY);
  } catch {
    return null;
  }
};

export const saveCustomOAuthClientId = (clientId: string | null) => {
  if (!clientId) {
    localStorage.removeItem(CUSTOM_OAUTH_CLIENT_ID_KEY);
  } else {
    localStorage.setItem(CUSTOM_OAUTH_CLIENT_ID_KEY, clientId.trim());
  }
};

export const getCustomFirebaseConfig = () => {
  try {
    const raw = localStorage.getItem(CUSTOM_FIREBASE_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && (parsed.projectId || parsed.apiKey)) {
        return parsed;
      }
    }
  } catch {}
  return null;
};

export const saveCustomFirebaseConfig = (customCfg: any | null) => {
  if (!customCfg) {
    localStorage.removeItem(CUSTOM_FIREBASE_CONFIG_KEY);
  } else {
    localStorage.setItem(CUSTOM_FIREBASE_CONFIG_KEY, JSON.stringify(customCfg));
  }
};

// Initialize Firebase App safely (singleton pattern)
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Provider with required Google Sheets and Drive scopes
const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));
provider.setCustomParameters({
  prompt: 'select_account',
});

// Cache the access token in memory only (MANDATORY: never store in localStorage/sessionStorage)
let cachedAccessToken: string | null = null;
let isSigningIn = false;
let currentGoogleUser: GoogleAuthUser | null = null;

let gisScriptPromise: Promise<void> | null = null;

/**
 * Dynamically loads the Google Identity Services (GSI) script
 */
export const loadGoogleIdentityScript = (): Promise<void> => {
  if (typeof window === 'undefined') return Promise.resolve();
  if ((window as any).google?.accounts?.oauth2) return Promise.resolve();
  if (gisScriptPromise) return gisScriptPromise;

  gisScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src*="accounts.google.com/gsi/client"]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', (e) => reject(e));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = (e) => {
      gisScriptPromise = null;
      reject(new Error('Google Identity Services script लोड हुन सकेन।'));
    };
    document.body.appendChild(script);
  });
  return gisScriptPromise;
};

/**
 * Fallback direct Google OAuth2 token client via Google Identity Services
 */
export const signInWithGoogleIdentityServices = async (
  customClientId?: string
): Promise<{ user: GoogleAuthUser; accessToken: string }> => {
  await loadGoogleIdentityScript();
  const activeClientId = customClientId || getCustomOAuthClientId() || firebaseConfig.oAuthClientId;

  if (!activeClientId) {
    throw new Error('OAuth Client ID उपलब्ध छैन।');
  }

  return new Promise((resolve, reject) => {
    try {
      const googleObj = (window as any).google;
      if (!googleObj?.accounts?.oauth2) {
        throw new Error('Google Identity Services client तयार छैन।');
      }

      const client = googleObj.accounts.oauth2.initTokenClient({
        client_id: activeClientId,
        scope: `${SCOPES.join(' ')} email profile openid`,
        callback: async (tokenResponse: any) => {
          if (tokenResponse.error) {
            reject(new Error(tokenResponse.error_description || tokenResponse.error));
            return;
          }
          if (!tokenResponse.access_token) {
            reject(new Error('Google बाट Access Token प्राप्त हुन सकेन।'));
            return;
          }

          cachedAccessToken = tokenResponse.access_token;

          let userObj: GoogleAuthUser = {
            uid: `gis_${Date.now()}`,
            email: null,
            displayName: 'गुगल प्रयोगकर्ता',
          };

          try {
            const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
            });
            if (userRes.ok) {
              const uData = await userRes.json();
              userObj = {
                uid: uData.sub || `gis_${Date.now()}`,
                email: uData.email || null,
                displayName: uData.name || uData.email || 'गुगल प्रयोगकर्ता',
                photoURL: uData.picture || null,
              };
            }
          } catch (e) {
            console.warn('Failed to fetch userinfo via token:', e);
          }

          currentGoogleUser = userObj;
          resolve({ user: userObj, accessToken: tokenResponse.access_token });
        },
      });

      client.requestAccessToken({ prompt: 'select_account' });
    } catch (err) {
      reject(err);
    }
  });
};

/**
 * Initialize auth state listener. Call this on app load.
 */
export const initAuth = (
  onAuthSuccess?: (user: GoogleAuthUser, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: FirebaseUser | null) => {
    if (user && cachedAccessToken) {
      const mappedUser: GoogleAuthUser = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
      };
      currentGoogleUser = mappedUser;
      if (onAuthSuccess) onAuthSuccess(mappedUser, cachedAccessToken);
    } else if (currentGoogleUser && cachedAccessToken) {
      if (onAuthSuccess) onAuthSuccess(currentGoogleUser, cachedAccessToken);
    } else {
      if (!isSigningIn) {
        cachedAccessToken = null;
        currentGoogleUser = null;
        if (onAuthFailure) onAuthFailure();
      }
    }
  });
};

/**
 * Must be called from a button click or user interaction
 */
export const googleSignIn = async (): Promise<{ user: GoogleAuthUser; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('गुगलबाट एक्सेस टोकन (Access Token) प्राप्त हुन सकेन।');
    }

    cachedAccessToken = credential.accessToken;
    const mappedUser: GoogleAuthUser = {
      uid: result.user.uid,
      email: result.user.email,
      displayName: result.user.displayName,
      photoURL: result.user.photoURL,
    };
    currentGoogleUser = mappedUser;
    return { user: mappedUser, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Google Sign in error:', error);
    const errorCode = error?.code || '';
    const errorMsg = String(error?.message || '');

    // Check if error is unauthorized-domain (e.g. Cloudflare Pages or custom domain)
    const isUnauthorizedDomain =
      errorCode === 'auth/unauthorized-domain' ||
      errorMsg.includes('auth/unauthorized-domain') ||
      errorMsg.includes('unauthorized-domain');

    if (isUnauthorizedDomain) {
      console.info('Firebase auth/unauthorized-domain detected.');
      const customClientId = getCustomOAuthClientId();
      // Only attempt GIS fallback if the user has explicitly configured their own client ID
      if (customClientId) {
        try {
          const gisResult = await signInWithGoogleIdentityServices(customClientId);
          if (gisResult) {
            return gisResult;
          }
        } catch (gisError) {
          console.warn('Custom GIS fallback attempt unsuccessful:', gisError);
        }
      }

      const currentHostname = typeof window !== 'undefined' ? window.location.hostname : 'Cloudflare Domain';
      const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
      const customErr = new Error(
        `तपाईंको होस्ट डोमेन (${currentHostname}) वा JavaScript Origin (${currentOrigin}) गुगल अधिकृत सूचीमा नभएकोले Error 400: origin_mismatch देखा परेको हो।`
      );
      (customErr as any).code = 'auth/unauthorized-domain';
      (customErr as any).domain = currentHostname;
      (customErr as any).origin = currentOrigin;
      (customErr as any).projectId = firebaseConfig.projectId;
      throw customErr;
    }

    throw error;
  } finally {
    isSigningIn = false;
  }
};

/**
 * Get current in-memory access token
 */
export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

/**
 * Set token in memory (e.g. after successful re-auth)
 */
export const setCachedAccessToken = (token: string | null) => {
  cachedAccessToken = token;
};

/**
 * Sign out of Google Account and clear in-memory token
 */
export const googleSignOut = async (): Promise<void> => {
  try {
    await signOut(auth);
  } catch (e) {
    console.warn('Google sign out error:', e);
  } finally {
    cachedAccessToken = null;
    currentGoogleUser = null;
  }
};

/**
 * Check if Google Account is currently connected with a valid in-memory token
 */
export const isGoogleConnected = (): boolean => {
  return Boolean((auth.currentUser || currentGoogleUser) && cachedAccessToken);
};

/**
 * Get current connected Google user details
 */
export const getCurrentGoogleUser = (): GoogleAuthUser | null => {
  if (auth.currentUser) {
    return {
      uid: auth.currentUser.uid,
      email: auth.currentUser.email,
      displayName: auth.currentUser.displayName,
      photoURL: auth.currentUser.photoURL,
    };
  }
  return currentGoogleUser;
};

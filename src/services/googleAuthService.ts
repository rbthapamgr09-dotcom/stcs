import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  User as FirebaseUser,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Production domain reference
export const PRODUCTION_DOMAIN = 'stcs.rbthapamgr09.workers.dev';
export const PRODUCTION_ORIGIN = 'https://stcs.rbthapamgr09.workers.dev';

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
const CONNECTED_GOOGLE_USER_KEY = 'nepal_payroll_connected_google_user';

export const getSavedConnectedUser = (): GoogleAuthUser | null => {
  try {
    const raw = localStorage.getItem(CONNECTED_GOOGLE_USER_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.email) return parsed;
    }
  } catch {}
  return null;
};

export const saveConnectedUserLocal = (user: GoogleAuthUser | null) => {
  try {
    if (!user) {
      localStorage.removeItem(CONNECTED_GOOGLE_USER_KEY);
    } else {
      localStorage.setItem(CONNECTED_GOOGLE_USER_KEY, JSON.stringify(user));
    }
  } catch {}
};

export const removeSavedConnectedUser = () => {
  saveConnectedUserLocal(null);
};

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
const sensitiveProvider = new GoogleAuthProvider();
SCOPES.forEach((scope) => sensitiveProvider.addScope(scope));
sensitiveProvider.setCustomParameters({
  prompt: 'select_account',
});

// Standard provider with basic profile & email (works for ANY Google account without 403 or Test User restrictions)
const standardProvider = new GoogleAuthProvider();
standardProvider.setCustomParameters({
  prompt: 'select_account',
});

// Cache the access token in memory only (MANDATORY: never store in localStorage/sessionStorage)
let cachedAccessToken: string | null = null;
let isSigningIn = false;
let currentGoogleUser: GoogleAuthUser | null = null;

let gisScriptPromise: Promise<void> | null = null;

/**
 * Format and translate Firebase / Google Auth errors to user-friendly Nepali messages
 */
export const getNepaliAuthErrorMessage = (error: any): string => {
  const errorCode = error?.code || '';
  const errorMsg = String(error?.message || '');

  if (
    errorCode === 'auth/unauthorized-domain' ||
    errorMsg.includes('auth/unauthorized-domain') ||
    errorMsg.includes('unauthorized-domain')
  ) {
    const host = typeof window !== 'undefined' ? window.location.hostname : PRODUCTION_DOMAIN;
    return `डोमेन अधिकृत छैन (auth/unauthorized-domain): तपाईंको डोमेन '${host}' लाई Firebase Console > Authentication > Settings > Authorized domains मा थप्न आवश्यक छ।`;
  }

  if (
    errorCode === 'origin_mismatch' ||
    errorMsg.includes('origin_mismatch') ||
    errorMsg.includes('redirect_uri_mismatch')
  ) {
    const origin = typeof window !== 'undefined' ? window.location.origin : PRODUCTION_ORIGIN;
    return `Origin अधिकृत छैन (Error 400: origin_mismatch): गुगल क्लाउड कन्सोल (Google Cloud Console > Credentials > OAuth 2.0 Web Client ID) मा '${origin}' लाई 'Authorized JavaScript origins' मा थप्न आवश्यक छ।`;
  }

  if (errorCode === 'auth/popup-blocked') {
    return 'ब्राउजरले लगइन पप-अप (Popup Window) रोकेको छ। कृपया ब्राउजर सेटिङमा गई यस साइटको लागि Pop-up अनब्लक (Allow) गर्नुहोस्।';
  }

  if (errorCode === 'auth/popup-closed-by-user') {
    return 'लगइन पप-अप विन्डो प्रक्रिया पूरा नगरी बन्द गरियो। कृपया पुनः प्रयास गर्नुहोस्।';
  }

  if (errorCode === 'auth/cancelled-popup-request') {
    return 'लगइन प्रक्रिया पहिले नै चालु छ। कृपया प्रतीक्षा गर्नुहोस् वा पुनः प्रयास गर्नुहोस्।';
  }

  if (errorCode === 'auth/network-request-failed') {
    return 'इन्टरनेट कनेक्सनमा समस्या आयो। कृपया आफ्नो इन्टरनेट जाँच गरी पुनः प्रयास गर्नुहोस्।';
  }

  if (errorCode === 'auth/operation-not-allowed') {
    return 'Firebase Console मा Google Authentication प्रदायक (Provider) सक्रिय (Enable) गरिएको छैन।';
  }

  if (errorCode === 'auth/user-disabled') {
    return 'यो गुगल प्रयोगकर्ता खाता प्रशासकद्वारा निष्क्रिय (Disabled) गरिएको छ।';
  }

  if (errorMsg.includes('403') || errorMsg.includes('access_denied')) {
    return 'गुगल OAuth अनुमति अस्वीकृत (Error 403: access_denied): Google Cloud Console को OAuth Consent Screen मा आफ्नो इमेललाई Test users मा थप्नुहोस् वा Apps Script विधि प्रयोग गर्नुहोस्।';
  }

  return errorMsg || 'गुगल प्रमाणीकरण प्रक्रियामा अज्ञात त्रुटि देखा पर्यो।';
};

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
  const activeClientId = customClientId || getCustomOAuthClientId() || (firebaseConfig as any).oAuthClientId;

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
 * Initialize auth state listener and check for redirect results.
 */
export const initAuth = (
  onAuthSuccess?: (user: GoogleAuthUser, token: string) => void,
  onAuthFailure?: () => void
) => {
  // Check redirect result on app initialization
  getRedirectResult(auth)
    .then((result) => {
      if (result) {
        const credential = GoogleAuthProvider.credentialFromResult(result);
        const token = credential?.accessToken || '';
        if (token) cachedAccessToken = token;

        const mappedUser: GoogleAuthUser = {
          uid: result.user.uid,
          email: result.user.email,
          displayName: result.user.displayName || result.user.email || 'गुगल प्रयोगकर्ता',
          photoURL: result.user.photoURL,
        };
        currentGoogleUser = mappedUser;
        saveConnectedUserLocal(mappedUser);
        if (onAuthSuccess) onAuthSuccess(mappedUser, token);
      }
    })
    .catch((err) => {
      console.warn('getRedirectResult notice:', err);
    });

  return onAuthStateChanged(auth, async (user: FirebaseUser | null) => {
    if (user) {
      const mappedUser: GoogleAuthUser = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || user.email || 'गुगल प्रयोगकर्ता',
        photoURL: user.photoURL,
      };
      currentGoogleUser = mappedUser;
      saveConnectedUserLocal(mappedUser);
      if (onAuthSuccess) onAuthSuccess(mappedUser, cachedAccessToken || '');
    } else if (currentGoogleUser) {
      if (onAuthSuccess) onAuthSuccess(currentGoogleUser, cachedAccessToken || '');
    } else {
      const savedUser = getSavedConnectedUser();
      if (savedUser && savedUser.email) {
        currentGoogleUser = savedUser;
        if (onAuthSuccess) onAuthSuccess(savedUser, cachedAccessToken || '');
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        currentGoogleUser = null;
        if (onAuthFailure) onAuthFailure();
      }
    }
  });
};

/**
 * Direct connection for authorized admin account (rbthapamgr09@gmail.com)
 * Enables 1-click connection without popup blockers or 403 restrictions
 */
export const directConnectAdminAccount = (
  email: string = 'rbthapamgr09@gmail.com',
  displayName: string = 'RB Thapa Magar'
): { user: GoogleAuthUser; accessToken: string } => {
  const mappedUser: GoogleAuthUser = {
    uid: `user_${email.replace(/[^a-zA-Z0-9]/g, '_')}`,
    email,
    displayName,
    photoURL: null,
  };
  currentGoogleUser = mappedUser;
  saveConnectedUserLocal(mappedUser);
  return { user: mappedUser, accessToken: cachedAccessToken || '' };
};

/**
 * Standard Firebase Google Sign-In with popup
 * Supports production domain (stcs.rbthapamgr09.workers.dev), local development, and preview origins
 */
export const googleSignIn = async (
  requireSensitiveScopes = false
): Promise<{ user: GoogleAuthUser; accessToken: string } | null> => {
  try {
    isSigningIn = true;

    // Use standardProvider by default so that all users (e.g. rbthapamgr09@gmail.com)
    // can sign in without being blocked by Google OAuth "Testing mode" or Error 403!
    const providerToUse = requireSensitiveScopes ? sensitiveProvider : standardProvider;

    const result = await signInWithPopup(auth, providerToUse);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential?.accessToken || '';
    cachedAccessToken = token || null;

    const mappedUser: GoogleAuthUser = {
      uid: result.user.uid,
      email: result.user.email,
      displayName: result.user.displayName || result.user.email || 'गुगल प्रयोगकर्ता',
      photoURL: result.user.photoURL,
    };
    currentGoogleUser = mappedUser;
    saveConnectedUserLocal(mappedUser);
    return { user: mappedUser, accessToken: token };
  } catch (error: any) {
    console.error('Google Sign in error:', error);
    const errorCode = error?.code || '';
    const errorMsg = String(error?.message || '');

    // Check if error is unauthorized-domain (e.g. Cloudflare Pages or custom production domain)
    const isUnauthorizedDomain =
      errorCode === 'auth/unauthorized-domain' ||
      errorMsg.includes('auth/unauthorized-domain') ||
      errorMsg.includes('unauthorized-domain');

    if (isUnauthorizedDomain) {
      console.info('Firebase auth/unauthorized-domain detected.');
      const customClientId = getCustomOAuthClientId();
      if (customClientId) {
        try {
          const gisResult = await signInWithGoogleIdentityServices(customClientId);
          if (gisResult) {
            saveConnectedUserLocal(gisResult.user);
            return gisResult;
          }
        } catch (gisError) {
          console.warn('Custom GIS fallback attempt unsuccessful:', gisError);
        }
      }

      const currentHostname = typeof window !== 'undefined' ? window.location.hostname : PRODUCTION_DOMAIN;
      const currentOrigin = typeof window !== 'undefined' ? window.location.origin : PRODUCTION_ORIGIN;
      const customErr = new Error(
        `तपाईंको होस्ट डोमेन (${currentHostname}) वा JavaScript Origin (${currentOrigin}) गुगल अधिकृत सूचीमा नभएकोले Error 400 देखा परेको हो।`
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
 * Sign In using Redirect (Useful if popup is blocked by browser policies)
 */
export const googleSignInRedirect = async (requireSensitiveScopes = false): Promise<void> => {
  const providerToUse = requireSensitiveScopes ? sensitiveProvider : standardProvider;
  await signInWithRedirect(auth, providerToUse);
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
 * Sign out of Google Account and clear in-memory token & local storage
 */
export const googleSignOut = async (): Promise<void> => {
  try {
    await signOut(auth);
  } catch (e) {
    console.warn('Google sign out error:', e);
  } finally {
    cachedAccessToken = null;
    currentGoogleUser = null;
    removeSavedConnectedUser();
  }
};

/**
 * Check if Google Account is currently connected
 */
export const isGoogleConnected = (): boolean => {
  if (auth.currentUser || currentGoogleUser) return true;
  const saved = getSavedConnectedUser();
  return Boolean(saved && saved.email);
};

/**
 * Get current connected Google user details
 */
export const getCurrentGoogleUser = (): GoogleAuthUser | null => {
  if (auth.currentUser) {
    return {
      uid: auth.currentUser.uid,
      email: auth.currentUser.email,
      displayName: auth.currentUser.displayName || auth.currentUser.email || 'गुगल प्रयोगकर्ता',
      photoURL: auth.currentUser.photoURL,
    };
  }
  if (currentGoogleUser) return currentGoogleUser;
  return getSavedConnectedUser();
};


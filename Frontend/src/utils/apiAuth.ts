const LEGACY_TOKEN_STORAGE_KEY = 'manipal_api_access_token';
const LEGACY_TOKEN_EXPIRY_STORAGE_KEY = 'manipal_api_access_token_expires_at';
const TOKEN_TTL_MS = 3_000 * 1_000;

let loginPromise: Promise<string> | null = null;

export const getApiBaseUrl = (): string => {
  const configuredUrl = import.meta.env.VITE_MANIPAL_API_BASE_URL || import.meta.env.VITE_API_BASE_URL;
  if (configuredUrl) return configuredUrl.replace(/\/+$/, '');
  if (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app')) return '/api-proxy';
  return 'https://devmanipal.getafixtechnologies.com/api';
};

const getTokenStorageKey = (): string => `manipal_api_access_token:${getApiBaseUrl()}`;
const getTokenExpiryStorageKey = (): string => `${getTokenStorageKey()}:expires_at`;

const getStoredToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  // Tokens issued by the old dev host are invalid on the production API.
  sessionStorage.removeItem(LEGACY_TOKEN_STORAGE_KEY);
  sessionStorage.removeItem(LEGACY_TOKEN_EXPIRY_STORAGE_KEY);

  const tokenStorageKey = getTokenStorageKey();
  const expiryStorageKey = getTokenExpiryStorageKey();
  const token = sessionStorage.getItem(tokenStorageKey);
  const expiresAt = Number(sessionStorage.getItem(expiryStorageKey));
  if (token && expiresAt > Date.now()) return token;
  sessionStorage.removeItem(tokenStorageKey);
  sessionStorage.removeItem(expiryStorageKey);
  return null;
};

const storeToken = (token: string): void => {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(getTokenStorageKey(), token);
  sessionStorage.setItem(getTokenExpiryStorageKey(), String(Date.now() + TOKEN_TTL_MS));
};

export const clearAuthToken = (): void => {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(LEGACY_TOKEN_STORAGE_KEY);
  sessionStorage.removeItem(LEGACY_TOKEN_EXPIRY_STORAGE_KEY);
  sessionStorage.removeItem(getTokenStorageKey());
  sessionStorage.removeItem(getTokenExpiryStorageKey());
};

const login = async (): Promise<string> => {
  const username = import.meta.env.VITE_MANIPAL_API_USERNAME;
  const password = import.meta.env.VITE_MANIPAL_API_PASSWORD;
  if (!username || !password) {
    throw new Error('Manipal API login credentials are not configured.');
  }

  const response = await fetch(`${getApiBaseUrl()}/user/login/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password, platform: 'web' }),
  });
  console.log('Login response:', response);
  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`;
    try {
      const body = await response.json();
      detail = body?.message || body?.detail || detail;
    } catch {
      // The upstream did not return JSON.
    }
    throw new Error(`Manipal API login failed: ${detail}`);
  }

  const body = await response.json();
  const token = body?.data?.user?.access_token;
  if (!token) throw new Error('The Manipal login response did not contain an access token.');

  storeToken(token);
  return token;
};

export const getAuthToken = async (): Promise<string> => {
  const storedToken = getStoredToken();
  if (storedToken) return storedToken;
  if (!loginPromise) {
    loginPromise = login().finally(() => {
      loginPromise = null;
    });
  }
  return loginPromise;
};

export const getAuthHeaders = async (): Promise<Record<string, string>> => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${await getAuthToken()}`,
});

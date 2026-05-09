export const AUTH_TOKEN_STORAGE_KEY = "emotisense_token";
export const LEGACY_AUTH_TOKEN_STORAGE_KEY = "token";

export function getStoredToken() {
  if (typeof window === "undefined") {
    return "";
  }
  return (
    window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)
    || window.localStorage.getItem(LEGACY_AUTH_TOKEN_STORAGE_KEY)
    || ""
  );
}

export function persistToken(token) {
  if (typeof window === "undefined" || !token) {
    return;
  }
  window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
  window.localStorage.setItem(LEGACY_AUTH_TOKEN_STORAGE_KEY, token);
}

export function clearStoredToken() {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(LEGACY_AUTH_TOKEN_STORAGE_KEY);
}

/**
 * Dev mode: type "devmode" anywhere on the landing page, or call enableDevMode().
 * Persists in localStorage so it survives refreshes. Clear with disableDevMode().
 */
const KEY = "photorabbit_dev_mode";
const SECRET_KEY = "photorabbit_dev_secret";

export function isDevMode(): boolean {
  if (typeof window === "undefined") return false;
  // Check URL param
  try {
    const params = new URLSearchParams(window.location.search);
    // The dev secret must be supplied at least once via ?devkey=... and is
    // validated server-side by the bootstrap-dev-user function.
    const key = params.get("devkey");
    if (key) localStorage.setItem(SECRET_KEY, key);
    if (params.get("dev") === "1") {
      localStorage.setItem(KEY, "1");
      return true;
    }
  } catch { /* URL parsing may fail in non-browser environments */ }
  return localStorage.getItem(KEY) === "1";
}

/** The locally-held dev secret. Never bundled — the operator supplies it via ?devkey=. */
export function getDevSecret(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(SECRET_KEY);
}

export function enableDevMode() {
  localStorage.setItem(KEY, "1");
}

export function disableDevMode() {
  localStorage.removeItem(KEY);
  localStorage.removeItem(SECRET_KEY);
}

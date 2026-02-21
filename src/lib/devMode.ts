/**
 * Dev mode: type "devmode" anywhere on the landing page, or call enableDevMode().
 * Persists in localStorage so it survives refreshes. Clear with disableDevMode().
 */
const KEY = "photorabbit_dev_mode";

export function isDevMode(): boolean {
  if (typeof window === "undefined") return false;
  // Check URL param
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("dev") === "1") {
      localStorage.setItem(KEY, "1");
      return true;
    }
  } catch { /* URL parsing may fail in non-browser environments */ }
  return localStorage.getItem(KEY) === "1";
}

export function enableDevMode() {
  localStorage.setItem(KEY, "1");
}

export function disableDevMode() {
  localStorage.removeItem(KEY);
}

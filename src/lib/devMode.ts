/**
 * Dev mode: append ?dev=1 to any URL to bypass auth.
 * Once activated, it persists in sessionStorage until the tab closes.
 */
const KEY = "photorabbit_dev_mode";

export function isDevMode(): boolean {
  if (typeof window === "undefined") return false;
  // Check URL param first
  const params = new URLSearchParams(window.location.search);
  if (params.get("dev") === "1") {
    sessionStorage.setItem(KEY, "1");
    return true;
  }
  return sessionStorage.getItem(KEY) === "1";
}

export const DEFAULT_THEME = "dark";
export const THEME_STORAGE_KEY = "bettaview-theme";

export function normalizeTheme(theme) {
  return theme === "light" ? "light" : DEFAULT_THEME;
}

export function getInitialTheme(storage) {
  try {
    const target = storage === undefined ? globalThis.localStorage : storage;
    return normalizeTheme(target?.getItem(THEME_STORAGE_KEY));
  } catch {
    return DEFAULT_THEME;
  }
}

export function applyTheme(theme, { root = globalThis.document?.documentElement, storage, persist = true } = {}) {
  const normalizedTheme = normalizeTheme(theme);
  if (root) {
    root.dataset.theme = normalizedTheme;
    root.style.colorScheme = normalizedTheme;
  }
  if (persist) {
    try {
      const target = storage === undefined ? globalThis.localStorage : storage;
      target?.setItem(THEME_STORAGE_KEY, normalizedTheme);
    } catch {
      // The selected theme still applies when storage is unavailable.
    }
  }
  return normalizedTheme;
}

export function nextTheme(theme) {
  return normalizeTheme(theme) === "dark" ? "light" : "dark";
}

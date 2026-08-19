export const RECENT_PULL_REQUEST_STORAGE_KEY = "bettaview-recent-pull-request";

export function getRecentPullRequest(storage) {
  try {
    const target = storage === undefined ? globalThis.localStorage : storage;
    return target?.getItem(RECENT_PULL_REQUEST_STORAGE_KEY)?.trim() || "";
  } catch {
    return "";
  }
}

export function saveRecentPullRequest(url, storage) {
  const value = url?.trim();
  if (!value) return "";
  try {
    const target = storage === undefined ? globalThis.localStorage : storage;
    target?.setItem(RECENT_PULL_REQUEST_STORAGE_KEY, value);
  } catch {
    // A blocked storage API should not prevent the pull request from opening.
  }
  return value;
}

export function clearRecentPullRequest(storage) {
  try {
    const target = storage === undefined ? globalThis.localStorage : storage;
    target?.removeItem(RECENT_PULL_REQUEST_STORAGE_KEY);
  } catch {
    // A blocked storage API should not prevent the empty state from rendering.
  }
}

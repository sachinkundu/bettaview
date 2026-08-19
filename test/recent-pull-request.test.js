import test from "node:test";
import assert from "node:assert/strict";
import {
  clearRecentPullRequest,
  getRecentPullRequest,
  RECENT_PULL_REQUEST_STORAGE_KEY,
  saveRecentPullRequest,
} from "../src/recent-pull-request.js";

function memoryStorage(initialValue) {
  const values = new Map();
  if (initialValue !== undefined) values.set(RECENT_PULL_REQUEST_STORAGE_KEY, initialValue);
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

test("restores and trims the most recently opened pull request URL", () => {
  const storage = memoryStorage("  https://github.com/acme/docs/pull/42  ");
  assert.equal(getRecentPullRequest(storage), "https://github.com/acme/docs/pull/42");
});

test("saves and clears the most recently opened pull request URL", () => {
  const storage = memoryStorage();
  saveRecentPullRequest(" https://github.com/acme/docs/pull/7 ", storage);
  assert.equal(getRecentPullRequest(storage), "https://github.com/acme/docs/pull/7");
  clearRecentPullRequest(storage);
  assert.equal(getRecentPullRequest(storage), "");
});

test("continues without persistence when browser storage is unavailable", () => {
  const storage = {
    getItem() { throw new Error("blocked"); },
    setItem() { throw new Error("blocked"); },
    removeItem() { throw new Error("blocked"); },
  };
  assert.equal(getRecentPullRequest(storage), "");
  assert.equal(saveRecentPullRequest("https://github.com/acme/docs/pull/9", storage), "https://github.com/acme/docs/pull/9");
  assert.doesNotThrow(() => clearRecentPullRequest(storage));
});

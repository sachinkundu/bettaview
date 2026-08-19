import test from "node:test";
import assert from "node:assert/strict";

import { applyTheme, DEFAULT_THEME, getInitialTheme, nextTheme, THEME_STORAGE_KEY } from "../src/theme.js";

test("defaults to dark when no theme preference exists", () => {
  const storage = { getItem: () => null };
  assert.equal(getInitialTheme(storage), DEFAULT_THEME);
  assert.equal(DEFAULT_THEME, "dark");
});

test("restores only a saved light preference", () => {
  assert.equal(getInitialTheme({ getItem: () => "light" }), "light");
  assert.equal(getInitialTheme({ getItem: () => "unexpected" }), "dark");
});

test("applies and persists a normalized theme", () => {
  const root = { dataset: {}, style: {} };
  const writes = [];
  const storage = { setItem: (...args) => writes.push(args) };

  assert.equal(applyTheme("light", { root, storage }), "light");
  assert.equal(root.dataset.theme, "light");
  assert.equal(root.style.colorScheme, "light");
  assert.deepEqual(writes, [[THEME_STORAGE_KEY, "light"]]);
});

test("toggles between dark and light", () => {
  assert.equal(nextTheme("dark"), "light");
  assert.equal(nextTheme("light"), "dark");
});

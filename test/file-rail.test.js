import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_FILE_RAIL_WIDTH,
  MAX_FILE_RAIL_WIDTH,
  MIN_FILE_RAIL_WIDTH,
  clampFileRailWidth,
  maxFileRailWidth,
} from "../src/file-rail.js";

test("clamps the file rail to its usable drag range", () => {
  assert.equal(clampFileRailWidth(100, 1600), MIN_FILE_RAIL_WIDTH);
  assert.equal(clampFileRailWidth(340, 1600), 340);
  assert.equal(clampFileRailWidth(900, 1600), MAX_FILE_RAIL_WIDTH);
  assert.equal(clampFileRailWidth(Number.NaN, 1600), DEFAULT_FILE_RAIL_WIDTH);
});

test("preserves room for the document and thread rails", () => {
  assert.equal(maxFileRailWidth(1300), 410);
  assert.equal(maxFileRailWidth(1400), 450);
  assert.equal(maxFileRailWidth(1000), MIN_FILE_RAIL_WIDTH);
});

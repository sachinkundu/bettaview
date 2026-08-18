import test from "node:test";
import assert from "node:assert/strict";

import { annotationSvgAttributes, circleSvgGeometry, startDrawing } from "../src/annotation-geometry.js";

test("capture-safe annotation styling is stored on the SVG shape", () => {
  assert.match(annotationSvgAttributes, /stroke="#e34b31"/);
  assert.match(annotationSvgAttributes, /fill="none"/);
  assert.match(annotationSvgAttributes, /stroke-width="9"/);
});

test("a circle starts at its center", () => {
  assert.deepEqual(startDrawing("circle", { x: 0.25, y: 0.4 }), {
    kind: "circle",
    mode: "center-radius",
    x1: 0.25,
    y1: 0.4,
    x2: 0.25,
    y2: 0.4,
  });
});

test("a circle grows by pointer distance and remains round in a non-square viewport", () => {
  const geometry = circleSvgGeometry(
    { x1: 0.25, y1: 0.5, x2: 0.5, y2: 0.5 },
    { width: 400, height: 200 },
  );

  assert.deepEqual(geometry, { cx: 250, cy: 500, rx: 250, ry: 500 });
  assert.equal(geometry.rx * 400 / 1000, 100);
  assert.equal(geometry.ry * 200 / 1000, 100);
});

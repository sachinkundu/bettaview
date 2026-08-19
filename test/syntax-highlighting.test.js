import test from "node:test";
import assert from "node:assert/strict";
import { highlightSource } from "../src/syntax-highlighting.js";

test("adds semantic spans for a declared language", () => {
  const result = highlightSource("const answer = 42;", "javascript");
  assert.equal(result.language, "javascript");
  assert.match(result.value, /hljs-keyword/);
  assert.match(result.value, /hljs-number/);
});

test("escapes source markup while highlighting", () => {
  const result = highlightSource("<script>alert('nope')</script>", "xml");
  assert.doesNotMatch(result.value, /<script>/);
  assert.match(result.value, /&lt;/);
});

test("auto-detects an unsupported or missing language", () => {
  const result = highlightSource("def greet(name):\n    return f\"Hello {name}\"");
  assert.equal(result.language, "python");
  assert.match(result.value, /hljs-keyword/);
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  changedLinesFromPatch,
  chooseAnchorLine,
  extractMermaidBlocks,
  locateSelectedText,
  marker,
  parsePullRequestUrl,
  readMarker,
} from "../server/github.js";

test("parses a GitHub pull request URL", () => {
  assert.deepEqual(parsePullRequestUrl("https://github.com/acme/docs/pull/42/files"), {
    owner: "acme", repo: "docs", number: 42,
  });
});

test("locates whitespace-normalized prose in source", () => {
  const source = "# Title\n\nA sentence split\nacross two lines.\n";
  assert.deepEqual(locateSelectedText(source, "A sentence split across two lines."), {
    startLine: 3, endLine: 4, selectedText: "A sentence split across two lines.",
  });
});

test("rejects ambiguous selection", () => {
  assert.throws(() => locateSelectedText("same\n\nsame", "same"), /ambiguous/);
});

test("extracts Mermaid identity and exact source range", () => {
  const [block] = extractMermaidBlocks("Text\n\n```mermaid\nflowchart LR\n A-->B\n```\n");
  assert.equal(block.startLine, 3);
  assert.equal(block.endLine, 6);
  assert.equal(block.code, "flowchart LR\n A-->B");
  assert.equal(block.id, "mermaid-1");
});

test("finds right-side changed lines and chooses one within a range", () => {
  const patch = "@@ -3,2 +3,4 @@\n context\n+first\n+second\n context";
  const lines = changedLinesFromPatch(patch);
  assert.deepEqual([...lines], [4, 5]);
  assert.equal(chooseAnchorLine({ startLine: 3, endLine: 5 }, lines), 5);
});

test("round trips versioned metadata markers", () => {
  const metadata = { kind: "text-selection", line: 9 };
  assert.deepEqual(readMarker(`Comment\n\n${marker(metadata)}`), metadata);
});

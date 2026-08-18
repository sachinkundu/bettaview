import test from "node:test";
import assert from "node:assert/strict";
import {
  approvalRestriction,
  batchReviewPayload,
  changedLinesFromPatch,
  chooseAnchorLine,
  extractMermaidBlocks,
  locateSelectedText,
  marker,
  parsePullRequestUrl,
  readMarker,
} from "../server/github.js";

test("prevents a pull request author from approving their own review", () => {
  assert.equal(
    approvalRestriction("SachinKundu", "sachinkundu"),
    "Pull request authors cannot approve their own pull requests.",
  );
  assert.equal(approvalRestriction("reviewer", "author"), null);
});

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

test("builds one GitHub review containing every held comment", () => {
  assert.deepEqual(batchReviewPayload("abc123", [
    { path: "README.md", line: 4, body: "First" },
    { path: "docs/flow.md", line: 12, body: "Second" },
  ]), {
    commit_id: "abc123",
    event: "COMMENT",
    body: "BettaView review with 2 inline comments.",
    comments: [
      { path: "README.md", line: 4, side: "RIGHT", body: "First" },
      { path: "docs/flow.md", line: 12, side: "RIGHT", body: "Second" },
    ],
  });
});

test("refuses to build an empty batch review", () => {
  assert.throws(() => batchReviewPayload("abc123", []), /at least one comment/);
});

test("carries the selected review state on the batched review", () => {
  assert.equal(batchReviewPayload("abc123", [{ path: "README.md", line: 4, body: "Fix" }], "REQUEST_CHANGES").event, "REQUEST_CHANGES");
  assert.throws(() => batchReviewPayload("abc123", [{ path: "README.md", line: 4, body: "Fix" }], "MERGE"), /Unsupported review state/);
});

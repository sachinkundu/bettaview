import test from "node:test";
import assert from "node:assert/strict";

import { activeThreadReferences, draftReferenceKey, threadReferenceKey } from "../src/thread-links.js";

test("builds stable, numbered marker-to-card references in rail order", () => {
  const drafts = [{ clientSubmissionId: "draft-1", kind: "text-selection", startLine: 4, selectedText: "selected prose" }];
  const threads = [{
    id: "PRRT_1",
    line: 9,
    comments: [{ metadata: { kind: "text-selection", startLine: 7, selectedText: "published prose" } }],
  }];

  assert.deepEqual(activeThreadReferences(threads, drafts), [
    { key: "draft-draft-1", line: 4, selectedText: "selected prose", draft: true, position: 1 },
    { key: "thread-PRRT_1", line: 7, selectedText: "published prose", draft: false, position: 2 },
  ]);
});

test("falls back to the native GitHub anchor and locates Mermaid metadata", () => {
  const references = activeThreadReferences([
    { id: "native", line: 12, comments: [{ metadata: null }] },
    { id: "diagram", line: 30, comments: [{ metadata: { kind: "mermaid-annotation", diagram: { startLine: 24 } } }] },
  ], []);

  assert.equal(references[0].line, 12);
  assert.equal(references[0].selectedText, null);
  assert.equal(references[1].line, 24);
});

test("uses distinct stable keys for published threads and local drafts", () => {
  assert.equal(threadReferenceKey({ id: "same" }), "thread-same");
  assert.equal(draftReferenceKey({ clientSubmissionId: "same" }), "draft-same");
});

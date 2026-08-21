import test from "node:test";
import assert from "node:assert/strict";
import {
  buildReviewFileTree,
  commentCloseNeedsConfirmation,
  reviewFileSegments,
  scenarioKeyword,
} from "../src/review-ui.js";

test("recognizes only OpenSpec scenario keywords", () => {
  assert.equal(scenarioKeyword(" WHEN "), "when");
  assert.equal(scenarioKeyword("then"), "then");
  assert.equal(scenarioKeyword("GIVEN"), null);
  assert.equal(scenarioKeyword("WHENEVER"), null);
});

test("shows OpenSpec change paths without their repeated prefix", () => {
  assert.deepEqual(
    reviewFileSegments("openspec/changes/review-history-aware-rechecks/proposal.md"),
    ["review-history-aware-rechecks", "proposal.md"],
  );
  assert.deepEqual(
    reviewFileSegments("openspec/changes/review-history-aware-rechecks/specs/agent-pipeline/spec.md"),
    ["review-history-aware-rechecks", "agent-pipeline"],
  );
  assert.deepEqual(reviewFileSegments("docs/reviewer/guide.md"), ["docs", "reviewer", "guide.md"]);
});

test("builds an IDE-like hierarchy and retains original file identities", () => {
  const files = [
    { path: "openspec/changes/review-history-aware-rechecks/specs/github-integration/spec.md", additions: 4, deletions: 1 },
    { path: "openspec/changes/review-history-aware-rechecks/specs/agent-pipeline/spec.md", additions: 2, deletions: 0 },
    { path: "openspec/changes/review-history-aware-rechecks/proposal.md", additions: 8, deletions: 3 },
  ];
  const [change] = buildReviewFileTree(files);

  assert.equal(change.kind, "branch");
  assert.equal(change.label, "review-history-aware-rechecks");
  assert.deepEqual(change.children.map((node) => node.label), ["agent-pipeline", "github-integration", "proposal.md"]);
  assert.equal(change.children[0].file.path, files[1].path);
});

test("only non-whitespace comment text needs discard confirmation", () => {
  assert.equal(commentCloseNeedsConfirmation(""), false);
  assert.equal(commentCloseNeedsConfirmation("  \n"), false);
  assert.equal(commentCloseNeedsConfirmation("Needs clarification"), true);
});

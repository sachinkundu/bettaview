import test from "node:test";
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { reviewOpenSpecTraceability } from "../src/review-traceability.js";
import { loadTraceability } from "../src/traceability.js";

const fixture = fileURLToPath(new URL("fixtures/traceability/sample-change", import.meta.url));

async function mutableFixture() {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "bettaview-review-traceability-"));
  const changeDirectory = path.join(temporaryRoot, "sample-change");
  await cp(fixture, changeDirectory, { recursive: true });
  return {
    changeDirectory,
    cleanup: () => rm(temporaryRoot, { recursive: true, force: true }),
  };
}

function passingJudgment() {
  const judgment = {
    coverage: "sufficient",
    scope: "in_scope",
    minimality: "minimal",
    rationale: "The cited behavior is covered without unrelated requirements.",
  };
  return {
    change: "model-invented-change",
    review: {
      kind: "semantic-spec-review",
      reviewer: { type: "llm", name: "invented", version: "invented" },
      promptVersion: "openspec-semantic-traceability-bidirectional-v2",
      reviewedAt: "not-a-real-time",
      overall: "findings",
    },
    passingJudgment: judgment,
    proposalStatements: [{
      proposalLine: 7,
      requirementLinkIds: ["resume-job"],
      coverage: "sufficient",
      rationale: "The requirement implements the proposal statement.",
    }],
    capabilities: [{
      path: "job-resume",
      capabilityLine: 13,
      judgment,
      links: [{
        id: "resume-job",
        proposalLines: [7],
        specStartLine: 3,
        judgment,
      }],
    }],
    findings: [],
  };
}

test("runs the complete judge, materialize, validate, and publish workflow", async (t) => {
  const copy = await mutableFixture();
  t.after(copy.cleanup);
  let receivedPrompt;

  const result = await reviewOpenSpecTraceability({
    changeDirectory: copy.changeDirectory,
    model: "test-model",
    judge: async ({ prompt }) => {
      receivedPrompt = prompt;
      return passingJudgment();
    },
  });

  assert.equal(result.attempts, 1);
  assert.match(receivedPrompt, /Immutable source: proposal\.md/);
  assert.match(receivedPrompt, /\s+7 \| - Resume a paused job/);
  const traceability = await loadTraceability(copy.changeDirectory);
  assert.equal(traceability.review.overall, "pass");
  assert.equal(traceability.review.reviewer.name, "codex-cli");
  assert.equal(traceability.review.reviewer.version, "test-model via injected-judge");
  assert.equal(traceability.change, "sample-change");
});

test("feeds an exact deterministic rejection into a bounded repair pass", async (t) => {
  const copy = await mutableFixture();
  t.after(copy.cleanup);
  const attempts = [];

  const result = await reviewOpenSpecTraceability({
    changeDirectory: copy.changeDirectory,
    model: "test-model",
    maxRepairs: 1,
    judge: async ({ attempt, repair }) => {
      attempts.push({ attempt, repair });
      const judgment = passingJudgment();
      if (attempt === 0) judgment.proposalStatements[0].requirementLinkIds = [];
      return judgment;
    },
  });

  assert.equal(result.attempts, 2);
  assert.equal(attempts[0].repair, undefined);
  assert.match(attempts[1].repair.error, /requirementLinks cannot be empty when coverage is sufficient/);
});

test("does not replace an existing sidecar when every candidate is rejected", async (t) => {
  const copy = await mutableFixture();
  t.after(copy.cleanup);
  const sidecarFile = path.join(copy.changeDirectory, "bettaview-traceability.json");
  const original = await readFile(sidecarFile, "utf8");

  await assert.rejects(reviewOpenSpecTraceability({
    changeDirectory: copy.changeDirectory,
    model: "test-model",
    maxRepairs: 0,
    judge: async () => {
      const judgment = passingJudgment();
      judgment.capabilities[0].links[0].specStartLine = 99;
      return judgment;
    },
  }), /Existing sidecar was not changed/);

  assert.equal(await readFile(sidecarFile, "utf8"), original);
});


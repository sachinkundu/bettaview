import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { formatTraceability, loadTraceability } from "../src/traceability.js";

const fixture = fileURLToPath(new URL("fixtures/traceability/sample-change", import.meta.url));
const materializer = fileURLToPath(new URL("../bin/materialize-traceability.js", import.meta.url));
const execFileAsync = promisify(execFile);

async function mutableFixture() {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "bettaview-traceability-"));
  const changeDirectory = path.join(temporaryRoot, "sample-change");
  await cp(fixture, changeDirectory, { recursive: true });
  return {
    changeDirectory,
    cleanup: () => rm(temporaryRoot, { recursive: true, force: true }),
  };
}

async function updateSidecar(changeDirectory, update) {
  const sidecarFile = path.join(changeDirectory, "bettaview-traceability.json");
  const sidecar = JSON.parse(await readFile(sidecarFile, "utf8"));
  update(sidecar);
  await writeFile(sidecarFile, `${JSON.stringify(sidecar, null, 2)}\n`);
}

function addEvidenceBackedFinding(sidecar) {
  sidecar.review.overall = "findings";
  sidecar.findings = [{
    id: "resume-ambiguity",
    type: "ambiguous",
    message: "The proposal does not say what happens when the checkpoint is stale.",
    capability: "job-resume",
    proposalEvidence: structuredClone(sidecar.links[0].proposalEvidence),
    spec: structuredClone(sidecar.links[0].spec),
  }];
}

test("resolves and displays an evidence-backed semantic review", async () => {
  const traceability = await loadTraceability(fixture);

  assert.equal(traceability.version, 3);
  assert.equal(traceability.capabilities[0].path, "job-resume");
  assert.equal(traceability.links[0].proposalEvidence[0].text, "- Resume a paused job from its saved checkpoint.");
  assert.match(traceability.links[0].spec.text, /The system SHALL resume a paused job/);
  assert.equal(traceability.links[0].judgment.coverage, "sufficient");
  assert.equal(traceability.proposalStatements[0].requirementLinks[0], "resume-job");
  assert.match(formatTraceability(traceability), /^semantic review: pass[\s\S]*proposal coverage:[\s\S]*proposal\.md:7-7[\s\S]*↓ supports[\s\S]*findings: 0$/);
});

test("materializes a bidirectional version 3 sidecar from line IDs", async (t) => {
  const copy = await mutableFixture();
  t.after(copy.cleanup);
  const judgmentFile = path.join(path.dirname(copy.changeDirectory), "judgment.json");
  const passingJudgment = {
    coverage: "sufficient",
    scope: "in_scope",
    minimality: "minimal",
    rationale: "The cited proposal behavior is covered without unrelated behavior.",
  };
  await writeFile(judgmentFile, JSON.stringify({
    change: "sample-change",
    review: {
      kind: "semantic-spec-review",
      reviewer: { type: "llm", name: "codex-cli", version: "fixture" },
      promptVersion: "openspec-semantic-traceability-bidirectional-v2",
      reviewedAt: "2026-08-20T12:00:00Z",
      overall: "pass",
    },
    passingJudgment,
    proposalStatements: [{
      proposalLine: 7,
      requirementLinkIds: ["resume-job"],
      coverage: "sufficient",
      rationale: "The resume requirement implements the proposal statement.",
    }],
    capabilities: [{
      path: "job-resume",
      capabilityLine: 13,
      judgment: passingJudgment,
      links: [{
        id: "resume-job",
        proposalLines: [7],
        specStartLine: 3,
        judgment: passingJudgment,
      }],
    }],
    findings: [],
  }, null, 2));

  await execFileAsync(process.execPath, [materializer, copy.changeDirectory, judgmentFile]);
  const traceability = await loadTraceability(copy.changeDirectory);
  assert.equal(traceability.version, 3);
  assert.deepEqual(traceability.proposalStatements[0].requirementLinks, ["resume-job"]);
});

test("continues to read a valid version 2 semantic sidecar", async (t) => {
  const copy = await mutableFixture();
  t.after(copy.cleanup);
  await updateSidecar(copy.changeDirectory, (sidecar) => {
    sidecar.version = 2;
    delete sidecar.proposalStatements;
  });

  const traceability = await loadTraceability(copy.changeDirectory);
  assert.equal(traceability.version, 2);
  assert.equal(traceability.links[0].id, "resume-job");
});

test("continues to read a valid version 1 sidecar", async (t) => {
  const copy = await mutableFixture();
  t.after(copy.cleanup);
  await updateSidecar(copy.changeDirectory, (sidecar) => {
    const link = sidecar.links[0];
    sidecar.version = 1;
    sidecar.links = [{
      id: link.id,
      proposal: {
        file: link.proposalEvidence[0].file,
        startLine: link.proposalEvidence[0].startLine,
        endLine: link.proposalEvidence[0].endLine,
      },
      spec: link.spec,
    }];
    delete sidecar.review;
    delete sidecar.capabilities;
    delete sidecar.findings;
  });

  const traceability = await loadTraceability(copy.changeDirectory);
  assert.equal(traceability.version, 1);
  assert.equal(traceability.links[0].proposal.text, "- Resume a paused job from its saved checkpoint.");
});

test("rejects a missing proposal file", async (t) => {
  const copy = await mutableFixture();
  t.after(copy.cleanup);
  await unlink(path.join(copy.changeDirectory, "proposal.md"));

  await assert.rejects(loadTraceability(copy.changeDirectory), /does not exist: proposal\.md/i);
});

test("rejects a missing spec file", async (t) => {
  const copy = await mutableFixture();
  t.after(copy.cleanup);
  await unlink(path.join(copy.changeDirectory, "specs/job-resume/spec.md"));

  await assert.rejects(loadTraceability(copy.changeDirectory), /does not exist: specs\/job-resume\/spec\.md/i);
});

for (const [description, range, expected] of [
  ["a zero", { startLine: 0, endLine: 1 }, /startLine must be a positive integer/],
  ["a reversed", { startLine: 8, endLine: 3 }, /reversed line range \(8-3\)/],
  ["an out-of-bounds", { startLine: 3, endLine: 99 }, /line range 3-99 is out of bounds/],
]) {
  test(`rejects ${description} line range`, async (t) => {
    const copy = await mutableFixture();
    t.after(copy.cleanup);
    await updateSidecar(copy.changeDirectory, (sidecar) => Object.assign(sidecar.links[0].spec, range));

    await assert.rejects(loadTraceability(copy.changeDirectory), expected);
  });
}

test("rejects a path that escapes the selected change directory", async (t) => {
  const copy = await mutableFixture();
  t.after(copy.cleanup);
  await updateSidecar(copy.changeDirectory, (sidecar) => {
    sidecar.links[0].spec.file = "../../outside.md";
  });

  await assert.rejects(loadTraceability(copy.changeDirectory), /must resolve under specs\//);
});

test("rejects a symlink that escapes the selected change directory", async (t) => {
  const copy = await mutableFixture();
  t.after(copy.cleanup);
  const outsideFile = path.join(path.dirname(copy.changeDirectory), "outside.md");
  await writeFile(outsideFile, "outside\n");
  const linkedFile = path.join(copy.changeDirectory, "specs/job-resume/outside.md");
  const { symlink } = await import("node:fs/promises");
  await symlink(outsideFile, linkedFile);
  await updateSidecar(copy.changeDirectory, (sidecar) => {
    sidecar.links[0].spec.file = "specs/job-resume/outside.md";
    sidecar.links[0].spec.startLine = 1;
    sidecar.links[0].spec.endLine = 1;
  });

  await assert.rejects(loadTraceability(copy.changeDirectory), /escapes the selected change directory/);
});

test("rejects an unsupported sidecar version", async (t) => {
  const copy = await mutableFixture();
  t.after(copy.cleanup);
  await updateSidecar(copy.changeDirectory, (sidecar) => {
    sidecar.version = 4;
  });

  await assert.rejects(loadTraceability(copy.changeDirectory), /Unsupported traceability sidecar version: 4/);
});

test("rejects proposal evidence whose quote does not match its cited lines", async (t) => {
  const copy = await mutableFixture();
  t.after(copy.cleanup);
  await updateSidecar(copy.changeDirectory, (sidecar) => {
    sidecar.links[0].proposalEvidence[0].quote = "A fabricated quotation.";
  });

  await assert.rejects(loadTraceability(copy.changeDirectory), /quote does not exactly match proposal\.md:7-7/);
});

test("rejects an omitted forward proposal coverage record", async (t) => {
  const copy = await mutableFixture();
  t.after(copy.cleanup);
  await updateSidecar(copy.changeDirectory, (sidecar) => {
    sidecar.proposalStatements = [];
  });

  await assert.rejects(loadTraceability(copy.changeDirectory), /proposal\.md:7-7 has no forward coverage record/);
});

test("rejects sufficient proposal coverage without a requirement", async (t) => {
  const copy = await mutableFixture();
  t.after(copy.cleanup);
  await updateSidecar(copy.changeDirectory, (sidecar) => {
    sidecar.proposalStatements[0].requirementLinks = [];
  });

  await assert.rejects(loadTraceability(copy.changeDirectory), /requirementLinks cannot be empty when coverage is sufficient/);
});

test("rejects a spec file with no declared proposal capability", async (t) => {
  const copy = await mutableFixture();
  t.after(copy.cleanup);
  const orphanDirectory = path.join(copy.changeDirectory, "specs/orphan");
  await mkdir(orphanDirectory, { recursive: true });
  await writeFile(path.join(orphanDirectory, "spec.md"), "### Requirement: Orphan behavior\nThe system SHALL do something unproposed.\n");

  await assert.rejects(loadTraceability(copy.changeDirectory), /spec files must exactly match proposal capabilities/);
});

test("resolves evidence attached to a semantic finding", async (t) => {
  const copy = await mutableFixture();
  t.after(copy.cleanup);
  await updateSidecar(copy.changeDirectory, addEvidenceBackedFinding);

  const traceability = await loadTraceability(copy.changeDirectory);
  assert.equal(traceability.findings[0].capability, "job-resume");
  assert.equal(traceability.findings[0].proposalEvidence[0].text, "- Resume a paused job from its saved checkpoint.");
  assert.match(traceability.findings[0].spec.text, /The system SHALL resume a paused job/);
});

test("rejects fabricated proposal evidence attached to a finding", async (t) => {
  const copy = await mutableFixture();
  t.after(copy.cleanup);
  await updateSidecar(copy.changeDirectory, (sidecar) => {
    addEvidenceBackedFinding(sidecar);
    sidecar.findings[0].proposalEvidence[0].quote = "A fabricated finding quotation.";
  });

  await assert.rejects(loadTraceability(copy.changeDirectory), /findings\[0\]\.proposalEvidence\[0\]\.quote does not exactly match proposal\.md:7-7/);
});

test("rejects a finding target that is only part of a spec requirement", async (t) => {
  const copy = await mutableFixture();
  t.after(copy.cleanup);
  await updateSidecar(copy.changeDirectory, (sidecar) => {
    addEvidenceBackedFinding(sidecar);
    sidecar.findings[0].spec.endLine = 7;
  });

  await assert.rejects(loadTraceability(copy.changeDirectory), /findings\[0\]\.spec range 3-7 must identify one complete Requirement block/);
});

test("rejects a stale reviewed document fingerprint", async (t) => {
  const copy = await mutableFixture();
  t.after(copy.cleanup);
  await updateSidecar(copy.changeDirectory, (sidecar) => {
    sidecar.review.documents[0].sha256 = "0".repeat(64);
  });

  await assert.rejects(loadTraceability(copy.changeDirectory), /sha256 does not match the current contents of proposal\.md/);
});

test("rejects a spec link assigned to an undeclared capability", async (t) => {
  const copy = await mutableFixture();
  t.after(copy.cleanup);
  await updateSidecar(copy.changeDirectory, (sidecar) => {
    sidecar.links[0].capability = "another-capability";
  });

  await assert.rejects(loadTraceability(copy.changeDirectory), /does not identify a declared capability/);
});

test("rejects an unsubstantiated semantic judgment", async (t) => {
  const copy = await mutableFixture();
  t.after(copy.cleanup);
  await updateSidecar(copy.changeDirectory, (sidecar) => {
    sidecar.links[0].proposalEvidence = [];
  });

  await assert.rejects(loadTraceability(copy.changeDirectory), /proposalEvidence must contain at least one citation/);
});

test("rejects a target that is only part of a spec requirement", async (t) => {
  const copy = await mutableFixture();
  t.after(copy.cleanup);
  await updateSidecar(copy.changeDirectory, (sidecar) => {
    sidecar.links[0].spec.endLine = 7;
  });

  await assert.rejects(loadTraceability(copy.changeDirectory), /must identify one complete Requirement block/);
});

test("rejects a passing review with an adverse semantic judgment", async (t) => {
  const copy = await mutableFixture();
  t.after(copy.cleanup);
  await updateSidecar(copy.changeDirectory, (sidecar) => {
    sidecar.links[0].judgment.minimality = "over_specified";
  });

  await assert.rejects(loadTraceability(copy.changeDirectory), /cannot be "pass" when a semantic judgment is not fully passing/);
});

test("rejects a sidecar change that does not match its directory", async (t) => {
  const copy = await mutableFixture();
  t.after(copy.cleanup);
  await updateSidecar(copy.changeDirectory, (sidecar) => {
    sidecar.change = "another-change";
  });

  await assert.rejects(loadTraceability(copy.changeDirectory), /does not match directory/);
});

#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  proposalCapabilityDeclarations,
  proposalChangeStatements,
  splitSourceLines,
} from "../src/traceability.js";

const [changeDirectory, judgmentFile, outputFile] = process.argv.slice(2);
if (!changeDirectory || !judgmentFile) {
  throw new Error("usage: materialize-traceability.js <change-directory> <line-id-judgment.json> [output.json]");
}

const judgment = JSON.parse(await readFile(judgmentFile, "utf8"));
const proposalSource = await readFile(path.join(changeDirectory, "proposal.md"), "utf8");
const proposalLines = splitSourceLines(proposalSource);
const digest = (source) => createHash("sha256").update(source).digest("hex");
const proposalEvidence = (lineNumbers, label) => lineNumbers.map((line) => {
  if (!Number.isInteger(line) || line < 1 || line > proposalLines.length) {
    throw new Error(`${label} contains invalid proposal line ${JSON.stringify(line)}`);
  }
  return {
    file: "proposal.md",
    startLine: line,
    endLine: line,
    quote: proposalLines[line - 1],
  };
});
const proposalRangeEvidence = (range) => ({
  file: "proposal.md",
  startLine: range.startLine,
  endLine: range.endLine,
  quote: proposalLines.slice(range.startLine - 1, range.endLine).join("\n"),
});

const declaredCapabilities = proposalCapabilityDeclarations(proposalLines);
if (declaredCapabilities.length === 0) throw new Error("proposal.md has no capability declarations under ## Capabilities");
const declarationByPath = new Map(declaredCapabilities.map((entry) => [entry.path, entry]));
const judgedPaths = judgment.capabilities.map((entry) => entry.path).sort();
const declaredPaths = declaredCapabilities.map((entry) => entry.path).sort();
if (JSON.stringify(judgedPaths) !== JSON.stringify(declaredPaths)) {
  throw new Error(`Judged capabilities do not exactly match proposal declarations (declared: ${declaredPaths.join(", ")}; judged: ${judgedPaths.join(", ")})`);
}

const documents = [{ file: "proposal.md", sha256: digest(proposalSource) }];
const capabilities = [];
const links = [];
const specByCapability = new Map();

for (const capability of judgment.capabilities) {
  const declaration = declarationByPath.get(capability.path);
  if (capability.capabilityLine !== declaration.startLine) {
    throw new Error(`Capability ${capability.path} must cite proposal line ${declaration.startLine}`);
  }
  const specFile = `specs/${capability.path}/spec.md`;
  const specSource = await readFile(path.join(changeDirectory, specFile), "utf8");
  const specLines = specSource.replace(/\r\n?/g, "\n").replace(/\n$/, "").split("\n");
  const starts = specLines.flatMap((line, index) => (/^### Requirement: \S/.test(line) ? [index + 1] : []));
  const blocks = starts.map((startLine) => {
    let endLine = specLines.length;
    for (let line = startLine + 1; line <= specLines.length; line += 1) {
      if (/^#{2,3} \S/.test(specLines[line - 1])) {
        endLine = line - 1;
        break;
      }
    }
    while (endLine > startLine && specLines[endLine - 1].trim() === "") endLine -= 1;
    return { startLine, endLine };
  });

  specByCapability.set(capability.path, { file: specFile, blocks });
  documents.push({ file: specFile, sha256: digest(specSource) });
  capabilities.push({
    path: capability.path,
    proposal: proposalEvidence([capability.capabilityLine], `capability ${capability.path}`)[0],
    specFile,
    judgment: capability.judgment || judgment.passingJudgment,
  });

  for (const link of capability.links) {
    const block = blocks.find((candidate) => candidate.startLine === link.specStartLine);
    if (!block) throw new Error(`No Requirement starts at ${specFile}:${link.specStartLine}`);
    links.push({
      id: link.id,
      capability: capability.path,
      relationship: "supports",
      proposalEvidence: proposalEvidence(link.proposalLines, `link ${link.id}`),
      spec: { file: specFile, startLine: block.startLine, endLine: block.endLine },
      judgment: link.judgment || judgment.passingJudgment,
    });
  }
}

const linkIds = new Set(links.map((link) => link.id));
const parsedStatements = proposalChangeStatements(proposalLines);
let proposalStatements = [];
if (judgment.proposalStatements !== undefined) {
  if (!Array.isArray(judgment.proposalStatements)) throw new Error("Judgment proposalStatements must be an array");
  if (parsedStatements.length === 0) throw new Error("proposal.md has no list statements under ## What Changes");
  const parsedByLine = new Map(parsedStatements.map((statement) => [statement.startLine, statement]));
  const judgedStatementLines = new Set();
  proposalStatements = judgment.proposalStatements.map((statement) => {
    const parsed = parsedByLine.get(statement.proposalLine);
    if (!parsed) throw new Error(`No ## What Changes statement starts at proposal.md:${statement.proposalLine}`);
    if (judgedStatementLines.has(statement.proposalLine)) throw new Error(`Duplicate proposal statement line ${statement.proposalLine}`);
    judgedStatementLines.add(statement.proposalLine);
    if (!Array.isArray(statement.requirementLinkIds)) throw new Error(`Proposal statement ${statement.proposalLine} must include requirementLinkIds`);
    for (const linkId of statement.requirementLinkIds) {
      if (!linkIds.has(linkId)) throw new Error(`Proposal statement ${statement.proposalLine} references unknown link ${linkId}`);
    }
    return {
      id: parsed.id,
      proposal: proposalRangeEvidence(parsed),
      requirementLinks: statement.requirementLinkIds,
      coverage: statement.coverage,
      rationale: statement.rationale,
    };
  });
  for (const parsed of parsedStatements) {
    if (!judgedStatementLines.has(parsed.startLine)) {
      throw new Error(`Proposal statement at proposal.md:${parsed.startLine}-${parsed.endLine} has no judgment`);
    }
  }
}

const findings = judgment.findings.map((finding) => {
  const spec = specByCapability.get(finding.capability);
  if (!spec) throw new Error(`Finding ${finding.id} names unknown capability ${finding.capability}`);
  const block = spec.blocks.find((candidate) => candidate.startLine === finding.specStartLine);
  if (!block) throw new Error(`No Requirement starts at ${spec.file}:${finding.specStartLine}`);
  return {
    id: finding.id,
    type: finding.type,
    message: finding.message,
    capability: finding.capability,
    proposalEvidence: proposalEvidence(finding.proposalLines, `finding ${finding.id}`),
    spec: { file: spec.file, startLine: block.startLine, endLine: block.endLine },
    ...(finding.source ? { source: finding.source } : {}),
  };
});

const sidecar = {
  version: judgment.proposalStatements === undefined ? 2 : 3,
  change: judgment.change,
  review: { ...judgment.review, documents },
  capabilities,
  links,
  ...(judgment.proposalStatements === undefined ? {} : { proposalStatements }),
  findings,
};
const destination = outputFile || path.join(changeDirectory, "bettaview-traceability.json");
await writeFile(destination, `${JSON.stringify(sidecar, null, 2)}\n`);
console.log(`materialized ${links.length} links and ${findings.length} findings to ${destination}`);

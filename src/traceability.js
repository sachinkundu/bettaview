import { createHash } from "node:crypto";
import { readFile, readdir, realpath } from "node:fs/promises";
import path from "node:path";

const SIDECAR_NAME = "bettaview-traceability.json";
const JUDGMENT_VALUES = {
  coverage: new Set(["sufficient", "partial", "missing"]),
  scope: new Set(["in_scope", "mixed", "out_of_scope"]),
  minimality: new Set(["minimal", "over_specified", "uncertain"]),
};

function fail(message) {
  throw new Error(message);
}

function assertPlainObject(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail(`${label} must be an object.`);
  }
}

function assertNonEmptyString(value, label) {
  if (typeof value !== "string" || value.trim().length === 0) {
    fail(`${label} must be a non-empty string.`);
  }
}

function assertInsideChange(changeDirectory, candidate, label) {
  const relative = path.relative(changeDirectory, candidate);
  if (relative === "" || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    fail(`${label} escapes the selected change directory.`);
  }
}

function validateDocumentPath(file, label, kind) {
  assertNonEmptyString(file, label);
  if (path.isAbsolute(file)) fail(`${label} must be relative to the selected change directory.`);

  const normalized = path.normalize(file);
  if (kind === "proposal" && normalized !== "proposal.md") {
    fail(`${label} must resolve to proposal.md.`);
  }
  if (kind === "spec" && (normalized === "specs" || !normalized.startsWith(`specs${path.sep}`))) {
    fail(`${label} must resolve under specs/.`);
  }
}

function validateEndpointShape(endpoint, label, kind) {
  assertPlainObject(endpoint, label);
  validateDocumentPath(endpoint.file, `${label}.file`, kind);

  for (const field of ["startLine", "endLine"]) {
    if (!Number.isInteger(endpoint[field]) || endpoint[field] < 1) {
      fail(`${label}.${field} must be a positive integer.`);
    }
  }
  if (endpoint.startLine > endpoint.endLine) {
    fail(`${label} has a reversed line range (${endpoint.startLine}-${endpoint.endLine}).`);
  }
}

export function splitSourceLines(source) {
  if (source.length === 0) return [];
  const lines = source.split(/\r\n|\n|\r/);
  if (/\r\n$|\n$|\r$/.test(source)) lines.pop();
  return lines;
}

function sha256(source) {
  return createHash("sha256").update(source).digest("hex");
}

async function resolveDocument(changeDirectory, file, label, kind) {
  validateDocumentPath(file, label, kind);
  const absoluteFile = path.resolve(changeDirectory, file);
  assertInsideChange(changeDirectory, absoluteFile, label);

  let canonicalFile;
  try {
    canonicalFile = await realpath(absoluteFile);
  } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "ENOTDIR") fail(`${label} does not exist: ${file}`);
    throw error;
  }
  assertInsideChange(changeDirectory, canonicalFile, label);

  let source;
  try {
    source = await readFile(canonicalFile, "utf8");
  } catch (error) {
    fail(`${label} could not be read: ${file} (${error.message})`);
  }

  return { file, source, lines: splitSourceLines(source), sha256: sha256(source) };
}

async function resolveEndpoint(changeDirectory, endpoint, label, kind, { requireQuote = false } = {}) {
  validateEndpointShape(endpoint, label, kind);
  const document = await resolveDocument(changeDirectory, endpoint.file, `${label}.file`, kind);

  if (endpoint.endLine > document.lines.length) {
    fail(`${label} line range ${endpoint.startLine}-${endpoint.endLine} is out of bounds for ${endpoint.file} (${document.lines.length} lines).`);
  }

  const text = document.lines.slice(endpoint.startLine - 1, endpoint.endLine).join("\n");
  if (requireQuote) {
    assertNonEmptyString(endpoint.quote, `${label}.quote`);
    if (endpoint.quote !== text) {
      fail(`${label}.quote does not exactly match ${endpoint.file}:${endpoint.startLine}-${endpoint.endLine}.`);
    }
  }

  return { ...endpoint, text, sha256: document.sha256 };
}

function validateJudgment(judgment, label) {
  assertPlainObject(judgment, label);
  for (const [field, allowed] of Object.entries(JUDGMENT_VALUES)) {
    if (!allowed.has(judgment[field])) {
      fail(`${label}.${field} must be one of: ${[...allowed].join(", ")}.`);
    }
  }
  assertNonEmptyString(judgment.rationale, `${label}.rationale`);
}

function isPassingJudgment(judgment) {
  return judgment.coverage === "sufficient"
    && judgment.scope === "in_scope"
    && judgment.minimality === "minimal";
}

function validateReviewer(review) {
  assertPlainObject(review, "review");
  if (review.kind !== "semantic-spec-review") fail('review.kind must be "semantic-spec-review".');
  assertNonEmptyString(review.promptVersion, "review.promptVersion");
  assertNonEmptyString(review.reviewedAt, "review.reviewedAt");
  if (Number.isNaN(Date.parse(review.reviewedAt))) fail("review.reviewedAt must be an ISO-8601 timestamp.");
  if (!new Set(["pass", "findings"]).has(review.overall)) fail('review.overall must be "pass" or "findings".');

  assertPlainObject(review.reviewer, "review.reviewer");
  if (review.reviewer.type !== "llm") fail('review.reviewer.type must be "llm".');
  assertNonEmptyString(review.reviewer.name, "review.reviewer.name");
  assertNonEmptyString(review.reviewer.version, "review.reviewer.version");

  if (!Array.isArray(review.documents) || review.documents.length === 0) {
    fail("review.documents must be a non-empty array.");
  }
}

async function loadSnapshots(changeDirectory, documents) {
  const snapshots = new Map();
  for (const [index, entry] of documents.entries()) {
    const label = `review.documents[${index}]`;
    assertPlainObject(entry, label);
    const kind = entry.file === "proposal.md" ? "proposal" : "spec";
    const document = await resolveDocument(changeDirectory, entry.file, `${label}.file`, kind);
    if (!/^[a-f0-9]{64}$/.test(entry.sha256 || "")) fail(`${label}.sha256 must be a lowercase SHA-256 digest.`);
    if (entry.sha256 !== document.sha256) fail(`${label}.sha256 does not match the current contents of ${entry.file}.`);
    if (snapshots.has(entry.file)) fail(`${label}.file duplicates snapshot ${entry.file}.`);
    snapshots.set(entry.file, document);
  }
  return snapshots;
}

function assertSnapshotted(endpoint, snapshots, label) {
  if (!snapshots.has(endpoint.file)) fail(`${label}.file is not pinned in review.documents: ${endpoint.file}.`);
  if (snapshots.get(endpoint.file).sha256 !== endpoint.sha256) fail(`${label}.file changed after its review snapshot was resolved.`);
}

function requirementBlocks(lines) {
  const starts = lines.flatMap((line, index) => (
    /^### Requirement: \S/.test(line) ? [index + 1] : []
  ));
  return starts.map((startLine) => {
    let endLine = lines.length;
    for (let line = startLine + 1; line <= lines.length; line += 1) {
      if (/^#{2,3} \S/.test(lines[line - 1])) {
        endLine = line - 1;
        break;
      }
    }
    while (endLine > startLine && lines[endLine - 1].trim() === "") endLine -= 1;
    return { startLine, endLine };
  });
}

function sectionRange(lines, heading) {
  const startIndex = lines.findIndex((line) => line.trim() === heading);
  if (startIndex === -1) return undefined;
  let endIndex = lines.length;
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    if (/^## \S/.test(lines[index])) {
      endIndex = index;
      break;
    }
  }
  return { startIndex, endIndex };
}

export function proposalChangeStatements(lines) {
  const section = sectionRange(lines, "## What Changes");
  if (!section) return [];
  const starts = [];
  for (let index = section.startIndex + 1; index < section.endIndex; index += 1) {
    if (/^[-*+] \S/.test(lines[index])) starts.push(index);
  }
  return starts.map((startIndex, statementIndex) => {
    const nextStart = starts[statementIndex + 1] ?? section.endIndex;
    let endIndex = nextStart - 1;
    while (endIndex > startIndex && lines[endIndex].trim() === "") endIndex -= 1;
    const startLine = startIndex + 1;
    return {
      id: `proposal-statement-${startLine}`,
      startLine,
      endLine: endIndex + 1,
    };
  });
}

export function proposalCapabilityDeclarations(lines) {
  const section = sectionRange(lines, "## Capabilities");
  if (!section) return [];
  const declarations = [];
  for (let index = section.startIndex + 1; index < section.endIndex; index += 1) {
    const match = lines[index].match(/^- `([a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*)`:/);
    if (match) declarations.push({ path: match[1], startLine: index + 1, endLine: index + 1 });
  }
  return declarations;
}

async function listSpecFiles(changeDirectory) {
  const specsDirectory = path.join(changeDirectory, "specs");
  const files = [];
  async function visit(directory) {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (error?.code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries) {
      const candidate = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(candidate);
      if (entry.isFile() && entry.name === "spec.md") {
        files.push(path.relative(changeDirectory, candidate));
      }
    }
  }
  await visit(specsDirectory);
  return files.sort();
}

async function loadVersion1(changeDirectory, sidecar) {
  const links = [];
  for (const [index, link] of sidecar.links.entries()) {
    const label = `links[${index}]`;
    assertPlainObject(link, label);
    assertNonEmptyString(link.id, `${label}.id`);
    const proposal = await resolveEndpoint(changeDirectory, link.proposal, `${label}.proposal`, "proposal");
    const spec = await resolveEndpoint(changeDirectory, link.spec, `${label}.spec`, "spec");
    links.push({ id: link.id, proposal, spec });
  }
  return { version: 1, change: sidecar.change, links };
}

async function loadSemanticVersion(changeDirectory, sidecar) {
  validateReviewer(sidecar.review);
  const snapshots = await loadSnapshots(changeDirectory, sidecar.review.documents);

  if (!Array.isArray(sidecar.capabilities) || sidecar.capabilities.length === 0) {
    fail("capabilities must be a non-empty array.");
  }
  const capabilities = [];
  const capabilityByPath = new Map();
  for (const [index, capability] of sidecar.capabilities.entries()) {
    const label = `capabilities[${index}]`;
    assertPlainObject(capability, label);
    assertNonEmptyString(capability.path, `${label}.path`);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/.test(capability.path)) {
      fail(`${label}.path must be a kebab-case capability path.`);
    }
    if (capabilityByPath.has(capability.path)) fail(`${label}.path duplicates capability ${capability.path}.`);

    const proposal = await resolveEndpoint(changeDirectory, capability.proposal, `${label}.proposal`, "proposal", { requireQuote: true });
    assertSnapshotted(proposal, snapshots, `${label}.proposal`);
    if (!proposal.text.startsWith(`- \`${capability.path}\`:`)) {
      fail(`${label}.proposal must cite the ${capability.path} capability declaration.`);
    }
    const expectedSpecFile = `specs/${capability.path}/spec.md`;
    if (capability.specFile !== expectedSpecFile) fail(`${label}.specFile must be ${expectedSpecFile}.`);
    if (!snapshots.has(capability.specFile)) fail(`${label}.specFile is not pinned in review.documents: ${capability.specFile}.`);
    validateJudgment(capability.judgment, `${label}.judgment`);

    const resolved = { ...capability, proposal };
    capabilities.push(resolved);
    capabilityByPath.set(capability.path, resolved);
  }

  if (sidecar.version === 3) {
    const proposal = snapshots.get("proposal.md");
    if (!proposal) fail("Version 3 review.documents must pin proposal.md.");
    const declarations = proposalCapabilityDeclarations(proposal.lines);
    if (declarations.length === 0) fail("proposal.md has no capability declarations under ## Capabilities.");
    const declaredPaths = declarations.map((entry) => entry.path).sort();
    const reviewedPaths = capabilities.map((entry) => entry.path).sort();
    if (JSON.stringify(declaredPaths) !== JSON.stringify(reviewedPaths)) {
      fail(`Version 3 capabilities must exactly match proposal declarations (declared: ${declaredPaths.join(", ")}; reviewed: ${reviewedPaths.join(", ")}).`);
    }
    const expectedSpecFiles = declarations.map((entry) => `specs/${entry.path}/spec.md`).sort();
    const actualSpecFiles = await listSpecFiles(changeDirectory);
    if (JSON.stringify(expectedSpecFiles) !== JSON.stringify(actualSpecFiles)) {
      fail(`Version 3 spec files must exactly match proposal capabilities (expected: ${expectedSpecFiles.join(", ")}; found: ${actualSpecFiles.join(", ")}).`);
    }
  }

  if (!Array.isArray(sidecar.links) || sidecar.links.length === 0) fail("Sidecar links must be a non-empty array.");
  const linkIds = new Set();
  const links = [];
  for (const [index, link] of sidecar.links.entries()) {
    const label = `links[${index}]`;
    assertPlainObject(link, label);
    assertNonEmptyString(link.id, `${label}.id`);
    if (linkIds.has(link.id)) fail(`${label}.id duplicates link ${link.id}.`);
    linkIds.add(link.id);

    const capability = capabilityByPath.get(link.capability);
    if (!capability) fail(`${label}.capability does not identify a declared capability: ${JSON.stringify(link.capability)}.`);
    if (link.relationship !== "supports") fail(`${label}.relationship must be "supports".`);
    validateJudgment(link.judgment, `${label}.judgment`);
    if (!Array.isArray(link.proposalEvidence) || link.proposalEvidence.length === 0) {
      fail(`${label}.proposalEvidence must contain at least one citation.`);
    }

    const proposalEvidence = [];
    for (const [evidenceIndex, evidence] of link.proposalEvidence.entries()) {
      const evidenceLabel = `${label}.proposalEvidence[${evidenceIndex}]`;
      const resolved = await resolveEndpoint(changeDirectory, evidence, evidenceLabel, "proposal", { requireQuote: true });
      assertSnapshotted(resolved, snapshots, evidenceLabel);
      proposalEvidence.push(resolved);
    }

    const spec = await resolveEndpoint(changeDirectory, link.spec, `${label}.spec`, "spec");
    assertSnapshotted(spec, snapshots, `${label}.spec`);
    if (spec.file !== capability.specFile) fail(`${label}.spec.file must match capability ${link.capability}: ${capability.specFile}.`);
    links.push({ ...link, proposalEvidence, spec });
  }

  for (const capability of capabilities) {
    const blocks = requirementBlocks(snapshots.get(capability.specFile).lines);
    if (blocks.length === 0) fail(`Capability ${capability.path} spec has no Requirement blocks.`);
    const targetCounts = new Map();
    for (const link of links.filter((candidate) => candidate.capability === capability.path)) {
      const matchingBlock = blocks.find((block) => (
        block.startLine === link.spec.startLine && block.endLine === link.spec.endLine
      ));
      if (!matchingBlock) {
        fail(`Link ${link.id} spec range ${link.spec.startLine}-${link.spec.endLine} must identify one complete Requirement block in ${capability.specFile}.`);
      }
      const key = `${matchingBlock.startLine}-${matchingBlock.endLine}`;
      targetCounts.set(key, (targetCounts.get(key) || 0) + 1);
    }
    for (const block of blocks) {
      const key = `${block.startLine}-${block.endLine}`;
      const count = targetCounts.get(key) || 0;
      if (count === 0) fail(`Requirement ${capability.specFile}:${key} has no semantic review link.`);
      if (count > 1) fail(`Requirement ${capability.specFile}:${key} has ${count} semantic review links; expected exactly one.`);
    }
  }

  let proposalStatements = [];
  if (sidecar.version === 3) {
    const proposalDocument = snapshots.get("proposal.md");
    const expectedStatements = proposalChangeStatements(proposalDocument.lines);
    if (expectedStatements.length === 0) fail("proposal.md has no list statements under ## What Changes.");
    if (!Array.isArray(sidecar.proposalStatements)) fail("proposalStatements must be an array in version 3.");

    const linkById = new Map(links.map((link) => [link.id, link]));
    const expectedById = new Map(expectedStatements.map((statement) => [statement.id, statement]));
    const statementById = new Map();
    proposalStatements = [];
    for (const [index, statement] of sidecar.proposalStatements.entries()) {
      const label = `proposalStatements[${index}]`;
      assertPlainObject(statement, label);
      assertNonEmptyString(statement.id, `${label}.id`);
      if (statementById.has(statement.id)) fail(`${label}.id duplicates proposal statement ${statement.id}.`);
      const expected = expectedById.get(statement.id);
      if (!expected) fail(`${label}.id does not identify a parsed ## What Changes statement: ${statement.id}.`);
      const proposal = await resolveEndpoint(changeDirectory, statement.proposal, `${label}.proposal`, "proposal", { requireQuote: true });
      assertSnapshotted(proposal, snapshots, `${label}.proposal`);
      if (proposal.startLine !== expected.startLine || proposal.endLine !== expected.endLine) {
        fail(`${label}.proposal must identify the complete parsed statement at proposal.md:${expected.startLine}-${expected.endLine}.`);
      }
      if (!new Set(["sufficient", "partial", "missing"]).has(statement.coverage)) {
        fail(`${label}.coverage must be one of: sufficient, partial, missing.`);
      }
      assertNonEmptyString(statement.rationale, `${label}.rationale`);
      if (!Array.isArray(statement.requirementLinks)) fail(`${label}.requirementLinks must be an array.`);
      if (statement.coverage === "sufficient" && statement.requirementLinks.length === 0) {
        fail(`${label}.requirementLinks cannot be empty when coverage is sufficient.`);
      }
      if (statement.coverage === "partial" && statement.requirementLinks.length === 0) {
        fail(`${label}.requirementLinks cannot be empty when coverage is partial.`);
      }
      if (statement.coverage === "missing" && statement.requirementLinks.length > 0) {
        fail(`${label}.requirementLinks must be empty when coverage is missing.`);
      }
      const targetIds = new Set();
      for (const [targetIndex, linkId] of statement.requirementLinks.entries()) {
        assertNonEmptyString(linkId, `${label}.requirementLinks[${targetIndex}]`);
        if (targetIds.has(linkId)) fail(`${label}.requirementLinks duplicates link ${linkId}.`);
        targetIds.add(linkId);
        const link = linkById.get(linkId);
        if (!link) fail(`${label}.requirementLinks references unknown link ${linkId}.`);
        const citesStatement = link.proposalEvidence.some((evidence) => (
          evidence.startLine >= expected.startLine && evidence.endLine <= expected.endLine
        ));
        if (!citesStatement) fail(`${label}.requirementLinks references ${linkId}, but that link does not cite this proposal statement.`);
      }
      const resolved = { ...statement, proposal };
      proposalStatements.push(resolved);
      statementById.set(statement.id, resolved);
    }
    for (const expected of expectedStatements) {
      if (!statementById.has(expected.id)) fail(`Proposal statement proposal.md:${expected.startLine}-${expected.endLine} has no forward coverage record.`);
    }
    for (const link of links) {
      const citedStatements = expectedStatements.filter((statement) => link.proposalEvidence.some((evidence) => (
        evidence.startLine >= statement.startLine && evidence.endLine <= statement.endLine
      )));
      for (const statement of citedStatements) {
        if (!statementById.get(statement.id).requirementLinks.includes(link.id)) {
          fail(`Link ${link.id} cites ${statement.id}, but the proposal statement does not map forward to that link.`);
        }
      }
    }
  }

  if (!Array.isArray(sidecar.findings)) fail("findings must be an array.");
  const findingIds = new Set();
  const findings = [];
  for (const [index, finding] of sidecar.findings.entries()) {
    const label = `findings[${index}]`;
    assertPlainObject(finding, label);
    assertNonEmptyString(finding.id, `${label}.id`);
    if (findingIds.has(finding.id)) fail(`${label}.id duplicates finding ${finding.id}.`);
    findingIds.add(finding.id);
    if (!new Set(["missing_coverage", "unsupported_requirement", "over_specified", "ambiguous"]).has(finding.type)) {
      fail(`${label}.type is unsupported.`);
    }
    assertNonEmptyString(finding.message, `${label}.message`);

    const capability = capabilityByPath.get(finding.capability);
    if (!capability) fail(`${label}.capability does not identify a declared capability: ${JSON.stringify(finding.capability)}.`);
    if (!Array.isArray(finding.proposalEvidence) || finding.proposalEvidence.length === 0) {
      fail(`${label}.proposalEvidence must contain at least one citation.`);
    }

    const proposalEvidence = [];
    for (const [evidenceIndex, evidence] of finding.proposalEvidence.entries()) {
      const evidenceLabel = `${label}.proposalEvidence[${evidenceIndex}]`;
      const resolved = await resolveEndpoint(changeDirectory, evidence, evidenceLabel, "proposal", { requireQuote: true });
      assertSnapshotted(resolved, snapshots, evidenceLabel);
      proposalEvidence.push(resolved);
    }

    const spec = await resolveEndpoint(changeDirectory, finding.spec, `${label}.spec`, "spec");
    assertSnapshotted(spec, snapshots, `${label}.spec`);
    if (spec.file !== capability.specFile) fail(`${label}.spec.file must match capability ${finding.capability}: ${capability.specFile}.`);
    const matchingBlock = requirementBlocks(snapshots.get(capability.specFile).lines).find((block) => (
      block.startLine === spec.startLine && block.endLine === spec.endLine
    ));
    if (!matchingBlock) {
      fail(`${label}.spec range ${spec.startLine}-${spec.endLine} must identify one complete Requirement block in ${capability.specFile}.`);
    }
    findings.push({ ...finding, proposalEvidence, spec });
  }
  if (sidecar.review.overall === "pass" && findings.length > 0) {
    fail('review.overall cannot be "pass" when findings are present.');
  }
  const judgments = [
    ...capabilities.map((capability) => capability.judgment),
    ...links.map((link) => link.judgment),
  ];
  if (sidecar.review.overall === "pass" && judgments.some((judgment) => !isPassingJudgment(judgment))) {
    fail('review.overall cannot be "pass" when a semantic judgment is not fully passing.');
  }
  if (sidecar.review.overall === "pass" && proposalStatements.some((statement) => statement.coverage !== "sufficient")) {
    fail('review.overall cannot be "pass" when a proposal statement is not sufficiently covered.');
  }
  const hasAdverseJudgment = judgments.some((judgment) => !isPassingJudgment(judgment))
    || proposalStatements.some((statement) => statement.coverage !== "sufficient");
  if (sidecar.review.overall === "findings" && findings.length === 0 && !hasAdverseJudgment) {
    fail('review.overall cannot be "findings" when findings is empty.');
  }

  return {
    version: sidecar.version,
    change: sidecar.change,
    review: sidecar.review,
    capabilities,
    links,
    proposalStatements,
    findings,
  };
}

export async function loadTraceability(changeDirectoryArgument, sidecarFileArgument) {
  if (typeof changeDirectoryArgument !== "string" || changeDirectoryArgument.length === 0) {
    fail("An OpenSpec change directory is required.");
  }

  let changeDirectory;
  try {
    changeDirectory = await realpath(path.resolve(changeDirectoryArgument));
  } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "ENOTDIR") fail(`Change directory does not exist: ${changeDirectoryArgument}`);
    throw error;
  }

  const sidecarFile = sidecarFileArgument
    ? path.resolve(sidecarFileArgument)
    : path.join(changeDirectory, SIDECAR_NAME);
  let rawSidecar;
  try {
    rawSidecar = await readFile(sidecarFile, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") fail(`Missing ${SIDECAR_NAME} in ${changeDirectoryArgument}.`);
    throw error;
  }

  let sidecar;
  try {
    sidecar = JSON.parse(rawSidecar);
  } catch (error) {
    fail(`Invalid JSON in ${SIDECAR_NAME}: ${error.message}`);
  }

  assertPlainObject(sidecar, SIDECAR_NAME);
  if (![1, 2, 3].includes(sidecar.version)) {
    fail(`Unsupported traceability sidecar version: ${JSON.stringify(sidecar.version)} (expected 1, 2, or 3).`);
  }

  const expectedChange = path.basename(changeDirectory);
  if (sidecar.change !== expectedChange) {
    fail(`Sidecar change ${JSON.stringify(sidecar.change)} does not match directory ${JSON.stringify(expectedChange)}.`);
  }
  if (!Array.isArray(sidecar.links) || sidecar.links.length === 0) fail("Sidecar links must be a non-empty array.");

  return sidecar.version === 1
    ? loadVersion1(changeDirectory, sidecar)
    : loadSemanticVersion(changeDirectory, sidecar);
}

function location(endpoint) {
  return `${endpoint.file}:${endpoint.startLine}-${endpoint.endLine}`;
}

function formatVersion1(link) {
  return [
    `[${link.id}]`,
    location(link.proposal),
    link.proposal.text,
    "  ↓ leads to",
    location(link.spec),
    link.spec.text,
  ].join("\n");
}

function formatVersion2(link) {
  const evidence = link.proposalEvidence.flatMap((proposal) => [location(proposal), proposal.text]);
  return [
    `[${link.id}] capability=${link.capability}`,
    `judgment coverage=${link.judgment.coverage} scope=${link.judgment.scope} minimality=${link.judgment.minimality}`,
    ...evidence,
    `  ↓ ${link.relationship}`,
    location(link.spec),
    link.spec.text,
    `rationale: ${link.judgment.rationale}`,
  ].join("\n");
}

export function formatTraceability(traceability) {
  const formattedLinks = traceability.links.map((link) => (
    traceability.version === 1 ? formatVersion1(link) : formatVersion2(link)
  ));
  if (traceability.version === 1) return formattedLinks.join("\n\n");

  const proposalCoverage = traceability.version === 3
    ? [
      "proposal coverage:",
      ...traceability.proposalStatements.flatMap((statement) => [
        `[${statement.id}] coverage=${statement.coverage} links=${statement.requirementLinks.join(",") || "none"}`,
        location(statement.proposal),
        statement.proposal.text,
        `rationale: ${statement.rationale}`,
      ]),
      "",
    ]
    : [];
  return [
    `semantic review: ${traceability.review.overall}`,
    `reviewer: ${traceability.review.reviewer.name} (${traceability.review.reviewer.version})`,
    `prompt: ${traceability.review.promptVersion}`,
    "",
    ...proposalCoverage,
    formattedLinks.join("\n\n"),
    "",
    `findings: ${traceability.findings.length}`,
  ].join("\n");
}

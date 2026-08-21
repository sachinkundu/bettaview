import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import {
  copyFile,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  loadTraceability,
  proposalCapabilityDeclarations,
  splitSourceLines,
} from "./traceability.js";

const PROMPT_VERSION = "openspec-semantic-traceability-bidirectional-v2";
const promptFile = fileURLToPath(new URL(`../prompts/${PROMPT_VERSION}.md`, import.meta.url));
const schemaFile = fileURLToPath(new URL(`../prompts/${PROMPT_VERSION}.schema.json`, import.meta.url));
const materializerFile = fileURLToPath(new URL("../bin/materialize-traceability.js", import.meta.url));

function sha256(source) {
  return createHash("sha256").update(source).digest("hex");
}

function numberedSource(source) {
  return splitSourceLines(source)
    .map((line, index) => `${String(index + 1).padStart(5, " ")} | ${line}`)
    .join("\n");
}

async function listSpecFiles(changeDirectory) {
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
  await visit(path.join(changeDirectory, "specs"));
  return files.sort();
}

export async function inventoryOpenSpecChange(changeDirectoryArgument) {
  const changeDirectory = await realpath(path.resolve(changeDirectoryArgument));
  const proposalSource = await readFile(path.join(changeDirectory, "proposal.md"), "utf8");
  const capabilities = proposalCapabilityDeclarations(splitSourceLines(proposalSource));
  if (capabilities.length === 0) {
    throw new Error("proposal.md has no capability declarations under ## Capabilities");
  }

  const expectedSpecFiles = capabilities.map(({ path: capabilityPath }) => (
    `specs/${capabilityPath}/spec.md`
  )).sort();
  const actualSpecFiles = await listSpecFiles(changeDirectory);
  if (JSON.stringify(actualSpecFiles) !== JSON.stringify(expectedSpecFiles)) {
    throw new Error(`Spec files do not exactly match proposal capabilities (expected: ${expectedSpecFiles.join(", ")}; found: ${actualSpecFiles.join(", ")})`);
  }

  const documents = [{
    file: "proposal.md",
    source: proposalSource,
    sha256: sha256(proposalSource),
  }];
  for (const file of expectedSpecFiles) {
    const source = await readFile(path.join(changeDirectory, file), "utf8");
    if (!splitSourceLines(source).some((line) => /^### Requirement: \S/.test(line))) {
      throw new Error(`${file} has no Requirement blocks`);
    }
    documents.push({ file, source, sha256: sha256(source) });
  }

  return {
    changeDirectory,
    change: path.basename(changeDirectory),
    documents,
  };
}

export function buildJudgePrompt({ inventory, instructions, reviewerVersion, reviewedAt, repair }) {
  const hostValues = [
    "## Host-supplied values",
    "",
    `- change: ${JSON.stringify(inventory.change)}`,
    "- review.kind: \"semantic-spec-review\"",
    "- review.reviewer.type: \"llm\"",
    "- review.reviewer.name: \"codex-cli\"",
    `- review.reviewer.version: ${JSON.stringify(reviewerVersion)}`,
    `- review.promptVersion: ${JSON.stringify(PROMPT_VERSION)}`,
    `- review.reviewedAt: ${JSON.stringify(reviewedAt)}`,
    "",
    "Use these exact host values in the structured response. The host will overwrite them before acceptance.",
  ];
  const repairContext = repair ? [
    "",
    "## Deterministic rejection to repair",
    "",
    "The previous candidate was rejected by the materializer or validator. Correct the line-ID judgment using the exact error and sources below. Do not weaken or reinterpret the validator.",
    "",
    `Error: ${repair.error}`,
    "",
    "Previous candidate:",
    JSON.stringify(repair.judgment, null, 2),
  ] : [];
  const sources = inventory.documents.flatMap((document) => [
    "",
    `## Immutable source: ${document.file}`,
    "",
    `SHA-256: ${document.sha256}`,
    "",
    numberedSource(document.source),
  ]);
  return [instructions.trim(), "", ...hostValues, ...repairContext, ...sources, ""].join("\n");
}

function isPassingJudgment(judgment) {
  return judgment?.coverage === "sufficient"
    && judgment?.scope === "in_scope"
    && judgment?.minimality === "minimal";
}

export function normalizeJudgment(judgment, { change, reviewerVersion, reviewedAt }) {
  if (judgment === null || typeof judgment !== "object" || Array.isArray(judgment)) {
    throw new Error("Codex did not return a JSON object");
  }
  const normalized = structuredClone(judgment);
  normalized.change = change;
  const capabilities = Array.isArray(normalized.capabilities) ? normalized.capabilities : [];
  const proposalStatements = Array.isArray(normalized.proposalStatements) ? normalized.proposalStatements : [];
  const findings = Array.isArray(normalized.findings) ? normalized.findings : [];
  const allJudgmentsPass = capabilities.every((capability) => (
    isPassingJudgment(capability.judgment)
      && Array.isArray(capability.links)
      && capability.links.every((link) => isPassingJudgment(link.judgment))
  ));
  const allStatementsPass = proposalStatements.every((statement) => statement.coverage === "sufficient");
  const overall = findings.length === 0 && allJudgmentsPass && allStatementsPass
    ? "pass"
    : "findings";
  normalized.review = {
    kind: "semantic-spec-review",
    reviewer: { type: "llm", name: "codex-cli", version: reviewerVersion },
    promptVersion: PROMPT_VERSION,
    reviewedAt,
    overall,
  };
  return normalized;
}

function runProcess(command, args, { cwd, input, forwardOutput = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const retainTail = (current, chunk) => `${current}${chunk}`.slice(-65_536);
    child.stdout.on("data", (chunk) => {
      stdout = retainTail(stdout, chunk);
      if (forwardOutput) process.stderr.write(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr = retainTail(stderr, chunk);
      if (forwardOutput) process.stderr.write(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${path.basename(command)} exited ${code}: ${(stderr || stdout).trim()}`));
    });
    child.stdin.end(input);
  });
}

async function codexVersion(codexCommand) {
  const { stdout } = await runProcess(codexCommand, ["--version"]);
  const version = stdout.trim();
  if (!version) throw new Error("codex --version returned no version");
  return version;
}

async function runCodexJudge({ prompt, model, outputFile, workingDirectory, codexCommand }) {
  await runProcess(codexCommand, [
    "exec",
    "--ephemeral",
    "--sandbox", "read-only",
    "--cd", workingDirectory,
    "--skip-git-repo-check",
    "--model", model,
    "--output-schema", schemaFile,
    "--output-last-message", outputFile,
    "--color", "never",
    "-",
  ], { cwd: workingDirectory, input: prompt });
  return JSON.parse(await readFile(outputFile, "utf8"));
}

function assertSnapshotUnchanged(traceability, inventory) {
  const accepted = new Map(traceability.review.documents.map((document) => [document.file, document.sha256]));
  for (const document of inventory.documents) {
    if (accepted.get(document.file) !== document.sha256) {
      throw new Error(`Source changed during review: ${document.file}`);
    }
  }
}

export async function reviewOpenSpecTraceability({
  changeDirectory: changeDirectoryArgument,
  model,
  maxRepairs = 2,
  codexCommand = process.env.BETTAVIEW_CODEX_BIN || "codex",
  judge,
  onProgress = () => {},
}) {
  if (typeof model !== "string" || model.trim() === "") throw new Error("A Codex model is required");
  if (!Number.isInteger(maxRepairs) || maxRepairs < 0 || maxRepairs > 5) {
    throw new Error("maxRepairs must be an integer from 0 to 5");
  }

  const inventory = await inventoryOpenSpecChange(changeDirectoryArgument);
  const instructions = await readFile(promptFile, "utf8");
  const cliVersion = judge ? "injected-judge" : await codexVersion(codexCommand);
  const reviewerVersion = `${model} via ${cliVersion}`;
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "bettaview-traceability-review-"));
  let repair;
  try {
    for (let attempt = 0; attempt <= maxRepairs; attempt += 1) {
      const reviewedAt = new Date().toISOString();
      const rawOutputFile = path.join(temporaryDirectory, `judge-${attempt}.json`);
      const judgmentFile = path.join(temporaryDirectory, `judgment-${attempt}.json`);
      const candidateFile = path.join(temporaryDirectory, `candidate-${attempt}.json`);
      const prompt = buildJudgePrompt({ inventory, instructions, reviewerVersion, reviewedAt, repair });
      onProgress({ attempt: attempt + 1, maxAttempts: maxRepairs + 1, repair: Boolean(repair) });

      let normalized;
      try {
        const rawJudgment = judge
          ? await judge({ prompt, model, attempt, repair })
          : await runCodexJudge({
            prompt,
            model,
            outputFile: rawOutputFile,
            workingDirectory: inventory.changeDirectory,
            codexCommand,
          });
        normalized = normalizeJudgment(rawJudgment, {
          change: inventory.change,
          reviewerVersion,
          reviewedAt,
        });
        await writeFile(judgmentFile, `${JSON.stringify(normalized, null, 2)}\n`);
        await runProcess(process.execPath, [
          materializerFile,
          inventory.changeDirectory,
          judgmentFile,
          candidateFile,
        ]);
        const traceability = await loadTraceability(inventory.changeDirectory, candidateFile);
        assertSnapshotUnchanged(traceability, inventory);
        const destination = path.join(inventory.changeDirectory, "bettaview-traceability.json");
        await copyFile(candidateFile, destination);
        return {
          destination,
          attempts: attempt + 1,
          reviewerVersion,
          traceability,
        };
      } catch (error) {
        if (/^Source changed during review:/.test(error.message)) throw error;
        if (attempt === maxRepairs) {
          throw new Error(`Traceability review failed after ${attempt + 1} attempt(s): ${error.message}. Existing sidecar was not changed.`);
        }
        repair = { error: error.message, judgment: normalized || null };
      }
    }
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
  throw new Error("Traceability review ended without a result");
}

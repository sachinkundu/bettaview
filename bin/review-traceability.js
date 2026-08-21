#!/usr/bin/env node

import { reviewOpenSpecTraceability } from "../src/review-traceability.js";

function usage() {
  return "Usage: npm run traceability:review -- <openspec-change-directory> --model <codex-model> [--max-repairs 0-5]";
}

function parseArguments(argumentsList) {
  let changeDirectory;
  let model;
  let maxRepairs = 2;
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === "--model") {
      model = argumentsList[++index];
    } else if (argument === "--max-repairs") {
      maxRepairs = Number(argumentsList[++index]);
    } else if (!argument.startsWith("-") && !changeDirectory) {
      changeDirectory = argument;
    } else {
      throw new Error(`Unknown or incomplete argument: ${argument}`);
    }
  }
  if (!changeDirectory || !model) throw new Error(usage());
  return { changeDirectory, model, maxRepairs };
}

try {
  const options = parseArguments(process.argv.slice(2));
  const result = await reviewOpenSpecTraceability({
    ...options,
    onProgress: ({ attempt, maxAttempts, repair }) => {
      console.error(`Codex semantic review attempt ${attempt}/${maxAttempts}${repair ? " (validator repair)" : ""}...`);
    },
  });
  console.log(`Generated ${result.destination}`);
  console.log(`Review: ${result.traceability.review.overall}`);
  console.log(`Reviewer: ${result.reviewerVersion}`);
  console.log(`Attempts: ${result.attempts}`);
  console.log(`Proposal statements: ${result.traceability.proposalStatements.length}`);
  console.log(`Capabilities: ${result.traceability.capabilities.length}`);
  console.log(`Requirements: ${result.traceability.links.length}`);
  console.log(`Findings: ${result.traceability.findings.length}`);
} catch (error) {
  console.error(`Traceability review error: ${error.message}`);
  process.exitCode = 1;
}

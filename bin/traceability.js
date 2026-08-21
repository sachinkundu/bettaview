#!/usr/bin/env node

import { formatTraceability, loadTraceability } from "../src/traceability.js";

const [changeDirectory, ...extraArguments] = process.argv.slice(2);

if (!changeDirectory || extraArguments.length > 0) {
  console.error("Usage: npm run traceability -- <openspec-change-directory>");
  process.exitCode = 1;
} else {
  try {
    const traceability = await loadTraceability(changeDirectory);
    console.log(formatTraceability(traceability));
  } catch (error) {
    console.error(`Traceability error: ${error.message}`);
    process.exitCode = 1;
  }
}


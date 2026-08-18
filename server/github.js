import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";

const API = "https://api.github.com";

export function githubToken() {
  const token = process.env.GITHUB_TOKEN?.trim();
  if (token) return token;
  return execFileSync("gh", ["auth", "token"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

export async function github(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${githubToken()}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "bettaview-experiment",
      ...options.headers,
    },
  });

  const text = await response.text();
  const value = response.headers.get("content-type")?.includes("application/json")
    ? (text ? JSON.parse(text) : null)
    : text;
  if (!response.ok) {
    const error = new Error(value?.message || `GitHub returned ${response.status}`);
    error.status = response.status;
    error.details = value;
    throw error;
  }
  return value;
}

export function parsePullRequestUrl(value) {
  const parsed = new URL(value);
  if (parsed.hostname !== "github.com") throw new Error("Use a github.com pull request URL.");
  const parts = parsed.pathname.split("/").filter(Boolean);
  if (parts.length < 4 || parts[2] !== "pull" || !/^\d+$/.test(parts[3])) {
    throw new Error("Use a URL shaped like https://github.com/owner/repo/pull/123.");
  }
  return { owner: parts[0], repo: parts[1], number: Number(parts[3]) };
}

export function approvalRestriction(viewerLogin, authorLogin) {
  if (!viewerLogin || !authorLogin || viewerLogin.toLowerCase() !== authorLogin.toLowerCase()) return null;
  return "Pull request authors cannot approve their own pull requests.";
}

export function fingerprint(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function extractMermaidBlocks(source) {
  const lines = source.split("\n");
  const blocks = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (!/^\s*```mermaid\s*$/.test(lines[index])) continue;
    const start = index;
    let end = index + 1;
    while (end < lines.length && !/^\s*```\s*$/.test(lines[end])) end += 1;
    if (end >= lines.length) continue;
    const code = lines.slice(start + 1, end).join("\n");
    blocks.push({
      id: `mermaid-${blocks.length + 1}`,
      startLine: start + 1,
      endLine: end + 1,
      code,
      fingerprint: fingerprint(code),
    });
    index = end;
  }
  return blocks;
}

function normalizedWithOffsets(value) {
  let normalized = "";
  const offsets = [];
  let inWhitespace = false;
  for (let index = 0; index < value.length; index += 1) {
    if (/\s/.test(value[index])) {
      if (!inWhitespace && normalized.length > 0) {
        normalized += " ";
        offsets.push(index);
      }
      inWhitespace = true;
      continue;
    }
    inWhitespace = false;
    normalized += value[index];
    offsets.push(index);
  }
  return { normalized: normalized.trim(), offsets };
}

function lineAtOffset(source, offset) {
  return source.slice(0, offset).split("\n").length;
}

export function locateSelectedText(source, selectedText) {
  const needle = normalizedWithOffsets(selectedText).normalized;
  if (!needle || needle.length < 3) throw new Error("Select at least three visible characters.");
  const haystack = normalizedWithOffsets(source);
  const first = haystack.normalized.indexOf(needle);
  if (first < 0) throw new Error("The selected text no longer matches the pull request source.");
  if (haystack.normalized.indexOf(needle, first + 1) >= 0) {
    throw new Error("That selection is ambiguous. Select a longer, unique passage.");
  }
  const startOffset = haystack.offsets[first];
  const endOffset = haystack.offsets[first + needle.length - 1];
  return {
    startLine: lineAtOffset(source, startOffset),
    endLine: lineAtOffset(source, endOffset),
    selectedText: needle,
  };
}

export function changedLinesFromPatch(patch = "") {
  const changed = new Set();
  let rightLine = 0;
  for (const line of patch.split("\n")) {
    const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) {
      rightLine = Number(hunk[1]);
      continue;
    }
    if (line.startsWith("+") && !line.startsWith("+++")) {
      changed.add(rightLine);
      rightLine += 1;
    } else if (!line.startsWith("-") && !line.startsWith("\\")) {
      rightLine += 1;
    }
  }
  return changed;
}

export function chooseAnchorLine(range, changedLines) {
  for (let line = range.endLine; line >= range.startLine; line -= 1) {
    if (changedLines.has(line)) return line;
  }
  throw new Error("GitHub only accepts new review threads on changed lines. Select changed content.");
}

export function marker(metadata) {
  return `<!-- bettaview:v1 ${Buffer.from(JSON.stringify(metadata)).toString("base64url")} -->`;
}

export function readMarker(body = "") {
  const match = body.match(/<!-- bettaview:v1 ([A-Za-z0-9_-]+) -->/);
  if (!match) return null;
  try {
    return JSON.parse(Buffer.from(match[1], "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

export function batchReviewPayload(headSha, comments, event = "COMMENT") {
  if (!headSha) throw new Error("A pull request head commit is required.");
  if (!Array.isArray(comments) || comments.length === 0) throw new Error("Add at least one comment before publishing.");
  if (!["COMMENT", "APPROVE", "REQUEST_CHANGES"].includes(event)) throw new Error("Unsupported review state.");
  return {
    commit_id: headSha,
    event,
    body: `BettaView review with ${comments.length} inline comment${comments.length === 1 ? "" : "s"}.`,
    comments: comments.map(({ path, line, body }) => ({ path, line, side: "RIGHT", body })),
  };
}

export function submissionId() {
  return randomUUID();
}

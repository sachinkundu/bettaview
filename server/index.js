import express from "express";
import sanitizeHtml from "sanitize-html";
import {
  changedLinesFromPatch,
  chooseAnchorLine,
  extractMermaidBlocks,
  fingerprint,
  github,
  locateSelectedText,
  marker,
  parsePullRequestUrl,
  readMarker,
} from "./github.js";

const app = express();
const port = Number(process.env.PORT || 4174);

app.use(express.json({ limit: "16mb" }));

const allowedTags = sanitizeHtml.defaults.allowedTags.concat([
  "details", "summary", "input", "picture", "source", "kbd", "mark", "relative-time",
]);
const allowedAttributes = {
  "*": ["class", "id", "dir", "title", "aria-hidden", "aria-label", "role"],
  a: ["href", "name", "target", "rel"],
  img: ["src", "alt", "width", "height", "loading"],
  input: ["type", "checked", "disabled"],
  code: ["class"],
  pre: ["class", "lang"],
  td: ["align"],
  th: ["align"],
};

function cleanRenderedMarkdown(html) {
  return sanitizeHtml(html, {
    allowedTags,
    allowedAttributes,
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer", target: "_blank" }),
    },
  });
}

async function pullContext(prUrl) {
  const identity = parsePullRequestUrl(prUrl);
  const { owner, repo, number } = identity;
  const pr = await github(`/repos/${owner}/${repo}/pulls/${number}`);
  const files = await github(`/repos/${owner}/${repo}/pulls/${number}/files?per_page=100`);
  return { identity, pr, files };
}

async function markdownFile(owner, repo, path, ref) {
  const content = await github(`/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${ref}`);
  return Buffer.from(content.content, "base64").toString("utf8");
}

async function threads(owner, repo, number) {
  const query = `query($owner:String!,$repo:String!,$number:Int!){repository(owner:$owner,name:$repo){pullRequest(number:$number){reviewThreads(first:100){nodes{id isResolved isOutdated path line startLine comments(first:100){nodes{databaseId body createdAt url author{login}}}}}}}}`;
  const data = await github("/graphql", {
    method: "POST",
    body: JSON.stringify({ query, variables: { owner, repo, number } }),
  });
  return data.data.repository.pullRequest.reviewThreads.nodes.map((thread) => ({
    ...thread,
    comments: thread.comments.nodes.map((comment) => ({
      ...comment,
      metadata: readMarker(comment.body),
    })),
  }));
}

function assertHead(pr, expectedHead) {
  if (pr.head.sha !== expectedHead) {
    const error = new Error(`The pull request changed. Refresh before commenting (now ${pr.head.sha.slice(0, 7)}).`);
    error.status = 409;
    throw error;
  }
}

async function existingSubmission(owner, repo, number, clientSubmissionId) {
  const comments = await github(`/repos/${owner}/${repo}/pulls/${number}/comments?per_page=100`);
  return comments.find((comment) => readMarker(comment.body)?.clientSubmissionId === clientSubmissionId);
}

async function createReviewComment({ context, path, line, body, metadata }) {
  const { identity, pr } = context;
  const prior = await existingSubmission(identity.owner, identity.repo, identity.number, metadata.clientSubmissionId);
  if (prior) return { comment: prior, duplicate: true };
  const comment = await github(`/repos/${identity.owner}/${identity.repo}/pulls/${identity.number}/comments`, {
    method: "POST",
    body: JSON.stringify({ body: `${body.trim()}\n\n${marker(metadata)}`, commit_id: pr.head.sha, path, line, side: "RIGHT" }),
  });
  return { comment, duplicate: false };
}

app.get("/api/pr", async (request, response, next) => {
  try {
    const context = await pullContext(request.query.url);
    const { owner, repo, number } = context.identity;
    const markdownFiles = context.files.filter((file) => /\.md(?:own)?$/i.test(file.filename));
    const renderedFiles = await Promise.all(markdownFiles.map(async (file) => {
      const source = await markdownFile(owner, repo, file.filename, context.pr.head.sha);
      const rendered = await github("/markdown", {
        method: "POST",
        body: JSON.stringify({ text: source, mode: "gfm", context: `${owner}/${repo}` }),
      });
      return {
        path: file.filename,
        status: file.status,
        additions: file.additions,
        deletions: file.deletions,
        source,
        sourceFingerprint: fingerprint(source),
        html: cleanRenderedMarkdown(rendered),
        changedLines: [...changedLinesFromPatch(file.patch)],
        mermaidBlocks: extractMermaidBlocks(source),
      };
    }));
    response.json({
      repository: `${owner}/${repo}`,
      number,
      title: context.pr.title,
      url: context.pr.html_url,
      headSha: context.pr.head.sha,
      baseSha: context.pr.base.sha,
      state: context.pr.state,
      draft: context.pr.draft,
      files: renderedFiles,
      threads: await threads(owner, repo, number),
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/comments/text", async (request, response, next) => {
  try {
    const { prUrl, path, headSha, selectedText, body, clientSubmissionId } = request.body;
    if (!body?.trim()) throw new Error("Write a comment before submitting.");
    const context = await pullContext(prUrl);
    assertHead(context.pr, headSha);
    const file = context.files.find((item) => item.filename === path);
    if (!file) throw new Error("The selected file is not part of this pull request.");
    const source = await markdownFile(context.identity.owner, context.identity.repo, path, headSha);
    const range = locateSelectedText(source, selectedText);
    const line = chooseAnchorLine(range, changedLinesFromPatch(file.patch));
    const metadata = {
      kind: "text-selection",
      clientSubmissionId,
      repository: `${context.identity.owner}/${context.identity.repo}`,
      pullRequest: context.identity.number,
      headSha,
      path,
      sourceFingerprint: fingerprint(source),
      startLine: range.startLine,
      endLine: range.endLine,
      selectedText: range.selectedText,
    };
    response.json(await createReviewComment({ context, path, line, body, metadata }));
  } catch (error) {
    next(error);
  }
});

async function ensureAssetBranch(owner, repo, baseSha) {
  try {
    await github(`/repos/${owner}/${repo}/git/ref/heads/bettaview-annotations`);
  } catch (error) {
    if (error.status !== 404) throw error;
    await github(`/repos/${owner}/${repo}/git/refs`, {
      method: "POST",
      body: JSON.stringify({ ref: "refs/heads/bettaview-annotations", sha: baseSha }),
    });
  }
}

async function uploadAnnotation(owner, repo, pr, clientSubmissionId, dataUrl) {
  const match = dataUrl.match(/^data:image\/png;base64,(.+)$/);
  if (!match) throw new Error("The annotation capture was not a PNG image.");
  await ensureAssetBranch(owner, repo, pr.base.sha);
  const path = `annotations/pr-${pr.number}/${pr.head.sha}/${clientSubmissionId}.png`;
  const result = await github(`/repos/${owner}/${repo}/contents/${path}`, {
    method: "PUT",
    body: JSON.stringify({
      message: `Store BettaView annotation ${clientSubmissionId}`,
      content: match[1],
      branch: "bettaview-annotations",
    }),
  });
  const imageUrl = `https://raw.githubusercontent.com/${owner}/${repo}/bettaview-annotations/${path}`;
  return { imageUrl, blobSha: result.content.sha, path };
}

app.post("/api/comments/annotation", async (request, response, next) => {
  try {
    const { prUrl, path, headSha, block, geometry, imageDataUrl, body, clientSubmissionId, render } = request.body;
    if (!body?.trim()) throw new Error("Write a comment before submitting.");
    if (!Array.isArray(geometry) || geometry.length === 0) throw new Error("Draw an arrow or circle before submitting.");
    const context = await pullContext(prUrl);
    assertHead(context.pr, headSha);
    const source = await markdownFile(context.identity.owner, context.identity.repo, path, headSha);
    const currentBlock = extractMermaidBlocks(source).find((candidate) => candidate.id === block.id);
    if (!currentBlock || currentBlock.fingerprint !== block.fingerprint) {
      const error = new Error("The Mermaid diagram changed. Refresh before commenting.");
      error.status = 409;
      throw error;
    }
    const file = context.files.find((item) => item.filename === path);
    const line = chooseAnchorLine(currentBlock, changedLinesFromPatch(file.patch));
    const asset = await uploadAnnotation(context.identity.owner, context.identity.repo, context.pr, clientSubmissionId, imageDataUrl);
    const metadata = {
      kind: "mermaid-annotation",
      clientSubmissionId,
      repository: `${context.identity.owner}/${context.identity.repo}`,
      pullRequest: context.identity.number,
      headSha,
      path,
      sourceFingerprint: fingerprint(source),
      diagram: { id: block.id, fingerprint: block.fingerprint, startLine: block.startLine, endLine: block.endLine },
      render,
      geometry,
      imageUrl: asset.imageUrl,
      imageBlobSha: asset.blobSha,
    };
    const commentBody = `${body.trim()}\n\n![Annotated Mermaid diagram](${asset.imageUrl})`;
    response.json({ ...(await createReviewComment({ context, path, line, body: commentBody, metadata })), asset });
  } catch (error) {
    next(error);
  }
});

app.post("/api/comments/reply", async (request, response, next) => {
  try {
    const { prUrl, commentId, body } = request.body;
    if (!body?.trim()) throw new Error("Write a reply before submitting.");
    const { owner, repo, number } = parsePullRequestUrl(prUrl);
    const comment = await github(`/repos/${owner}/${repo}/pulls/${number}/comments/${commentId}/replies`, {
      method: "POST",
      body: JSON.stringify({ body: body.trim() }),
    });
    response.json({ comment });
  } catch (error) {
    next(error);
  }
});

app.post("/api/reviews", async (request, response, next) => {
  try {
    const { prUrl, headSha, event, body = "" } = request.body;
    if (!["COMMENT", "APPROVE", "REQUEST_CHANGES"].includes(event)) throw new Error("Unsupported review state.");
    const context = await pullContext(prUrl);
    assertHead(context.pr, headSha);
    const review = await github(`/repos/${context.identity.owner}/${context.identity.repo}/pulls/${context.identity.number}/reviews`, {
      method: "POST",
      body: JSON.stringify({ commit_id: headSha, event, body }),
    });
    response.json({ review });
  } catch (error) {
    next(error);
  }
});

app.use(express.static("dist"));
app.get("/{*splat}", (_request, response) => response.sendFile(new URL("../dist/index.html", import.meta.url).pathname));

app.use((error, _request, response, _next) => {
  response.status(error.status && error.status >= 400 ? error.status : 400).json({
    error: error.message,
    details: error.details || undefined,
  });
});

app.listen(port, "127.0.0.1", () => {
  process.stdout.write(`BettaView listening on http://127.0.0.1:${port}\n`);
});

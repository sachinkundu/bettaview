import express from "express";
import sanitizeHtml from "sanitize-html";
import {
  approvalRestriction,
  batchReviewPayload,
  changedLinesFromPatch,
  chooseAnchorLine,
  extractMermaidBlocks,
  fingerprint,
  github,
  isRenderableMarkdownFile,
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

async function assertReviewEventAllowed(context, event) {
  if (event !== "APPROVE") return;
  const viewer = await github("/user");
  const restriction = approvalRestriction(viewer.login, context.pr.user.login);
  if (!restriction) return;
  const error = new Error(restriction);
  error.status = 422;
  throw error;
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

async function prepareBatchComment(context, draft, sourceCache) {
  const { identity, pr, files } = context;
  if (!draft?.body?.trim()) throw new Error("Every unpublished comment needs text.");
  if (!draft.clientSubmissionId) throw new Error("An unpublished comment is missing its submission identity.");
  const file = files.find((item) => item.filename === draft.path);
  if (!file) throw new Error(`${draft.path || "The selected file"} is not part of this pull request.`);
  let source = sourceCache.get(draft.path);
  if (!source) {
    source = await markdownFile(identity.owner, identity.repo, draft.path, pr.head.sha);
    sourceCache.set(draft.path, source);
  }

  if (draft.kind === "text-selection") {
    const range = locateSelectedText(source, draft.selectedText, {
      startLine: Number(draft.startLine),
      endLine: Number(draft.endLine),
    });
    const line = chooseAnchorLine(range, changedLinesFromPatch(file.patch));
    return {
      draft,
      path: draft.path,
      line,
      body: draft.body.trim(),
      metadata: {
        kind: "text-selection",
        clientSubmissionId: draft.clientSubmissionId,
        repository: `${identity.owner}/${identity.repo}`,
        pullRequest: identity.number,
        headSha: pr.head.sha,
        path: draft.path,
        sourceFingerprint: fingerprint(source),
        startLine: range.startLine,
        endLine: range.endLine,
        selectedText: range.selectedText,
      },
    };
  }

  if (draft.kind === "mermaid-annotation") {
    if (!Array.isArray(draft.geometry) || draft.geometry.length === 0) throw new Error("Every diagram comment needs an arrow or circle.");
    if (!/^data:image\/png;base64,/.test(draft.imageDataUrl || "")) throw new Error("Every diagram comment needs a PNG capture.");
    const currentBlock = extractMermaidBlocks(source).find((candidate) => candidate.id === draft.block?.id);
    if (!currentBlock || currentBlock.fingerprint !== draft.block?.fingerprint) {
      const error = new Error(`The Mermaid diagram in ${draft.path} changed. Refresh before publishing.`);
      error.status = 409;
      throw error;
    }
    return {
      draft,
      path: draft.path,
      line: chooseAnchorLine(currentBlock, changedLinesFromPatch(file.patch)),
      body: draft.body.trim(),
      currentBlock,
      sourceFingerprint: fingerprint(source),
    };
  }

  throw new Error(`Unsupported unpublished comment type: ${draft.kind || "unknown"}.`);
}

app.get("/api/pr", async (request, response, next) => {
  try {
    const context = await pullContext(request.query.url);
    const { owner, repo, number } = context.identity;
    const markdownFiles = context.files.filter(isRenderableMarkdownFile);
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
    const [reviewThreads, viewer] = await Promise.all([
      threads(owner, repo, number),
      github("/user"),
    ]);
    const approveRestriction = approvalRestriction(viewer.login, context.pr.user.login);
    response.json({
      repository: `${owner}/${repo}`,
      number,
      title: context.pr.title,
      url: context.pr.html_url,
      headSha: context.pr.head.sha,
      baseSha: context.pr.base.sha,
      state: context.pr.state,
      draft: context.pr.draft,
      authorLogin: context.pr.user.login,
      viewerLogin: viewer.login,
      reviewCapabilities: {
        approve: { allowed: !approveRestriction, reason: approveRestriction },
      },
      files: renderedFiles,
      threads: reviewThreads,
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

app.post("/api/comments/batch", async (request, response, next) => {
  try {
    const { prUrl, headSha, event = "COMMENT", comments } = request.body;
    if (!Array.isArray(comments) || comments.length === 0) throw new Error("Add at least one comment before publishing.");
    if (comments.length > 50) throw new Error("Publish at most 50 comments in one review.");
    if (!["COMMENT", "APPROVE", "REQUEST_CHANGES"].includes(event)) throw new Error("Unsupported review state.");
    const context = await pullContext(prUrl);
    assertHead(context.pr, headSha);
    await assertReviewEventAllowed(context, event);

    const ids = comments.map((comment) => comment.clientSubmissionId);
    if (new Set(ids).size !== ids.length) throw new Error("Each unpublished comment must have a unique submission identity.");
    const priorComments = await github(`/repos/${context.identity.owner}/${context.identity.repo}/pulls/${context.identity.number}/comments?per_page=100`);
    const priorIds = new Set(priorComments.map((comment) => readMarker(comment.body)?.clientSubmissionId).filter(Boolean));
    const unpublished = comments.filter((comment) => !priorIds.has(comment.clientSubmissionId));
    if (!unpublished.length) return response.json({ review: null, published: 0, duplicates: comments.length, assets: [] });

    const replyDrafts = unpublished.filter((draft) => draft.kind === "reply");
    const commentDrafts = unpublished.filter((draft) => draft.kind !== "reply");
    for (const draft of replyDrafts) {
      if (!draft.body?.trim()) throw new Error("Every unpublished reply needs text.");
      if (!priorComments.some((comment) => comment.id === Number(draft.commentId))) {
        throw new Error("A reply target is no longer part of this pull request. Refresh before publishing.");
      }
    }

    const sourceCache = new Map();
    const prepared = [];
    for (const draft of commentDrafts) prepared.push(await prepareBatchComment(context, draft, sourceCache));

    const assets = [];
    for (const item of prepared) {
      if (item.draft.kind !== "mermaid-annotation") continue;
      const asset = await uploadAnnotation(
        context.identity.owner,
        context.identity.repo,
        context.pr,
        item.draft.clientSubmissionId,
        item.draft.imageDataUrl,
      );
      assets.push(asset);
      item.metadata = {
        kind: "mermaid-annotation",
        clientSubmissionId: item.draft.clientSubmissionId,
        repository: `${context.identity.owner}/${context.identity.repo}`,
        pullRequest: context.identity.number,
        headSha,
        path: item.path,
        sourceFingerprint: item.sourceFingerprint,
        diagram: {
          id: item.currentBlock.id,
          fingerprint: item.currentBlock.fingerprint,
          startLine: item.currentBlock.startLine,
          endLine: item.currentBlock.endLine,
        },
        render: item.draft.render,
        geometry: item.draft.geometry,
        imageUrl: asset.imageUrl,
        imageBlobSha: asset.blobSha,
      };
      item.body = `${item.body}\n\n![Annotated Mermaid diagram](${asset.imageUrl})`;
    }

    const reviewComments = prepared.map((item) => ({
      path: item.path,
      line: item.line,
      body: `${item.body}\n\n${marker(item.metadata)}`,
    }));
    let review = null;
    if (reviewComments.length) {
      review = await github(`/repos/${context.identity.owner}/${context.identity.repo}/pulls/${context.identity.number}/reviews`, {
        method: "POST",
        body: JSON.stringify(batchReviewPayload(headSha, reviewComments, event)),
      });
    }

    const replies = [];
    for (const draft of replyDrafts) {
      const metadata = { kind: "reply", clientSubmissionId: draft.clientSubmissionId, headSha, path: draft.path };
      replies.push(await github(`/repos/${context.identity.owner}/${context.identity.repo}/pulls/${context.identity.number}/comments/${Number(draft.commentId)}/replies`, {
        method: "POST",
        body: JSON.stringify({ body: `${draft.body.trim()}\n\n${marker(metadata)}` }),
      }));
    }
    if (!reviewComments.length && event !== "COMMENT") {
      review = await github(`/repos/${context.identity.owner}/${context.identity.repo}/pulls/${context.identity.number}/reviews`, {
        method: "POST",
        body: JSON.stringify({ commit_id: headSha, event, body: "" }),
      });
    }
    response.json({ review, replies, published: reviewComments.length + replies.length, duplicates: comments.length - unpublished.length, assets });
  } catch (error) {
    next(error);
  }
});

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
    await assertReviewEventAllowed(context, event);
    const review = await github(`/repos/${context.identity.owner}/${context.identity.repo}/pulls/${context.identity.number}/reviews`, {
      method: "POST",
      body: JSON.stringify({ commit_id: headSha, event, body }),
    });
    response.json({ review });
  } catch (error) {
    next(error);
  }
});

app.use("/api", (_request, response) => {
  response.status(404).json({ error: "The requested BettaView API endpoint does not exist. Restart the server if it was recently updated." });
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

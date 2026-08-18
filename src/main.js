import mermaid from "mermaid";
import { toPng } from "html-to-image";
import "./styles.css";

const apiOrigin = window.location.port === "5173" ? "http://127.0.0.1:4174" : "";
const defaultPullRequest = "https://github.com/sachinkundu/bettaview/pull/1";

const state = {
  prUrl: defaultPullRequest,
  data: null,
  activePath: null,
  selectedText: "",
  selectionRange: null,
  drawings: new Map(),
};

mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: "neutral", fontFamily: "Inter, ui-sans-serif, system-ui" });

const app = document.querySelector("#app");

function id() {
  return crypto.randomUUID();
}

async function request(path, options = {}) {
  const response = await fetch(`${apiOrigin}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error || "The request failed.");
  return value;
}

function escapeHtml(value = "") {
  return value.replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]);
}

function shortSha(value) {
  return value?.slice(0, 7) || "unknown";
}

function setNotice(message, tone = "info") {
  const notice = document.querySelector("#notice");
  if (!notice) return;
  notice.textContent = message;
  notice.dataset.tone = tone;
  notice.hidden = false;
  window.clearTimeout(setNotice.timeout);
  setNotice.timeout = window.setTimeout(() => { notice.hidden = true; }, tone === "error" ? 8000 : 4000);
}

function shell() {
  app.innerHTML = `
    <header class="topbar">
      <a class="brand" href="#" aria-label="BettaView home">
        <span class="brand-mark">β</span>
        <span><strong>BettaView</strong><small>Rendered review experiment</small></span>
      </a>
      <form id="pr-form" class="pr-form">
        <label for="pr-url">Pull request</label>
        <input id="pr-url" name="url" type="url" value="${escapeHtml(state.prUrl)}" required />
        <button type="submit" class="button primary">Open</button>
      </form>
    </header>
    <div id="notice" class="notice" hidden></div>
    <main id="workspace" class="empty-state">
      <div class="loader"></div>
      <p>Loading the exact pull request head from GitHub…</p>
    </main>
    <aside id="selection-composer" class="selection-composer" hidden>
      <button class="composer-close" aria-label="Close">×</button>
      <span class="eyebrow">Selected rendered text</span>
      <blockquote id="selection-preview"></blockquote>
      <textarea id="selection-comment" rows="4" placeholder="What should change?"></textarea>
      <button id="submit-selection" class="button primary">Publish native thread</button>
    </aside>
  `;
  document.querySelector("#pr-form").addEventListener("submit", (event) => {
    event.preventDefault();
    state.prUrl = new FormData(event.currentTarget).get("url").trim();
    loadPullRequest();
  });
  document.querySelector(".composer-close").addEventListener("click", closeSelectionComposer);
  document.querySelector("#submit-selection").addEventListener("click", submitSelectionComment);
}

async function loadPullRequest({ preservePath = true } = {}) {
  const workspace = document.querySelector("#workspace");
  workspace.className = "empty-state";
  workspace.innerHTML = `<div class="loader"></div><p>Loading rendered Markdown and native threads from GitHub…</p>`;
  try {
    const data = await request(`/api/pr?url=${encodeURIComponent(state.prUrl)}`);
    state.data = data;
    if (!preservePath || !data.files.some((file) => file.path === state.activePath)) {
      state.activePath = data.files.find((file) => file.mermaidBlocks.length > 0)?.path || data.files[0]?.path;
    }
    renderWorkspace();
  } catch (error) {
    workspace.innerHTML = `<div class="error-card"><strong>Could not open that pull request.</strong><p>${escapeHtml(error.message)}</p></div>`;
  }
}

function renderWorkspace() {
  const data = state.data;
  const file = data.files.find((item) => item.path === state.activePath);
  const workspace = document.querySelector("#workspace");
  workspace.className = "workspace";
  workspace.innerHTML = `
    <aside class="file-rail">
      <div class="pr-summary">
        <span class="eyebrow">${escapeHtml(data.repository)} · PR #${data.number}</span>
        <a href="${escapeHtml(data.url)}" target="_blank" rel="noreferrer"><h1>${escapeHtml(data.title)}</h1></a>
        <div class="commit-chip"><span></span>Exact head <code>${shortSha(data.headSha)}</code></div>
      </div>
      <nav class="file-list" aria-label="Changed Markdown files">
        ${data.files.map((item) => `<button class="file-link ${item.path === state.activePath ? "active" : ""}" data-path="${escapeHtml(item.path)}"><span>${escapeHtml(item.path.split("/").at(-1))}</span><small>+${item.additions} −${item.deletions}</small></button>`).join("") || `<p class="muted">No changed Markdown files.</p>`}
      </nav>
      <div class="review-actions">
        <span class="eyebrow">Submit review state</span>
        <button data-review="COMMENT" class="button subtle">Comment</button>
        <button data-review="APPROVE" class="button subtle">Approve</button>
        <button data-review="REQUEST_CHANGES" class="button subtle danger">Request changes</button>
      </div>
    </aside>
    <section class="document-column">
      ${file ? `
        <div class="document-toolbar">
          <div><span class="status-dot"></span><strong>${escapeHtml(file.path)}</strong><small>${file.changedLines.length} commentable changed lines</small></div>
          <button id="refresh" class="button ghost">Refresh from GitHub</button>
        </div>
        <article id="rendered-document" class="markdown-body">${file.html}</article>
      ` : `<div class="empty-state"><p>No changed Markdown file to render.</p></div>`}
    </section>
    <aside class="thread-rail">
      <div class="thread-heading"><div><span class="eyebrow">Native GitHub review</span><h2>Threads</h2></div><span class="thread-count">${data.threads.length}</span></div>
      <div id="threads">${renderThreads(data.threads)}</div>
    </aside>
  `;

  document.querySelectorAll(".file-link").forEach((button) => button.addEventListener("click", () => {
    state.activePath = button.dataset.path;
    closeSelectionComposer();
    renderWorkspace();
  }));
  document.querySelector("#refresh")?.addEventListener("click", () => loadPullRequest());
  document.querySelectorAll("[data-review]").forEach((button) => button.addEventListener("click", () => submitReview(button.dataset.review)));
  document.querySelector("#rendered-document")?.addEventListener("mouseup", handleTextSelection);
  document.querySelectorAll("[data-reply]").forEach((button) => button.addEventListener("click", () => submitReply(button.dataset.reply)));
  if (file) renderMermaidDiagrams(file);
}

function visibleCommentBody(body) {
  return body
    .replace(/<!-- bettaview:v1 [A-Za-z0-9_-]+ -->/g, "")
    .replace(/<!-- bettaview:v1 \{[\s\S]*?\} -->/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\\n\\n/g, "\n\n")
    .trim();
}

function annotationState(annotation) {
  if (annotation.headSha === state.data.headSha) return "Current";
  const file = state.data.files.find((candidate) => candidate.path === annotation.path);
  if (!file) return "Orphaned";
  if (file.mermaidBlocks.some((block) => block.fingerprint === annotation.diagram.fingerprint)) return "Replayable";
  const priorSlot = annotation.diagram.id.match(/^mermaid-\d+/)?.[0];
  if (file.mermaidBlocks.some((block) => block.id === annotation.diagram.id || block.id === priorSlot)) return "Stale";
  return "Orphaned";
}

function renderThreads(threads) {
  if (!threads.length) return `<div class="no-threads"><span>◌</span><p>No native review threads yet.</p></div>`;
  return threads.map((thread) => {
    const first = thread.comments[0];
    const annotation = first?.metadata?.kind === "mermaid-annotation" ? first.metadata : null;
    return `<section class="thread-card ${thread.isOutdated ? "outdated" : ""}">
      <div class="thread-meta">
        <span>${escapeHtml(thread.path)}:${thread.line || "outdated"}</span>
        <span>${thread.isOutdated ? "Outdated" : thread.isResolved ? "Resolved" : "Open"}</span>
      </div>
      ${thread.comments.map((comment) => `<div class="comment">
        <div class="avatar">${escapeHtml((comment.author?.login || "?")[0].toUpperCase())}</div>
        <div><strong>${escapeHtml(comment.author?.login || "unknown")}</strong><p>${escapeHtml(visibleCommentBody(comment.body))}</p>${comment.metadata?.imageUrl ? `<a href="${escapeHtml(comment.metadata.imageUrl)}" target="_blank"><img class="annotation-thumb" src="${escapeHtml(comment.metadata.imageUrl)}" alt="Annotated Mermaid diagram" /></a>` : ""}</div>
      </div>`).join("")}
      ${annotation ? `<div class="annotation-state"><span>Diagram ${escapeHtml(annotation.diagram.id)}</span><span>${annotationState(annotation)}</span></div>` : ""}
      <div class="reply-row"><input id="reply-${first.databaseId}" placeholder="Reply on GitHub…" /><button class="button ghost" data-reply="${first.databaseId}">Reply</button></div>
    </section>`;
  }).join("");
}

function handleTextSelection() {
  const selection = window.getSelection();
  const text = selection?.toString().trim();
  if (!text || text.length < 3 || !selection.rangeCount) return;
  const range = selection.getRangeAt(0);
  const documentRoot = document.querySelector("#rendered-document");
  if (!documentRoot.contains(range.commonAncestorContainer)) return;
  state.selectedText = text;
  state.selectionRange = range.cloneRange();
  const composer = document.querySelector("#selection-composer");
  document.querySelector("#selection-preview").textContent = text;
  document.querySelector("#selection-comment").value = "";
  composer.hidden = false;
  document.querySelector("#selection-comment").focus();
}

function closeSelectionComposer() {
  document.querySelector("#selection-composer").hidden = true;
  state.selectedText = "";
  state.selectionRange = null;
  window.getSelection()?.removeAllRanges();
}

async function submitSelectionComment() {
  const button = document.querySelector("#submit-selection");
  const body = document.querySelector("#selection-comment").value;
  if (!state.selectedText) return setNotice("Select text in the rendered document first.", "error");
  button.disabled = true;
  button.textContent = "Publishing…";
  try {
    await request("/api/comments/text", {
      method: "POST",
      body: JSON.stringify({
        prUrl: state.prUrl,
        path: state.activePath,
        headSha: state.data.headSha,
        selectedText: state.selectedText,
        body,
        clientSubmissionId: id(),
      }),
    });
    closeSelectionComposer();
    setNotice("Native GitHub thread published and read-back is available.", "success");
    await loadPullRequest();
  } catch (error) {
    setNotice(error.message, "error");
  } finally {
    button.disabled = false;
    button.textContent = "Publish native thread";
  }
}

async function renderMermaidDiagrams(file) {
  const root = document.querySelector("#rendered-document");
  const candidates = [...root.querySelectorAll('pre[lang="mermaid"], pre code.language-mermaid')].map((node) => node.tagName === "PRE" ? node : node.closest("pre"));
  for (let index = 0; index < file.mermaidBlocks.length; index += 1) {
    const block = file.mermaidBlocks[index];
    const pre = candidates[index];
    if (!pre) continue;
    const card = document.createElement("section");
    card.className = "diagram-review";
    card.dataset.blockId = block.id;
    card.innerHTML = `
      <div class="diagram-toolbar">
        <div><strong>Mermaid annotation</strong><small>Lines ${block.startLine}–${block.endLine}</small></div>
        <div class="tool-group">
          <button class="tool active" data-tool="arrow">↗ Arrow</button>
          <button class="tool" data-tool="circle">◯ Circle</button>
          <button class="tool" data-action="undo">Undo</button>
          <button class="tool" data-action="clear">Clear</button>
        </div>
      </div>
      <div class="diagram-stage"><div class="mermaid-output"></div><svg class="drawing-layer" viewBox="0 0 1000 1000" preserveAspectRatio="none"><defs><marker id="arrow-${index}" markerWidth="12" markerHeight="12" refX="10" refY="4" orient="auto"><path d="M0,0 L0,8 L11,4 z" fill="#e34b31" /></marker></defs><g></g></svg></div>
      <div class="diagram-comment"><textarea rows="3" placeholder="Explain what the visual mark refers to…"></textarea><button class="button primary">Publish annotation</button></div>
    `;
    const githubEnrichment = pre.closest("section.js-render-needs-enrichment");
    (githubEnrichment || pre).replaceWith(card);
    try {
      const result = await mermaid.render(`bettaview-${index}-${Date.now()}`, block.code);
      card.querySelector(".mermaid-output").innerHTML = result.svg;
      setupDrawing(card, block, file);
    } catch (error) {
      card.querySelector(".mermaid-output").innerHTML = `<div class="diagram-error">Mermaid could not render: ${escapeHtml(error.message)}</div>`;
    }
  }
}

function setupDrawing(card, block, file) {
  const stage = card.querySelector(".diagram-stage");
  const layer = card.querySelector(".drawing-layer");
  const group = layer.querySelector("g");
  const drawings = [];
  state.drawings.set(block.id, drawings);
  let tool = "arrow";
  let draft = null;

  function point(event) {
    const rect = layer.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height };
  }

  function redraw() {
    group.innerHTML = drawings.map((shape) => shape.kind === "arrow"
      ? `<line x1="${shape.x1 * 1000}" y1="${shape.y1 * 1000}" x2="${shape.x2 * 1000}" y2="${shape.y2 * 1000}" marker-end="url(#${layer.querySelector("marker").id})" />`
      : `<ellipse cx="${((shape.x1 + shape.x2) / 2) * 1000}" cy="${((shape.y1 + shape.y2) / 2) * 1000}" rx="${Math.abs(shape.x2 - shape.x1) * 500}" ry="${Math.abs(shape.y2 - shape.y1) * 500}" />`).join("");
  }

  layer.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    layer.setPointerCapture(event.pointerId);
    const start = point(event);
    draft = { kind: tool, x1: start.x, y1: start.y, x2: start.x, y2: start.y };
    drawings.push(draft);
  });
  layer.addEventListener("pointermove", (event) => {
    if (!draft) return;
    const current = point(event);
    draft.x2 = current.x;
    draft.y2 = current.y;
    redraw();
  });
  layer.addEventListener("pointerup", () => { draft = null; redraw(); });

  card.querySelectorAll("[data-tool]").forEach((button) => button.addEventListener("click", () => {
    tool = button.dataset.tool;
    card.querySelectorAll("[data-tool]").forEach((candidate) => candidate.classList.toggle("active", candidate === button));
  }));
  card.querySelector('[data-action="undo"]').addEventListener("click", () => { drawings.pop(); redraw(); });
  card.querySelector('[data-action="clear"]').addEventListener("click", () => { drawings.splice(0); redraw(); });
  card.querySelector(".diagram-comment .button").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const body = card.querySelector("textarea").value;
    if (!drawings.length) return setNotice("Draw an arrow or circle first.", "error");
    if (!body.trim()) return setNotice("Add a typed comment for the annotation.", "error");
    button.disabled = true;
    button.textContent = "Capturing…";
    try {
      const imageDataUrl = await toPng(stage, { pixelRatio: 2, backgroundColor: "#fbfaf7" });
      button.textContent = "Publishing…";
      await request("/api/comments/annotation", {
        method: "POST",
        body: JSON.stringify({
          prUrl: state.prUrl,
          path: file.path,
          headSha: state.data.headSha,
          block,
          geometry: drawings,
          render: { width: stage.clientWidth, height: stage.clientHeight, pixelRatio: 2 },
          imageDataUrl,
          body,
          clientSubmissionId: id(),
        }),
      });
      setNotice("Annotation image and native GitHub thread published.", "success");
      await loadPullRequest();
    } catch (error) {
      setNotice(error.message, "error");
    } finally {
      button.disabled = false;
      button.textContent = "Publish annotation";
    }
  });
}

async function submitReply(commentId) {
  const input = document.querySelector(`#reply-${commentId}`);
  try {
    await request("/api/comments/reply", {
      method: "POST",
      body: JSON.stringify({ prUrl: state.prUrl, commentId: Number(commentId), body: input.value }),
    });
    setNotice("Reply published on GitHub.", "success");
    await loadPullRequest();
  } catch (error) {
    setNotice(error.message, "error");
  }
}

async function submitReview(event) {
  try {
    await request("/api/reviews", {
      method: "POST",
      body: JSON.stringify({ prUrl: state.prUrl, headSha: state.data.headSha, event, body: `BettaView experiment review: ${event.toLowerCase().replace("_", " ")}.` }),
    });
    setNotice(`${event.replace("_", " ")} review submitted.`, "success");
    await loadPullRequest();
  } catch (error) {
    setNotice(error.message, "error");
  }
}

shell();
loadPullRequest({ preservePath: false });

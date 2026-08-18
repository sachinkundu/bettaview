import mermaid from "mermaid";
import { toPng } from "html-to-image";
import { request } from "./api.js";
import { annotationSvgAttributes, circleSvgGeometry, startDrawing } from "./annotation-geometry.js";
import { activeThreadReferences, draftReferenceKey, threadReferenceKey } from "./thread-links.js";
import "./styles.css";

const defaultPullRequest = "https://github.com/sachinkundu/bettaview/pull/1";

const state = {
  prUrl: defaultPullRequest,
  data: null,
  activePath: null,
  selectedText: "",
  selectionRange: null,
  drafts: [],
  reviewEvent: "COMMENT",
};

mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: "neutral", fontFamily: "Inter, ui-sans-serif, system-ui" });

const app = document.querySelector("#app");

function id() {
  return crypto.randomUUID();
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
      <button id="submit-selection" class="button primary">Add comment</button>
    </aside>
    <div id="pending-review-bar" class="pending-review-bar" hidden>
      <div><strong id="pending-review-count"></strong><small>Held locally until you publish</small></div>
      <button id="publish-review" class="button primary">Publish review</button>
    </div>
  `;
  document.querySelector("#pr-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!confirmDraftDiscard("Opening another pull request")) return;
    state.prUrl = new FormData(event.currentTarget).get("url").trim();
    await loadPullRequest();
  });
  document.querySelector(".composer-close").addEventListener("click", closeSelectionComposer);
  document.querySelector("#submit-selection").addEventListener("click", stageSelectionComment);
  document.querySelector("#publish-review").addEventListener("click", publishReview);
  window.addEventListener("beforeunload", (event) => {
    if (!state.drafts.length) return;
    event.preventDefault();
    event.returnValue = "";
  });
}

function confirmDraftDiscard(action) {
  if (!state.drafts.length) return true;
  if (!window.confirm(`${action} will discard ${state.drafts.length} unpublished comment${state.drafts.length === 1 ? "" : "s"}. Continue?`)) return false;
  state.drafts = [];
  state.reviewEvent = "COMMENT";
  updateDraftUI();
  return true;
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
  const activeThreads = threadsForActiveFile();
  const activeDrafts = draftsForActiveFile();
  const approveCapability = data.reviewCapabilities?.approve || { allowed: true, reason: null };
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
        <button data-review="COMMENT" class="button subtle ${state.reviewEvent === "COMMENT" ? "selected" : ""}">Comment</button>
        <button data-review="APPROVE" class="button subtle ${state.reviewEvent === "APPROVE" ? "selected" : ""}" ${approveCapability.allowed ? "" : `disabled title="${escapeHtml(approveCapability.reason)}"`}>Approve</button>
        <button data-review="REQUEST_CHANGES" class="button subtle danger ${state.reviewEvent === "REQUEST_CHANGES" ? "selected" : ""}">Request changes</button>
        ${approveCapability.allowed ? "" : `<p class="review-restriction">Signed in as @${escapeHtml(data.viewerLogin)}. ${escapeHtml(approveCapability.reason)}</p>`}
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
      <div class="thread-heading"><div><span class="eyebrow">GitHub review</span><h2>Threads</h2></div><span class="thread-count">${activeThreads.length + activeDrafts.length}</span></div>
      <div id="threads">${renderThreadRail(activeThreads, activeDrafts)}</div>
    </aside>
  `;

  document.querySelectorAll(".file-link").forEach((button) => button.addEventListener("click", () => {
    state.activePath = button.dataset.path;
    closeSelectionComposer();
    renderWorkspace();
  }));
  document.querySelector("#refresh")?.addEventListener("click", () => {
    if (confirmDraftDiscard("Refreshing from GitHub")) loadPullRequest();
  });
  document.querySelectorAll("[data-review]").forEach((button) => button.addEventListener("click", () => submitReview(button.dataset.review)));
  document.querySelector("#rendered-document")?.addEventListener("mouseup", handleTextSelection);
  bindThreadActions();
  updateDraftBar();
  if (file) renderMermaidDiagrams(file);
}

function threadsForActiveFile() {
  return state.data?.threads.filter((thread) => thread.path === state.activePath) || [];
}

function draftsForActiveFile() {
  return state.drafts.filter((draft) => draft.path === state.activePath);
}

function renderThreadRail(threads = threadsForActiveFile(), drafts = draftsForActiveFile()) {
  if (!threads.length && !drafts.length) {
    return `<div class="no-threads"><span>◌</span><p>No review threads for this file.</p></div>`;
  }
  return `${renderDrafts(drafts)}${renderThreads(threads)}`;
}

function referencePosition(key) {
  return activeThreadReferences(threadsForActiveFile(), draftsForActiveFile()).find((reference) => reference.key === key)?.position;
}

function renderDrafts(drafts) {
  if (!drafts.length) return "";
  return `<div class="draft-heading"><span class="eyebrow">Unpublished</span><span>Only in this tab</span></div>${drafts.map((draft) => {
    const key = draftReferenceKey(draft);
    return `
    <section class="thread-card draft-card" data-thread-key="${escapeHtml(key)}" data-thread-path="${escapeHtml(draft.path)}" data-thread-line="${draft.startLine}" tabindex="-1">
      <div class="thread-meta">
        <div class="thread-location"><span class="thread-position-index">${referencePosition(key)}</span><button class="line-ref" data-go-path="${escapeHtml(draft.path)}" data-go-line="${draft.startLine}">${escapeHtml(draft.path)}:${draft.startLine}${draft.endLine !== draft.startLine ? `–${draft.endLine}` : ""}</button></div>
        <span>Draft</span>
      </div>
      <div class="comment"><div class="avatar">D</div><div><strong>Unpublished ${draft.kind === "reply" ? "reply" : "comment"}</strong><p>${escapeHtml(draft.body)}</p>${draft.kind === "mermaid-annotation" ? `<span class="draft-kind">Annotated diagram</span>` : ""}</div></div>
      <button class="remove-draft" data-remove-draft="${draft.clientSubmissionId}">Remove</button>
    </section>`;
  }).join("")}`;
}

function bindThreadActions() {
  document.querySelectorAll("[data-reply]").forEach((button) => button.addEventListener("click", () => submitReply(button.dataset.reply)));
  document.querySelectorAll("[data-go-path]").forEach((button) => button.addEventListener("click", () => goToLine(button.dataset.goPath, Number(button.dataset.goLine))));
  document.querySelectorAll("[data-remove-draft]").forEach((button) => button.addEventListener("click", () => {
    state.drafts = state.drafts.filter((draft) => draft.clientSubmissionId !== button.dataset.removeDraft);
    updateDraftUI();
  }));
}

function updateDraftBar() {
  const bar = document.querySelector("#pending-review-bar");
  if (!bar) return;
  bar.hidden = state.drafts.length === 0;
  document.querySelector("#pending-review-count").textContent = `${state.drafts.length} unpublished comment${state.drafts.length === 1 ? "" : "s"}`;
}

function updateDraftUI() {
  updateDraftBar();
  const threads = document.querySelector("#threads");
  if (!threads || !state.data) return;
  const activeThreads = threadsForActiveFile();
  const activeDrafts = draftsForActiveFile();
  threads.innerHTML = renderThreadRail(activeThreads, activeDrafts);
  const count = document.querySelector(".thread-count");
  if (count) count.textContent = activeThreads.length + activeDrafts.length;
  bindThreadActions();
  applyThreadReferences();
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
  if (!threads.length) return "";
  return threads.map((thread) => {
    const first = thread.comments[0];
    const annotation = first?.metadata?.kind === "mermaid-annotation" ? first.metadata : null;
    const key = threadReferenceKey(thread);
    return `<section class="thread-card ${thread.isOutdated ? "outdated" : ""}" data-thread-key="${escapeHtml(key)}" data-thread-path="${escapeHtml(thread.path)}" data-thread-line="${thread.line || ""}" tabindex="-1">
      <div class="thread-meta">
        <div class="thread-location"><span class="thread-position-index">${referencePosition(key)}</span>${thread.line ? `<button class="line-ref" data-go-path="${escapeHtml(thread.path)}" data-go-line="${thread.line}">${escapeHtml(thread.path)}:${thread.line}</button>` : `<span>${escapeHtml(thread.path)}:outdated</span>`}</div>
        <span>${thread.isOutdated ? "Outdated" : thread.isResolved ? "Resolved" : "Open"}</span>
      </div>
      ${thread.comments.map((comment) => `<div class="comment">
        <div class="avatar">${escapeHtml((comment.author?.login || "?")[0].toUpperCase())}</div>
        <div><strong>${escapeHtml(comment.author?.login || "unknown")}</strong><p>${escapeHtml(visibleCommentBody(comment.body))}</p>${comment.metadata?.imageUrl ? `<a href="${escapeHtml(comment.metadata.imageUrl)}" target="_blank"><img class="annotation-thumb" src="${escapeHtml(comment.metadata.imageUrl)}" alt="Annotated Mermaid diagram" /></a>` : ""}</div>
      </div>`).join("")}
      ${annotation ? `<div class="annotation-state"><span>Diagram ${escapeHtml(annotation.diagram.id)}</span><span>${annotationState(annotation)}</span></div>` : ""}
      <div class="reply-row"><input id="reply-${first.databaseId}" placeholder="Add a reply…" /><button class="button ghost" data-reply="${first.databaseId}">Add</button></div>
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
  positionSelectionComposer(range.getBoundingClientRect());
  document.querySelector("#selection-comment").focus();
}

function positionSelectionComposer(rect) {
  const composer = document.querySelector("#selection-composer");
  const width = 370;
  const gap = 14;
  const left = rect.right + gap + width <= window.innerWidth
    ? rect.right + gap
    : Math.max(gap, rect.left - width - gap);
  composer.style.left = `${left}px`;
  composer.style.top = `${Math.min(Math.max(88, rect.top - 24), window.innerHeight - 310)}px`;
}

function closeSelectionComposer() {
  document.querySelector("#selection-composer").hidden = true;
  state.selectedText = "";
  state.selectionRange = null;
  window.getSelection()?.removeAllRanges();
}

function stageSelectionComment() {
  const button = document.querySelector("#submit-selection");
  const body = document.querySelector("#selection-comment").value;
  if (!state.selectedText) return setNotice("Select text in the rendered document first.", "error");
  if (!body.trim()) return setNotice("Write a comment before adding it.", "error");
  const lines = locateVisibleLines(state.data.files.find((file) => file.path === state.activePath).source, state.selectedText);
  state.drafts.push({
    kind: "text-selection",
    prUrl: state.prUrl,
    path: state.activePath,
    headSha: state.data.headSha,
    selectedText: state.selectedText,
    body: body.trim(),
    startLine: lines?.startLine || 1,
    endLine: lines?.endLine || lines?.startLine || 1,
    clientSubmissionId: id(),
  });
  button.textContent = "Add comment";
  closeSelectionComposer();
  updateDraftUI();
  setNotice("Comment added to the unpublished review.", "success");
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
          <button class="tool" data-action="redo">Redo</button>
          <button class="tool" data-action="clear">Clear</button>
        </div>
      </div>
      <div class="diagram-stage"><div class="mermaid-output"></div><svg class="drawing-layer" viewBox="0 0 1000 1000" preserveAspectRatio="none"><defs><marker id="arrow-${index}" markerUnits="userSpaceOnUse" markerWidth="36" markerHeight="64" refX="32" refY="24" orient="auto"><path d="M0,0 L0,48 L35,24 z" fill="#e34b31" /></marker></defs><g></g></svg></div>
      <div class="diagram-comment"><textarea rows="3" placeholder="Explain what the visual mark refers to…"></textarea><button class="button primary">Add annotation</button></div>
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
  decorateDocumentLines(file);
}

function setupDrawing(card, block, file) {
  const stage = card.querySelector(".diagram-stage");
  const layer = card.querySelector(".drawing-layer");
  const group = layer.querySelector("g");
  let drawings = [];
  let history = [[]];
  let historyIndex = 0;
  let tool = "arrow";
  let draft = null;

  function point(event) {
    const rect = layer.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height };
  }

  function redraw() {
    const visibleDrawings = draft ? [...drawings, draft] : drawings;
    const viewport = layer.getBoundingClientRect();
    group.innerHTML = visibleDrawings.map((shape) => {
      if (shape.kind === "arrow") {
        return `<line x1="${shape.x1 * 1000}" y1="${shape.y1 * 1000}" x2="${shape.x2 * 1000}" y2="${shape.y2 * 1000}" ${annotationSvgAttributes} marker-end="url(#${layer.querySelector("marker").id})" />`;
      }
      const circle = circleSvgGeometry(shape, viewport);
      return `<ellipse cx="${circle.cx}" cy="${circle.cy}" rx="${circle.rx}" ry="${circle.ry}" ${annotationSvgAttributes} />`;
    }).join("");
  }

  layer.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    layer.setPointerCapture(event.pointerId);
    const start = point(event);
    draft = startDrawing(tool, start);
    stage.focus();
  });
  layer.addEventListener("pointermove", (event) => {
    if (!draft) return;
    const current = point(event);
    draft.x2 = current.x;
    draft.y2 = current.y;
    redraw();
  });
  layer.addEventListener("pointerup", () => {
    if (draft) commitDrawingState([...drawings, draft]);
    draft = null;
    redraw();
  });

  function commitDrawingState(next) {
    history = history.slice(0, historyIndex + 1);
    history.push(next.map((shape) => ({ ...shape })));
    historyIndex += 1;
    drawings = history[historyIndex].map((shape) => ({ ...shape }));
    updateHistoryButtons();
  }

  function restoreHistory(index) {
    historyIndex = index;
    drawings = history[historyIndex].map((shape) => ({ ...shape }));
    draft = null;
    updateHistoryButtons();
    redraw();
  }

  function updateHistoryButtons() {
    card.querySelector('[data-action="undo"]').disabled = historyIndex === 0;
    card.querySelector('[data-action="redo"]').disabled = historyIndex === history.length - 1;
  }

  card.querySelectorAll("[data-tool]").forEach((button) => button.addEventListener("click", () => {
    tool = button.dataset.tool;
    card.querySelectorAll("[data-tool]").forEach((candidate) => candidate.classList.toggle("active", candidate === button));
  }));
  card.querySelector('[data-action="undo"]').addEventListener("click", () => { if (historyIndex > 0) restoreHistory(historyIndex - 1); });
  card.querySelector('[data-action="redo"]').addEventListener("click", () => { if (historyIndex < history.length - 1) restoreHistory(historyIndex + 1); });
  card.querySelector('[data-action="clear"]').addEventListener("click", () => { if (drawings.length) commitDrawingState([]); redraw(); });
  card.addEventListener("keydown", (event) => {
    if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z" || event.target.matches("textarea")) return;
    event.preventDefault();
    if (event.shiftKey && historyIndex < history.length - 1) restoreHistory(historyIndex + 1);
    else if (!event.shiftKey && historyIndex > 0) restoreHistory(historyIndex - 1);
  });
  stage.tabIndex = 0;
  updateHistoryButtons();
  card.querySelector(".diagram-comment .button").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const body = card.querySelector("textarea").value;
    if (!drawings.length) return setNotice("Draw an arrow or circle first.", "error");
    if (!body.trim()) return setNotice("Add a typed comment for the annotation.", "error");
    button.disabled = true;
    button.textContent = "Capturing…";
    try {
      const imageDataUrl = await toPng(stage, { pixelRatio: 2, backgroundColor: "#fbfaf7" });
      state.drafts.push({
        kind: "mermaid-annotation",
        prUrl: state.prUrl,
        path: file.path,
        headSha: state.data.headSha,
        block,
        geometry: drawings.map((shape) => ({ ...shape })),
        render: { width: stage.clientWidth, height: stage.clientHeight, pixelRatio: 2 },
        imageDataUrl,
        body: body.trim(),
        startLine: block.startLine,
        endLine: block.endLine,
        clientSubmissionId: id(),
      });
      card.querySelector("textarea").value = "";
      commitDrawingState([]);
      redraw();
      updateDraftUI();
      setNotice("Annotation added to the unpublished review.", "success");
    } catch (error) {
      setNotice(error.message, "error");
    } finally {
      button.disabled = false;
      button.textContent = "Add annotation";
    }
  });
}

async function publishReview() {
  if (!state.drafts.length) return;
  const button = document.querySelector("#publish-review");
  button.disabled = true;
  button.textContent = "Publishing…";
  try {
    const result = await request("/api/comments/batch", {
      method: "POST",
      body: JSON.stringify({ prUrl: state.prUrl, headSha: state.data.headSha, event: state.reviewEvent, comments: state.drafts }),
    });
    const count = state.drafts.length;
    state.drafts = [];
    state.reviewEvent = "COMMENT";
    closeSelectionComposer();
    updateDraftBar();
    setNotice(`${result.published ?? count} comment${count === 1 ? "" : "s"} published from one review submission.`, "success");
    await loadPullRequest();
  } catch (error) {
    setNotice(`${error.message} Your unpublished comments are still here.`, "error");
  } finally {
    button.disabled = false;
    button.textContent = "Publish review";
  }
}

function submitReply(commentId) {
  const input = document.querySelector(`#reply-${commentId}`);
  if (!input.value.trim()) return setNotice("Write a reply before adding it.", "error");
  const thread = state.data.threads.find((candidate) => candidate.comments[0]?.databaseId === Number(commentId));
  if (!thread) return setNotice("That thread is no longer available. Refresh from GitHub.", "error");
  state.drafts.push({
    kind: "reply",
    prUrl: state.prUrl,
    path: thread.path,
    headSha: state.data.headSha,
    commentId: Number(commentId),
    body: input.value.trim(),
    startLine: thread.line || thread.startLine || 1,
    endLine: thread.line || thread.startLine || 1,
    clientSubmissionId: id(),
  });
  input.value = "";
  updateDraftUI();
  setNotice("Reply added to the unpublished review.", "success");
}

async function submitReview(event) {
  if (event === "APPROVE" && state.data.reviewCapabilities?.approve?.allowed === false) {
    return setNotice(state.data.reviewCapabilities.approve.reason, "error");
  }
  if (state.drafts.length) {
    state.reviewEvent = event;
    document.querySelectorAll("[data-review]").forEach((button) => button.classList.toggle("selected", button.dataset.review === event));
    setNotice(`${event.replace("_", " ")} will be applied when the review is published.`, "success");
    return;
  }
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

function sourceWordTokens(value) {
  const tokens = [];
  for (const match of value.matchAll(/[\p{L}\p{N}_]+/gu)) tokens.push({ value: match[0].toLocaleLowerCase(), offset: match.index });
  return tokens;
}

function sourceLineAt(source, offset) {
  return source.slice(0, offset).split("\n").length;
}

function locateVisibleLines(source, visibleText) {
  const sourceTokens = sourceWordTokens(source);
  const visibleTokens = sourceWordTokens(visibleText);
  if (!visibleTokens.length) return null;
  const windowSize = Math.min(8, visibleTokens.length);
  const offsets = [...new Set([0, Math.max(0, visibleTokens.length - windowSize)])];
  const matches = [];
  for (const visibleOffset of offsets) {
    const needle = visibleTokens.slice(visibleOffset, visibleOffset + windowSize).map((token) => token.value);
    for (let index = 0; index <= sourceTokens.length - needle.length; index += 1) {
      if (needle.every((token, tokenIndex) => sourceTokens[index + tokenIndex].value === token)) {
        matches.push({ visibleOffset, start: sourceTokens[index].offset, end: sourceTokens[index + needle.length - 1].offset });
      }
    }
  }
  const firstMatches = matches.filter((match) => match.visibleOffset === 0);
  if (firstMatches.length !== 1) return null;
  const lastOffset = offsets.at(-1);
  const lastMatches = matches.filter((match) => match.visibleOffset === lastOffset);
  const end = lastMatches.length === 1 ? lastMatches[0].end : firstMatches[0].end;
  return { startLine: sourceLineAt(source, firstMatches[0].start), endLine: sourceLineAt(source, end) };
}

function decorateDocumentLines(file) {
  const root = document.querySelector("#rendered-document");
  if (!root) return;
  for (const element of root.children) {
    let lines;
    if (element.matches(".diagram-review")) {
      const block = file.mermaidBlocks.find((candidate) => candidate.id === element.dataset.blockId);
      if (block) lines = { startLine: block.startLine, endLine: block.endLine };
    } else {
      lines = locateVisibleLines(file.source, element.textContent.trim());
    }
    if (!lines) continue;
    element.dataset.sourceStart = lines.startLine;
    element.dataset.sourceEnd = lines.endLine;
    element.dataset.sourceLabel = lines.startLine === lines.endLine ? String(lines.startLine) : `${lines.startLine}–${lines.endLine}`;
  }
  applyThreadReferences();
}

function elementForLine(line) {
  const elements = [...document.querySelectorAll("#rendered-document > [data-source-start]")];
  return elements.find((element) => Number(element.dataset.sourceStart) <= line && Number(element.dataset.sourceEnd) >= line)
    || elements.toSorted((left, right) => Math.abs(Number(left.dataset.sourceStart) - line) - Math.abs(Number(right.dataset.sourceStart) - line))[0];
}

function normalizedTextEnd(root, selectedText) {
  if (!selectedText) return null;
  const nodes = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return node.parentElement?.closest(".comment-position-marker, .diagram-toolbar, .diagram-comment")
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT;
    },
  });
  while (walker.nextNode()) nodes.push(walker.currentNode);

  let normalized = "";
  const ends = [];
  for (const node of nodes) {
    for (let offset = 0; offset < node.data.length; offset += 1) {
      const character = node.data[offset];
      if (/\s/.test(character)) {
        if (normalized && !normalized.endsWith(" ")) {
          normalized += " ";
          ends.push({ node, offset: offset + 1 });
        }
      } else {
        normalized += character;
        ends.push({ node, offset: offset + 1 });
      }
    }
  }

  const needle = selectedText.replace(/\s+/g, " ").trim();
  const index = normalized.indexOf(needle);
  if (index < 0 || normalized.indexOf(needle, index + 1) >= 0) return null;
  return ends[index + needle.length - 1];
}

function createPositionMarker(reference) {
  const marker = document.createElement("button");
  marker.type = "button";
  marker.className = `comment-position-marker${reference.draft ? " draft-position-marker" : ""}`;
  marker.dataset.threadKey = reference.key;
  marker.setAttribute("aria-label", `Show comment ${reference.position} in the review column`);
  marker.setAttribute("aria-pressed", "false");
  marker.textContent = reference.position;
  marker.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeSelectionComposer();
    focusThreadCard(reference.key);
  });
  return marker;
}

function placePositionMarker(reference) {
  const root = document.querySelector("#rendered-document");
  const fallback = elementForLine(reference.line);
  if (!root || !fallback) return;
  const marker = createPositionMarker(reference);
  const exactEnd = reference.selectedText ? normalizedTextEnd(root, reference.selectedText) : null;
  if (exactEnd) {
    marker.classList.add("inline-comment-position-marker");
    const range = document.createRange();
    range.setStart(exactEnd.node, exactEnd.offset);
    range.collapse(true);
    range.insertNode(marker);
  } else {
    let group = fallback.querySelector(":scope > .comment-position-group");
    if (!group) {
      group = document.createElement("span");
      group.className = "comment-position-group";
      fallback.append(group);
    }
    group.append(marker);
  }
  fallback.classList.add("has-thread-reference");
}

function applyThreadReferences() {
  document.querySelectorAll("#rendered-document .comment-position-marker, #rendered-document .comment-position-group").forEach((element) => element.remove());
  document.querySelectorAll("#rendered-document > .has-thread-reference").forEach((element) => element.classList.remove("has-thread-reference"));
  if (!state.data) return;
  activeThreadReferences(threadsForActiveFile(), draftsForActiveFile())
    .filter((reference) => reference.line)
    .forEach(placePositionMarker);
}

function focusThreadCard(key) {
  document.querySelectorAll(".thread-card.is-focused").forEach((card) => card.classList.remove("is-focused"));
  document.querySelectorAll(".comment-position-marker[aria-pressed='true']").forEach((marker) => marker.setAttribute("aria-pressed", "false"));
  const card = [...document.querySelectorAll(".thread-card[data-thread-key]")].find((candidate) => candidate.dataset.threadKey === key);
  if (!card) return;
  card.classList.add("is-focused");
  card.focus({ preventScroll: true });
  document.querySelectorAll(".comment-position-marker").forEach((marker) => {
    if (marker.dataset.threadKey === key) marker.setAttribute("aria-pressed", "true");
  });
  card.scrollIntoView({ behavior: "smooth", block: "center" });
}

function goToLine(path, line) {
  if (path !== state.activePath) {
    state.activePath = path;
    closeSelectionComposer();
    renderWorkspace();
  }
  window.setTimeout(() => {
    const target = elementForLine(line);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    target.classList.add("line-focus");
    window.setTimeout(() => target.classList.remove("line-focus"), 1800);
  }, 120);
}

shell();
loadPullRequest({ preservePath: false });

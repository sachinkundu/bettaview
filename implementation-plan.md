# Phase 1 — GitHub Rendered Review Experiment Plan

Status: Proposed experiment  
Source: `initial-requirements.md`  
Follow-on: `phase-2-openspec-traceability-plan.md`  
Last updated: 2026-08-18

## 1. Objective

Build the smallest credible experiment that proves whether rendered Markdown review can work with the native GitHub.com pull request workflow.

The experiment should let a reviewer:

1. open a Markdown file changed by a GitHub pull request,
2. read the Markdown and Mermaid supported by GitHub.com in rendered form,
3. comment on selected rendered content through a native GitHub review thread,
4. draw an arrow or circle over a rendered Mermaid diagram,
5. submit the annotated image with a normal typed comment, and
6. see GitHub replies and review state in the rendered view.

The goal is evidence, not production readiness. Results from a real GitHub integration will determine whether further resources should be committed.

OpenSpec traceability is not part of this experiment. It has its own follow-on plan in `phase-2-openspec-traceability-plan.md` and does not begin until this experiment is reviewed and accepted.

## 2. Experiment boundaries

### In scope

- Markdown files changed in a GitHub pull request.
- The Markdown supported by GitHub.com, using GitHub Flavored Markdown rendering in repository context.
- Mermaid fenced diagrams supported by GitHub.com's current Mermaid version.
- Selection-based comments on rendered prose.
- Arrow and circle annotations on rendered Mermaid diagrams.
- An annotation image paired with a typed comment.
- Native GitHub review threads and replies.
- GitHub review submission states: comment, approve, and request changes.
- Enough context for a coding agent to identify the pull request, file, commit, and Mermaid block.
- A dedicated experiment repository and GitHub App installation.

### Out of scope

- OpenSpec discovery, traceability, graphing, and inference.
- Accessibility work.
- Production deployment or general availability.
- Production hardening, penetration testing, compliance, or formal security review.
- SLOs, dashboards, on-call processes, backups, disaster recovery, or operational runbooks.
- Broad private-repository rollout or use of production repository data.
- Diagram formats other than Mermaid.
- General-purpose review for non-Markdown files.
- Application-owned durable storage.

## 3. Experiment questions

Confirmed GitHub.com capabilities used by this plan:

- GitHub's [Markdown REST API](https://docs.github.com/en/rest/markdown/markdown) renders `gfm` with repository context.
- GitHub [supports Mermaid fenced diagrams](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/creating-diagrams) in pull requests and Markdown files, using GitHub.com's deployed Mermaid version.
- GitHub's [pull request review APIs](https://docs.github.com/en/rest/pulls/reviews) store native comments and the comment, approve, and request-changes states.
- GitHub documents [attachment uploads](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/attaching-files) through its web comment interface. Its documented review API accepts comment bodies and anchors but does not provide a documented general attachment field, so the GitHub-hosted annotation-image path remains a Milestone G0 experiment question.

The experiment must answer:

1. Can a rendered selection be mapped to an anchor that GitHub accepts as a native review thread?
2. Which changed, unchanged, or outdated Markdown lines can receive native threads?
3. Can existing GitHub threads and replies be mapped back to the correct rendered passage?
4. Can the client reproduce GitHub.com's current Markdown and Mermaid output closely enough for useful review?
5. Can an annotated diagram image and typed comment be delivered together in a form a coding agent can consume?
6. Can a diagram annotation be tied to an exact commit and clearly identified as stale after the diagram changes?
7. Are the limitations small enough that the experience is worth further investment?

## 4. Minimal system shape

### GitHub integration

- Install a GitHub App only on the dedicated experiment repository.
- Read the pull request, changed Markdown files, commits, diffs, and review threads.
- Create review comments, replies, and review submissions.
- Keep all durable comments, replies, review state, annotation images, and reconstruction metadata on GitHub.com.
- Refresh explicitly or from the minimum event handling needed for the experiment.

### Experiment review client

- Display changed Markdown files as rendered documents.
- Map rendered elements to source files, ranges, and the exact head commit.
- Display existing GitHub review threads at their rendered anchors.
- Provide text-selection commenting and Mermaid arrow/circle annotation.

### Renderer and anchor map

- Ask GitHub's Markdown API to render in `gfm` mode with repository context.
- Render Mermaid fences using the GitHub.com-supported syntax and current Mermaid version; prove parity in Milestone G0.
- Sanitize or constrain any additional client-side rendering step.
- Emit a map from rendered elements to source ranges.
- Capture the rendered diagram and marks as an image.

### No application persistence

- Fetch pull request source, commits, comments, replies, and review state from GitHub.com when the view opens or refreshes.
- Keep render maps and draft annotations only in the active browser/session.
- Before posting an annotation comment, put its image on GitHub and include its GitHub URL in the native review-comment body.
- Put any reconstruction metadata needed by the client in the GitHub comment body as a versioned machine-readable marker.
- After GitHub confirms the post, discard the local render map, draft image, and submission metadata; rebuilding the view must work from GitHub alone.
- Do not introduce an application database, object store, or long-term local cache for Phase 1.

The only unresolved storage question is how the experiment uploads the generated image to GitHub. Milestone G0 must prove a GitHub-hosted path. Prefer GitHub's attachment upload when it can be used reliably; otherwise store the image as a GitHub repository asset and link it from the native review comment. External asset hosting is out of scope.

## 5. Identity and anchoring

Every render and comment attempt should carry:

- repository and pull request,
- base and head commit,
- file path,
- source line or section range,
- content fingerprint, and
- Mermaid block identity when applicable.

Diagram annotation comments should additionally carry the original render dimensions, normalized mark geometry, source fingerprint, and GitHub-hosted image URL. Store this reconstruction metadata in the GitHub comment, not in an application database.

Coordinates are presentation data, not the sole identity. If a new commit makes an anchor ambiguous, show it as stale instead of silently moving it.

## 6. Delivery milestones

### Milestone G0 — Feasibility spikes

**Goal:** Resolve the unknowns that could make the experiment unworkable.

Tasks:

- Create a fixture pull request covering GitHub.com's documented Markdown features and representative Mermaid diagram types.
- Prove creation and read-back of a native GitHub review thread on changed Markdown.
- Test thread behavior for changed, unchanged, and outdated lines.
- Prototype source-to-render mapping for prose and Mermaid blocks.
- Prove a GitHub-hosted image upload path for generated annotation images.
- Verify GitHub Markdown API output and client Mermaid output against the same content rendered on GitHub.com.
- Capture and replay normalized arrow/circle geometry over a diagram render.
- Record the chosen experiment approach and its known limitations.

Exit criteria:

- A native thread is created on the real fixture pull request and read back from GitHub.
- The thread maps to the intended rendered passage.
- One GitHub-hosted annotated diagram image and typed comment can be retrieved together after all local session state is cleared.
- Any GitHub anchor or image-delivery limitations are documented clearly enough to decide whether to continue.

### Milestone G1 — Rendered pull request reader

**Goal:** Read changed Markdown safely at an exact pull request commit.

Tasks:

- Load pull request identity, head commit, changed Markdown files, source, and diffs.
- Render Markdown through GitHub's `gfm` mode with repository context.
- Render the Mermaid syntax supported by GitHub.com's current Mermaid version.
- Emit the source-to-render map.
- Add basic file navigation and visible loading/error states.
- Show the exact rendered commit and detect when the pull request head changes.

Exit criteria:

- The experiment reviewer can read every changed Markdown fixture file.
- The rendered view identifies its exact head commit.
- Unsafe embedded content is sanitized or rejected.
- Every commentable element exposes its file and source anchor.

### Milestone G2 — Native rendered review

**Goal:** Complete the text-review flow without leaving the rendered interface.

Tasks:

- Select rendered text and draft a comment.
- Convert the selection into a valid GitHub review anchor.
- Publish a native GitHub review thread.
- Fetch and display existing threads, authors, outdated state, and replies.
- Reply to a thread.
- Submit comment, approve, and request-changes review states.
- Refuse publication when the commit or anchor has become stale or ambiguous.

Exit criteria:

- A rendered-text comment appears as a native GitHub thread and is read back into the rendered view.
- A reply made in GitHub appears at the rendered anchor after refresh.
- The three review submission states round-trip with the correct actor and commit.
- Failed or stale submissions are visible and do not appear successful.

### Milestone G3 — Mermaid visual annotation

**Goal:** Deliver an annotated diagram and typed text through a native review thread.

Tasks:

- Draw arrows and circles over the rendered diagram, with undo and clear controls.
- Capture the diagram and marks at a deterministic resolution.
- Include the diagram identity, commit, source fingerprint, geometry, and GitHub-hosted image URL in the GitHub comment.
- Publish the typed comment and image reference in one native thread anchored to the Mermaid block.
- Display the annotation and thread beside the rendered diagram.
- Detect a changed diagram and label the prior annotation as current, stale, replayable, or orphaned.

Exit criteria:

- A reviewer submits an arrow or circle and typed text once and receives one native GitHub thread containing both.
- A coding agent can retrieve the thread, image, pull request, file, commit, and diagram identity from GitHub alone.
- A new commit does not silently move an ambiguous annotation.

## 7. Minimal cross-cutting controls

This is an experiment, not a production system. Cross-cutting work is intentionally limited to controls needed to run the experiment safely and trust its result.

### Security minimum

- Use a dedicated experiment repository with non-sensitive fixture content.
- Grant the GitHub App only the repository and permissions needed for the experiment.
- Keep credentials out of source and logs.
- Sanitize Markdown, HTML, Mermaid output, and links before rendering.
- Do not connect production repositories or store production source data.

### Reliability minimum

- Pin every render, anchor, and annotation to an exact commit.
- Prevent a retry of the same submission from creating an accidental duplicate thread.
- Show GitHub, rendering, and asset failures to the reviewer instead of reporting false success.
- Confirm GitHub has stored the submitted image and identity metadata before discarding session state.
- Use manual refresh and manual recovery where that is sufficient for evaluation.

No accessibility work is included in this phase.

## 8. Completion gate

Phase 1 is complete when Milestones G0–G3 pass and this provider-originated flow is demonstrated against the real experiment repository:

1. Open a pull request that changes Markdown prose and a Mermaid block.
2. Load the rendered document at the exact head commit.
3. Publish a rendered-text comment and read the native thread back from GitHub.
4. Reply in GitHub and read the reply back at the rendered anchor.
5. Submit an arrow or circle annotation with typed text and retrieve both as the coding-agent consumer.
6. Submit comment, approve, and request-changes review states and read them back from GitHub.
7. Push a diagram change and verify the old annotation receives the correct state without silent repositioning.
8. Clear all browser and application session state, reopen the pull request, and reconstruct the rendered comments and annotation from GitHub alone.

Passing mocked or self-contained tests alone does not satisfy the gate. Retain the pull request identifier, commit SHA, GitHub thread identifiers, annotation asset, read-back result, and screenshots needed to reproduce the demonstration.

## 9. Verification

Automate only the checks that materially improve confidence or speed up iteration:

- source-to-render mapping,
- Markdown sanitization and fixture rendering,
- parity checks against GitHub.com's Markdown and Mermaid rendering,
- coordinate normalization,
- stale commit and fingerprint detection,
- GitHub payload parsing,
- duplicate-submission protection, and
- the real end-to-end scenarios in the completion gate.

## 10. Requirement coverage

| Requirement area | Delivery |
| --- | --- |
| Render the Markdown and Mermaid supported by GitHub.com | Milestones G0 and G1 |
| Comment on selected rendered content | Milestone G2 |
| Native threads, replies, and review states | Milestone G2 |
| Arrow/circle annotation and image capture | Milestone G3 |
| Deliver and reconstruct image, text, pull request, file, commit, and diagram context from GitHub | Milestone G3 |
| Explicitly scoped repository access | Milestones G0 and G1 |
| Real GitHub proof | Completion gate |

## 11. Initial backlog

1. Fixture repository and representative Markdown/Mermaid pull request.
2. GitHub App permission and native-thread spike.
3. Rendered-element-to-source anchor spike.
4. GitHub-hosted annotation image-delivery spike.
5. Markdown/Mermaid rendering and sanitization spike.
6. Milestone G1 reader implementation.
7. Milestone G2 review round trip.
8. Milestone G3 diagram annotation round trip.
9. Completion-gate demonstration and findings summary.

Estimate one milestone at a time. Do not create a production-hardening backlog or begin Phase 2 before the experiment results are reviewed.

## 12. Result and investment decision

At the end of Phase 1, produce a short findings document containing:

- the real GitHub evidence,
- the flows that worked,
- platform limitations and failed cases,
- unsupported Markdown or Mermaid cases,
- annotation-storage and anchoring constraints,
- rough effort and architecture implications for a production version, and
- a recommendation to stop, revise, extend the experiment, or invest in productization.

Further security, reliability, accessibility, operational, and production work requires a separate decision after these results are available.

# Phase 2 — OpenSpec Traceability Implementation Plan

Status: Deferred experiment  
Source: `initial-requirements.md`  
Depends on: `implementation-plan.md` Phase 1 completion gate  
Last updated: 2026-08-18

## 1. Objective

Add visual traceability across an OpenSpec change from proposal through implementation tasks:

`Proposal → Specs → Design → Tasks`

The graph should expose exact source passages, upstream rationale, downstream coverage, missing or invalid relationships, and the provenance of every link. It should serve both human reviewers and coding agents.

Phase 2 is a follow-on experiment. It reuses the completed Phase 1 GitHub rendering, identity, navigation, authorization, and pull request integration layers. It must not weaken or regress the rendered-review workflow.

## 2. Entry conditions

Phase 2 does not start until the Phase 1 results in `implementation-plan.md` have been reviewed and there is an explicit decision to invest further resources.

Before Phase 2 implementation begins:

- the GitHub rendered reader, native review threads, replies, review states, and Mermaid annotations work end to end against a real GitHub App installation,
- the Phase 1 document and anchor identity contracts are documented,
- the dedicated experiment-repository boundary is proven,
- known Phase 1 limitations are recorded, and
- any Phase 2 change required to a Phase 1 contract has an explicit compatibility and migration plan.

## 3. Scope boundaries

### In scope

- Discover proposal, specification, design, and task documents belonging to one OpenSpec change.
- Represent documents and relevant passages as visual nodes.
- Represent traceability relationships as directed links.
- Navigate from nodes and links to exact rendered passages.
- Show upstream rationale and downstream implementation coverage.
- Support explicit author-recorded links and advisory inferred links.
- Preserve file, source range, stable identity, commit, provenance, evidence, and confidence.
- Detect and explain healthy, missing, broken, stale, and inferred relationships.
- Refresh affected graph records when pull request documents change.
- Make graph data and findings available to human reviewers and coding agents.

### Deferred until a later decision

- Reviewer creation or correction of links from the graph.
- Automated mutation of OpenSpec source documents.
- Merge-blocking traceability validation.
- Semantic or model-based inference unless deterministic inference proves insufficient.
- OpenSpec layouts that are not represented in the Phase O0 corpus.
- Accessibility work.
- Production deployment, hardening, or operational readiness.

### Non-goals

- Replacing the Phase 1 rendered-review interface.
- Treating inferred relationships as author-confirmed facts.
- Silently updating or promoting inferred links to explicit links.
- Making line numbers the sole identity for a traced item.
- Guaranteeing that stale references remain navigable after arbitrary source changes.

## 4. Working assumptions and decision gates

| Topic | Working assumption | Decision gate |
| --- | --- | --- |
| Phase 1 reuse | Traceability uses Phase 1 rendering, navigation, repository authorization, and commit identity. | Validate during Milestone O0. |
| OpenSpec identity | Prefer stable identifiers and explicit manifest links; use section anchors and content fingerprints as fallback identity. | Confirm after inspecting the Milestone O0 corpus. |
| Explicit data | A versioned sidecar manifest can record items and relationships without making GitHub cease to be the source of truth for documents. | Confirm in Milestone O0. |
| Inference | Inferred links are advisory, include evidence and confidence, and never overwrite explicit links. | Confirm the confidence policy before Milestone O2. |
| Validation | Missing, broken, stale, and inferred relationships initially produce visible findings, not merge-blocking failures. | Revisit after usage evidence. |
| Processing | Traceability processing runs against an exact pull request commit and emits versioned records. | Choose its runtime location in Milestone O0. |

## 5. Proposed system extension

### 5.1 Traceability processor

- Discovers the OpenSpec documents belonging to the pull request change.
- Reads an explicit manifest when present.
- Derives only missing relationships when inference is enabled.
- Validates relationship targets and classifies their state.
- Emits a versioned graph tied to a repository, pull request, and commit.
- Reprocesses only affected items when source documents change.

### 5.2 Graph review interface

- Adds a high-level graph to the Phase 1 rendered-review client.
- Filters by document type, relationship type, provenance, and validation state.
- Supports upstream and downstream traversal.
- Opens the exact Phase 1 rendered passage for a selected node or relationship.
- Provides a basic findings list for inspecting relationships without navigating the graph.
- Exposes the reason and source evidence for every finding.

### 5.3 On-demand graph state

- Read OpenSpec documents and explicit manifests from GitHub at the selected pull request commit.
- Derive graph items, relationships, validation results, and inferred evidence on demand.
- Keep the graph in browser or job memory only for the active experiment session.
- If a finding is posted, publish it as a native GitHub review comment with enough versioned metadata to reconstruct it from GitHub.
- Do not add an application database, object store, or durable graph cache for the experiment.

## 6. Identity and traceability data model

Every traced item should contain:

- repository and pull request,
- base and head commit,
- document type,
- file path,
- item type,
- stable item identifier when available,
- source section or line range,
- normalized content fingerprint, and
- schema/indexer version.

Every relationship should contain:

- source and target item identifiers,
- source and target document types,
- file paths and source ranges,
- relationship type,
- provenance: `explicit` or `inferred`,
- inference method and supporting evidence when applicable,
- confidence when inferred,
- validation state and reason,
- repository, pull request, and commit, and
- record/schema version and timestamps.

Stable identifiers and fingerprints are the primary identity mechanisms. Line and section ranges locate content within a specific version but do not independently establish identity across versions.

## 7. Delivery milestones

### Milestone O0 — OpenSpec discovery and data contract

**Goal:** Establish the real OpenSpec document structures, identity rules, and traceability contract.

Tasks:

- Inventory representative OpenSpec changes and document their actual layouts, heading conventions, identifiers, explicit references, and existing metadata.
- Define which proposal, specification, design, and task documents belong to one change.
- Define the traceability vocabulary and mandatory and optional relationship types.
- Decide stable identifier placement: embedded Markdown, sidecar manifest, or both.
- Define and version a traceability manifest and record schema.
- Specify validation states and rules for healthy, missing, broken, stale, and inferred relationships.
- Define the coding-agent graph/findings interface.
- Choose where the traceability processor runs.
- Define the non-sensitive fixture-data boundary for traceability processing and inference.
- Record decisions for processing, data retention, explicit manifests, inference, and merge-policy boundaries.

Exit criteria:

- At least two representative OpenSpec changes have been inventoried.
- Document discovery and identity rules are demonstrated against the inventory.
- The manifest, record schema, relationship vocabulary, and validation rules are reviewed and versioned.
- Phase 2 does not require a breaking change to a Phase 1 contract; any required change has an explicit migration plan.

### Milestone O1 — Explicit OpenSpec traceability

**Goal:** Visualize author-declared traceability before introducing inferred relationships.

Tasks:

- Build adapters for the observed OpenSpec document layouts.
- Discover documents belonging to one change and validate manifest references against the pull request commit.
- Generate the proposal-to-specification-to-design-to-task graph.
- Add basic graph filtering, upstream/downstream traversal, a status legend, and a findings list.
- Navigate from nodes and links to exact rendered passages.
- Show healthy, missing, broken, and stale relationships with reasons and source evidence.
- Make the graph data available through a documented interface consumable by coding agents.

Exit criteria:

- A fixture OpenSpec change with explicit identifiers and links produces a deterministic graph.
- Every node and relationship navigates to the correct rendered source passage at the indexed commit.
- Broken targets and missing mandatory links are visible with actionable reasons.
- Recomputed graph records retain provenance and commit identity after refresh.

### Milestone O2 — Hybrid discovery and inference

**Goal:** Add advisory relationships for legacy or incomplete documents without weakening trust in explicit links.

Tasks:

- Implement deterministic inference first, using identifiers, explicit textual references, normalized headings, and task references.
- Add semantic inference only if deterministic coverage is insufficient and a measured evaluation justifies it.
- Record evidence, method, model/version if applicable, and confidence for every inferred link.
- Define confidence bands and the conditions for inferred, stale, and untrusted classifications.
- Evaluate inference against a human-labelled corpus of representative OpenSpec changes.
- Visually separate explicit and inferred links and allow inferred links to be hidden.
- Recompute affected records when documents change.
- Never silently promote inferred links to explicit links.

Exit criteria:

- Evaluation thresholds for precision and coverage are agreed and met on the labelled corpus.
- Every inferred edge exposes why it exists and how confident the processor is.
- Explicit records always take precedence and remain visually distinguishable.
- Changed documents invalidate or revalidate dependent inferred relationships deterministically.

### Milestone O3 — Experiment evaluation and regression proof

**Goal:** Prove traceability behavior against real OpenSpec changes without regressing Phase 1.

Tasks:

- Test complete, missing, broken, stale, and inferred relationships against representative real changes.
- Verify graph navigation and coding-agent consumption at exact commits.
- Run the complete Phase 1 regression suite.
- Document the supported OpenSpec subset, validation semantics, inference limitations, and known gaps.

Exit criteria:

- Real OpenSpec changes produce reproducible graph and finding records.
- All Phase 1 completion-gate scenarios continue to pass.
- A findings summary supports a decision to stop, revise, extend the experiment, or invest further.

## 8. Minimal cross-cutting controls

This is not a production system. Apply only the controls needed to keep the experiment isolated and make its findings trustworthy.

### Security minimum

- Use the dedicated experiment repository and non-sensitive fixture content.
- Apply the Phase 1 GitHub App scope to graph, finding, evidence, and processing requests.
- Treat OpenSpec documents, manifest content, identifiers, references, and inferred evidence as untrusted input.
- Do not send repository content to an external inference service during the experiment without an explicit decision.
- Keep credentials out of source and logs.
- Keep derived graph records in session memory only; put any posted finding and reconstruction metadata on GitHub.

### Reliability minimum

- Pin every graph and finding to an exact commit.
- Make stale data explicit and never imply that a prior graph represents the latest head.
- Version traceability records, manifests, adapters, validation rules, and inference methods.
- Preserve enough context to reproduce the experiment findings.
- Use manual refresh and recovery where sufficient.

No accessibility work is included in Phase 2.

## 9. Verification plan

### Automated tests

- Unit tests for OpenSpec discovery, manifest parsing, graph generation, validation, evidence, confidence, and state classification.
- Contract tests for versioned traceability records and the coding-agent interface.
- Golden graph tests for complete, missing, broken, stale, and inferred fixture changes.
- Integration tests for commit refresh, deterministic invalidation, and explicit-over-inferred precedence.
- Measured inference evaluation against a human-labelled corpus.
- The complete Phase 1 regression suite.

### Real end-to-end scenarios

Automated tests do not replace provider-originated proof. Run these scenarios against real GitHub pull requests containing representative OpenSpec changes:

1. Index a complete explicitly linked OpenSpec change and verify every graph navigation target.
2. Break or remove selected references and verify missing, broken, and stale states from source and graph records.
3. Index an incomplete legacy change and verify inferred links retain evidence, confidence, and visibly distinct provenance.
4. Push a new commit and verify affected graph records are refreshed or invalidated against the correct commit.
5. Expose the same graph and findings to a human reviewer and the coding-agent consumer.
6. Repeat the Phase 1 real end-to-end scenarios and verify no regression.

For every scenario, retain the GitHub URL or identifier, commit SHA, posted GitHub comment identifiers, read-back result, and any findings artifact committed to the experiment repository. Do not retain a separate application copy.

## 10. Requirement coverage

| Requirement area | Planned delivery |
| --- | --- |
| Define the OpenSpec data contract and discovery rules | Milestone O0 |
| Discover OpenSpec documents and render a navigable graph | Milestone O1 |
| Exact anchors and upstream/downstream coverage | Milestone O1 |
| Explicit versus inferred provenance | Milestones O1 and O2 |
| Missing, broken, stale, healthy, and inferred states | Milestones O1 and O2 |
| Refresh traceability when documents change | Milestones O1 and O2 |
| Graph/findings available to humans and coding agents | Milestone O1 |
| Preserve the experiment boundary and Phase 1 behavior | Milestone O3 |

## 11. Principal risks and mitigations

| Risk | Mitigation |
| --- | --- |
| OpenSpec layouts differ across repositories or versions. | Inventory real changes first, version adapters, and define the supported subset explicitly. |
| Line anchors break through rebases and force-pushes. | Use stable identifiers and content fingerprints in addition to line ranges; retain original commit context and surface stale state. |
| Inference creates convincing but false traceability. | Prefer explicit manifests, expose evidence and confidence, visually distinguish inference, measure precision, and keep it advisory. |
| A relationship target changes enough to invalidate prior evidence. | Revalidate at each indexed commit and classify the record as stale or broken instead of silently retargeting it. |
| Large documents or graphs become unusable. | Process incrementally, virtualize long views, cluster or filter graphs, and provide a searchable findings list. |
| Graph processing exposes source content unnecessarily. | Use non-sensitive fixture content, keep the GitHub App scoped to the experiment repository, and minimize duplicated source content. |
| Phase 2 changes regress the GitHub review workflow. | Preserve Phase 1 contracts and run its complete regression and provider-originated scenarios before Phase 2 completion. |

## 12. Initial Phase 2 backlog

Create this backlog only after Phase 1 results support an explicit decision to invest further:

1. Representative OpenSpec corpus inventory.
2. Document discovery and change-membership rules.
3. Stable identity and source-anchor decision.
4. Relationship vocabulary and validation-state decision.
5. Versioned manifest and traceability-record schema.
6. Processing-location and repository-data-boundary decision.
7. Coding-agent graph/findings interface contract.
8. Milestone O1 implementation breakdown based on the approved O0 artifacts.

Do not estimate inference work until explicit traceability has been implemented and evaluated. Estimate Milestones O1–O3 separately using evidence from the preceding milestone.

## 13. Product decisions still required

- Canonical OpenSpec document layouts and relationship vocabulary.
- Stable identifier placement: embedded Markdown, sidecar manifest, or both.
- Mandatory versus optional traceability relationships.
- Traceability processor runtime location.
- Coding-agent graph/findings consumption interface.
- Whether private repository content may be processed by any external inference service.
- Confidence thresholds and evaluation corpus for inference.
- Whether any traceability finding should eventually become merge-blocking.
- Whether a future product needs a durable graph cache after the on-demand experiment is evaluated.

Capture decisions as dated architecture or product decision records so requirements, implementation, and acceptance evidence remain traceable.

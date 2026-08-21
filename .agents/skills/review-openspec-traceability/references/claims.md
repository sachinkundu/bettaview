# Traceability claims and limits

## Accepted inputs

The current parser contract recognizes:

- top-level Markdown list items under `## What Changes` as proposal statements;
- capability declarations of the form ``- `capability-path`: description`` under `## Capabilities`;
- exactly one `specs/<capability-path>/spec.md` for every declared capability and no orphan spec files; and
- requirement blocks beginning with `### Requirement: `.

Reject an input that does not fit this contract. Do not reinterpret a different proposal shape silently.

## Host-controlled facts

The runner, not the model:

- supplies immutable line-numbered proposal and spec snapshots;
- pins every reviewed document with SHA-256;
- injects the selected model and Codex CLI version;
- injects the accepted review timestamp and prompt version;
- derives `review.overall` from judgments and findings;
- converts proposal line IDs into exact quotations;
- converts requirement start lines into complete requirement ranges;
- checks exact capability/spec correspondence and bidirectional adjacency; and
- publishes `bettaview-traceability.json` only after validation succeeds.

## Model-controlled opinions

Codex selects the semantic links and judges:

- proposal statement coverage: sufficient, partial, or missing;
- requirement coverage: sufficient, partial, or missing;
- capability scope: in scope, mixed, or out of scope;
- minimality: minimal, over-specified, or uncertain; and
- evidence-backed findings and rationales.

These are review opinions. Running the same model again can produce a different opinion.

## Honest product claim

Say:

> BettaView creates an evidence-backed proposal/spec review. Its deterministic validator proves that the cited text, document versions, parsed inventory, and two-way mapping are internally consistent. The semantic assessment remains a Codex review judgment.

Do not say:

> BettaView deterministically proves that every specification is necessary and sufficient.


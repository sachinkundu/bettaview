# Proposal-to-Spec Traceability — Minimal Implementation Plan

Status: Bidirectional semantic-review extension complete  
Source: `phase-2-openspec-traceability-plan.md`  
Scope: Only the first proposal-to-spec connection  
Last updated: 2026-08-20

## Goal

Prove that BettaView can store, validate, and display one useful connection from an exact passage in a normal OpenSpec proposal to an exact passage in a generated OpenSpec specification.

The proof is complete when one command displays this result from a real OpenSpec change:

```text
proposal.md:5-7
  ↓ leads to
specs/workflow/spec.md:3-10
```

The command must also print the referenced proposal and specification text so the connection can be inspected directly.

## Boundaries

These boundaries describe the completed version 1 proof. On 2026-08-19 the user explicitly authorized the evidence-backed semantic-review extension recorded below; its version 2 sidecar adds judgments, quotations, provenance, and fingerprints while preserving version 1 compatibility.

- [x] Keep `proposal.md`, files under `specs/`, `design.md`, `tasks.md`, and `.openspec.yaml` unchanged.
- [x] Store all BettaView traceability data in `openspec/changes/<change-name>/bettaview-traceability.json`.
- [x] Support proposal-to-spec links only.
- [x] Use file paths and line ranges only; do not add stable IDs, fingerprints, confidence, inference, or additional schemas yet.
- [x] Do not build a graph, browser interface, GitHub endpoint, review comment integration, database, or cache.
- [x] Do not support design documents, tasks, legacy-change inference, link editing, or merge-blocking validation.

## Step 1 — Prepare one reproducible example

- [x] Create the non-sensitive `add-batch-calculator-cli` OpenSpec change with a normal `proposal.md`.
- [x] Run the normal OpenSpec specs-generation step so it creates standard files under `specs/`.
- [x] Confirm the proposal and generated specs contain no BettaView markers or metadata.
- [x] Select proposal passages and the specification requirements that were created from them.
- [x] Record the exact file path, start line, and end line for both ends of each connection.

### Done when

- [x] One proposal passage has one clearly corresponding spec passage.
- [x] Standard OpenSpec validation passes before BettaView data is added.

## Step 2 — Write the minimal sidecar

- [x] Create `openspec/changes/<change-name>/bettaview-traceability.json` after the specs step.
- [x] Use only this version 1 structure:

```json
{
  "version": 1,
  "change": "resume-paused-workflow",
  "links": [
    {
      "id": "link-1",
      "proposal": {
        "file": "proposal.md",
        "startLine": 5,
        "endLine": 7
      },
      "spec": {
        "file": "specs/workflow/spec.md",
        "startLine": 3,
        "endLine": 10
      }
    }
  ]
}
```

- [x] Produce the first sidecar with a focused agent step after normal spec generation.
- [x] Do not decide yet whether the final producer belongs in OpenSpec, an `opsx:continue` wrapper, or a separate command.

### Done when

- [x] The sidecar contains at least one proposal-to-spec link.
- [x] No standard OpenSpec document was changed to carry the link.

## Step 3 — Implement a small validator and viewer

- [x] Add one Node.js command that accepts the OpenSpec change directory.
- [x] Read and parse `bettaview-traceability.json`.
- [x] Reject an unsupported sidecar version.
- [x] Check that `change` matches the change directory name.
- [x] Check that every link has an ID, proposal endpoint, and spec endpoint.
- [x] Resolve paths only inside the selected change directory.
- [x] Check that proposal paths resolve to `proposal.md` and spec paths resolve under `specs/`.
- [x] Check that every start and end line is a positive integer and `startLine <= endLine`.
- [x] Check that every referenced file exists and every range is within that file.
- [x] Print each valid connection as proposal location and text, a directional separator, and spec location and text.
- [x] Print a specific error for a missing file or invalid line range and exit unsuccessfully.
- [x] Add a package script so the proof has one documented command, for example `npm run traceability -- <change-directory>`.

### Done when

- [x] The command displays both ends of the real proposal-to-spec connection.
- [x] The command never silently skips a malformed or broken link.

## Step 4 — Add only the essential tests

- [x] Add one valid fixture containing a proposal, one spec, and one sidecar link.
- [x] Test that the valid link resolves to the expected proposal and spec text.
- [x] Test rejection of a missing proposal file.
- [x] Test rejection of a missing spec file.
- [x] Test rejection of a zero, reversed, or out-of-bounds line range.
- [x] Test rejection of a path that escapes the selected change directory.
- [x] Test rejection of an unsupported sidecar version.
- [x] Run the existing BettaView test suite to ensure the new command does not break current behavior.

### Done when

- [x] All focused traceability tests pass.
- [x] All existing BettaView tests pass.

## Step 5 — Run and record the proof

- [x] Run normal OpenSpec validation on the real change after the sidecar is present.
- [x] Run the traceability command and retain its proposal-to-spec output.
- [x] Temporarily break one target file path and retain the resulting error.
- [x] Temporarily make one line range invalid and retain the resulting error.
- [x] Restore the valid sidecar and rerun both OpenSpec validation and the traceability command.
- [x] Record the change name, command, output, sidecar, and validation results under `evidence/openspec-traceability-initial-slice/`.

## Definition of done

- [x] Normal OpenSpec generation produces unchanged proposal and spec documents.
- [x] A separate BettaView sidecar records at least one proposal-to-spec connection.
- [x] One command displays the exact text at both ends of the connection.
- [x] Missing files and invalid ranges fail visibly.
- [x] Standard OpenSpec validation still passes.
- [x] Focused and existing BettaView tests pass.
- [x] No graph, browser UI, inference, design/task support, or permanent producer integration was added.

## Authorized semantic-review extension

- [x] Treat OpenSpec's capability-to-spec-file relationship as deterministic input to the review.
- [x] Codify the LLM judge's coverage, scope, minimality, and exact-evidence contract in a versioned prompt.
- [x] Generate a version 2 sidecar for `add-batch-calculator-cli` with reviewer provenance, document fingerprints, capability identity, exact proposal quotations, requirement ranges, semantic judgments, rationales, and findings.
- [x] Reject stale document fingerprints and proposal quotations that do not exactly match their cited ranges.
- [x] Require every semantic judgment to contain proposal evidence and target one complete parsed requirement block.
- [x] Require every requirement block in the capability's spec file to have exactly one semantic review link.
- [x] Preserve validation and rendering support for version 1 sidecars.
- [x] Record the semantic-review proof under `evidence/openspec-semantic-traceability-review/`.

## Authorized bidirectional review extension

- [x] Parse every top-level `## What Changes` list item into a deterministic proposal statement inventory without modifying OpenSpec artifacts.
- [x] Add version 3 sidecars with one forward coverage record for every proposal statement.
- [x] Require the reviewed capability set to exactly match proposal capability declarations.
- [x] Require actual `specs/**/spec.md` files to exactly match the declared capability paths.
- [x] Preserve one reverse semantic link for every complete requirement block.
- [x] Require proposal-statement forward mappings and requirement reverse citations to agree.
- [x] Reject omitted statements, orphan spec files, empty sufficient mappings, unknown links, stale hashes, fabricated quotes, incomplete requirements, and inconsistent adjacency.
- [x] Add a bidirectional, adversarial Codex prompt and JSON output schema.
- [x] Preserve version 1 and version 2 validation compatibility.
- [x] Run the flow against deos-review-agent PR #22 at exact head `8c447b3da7ef68cf4ad75c1849e5fa7f30477278`.
- [x] Retain the validator-driven repair and accepted version 3 sidecar under `evidence/openspec-traceability-pr22-v3/`.

## Decision after the proof

- [x] Review whether the connection is useful and precise enough to continue.
- [x] Choose a separate BettaView post-processing command so standard OpenSpec artifacts remain unchanged.
- [x] Package the accepted workflow as a repository-local agent skill, versioned prompt/schema, Codex CLI runner, bounded repair loop, and deterministic validator.
- [ ] Create a separate plan for visualization or broader lifecycle traceability work.

# OpenSpec Traceability — Initial Slice

Status: Concrete scope for the first traceability experiment

## Goal

Prove that Bettaview can record useful links from an OpenSpec proposal to the specifications created from it.

This slice is only about what those links look like and how they are stored. It does not design the visualization and does not extend the mapping to design or tasks.

## Firm boundary

OpenSpec documents must remain standard OpenSpec documents.

Bettaview must not add IDs, citation markers, comments, or other traceability metadata to:

- `proposal.md`
- files under `specs/`
- `design.md`
- `tasks.md`
- `.openspec.yaml`

All Bettaview traceability information lives in a separate Bettaview-owned sidecar file.

## Existing OpenSpec handoff

`opsx:continue` already knows how to move from one artifact to the next:

1. It asks OpenSpec for the current change status.
2. OpenSpec reports which artifact is ready next.
3. When specs are ready, OpenSpec returns the proposal as a dependency.
4. The agent reads the proposal and creates normal OpenSpec spec files.

OpenSpec therefore already tells us that the proposal is an input to the specs. It does not record which proposal passage led to each specification requirement.

## Bettaview wrapper

For this initial slice, Bettaview wraps the normal specs step:

1. Capture the exact proposal file returned as the specs dependency.
2. Let `opsx:continue` create the standard OpenSpec specs without changing their format.
3. Read the proposal and the newly created spec files.
4. Produce proposal-to-spec links in a separate sidecar file.
5. Check that every stored file and line range still exists.

The first link producer may be a focused agent step. OpenSpec identifies the documents involved; the link producer identifies the exact passages within those documents.

## Sidecar location

Store the first experiment's data at:

```text
openspec/changes/<change-name>/bettaview-traceability.json
```

The sidecar is derived data. The proposal and specs remain the source documents.

## Minimal sidecar shape

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

This is deliberately small. More identity or change-detection fields should be added only when the experiment proves they are needed.

## What the first proof must show

- `opsx:continue` creates normal OpenSpec specs from a normal proposal.
- Neither the proposal nor the specs contain Bettaview markers or metadata.
- Bettaview creates a separate sidecar containing at least one proposal-to-spec link.
- Both ends of every link resolve to real files and line ranges.
- A broken file or line range is reported instead of silently ignored.
- Standard OpenSpec validation still passes for the change.

## Out of scope

- Proposal-to-design, spec-to-design, or task links.
- Editing OpenSpec documents to add traceability.
- Choosing the final graph or review interface.
- Inferring links across old changes that were not created through this experiment.
- Merge-blocking traceability checks.

## Decision after the proof

After testing this on a real OpenSpec change, decide whether the sidecar should be produced by:

- an OpenSpec extension,
- a Bettaview wrapper around `opsx:continue`, or
- a separate post-processing command.

That decision should use the evidence from this slice rather than being made before the link format is proven.

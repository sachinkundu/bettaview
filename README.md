# BettaView

BettaView is a Phase 1 experiment for reviewing GitHub pull request Markdown in
rendered form while keeping comments and review state native to GitHub.

The rendered-review experiment plan is in [`implementation-plan.md`](implementation-plan.md).
The Phase 2 OpenSpec traceability proof now supports bidirectional proposal/spec
review; the broader graph and review-interface experiment remains deferred.

## Run the OpenSpec traceability proof

Run these commands from the BettaView repository root. You need Node.js 22 or
newer, installed npm dependencies, and an authenticated Codex CLI:

```sh
npm install
codex login status
```

The selected OpenSpec change directory must contain:

- `proposal.md` with top-level list items under `## What Changes`;
- at least one capability declaration under `## Capabilities` in the form
  ``- `capability-name`: description``; and
- exactly one `specs/<capability-name>/spec.md` per declared capability, with
  one or more `### Requirement:` blocks.

Pass either a relative or absolute change-directory path and explicitly select
the Codex model:

```sh
npm run traceability:review -- <change-directory> --model <codex-model>
npm run traceability -- <change-directory>
```

For example, run the included batch-calculator fixture with:

```sh
openspec validate add-batch-calculator-cli --type change --strict --no-interactive
npm run traceability:review -- openspec/changes/add-batch-calculator-cli --model gpt-5.6-sol
npm run traceability -- openspec/changes/add-batch-calculator-cli
```

The generator writes `<change-directory>/bettaview-traceability.json`. It runs
Codex CLI in a read-only sandbox, supplies immutable line-numbered source,
materializes exact evidence, and validates the candidate before publishing it.
It performs up to two validator-driven repair attempts by default. Override the
bound when needed:

```sh
npm run traceability:review -- <change-directory> --model <codex-model> --max-repairs 1
```

If every candidate is rejected, the command exits with an error and preserves
the existing sidecar. Runtime provenance and the overall result are host-derived
rather than trusted from model output.

Version 3 sidecars review both directions. Every `## What Changes` statement has
a forward coverage record, and every complete requirement has a reverse link to
exact proposal evidence with coverage/scope/minimality judgments. The current
Codex judge contract and structured-output schema are in
[`prompts/openspec-semantic-traceability-bidirectional-v2.md`](prompts/openspec-semantic-traceability-bidirectional-v2.md)
and [`prompts/openspec-semantic-traceability-bidirectional-v2.schema.json`](prompts/openspec-semantic-traceability-bidirectional-v2.schema.json).

Codex agents can invoke the repository-local
[`review-openspec-traceability`](.agents/skills/review-openspec-traceability/SKILL.md)
skill directly with `$review-openspec-traceability` or allow its description to
match a traceability request.

Codex returns line IDs and semantic opinions. For debugging or retained judge
output, the lower-level host commands remain available to materialize exact
quotes, complete requirement ranges, fingerprints, and bidirectional adjacency:

```sh
npm run traceability:materialize -- <change-directory> <judge-line-ids.json>
npm run traceability -- <change-directory>
```

The traceability command validates every file, quotation, fingerprint, and line
range, rejects paths that leave the selected change directory, and prints the
exact text at both ends of each valid link. It validates structural evidence
and graph integrity; coverage, scope, and minimality remain Codex review
opinions. Retained proof output is under
[`evidence/openspec-traceability-initial-slice/`](evidence/openspec-traceability-initial-slice/),
and the evidence-backed semantic review is under
[`evidence/openspec-semantic-traceability-review/`](evidence/openspec-semantic-traceability-review/).
The real PR #22 bidirectional proof, including a validator-driven Codex repair
pass and one retained semantic finding, is under
[`evidence/openspec-traceability-pr22-v3/`](evidence/openspec-traceability-pr22-v3/).

## Run the experiment portal

Prerequisites: Node.js 22 or newer and an authenticated GitHub CLI session with
access to the pull request repository.

```sh
npm install
npm run build
npm start
```

Open <http://127.0.0.1:4174>. The portal remembers the most recently opened
pull request and restores it while it remains open on GitHub. Otherwise, it
starts with a centered field for an open GitHub pull request URL.

- Select unique text in rendered Markdown to open a comment box beside the
  selection.
- Draw arrows or circles over rendered Mermaid diagrams, with undo and redo,
  then add typed comments for the annotations.
- Keep new comments and replies in the local review queue. The publish control
  appears with the first draft and sends the queue in one review submission.
- Use the numbered markers at each rendered comment position to reveal and
  highlight the matching card in the thread column. Threads without BettaView
  selection metadata fall back to their native GitHub line.
- Use the rendered line-number gutter or a thread's file-and-line link to move
  back from the discussion to the document.
- See only the published threads and unpublished comments for the Markdown file
  currently open in the document view.
- Refresh to reconstruct published threads and annotation metadata from GitHub.
  BettaView warns before a refresh or navigation would discard local drafts.

The experiment server binds only to loopback. It reads the token returned by
`gh auth token` in the server process and never sends the token to the browser.
Annotation PNGs are committed to the `bettaview-annotations` branch and linked
from native review comments. No application database or asset store is used.

## Experiment shortcut

This one-shot implementation uses the local GitHub CLI identity instead of a
GitHub App. It is intended only for the dedicated, non-sensitive public fixture
repository. A production implementation would require GitHub App installation
authentication, authorization boundaries, and broader security work.

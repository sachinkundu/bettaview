# OpenSpec traceability proof: deos-review-agent PR #22

This is a read-only, exact-head test against <https://github.com/sachinkundu/deos-review-agent/pull/22>.

- PR head: `29274bbea0ae01dcc7826ef19a12698549199fd8`
- PR base: `4c80b0b422b20f36a8aa4bc8f97b32ed251f89db`
- change: `review-history-aware-rechecks`
- proposal SHA-256: `8236a97d8aaf8369f8b7e322398d661e06e8884abde2a60092d8321e12a6edb1`
- result: 6 capabilities and 41 complete requirement blocks/links in both runs
- OpenSpec result: `openspec validate review-history-aware-rechecks --type change --strict --no-interactive` passed
- BettaView result: the materialized sidecar passed deterministic validation

There are two intentionally separate semantic results:

- `judge-line-ids.json` and `bettaview-traceability.json` encode the three findings already produced by the independent Codex GitHub review. This is the review-grounded result.
- `codex-cli-standalone-judge-line-ids.json` and `codex-cli-standalone-traceability.json` came from a fresh, isolated `codex exec` run that was prohibited from reading GitHub reviews. It returned zero findings and `overall: pass`.

Both judgments contain only proposal line IDs and spec requirement start-line IDs for evidence—not copied quotations, calculated end lines, or hashes. In both cases the host extracted proposal quotations, expanded each spec start line to one complete requirement block, and calculated document hashes.

The three findings reproduce the substance of the three Codex review threads on the exact head:

- recheck mode can suppress fresh defect discovery after new commits: <https://github.com/sachinkundu/deos-review-agent/pull/22#discussion_r3820009494>
- initial-review read-back does not clearly enumerate child inline comments: <https://github.com/sachinkundu/deos-review-agent/pull/22#discussion_r3820009501>
- action identity depends on potentially variable generated evidence: <https://github.com/sachinkundu/deos-review-agent/pull/22#discussion_r3820009507>

The standalone Codex CLI semantic result did **not** reproduce these findings. Its 41 structurally valid mappings passed deterministic validation. This is the key test outcome: deterministic evidence validation prevents invented or stale citations, but it does not make the semantic judgment itself deterministic or correct.

The CLI banner identified the configured model as `gpt-5.6-sol`; the model-generated JSON identified itself as `gpt-5`. Runtime provenance therefore also needs to be injected by the host instead of trusted from model output.

## Deterministic rejection check

After materialization, one proposal quote in link `rechecks-mode-selection` was replaced with fabricated text. Validation exited 1 with:

```text
Traceability error: links[25].proposalEvidence[0].quote does not exactly match proposal.md:3-3.
```

The valid sidecar was then regenerated from the unchanged line-ID judgment and passed again. No GitHub mutation was performed; this is local proof against provider-fetched source at the pinned head.

## Replay

From this BettaView repository, with the PR checked out at the pinned head:

```sh
npm run traceability:materialize -- \
  /path/to/deos-review-agent/openspec/changes/review-history-aware-rechecks \
  evidence/openspec-traceability-pr22/judge-line-ids.json

npm run traceability -- \
  /path/to/deos-review-agent/openspec/changes/review-history-aware-rechecks
```

The fresh standalone judge used Codex CLI non-interactive mode with a read-only sandbox, `--output-schema`, and `--output-last-message`, following the official Codex CLI structured-output interface. The exact judge prompt and schema are under `prompts/`.

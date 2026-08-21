# Bidirectional OpenSpec traceability proof: deos-review-agent PR #22

This is a read-only test against the current exact head of <https://github.com/sachinkundu/deos-review-agent/pull/22> after the specs were narrowed in response to review.

- PR head: `8c447b3da7ef68cf4ad75c1849e5fa7f30477278`
- change: `review-history-aware-rechecks`
- proposal SHA-256: `8236a97d8aaf8369f8b7e322398d661e06e8884abde2a60092d8321e12a6edb1`
- reviewer: Codex CLI with `gpt-5.6-sol`, read-only and non-interactive
- prompt: `openspec-semantic-traceability-bidirectional-v2`
- inventory: 8 `## What Changes` statements, 6 capabilities, and 21 complete requirements
- result: `findings`, with 1 semantic finding
- OpenSpec strict validation: passed
- BettaView version 3 deterministic validation: passed after one repair pass

## Result

Seven proposal statements were judged sufficiently covered. Proposal line 11 was judged partially covered:

```text
- Classify prior and current findings as fixed, unfixed, obsolete, new, or ambiguous, with evidence and strictly validated reply or new-comment actions.
```

The specs define fixed, unfixed, obsolete, and ambiguous for prior findings but do not define or emit the proposal's `new` classification for current findings. The finding targets `specs/review-bot/review-rechecks/spec.md` at the complete requirement beginning on line 75.

## Deterministic repair

The first Codex output was schema-valid but internally inconsistent in two directions:

- proposal statement 11 mapped forward to `review-posting-restrict-recheck-posting`, while that requirement did not cite line 11 in reverse;
- `diff-filtering-preserve-complete-history` cited proposal statement 8, while statement 8 did not map forward to that requirement.

The version 3 validator rejected the first materialization. A second Codex pass received the exact validation error, corrected both adjacency lists, preserved the semantic finding, and then passed.

## What is proven

- every declared capability has exactly its corresponding spec file;
- there are no undeclared or unreviewed spec files;
- every complete requirement has exactly one reverse traceability link;
- every `## What Changes` statement has exactly one forward coverage record;
- forward and reverse mappings agree;
- all cited proposal text, requirement blocks, and SHA-256 snapshots match the pinned source;
- the semantic coverage/minimality verdict remains a review opinion, not a deterministic proof.

No GitHub mutation was performed.

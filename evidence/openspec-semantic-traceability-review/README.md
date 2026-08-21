# Evidence-Backed OpenSpec Semantic Review

Date: 2026-08-19  
Change: `add-batch-calculator-cli`  
Sidecar version: 2  
Prompt version: `openspec-semantic-traceability-v1`

## Reviewed inputs

```text
proposal.md
sha256 d508e9e661c0c01c91a0a96e1175fe5ff259544b614e5226a3eb392b17fd0338

specs/batch-calculator-cli/spec.md
sha256 8cde12a2845b7bc2ada5da694f4585eb6b7d2b15f734e91d07df792eadd7aa27
```

OpenSpec deterministically maps the proposal's `batch-calculator-cli` capability declaration to `specs/batch-calculator-cli/spec.md`. Codex reviewed every parsed requirement against the exact proposal and produced the live `openspec/changes/add-batch-calculator-cli/bettaview-traceability.json`.

The judge produced five supported links and no findings. Every link includes exact proposal evidence, a complete spec requirement range, coverage/scope/minimality classifications, and a concise rationale.

## Review artifacts

```text
openspec/changes/add-batch-calculator-cli/bettaview-traceability.json
sha256 1d283c20185f960976028fc038266131fde111a73211ce2b728bf079430c7406

prompts/openspec-semantic-traceability-v1.md
sha256 39d08779f7a92019575c6093074f5f200a16d147d2a4392c6e98d290d006bf8e
```

## Deterministic verification

```sh
npm run traceability -- openspec/changes/add-batch-calculator-cli
```

The command returned `semantic review: pass`, displayed all five evidence-backed relationships, and returned `findings: 0`.

Focused tests prove rejection of fabricated quotations, stale fingerprints, undeclared capabilities, missing evidence, partial requirement targets, missing files, invalid ranges, directory escapes, unsupported versions, and mismatched change identity. A legacy version 1 sidecar remains accepted.

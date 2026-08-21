# OpenSpec Traceability Initial-Slice Evidence

Date: 2026-08-19  
Change: `add-batch-calculator-cli`  
Node.js: `v26.5.1`  
OpenSpec CLI: `1.8.0`

## Final valid proof

```sh
openspec validate add-batch-calculator-cli --type change --strict --no-interactive
```

```text
Change 'add-batch-calculator-cli' is valid
```

The same strict validation result was recorded before the BettaView sidecar was created and after the restored sidecar was present.

```sh
npm run traceability -- openspec/changes/add-batch-calculator-cli
```

The complete retained output is in `traceability-output.txt`. It resolves five proposal-to-spec links and prints the exact source text at both ends.

The final sidecar is retained as `bettaview-traceability.json` and is identical to the sidecar in the OpenSpec change. Final source hashes:

```text
d508e9e661c0c01c91a0a96e1175fe5ff259544b614e5226a3eb392b17fd0338  proposal.md
8cde12a2845b7bc2ada5da694f4585eb6b7d2b15f734e91d07df792eadd7aa27  specs/batch-calculator-cli/spec.md
3e5f192f741ddff8b462397d7ae0ba615b1b0316fd012b467be24d3bae09d3b7  bettaview-traceability.json
```

A case-insensitive search for `bettaview`, `traceability`, `startLine`, and `endLine` returned no matches in `proposal.md` or files under `specs/`.

## Retained negative proofs

With the last spec target temporarily changed to `specs/batch-calculator-cli/missing.md`, the command exited with status 1:

```text
Traceability error: links[4].spec.file does not exist: specs/batch-calculator-cli/missing.md
```

With that target restored and its range temporarily changed to `47-99`, the command exited with status 1:

```text
Traceability error: links[4].spec line range 47-99 is out of bounds for specs/batch-calculator-cli/spec.md (56 lines).
```

The valid target and range were restored before final validation.

## Automated verification

```text
npm test
tests 45
pass 45
fail 0

npm run build
exit 0
```

The 10 focused traceability tests cover valid text resolution, missing proposal and spec files, zero/reversed/out-of-bounds ranges, lexical and symlink path escape, unsupported version, and mismatched change identity.

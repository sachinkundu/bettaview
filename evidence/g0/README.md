# G0 evidence ledger

This directory records provider-originated evidence for the feasibility spikes.
Do not add credentials, private keys, access tokens, or application-owned copies
of repository content.

## Fixture pull request

- Repository: `sachinkundu/bettaview`
- Pull request: [#1](https://github.com/sachinkundu/bettaview/pull/1)
- Base commit: `6dda138961293392bc0e86e81beb4e99a7a0845e`
- Fixture commit: `bca14988ff34c006c6f9c93e7ddf7f47b1edfd1e`
- Changed Markdown fixture: `fixtures/rendered-review.md`

## Native changed-line thread probe

- Authentication: authenticated GitHub user token; GitHub App proof remains open.
- Anchor: `fixtures/rendered-review.md`, right side, line 9.
- REST review-comment ID: `3801553071`.
- GraphQL review-thread ID: `PRRT_kwDOT8EQcs6aAP54`.
- GitHub review ID: `4957902558`.
- Read-back: REST and GraphQL both returned the intended file, line, and exact
  fixture commit.
- Thread state at read-back: unresolved and not outdated.
- Provider URL:
  <https://github.com/sachinkundu/bettaview/pull/1#discussion_r3801553071>

This proves a native changed-line thread can be created and retrieved on the
real fixture pull request. It does not yet prove rendered-selection mapping or
GitHub App authentication.

## Evidence to retain

- Exact pull request and commit identifiers.
- Native review thread identifiers and API read-back results.
- Changed, unchanged, and outdated anchor outcomes.
- GitHub-hosted annotation asset URL and retrieval result.
- Markdown and Mermaid parity findings against GitHub.com.
- Screenshots that reproduce the provider flow.

## Current limitations

- The initial repository bootstrap uses the authenticated GitHub user. A
  least-privilege GitHub App and installation-token proof are still required.
- No G0 exit criterion has passed merely because this fixture exists.

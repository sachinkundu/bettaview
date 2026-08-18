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

## Portal provider flow

- Portal authentication: local `gh` user token, kept in the loopback server.
- Rendered-selection comment ID: `3801650303`.
- Rendered-selection GitHub review ID: `4958060635`.
- Rendered-selection anchor: `fixtures/rendered-review.md`, right side, line 9.
- Mermaid annotation comment ID: `3801655982`.
- Mermaid annotation GitHub review ID: `4958068237`.
- Mermaid annotation anchor: `fixtures/rendered-review.md`, right side, line 43.
- Annotation blob SHA: `9a061c4789cd07873488d6da84860dfcd9a037bd`.
- Annotation branch commit: `90cdc2a5409972930c534c5dbd3e03d2c5a0bb80`.
- Annotation image:
  <https://raw.githubusercontent.com/sachinkundu/bettaview/bettaview-annotations/annotations/pr-1/a9915a5238c36bc220017a00ed7a6ed3b11c8399/cc903cbd-f8b7-4a61-9889-2064734ede97.png>
- Image read-back: HTTP 200 with `content-type: image/png`; GitHub Contents API
  returned the same blob SHA and a 35,026-byte asset.
- Portal read-back: both native threads were reconstructed after refresh; the
  annotation metadata resolved to the exact diagram fingerprint and `Current`
  state.
- Reply comment ID: `3801671225`; it was created from the portal and returned in
  the original rendered-selection thread after refresh.
- Comment-only review ID: `4958088915`; GitHub returned state `COMMENTED` at the
  exact fixture commit.

The rendered-selection and annotation submissions both used fixture commit
`a9915a5238c36bc220017a00ed7a6ed3b11c8399`.

## Evidence to retain

- Exact pull request and commit identifiers.
- Native review thread identifiers and API read-back results.
- Changed, unchanged, and outdated anchor outcomes.
- GitHub-hosted annotation asset URL and retrieval result.
- Markdown and Mermaid parity findings against GitHub.com.
- Screenshots that reproduce the provider flow.

## Current limitations

- The experiment uses the authenticated GitHub user instead of a least-privilege
  GitHub App. This is an explicit one-shot shortcut.
- The fixture repository is public so raw annotation assets render without an
  external store or credentials.
- The pull request author cannot approve or request changes on their own pull
  request; those review-state cases require a second GitHub actor.

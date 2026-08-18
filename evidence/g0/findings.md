# Phase 1 experiment findings

Status: portal experiment ready for hands-on evaluation  
Pull request: <https://github.com/sachinkundu/bettaview/pull/1>

## Provider flows that worked

- GitHub's Markdown API returned repository-context GFM for both changed fixture
  documents at the exact pull request head.
- The client rendered both Mermaid fixtures and supported arrow/circle overlay,
  undo, clear, normalized geometry, and deterministic PNG capture.
- Selecting unique rendered prose mapped back to its source range and a changed
  line. GitHub accepted the resulting native review thread and returned it on
  refresh.
- A reply created in the portal returned inside the same native GitHub thread.
- An arrow annotation and typed comment produced one native review thread. Its
  PNG, commit, file, diagram fingerprint, render dimensions, and normalized
  geometry were reconstructed from GitHub alone after refresh.
- The GitHub-hosted annotation returned HTTP 200 as `image/png` after local
  drawing state was discarded.
- Comment-only review submission returned GitHub state `COMMENTED`.
- Submission IDs embedded in versioned comment markers protect retries from
  creating a second thread.

Exact provider identifiers and the annotation asset are retained in
[`README.md`](README.md).

## Experiment limitations

- Authentication uses the local `gh` token instead of a GitHub App. The portal
  is intentionally bound to `127.0.0.1`.
- The repository is public so raw GitHub annotation assets render without a
  separate object store or asset credentials.
- Text mapping deliberately supports unique plain-text selections. Repeated
  phrases or selections whose visible text differs substantially from Markdown
  source are rejected instead of guessed.
- GitHub only accepts a new review thread on a changed diff line. The portal
  surfaces that constraint as an error for unchanged selections.
- The pull request author cannot approve or request changes on their own pull
  request. Those two review states need a second actor for provider proof.
- Mermaid syntax parity is useful for the two fixtures but has not been measured
  pixel-for-pixel against GitHub.com's deployed Mermaid renderer.
- Annotation assets create one commit per image on a dedicated branch. That is
  acceptable for this experiment, not a production storage design.
- No accessibility, mobile layout, production hardening, or operational work
  was attempted.

## Recommendation

Use the portal for a short hands-on evaluation of rendered prose comments and
diagram annotations. The native GitHub thread, reply, image, and reconstruction
path is credible enough to evaluate the interaction. If the experience is worth
continuing, the next investment should be robust source maps plus GitHub App
authentication—not OpenSpec traceability or production hardening yet.


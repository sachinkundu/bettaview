# BettaView

BettaView is a Phase 1 experiment for reviewing GitHub pull request Markdown in
rendered form while keeping comments and review state native to GitHub.

The experiment plan is in [`implementation-plan.md`](implementation-plan.md).
Phase 2 OpenSpec traceability is deliberately separate and has not started.

## Run the experiment portal

Prerequisites: Node.js 22 or newer and an authenticated GitHub CLI session with
access to the pull request repository.

```sh
npm install
npm run build
npm start
```

Open <http://127.0.0.1:4174>. The portal defaults to the live fixture pull
request, but another GitHub pull request URL can be entered in the header.

- Select unique text in rendered Markdown to open the native-thread composer.
- Draw an arrow or circle over a rendered Mermaid diagram, add a typed comment,
  and publish both in one native thread.
- Refresh to reconstruct threads and annotation metadata from GitHub.

The experiment server binds only to loopback. It reads the token returned by
`gh auth token` in the server process and never sends the token to the browser.
Annotation PNGs are committed to the `bettaview-annotations` branch and linked
from native review comments. No application database or asset store is used.

## Experiment shortcut

This one-shot implementation uses the local GitHub CLI identity instead of a
GitHub App. It is intended only for the dedicated, non-sensitive public fixture
repository. A production implementation would require GitHub App installation
authentication, authorization boundaries, and broader security work.

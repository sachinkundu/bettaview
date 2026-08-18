# Visual Review and Traceability for GitHub Documents

Status: Draft

## Purpose

Define the requirements for a tool that makes Markdown documents in GitHub pull requests easy to read and review in their rendered form, and makes the relationships between OpenSpec documents visually traceable.

## Problem

GitHub can display Markdown changes as rendered documents, which makes prose, formatting, and diagrams easier to understand. However, reviewers cannot leave line-level pull request comments from that rendered view. They must switch to the Markdown source, where the relationship between the source and the rendered document—especially diagrams—can be difficult to follow.

## Desired experience

A reviewer opens a Markdown file from a GitHub pull request, reads it as a rendered document, and leaves visual annotations without losing the connection to GitHub's review workflow.

For Mermaid diagrams, the reviewer can draw an arrow or circle over the rendered diagram to point at a specific area, then add a typed text comment. The coding agent receives both the annotated diagram image and the reviewer's text, so the visual reference and requested change remain connected.

## Initial requirements

- Render Markdown files changed by a GitHub pull request.
- Render GitHub-compatible Mermaid diagrams and other supported Markdown content.
- Allow a reviewer to select rendered content and attach a comment to it.
- Allow a reviewer to annotate a rendered Mermaid diagram using simple visual marks such as arrows and circles.
- Keep annotation comments as normal typed text; text does not need to be drawn onto the diagram.
- Capture the diagram and its visual marks as an image when the annotation is submitted.
- Deliver the annotated image and typed comment together to the coding agent.
- Include enough context with the annotation to identify the pull request, Markdown file, commit, and Mermaid diagram it refers to.
- Publish comments as native GitHub pull request review threads.
- Display existing GitHub review threads in the rendered document.
- Preserve GitHub as the source of truth for the document, comments, review state, and history.
- Support replies and normal review states such as comment, approve, and request changes.
- Make permissions and access to private repositories explicit and appropriately scoped.

## OpenSpec traceability visualization

### Desired experience

A reviewer can see the flow of an OpenSpec change as a visual graph:

`Proposal → Specs → Design → Tasks`

The graph shows which exact sections or lines in one document are carried into another document. For example, a specification can point back to the relevant proposal passage, a design decision can point to both the proposal and corresponding specification requirement, and an implementation task can point to the requirements and design decisions it implements.

Selecting a node or relationship opens the relevant rendered document at the referenced passage. The reviewer can move between the high-level graph and the underlying source without manually searching across files.

### Traceability requirements

- Discover all proposal, specification, design, and task documents belonging to an OpenSpec change.
- Represent documents and their relevant sections, requirements, decisions, and tasks as visual nodes.
- Represent the relationships between those items as directed links.
- Preserve exact source anchors, including file path and line or section range.
- Allow a reviewer to select a graph node or link and navigate to the corresponding rendered content.
- Show both upstream rationale and downstream implementation coverage for an item.
- Distinguish links explicitly recorded by the authoring tool from links inferred later by a processing layer.
- Record the provenance and confidence of inferred links so they are not presented as authoritative facts.
- Refresh the graph when documents change in the pull request.
- Make the graph and its findings available to both human reviewers and coding agents.

### Missing and broken-link detection

The visualization should make traceability gaps immediately visible. Examples include:

- A proposal requirement with no corresponding specification.
- A specification requirement with no corresponding design treatment where one is expected.
- A specification or design decision with no implementation task.
- A task with no identifiable upstream requirement or design decision.
- A reference to a file, section, or line range that no longer exists.
- A relationship whose target changed enough that the link can no longer be trusted.

Healthy, missing, broken, stale, and inferred relationships should have visually distinct states. A reviewer should be able to select a problem to see why it was classified that way and what source evidence was used.

### Traceability data layer

A processing layer may be required to create the graph. Two approaches should be evaluated:

1. Extend the OpenSpec authoring tooling to emit a machine-readable traceability manifest as documents are generated.
2. Build a separate indexing layer that reads existing OpenSpec documents and derives the relationships after generation.

A hybrid approach may use explicit links from a manifest when available and infer only the missing relationships. Explicit and inferred links must remain distinguishable in the interface and data model.

A traceability record will likely need stable item identifiers, document type, file path, source range, relationship type, target identifier, provenance, confidence, validation state, and the commit or document version against which it was created.

## Questions to expand later

- Should diagram annotations be anchored to the whole Mermaid block, a specific diagram node, or fixed image coordinates?
- Should the annotated image be uploaded directly to the GitHub review comment or stored elsewhere and linked from it?
- How should a visual annotation behave when the Mermaid source changes and the diagram is re-rendered?
- Should this be a browser extension, GitHub App, hosted service, or self-hosted tool?
- How should annotations survive edits, rebases, and force-pushes?
- Which Markdown extensions and diagram formats must be supported?
- What security and data-retention requirements apply?
- Does the current OpenSpec toolchain expose any traceability metadata that can be reused?
- Should stable identifiers be embedded in the Markdown, stored in a sidecar JSON manifest, or both?
- Are line numbers sufficient as anchors, or should links primarily use stable identifiers and content fingerprints?
- Which relationships are mandatory, and which are optional for a valid OpenSpec change?
- Should broken traceability fail validation, create a warning, or only appear in the visual review?
- Where should the traceability processor run: during generation, in CI, in a GitHub App, or in the review client?
- Should reviewers be able to create or correct traceability links from the visual graph?

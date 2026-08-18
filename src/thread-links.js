export function threadReferenceKey(thread) {
  return `thread-${thread.id}`;
}

export function draftReferenceKey(draft) {
  return `draft-${draft.clientSubmissionId}`;
}

function publishedReference(thread) {
  const metadata = thread.comments?.[0]?.metadata;
  const isTextSelection = metadata?.kind === "text-selection";
  return {
    key: threadReferenceKey(thread),
    line: metadata?.startLine || metadata?.diagram?.startLine || thread.line || thread.startLine,
    selectedText: isTextSelection ? metadata.selectedText : null,
    draft: false,
  };
}

function draftReference(draft) {
  return {
    key: draftReferenceKey(draft),
    line: draft.startLine,
    selectedText: draft.kind === "text-selection" ? draft.selectedText : null,
    draft: true,
  };
}

export function activeThreadReferences(threads, drafts) {
  return [
    ...drafts.map(draftReference),
    ...threads.map(publishedReference),
  ].map((reference, index) => ({ ...reference, position: index + 1 }));
}

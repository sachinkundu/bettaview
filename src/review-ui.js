const OPENSPEC_CHANGES_PREFIX = ["openspec", "changes"];

export function scenarioKeyword(value) {
  const keyword = value?.trim().toUpperCase();
  return keyword === "WHEN" || keyword === "THEN" ? keyword.toLowerCase() : null;
}

export function decorateScenarioKeywords(root) {
  root?.querySelectorAll("strong").forEach((element) => {
    const keyword = scenarioKeyword(element.textContent);
    if (!keyword) return;
    element.classList.add("scenario-keyword", `scenario-keyword-${keyword}`);
  });
}

export function reviewFileSegments(path) {
  const segments = path.split("/").filter(Boolean);
  const isOpenSpecChange = OPENSPEC_CHANGES_PREFIX.every((segment, index) => segments[index] === segment);
  const visible = isOpenSpecChange ? segments.slice(OPENSPEC_CHANGES_PREFIX.length) : segments;

  if (isOpenSpecChange && visible.length >= 4 && visible[1] === "specs" && visible.at(-1) === "spec.md") {
    return [visible[0], ...visible.slice(2, -1)];
  }
  return visible;
}

function compareNodes(left, right) {
  if (left.kind !== right.kind) return left.kind === "branch" ? -1 : 1;
  return left.label.localeCompare(right.label, undefined, { numeric: true, sensitivity: "base" });
}

export function buildReviewFileTree(files) {
  const root = { kind: "branch", label: "", children: [] };

  for (const file of files) {
    const segments = reviewFileSegments(file.path);
    let parent = root;
    for (const label of segments.slice(0, -1)) {
      let branch = parent.children.find((node) => node.kind === "branch" && node.label === label);
      if (!branch) {
        branch = { kind: "branch", label, children: [] };
        parent.children.push(branch);
      }
      parent = branch;
    }
    parent.children.push({ kind: "file", label: segments.at(-1) || file.path, file });
  }

  const sort = (branch) => {
    branch.children.sort(compareNodes);
    branch.children.filter((node) => node.kind === "branch").forEach(sort);
  };
  sort(root);
  return root.children;
}

export function commentCloseNeedsConfirmation(value) {
  return Boolean(value?.trim());
}

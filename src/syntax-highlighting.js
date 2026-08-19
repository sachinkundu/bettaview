import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import css from "highlight.js/lib/languages/css";
import diff from "highlight.js/lib/languages/diff";
import http from "highlight.js/lib/languages/http";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import markdown from "highlight.js/lib/languages/markdown";
import python from "highlight.js/lib/languages/python";
import rust from "highlight.js/lib/languages/rust";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";

const languages = {
  bash,
  css,
  diff,
  http,
  javascript,
  json,
  markdown,
  python,
  rust,
  sql,
  typescript,
  xml,
  yaml,
};

for (const [name, definition] of Object.entries(languages)) {
  hljs.registerLanguage(name, definition);
}

const autoDetectLanguages = Object.keys(languages);

function declaredLanguage(code) {
  const codeLanguage = [...code.classList]
    .map((name) => name.match(/^(?:language|lang)-(.+)$/)?.[1])
    .find(Boolean);
  return codeLanguage || code.closest("pre")?.getAttribute("lang") || "";
}

export function highlightSource(source, language = "") {
  if (language && hljs.getLanguage(language)) {
    return hljs.highlight(source, { language, ignoreIllegals: true });
  }
  return hljs.highlightAuto(source, autoDetectLanguages);
}

export function highlightCodeBlocks(root) {
  if (!root) return;
  for (const code of root.querySelectorAll("pre code")) {
    const language = declaredLanguage(code);
    if (language.toLowerCase() === "mermaid") continue;
    const result = highlightSource(code.textContent, language);
    code.innerHTML = result.value;
    code.classList.add("hljs");
    if (result.language) code.classList.add(`language-${result.language}`);
  }
}

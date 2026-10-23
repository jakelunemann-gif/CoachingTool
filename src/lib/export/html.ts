import type { DocModel, DocNode } from "./docModel";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const LIST_STYLES = ["decimal", "lower-alpha", "lower-roman", "decimal"];

function nodeHtml(n: DocNode): string {
  let text = esc(n.text);
  if (n.link) text = `<a href="${esc(n.link)}">${text}</a>`;
  if (n.bold) text = `<b>${text}</b>`;
  return `${text}${n.suffix ? esc(n.suffix) : ""}`;
}

function listHtml(nodes: DocNode[], depth: number): string {
  if (nodes.length === 0) return "";
  const items = nodes.map((n) => `<li>${nodeHtml(n)}${listHtml(n.children, depth + 1)}</li>`).join("");
  return `<ol style="list-style-type:${LIST_STYLES[depth % LIST_STYLES.length]}">${items}</ol>`;
}

/** Standalone HTML, used for the Google Docs upload (Drive converts it). */
export function docToHtml(doc: DocModel): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(doc.title)}</title></head>` +
    `<body style="font-family:Arial,sans-serif;font-size:11pt">` +
    `<p><b>${esc(doc.header)}</b></p><p><b>Practice Plan</b></p>${listHtml(doc.nodes, 0)}</body></html>`;
}

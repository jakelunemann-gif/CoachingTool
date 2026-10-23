import type { DocModel, DocNode } from "@/lib/export/docModel";

function DocList({ nodes, depth }: { nodes: DocNode[]; depth: number }) {
  if (nodes.length === 0) return null;
  return (
    <ol className={`l${Math.min(depth, 3)}`}>
      {nodes.map((n, i) => {
        const text = n.link ? (
          <a href={n.link} target="_blank" rel="noreferrer">
            {n.text}
          </a>
        ) : (
          n.text
        );
        return (
          <li key={i}>
            {n.bold ? <b>{text}</b> : text}
            {n.suffix && <span className={n.bold ? "suffix-time" : undefined}>{n.suffix}</span>}
            <DocList nodes={n.children} depth={depth + 1} />
          </li>
        );
      })}
    </ol>
  );
}

/** The plan rendered like the coach's Google Docs. */
export function PlanDocument({ doc }: { doc: DocModel }) {
  return (
    <div className="plan-doc" data-testid="plan-document">
      <p>
        <b>{doc.header}</b>
      </p>
      <p className="mb-2">
        <b>Practice Plan</b>
      </p>
      <DocList nodes={doc.nodes} depth={0} />
    </div>
  );
}

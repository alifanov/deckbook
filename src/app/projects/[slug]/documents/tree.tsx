import Link from "next/link";
import type { DocumentNode } from "../../../../domain/documents";
import { day, Icon } from "../../../../ui";

/** Ветка дерева документов. Папка — нативный <details>: галочка её схлопывает без JS. */
export function Branch({ node, slug }: { node: DocumentNode; slug: string }) {
  const link = (
    <Link
      href={`/projects/${slug}/documents/${node.id}`}
      className="grow"
      style={node.isFolder ? { fontWeight: 600, fontSize: 16 } : undefined}
    >
      {node.name}
    </Link>
  );

  if (!node.isFolder) {
    return (
      <div className="item">
        {link}
        <span className="muted">
          {node.updatedBy?.name ?? "владелец"} · {day(node.updatedAt)}
        </span>
      </div>
    );
  }

  return (
    <details className="tree" open>
      <summary className="item">
        <span className="muted twist">
          <Icon name="right" />
        </span>
        {link}
        <span className="muted">{node.children.length}</span>
      </summary>
      {node.children.length > 0 && (
        <div className="kids">
          {node.children.map((child) => (
            <Branch key={child.id} node={child} slug={slug} />
          ))}
        </div>
      )}
    </details>
  );
}

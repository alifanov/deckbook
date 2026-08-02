import Link from "next/link";
import type { DocumentNode } from "../../../../domain/documents";
import { trail } from "../../../../domain/tree";
import { Icon } from "../../../../ui";

/** Ветка дерева: файл — ссылка, папка — нативный <details>, схлопывается по клику. */
function Branch({
  node,
  slug,
  activeId,
  open,
}: {
  node: DocumentNode;
  slug: string;
  activeId?: string;
  open: Set<string>;
}) {
  const href = `/projects/${slug}/documents/${node.id}`;

  if (!node.isFolder) {
    return (
      <Link className={node.id === activeId ? "file here" : "file"} href={href}>
        <span className="grow">{node.name}</span>
      </Link>
    );
  }

  return (
    <details open={open.has(node.id)}>
      <summary>
        <span className="twist">
          <Icon name="right" />
        </span>
        <span className="grow" style={{ fontWeight: 600 }}>
          {node.name}
        </span>
        {/* счётчик заодно ведёт на страницу папки — там переименование и удаление */}
        <Link className="muted" href={href} title="Страница папки">
          {node.children.length}
        </Link>
      </summary>
      <div className="kids">
        {node.children.map((child) => (
          <Branch key={child.id} node={child} slug={slug} activeId={activeId} open={open} />
        ))}
      </div>
    </details>
  );
}

/**
 * Левая панель двухпанельного просмотра: папки раскрываются кликом и
 * закрываются повторным.
 * ponytail: нативный <details>, никакого клиентского состояния.
 */
export function DocumentTree({
  tree,
  slug,
  activeId,
}: {
  tree: DocumentNode[];
  slug: string;
  activeId?: string;
}) {
  // Раскрыты только папки над выбранным узлом — остальное ждёт клика.
  const open = new Set((activeId ? (trail(tree, activeId) ?? []) : []).map((node) => node.id));

  return (
    <aside className="card tree">
      {tree.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>
          Пока пусто.
        </p>
      ) : (
        tree.map((node) => (
          <Branch key={node.id} node={node} slug={slug} activeId={activeId} open={open} />
        ))
      )}
    </aside>
  );
}

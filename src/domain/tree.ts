/** Оба дерева проекта — задач и документов — собираются из плоской выборки одинаково. */
export type Node<T> = T & { children: Node<T>[] };

export function buildTree<T extends { id: string; parentId: string | null }>(
  nodes: T[],
  parentId: string | null,
): Node<T>[] {
  return nodes
    .filter((node) => node.parentId === parentId)
    .map((node) => ({ ...node, children: buildTree(nodes, node.id) }));
}

/**
 * Цепочка предков до узла, без самого узла: хлебные крошки и раскрытые папки
 * над выбранным файлом. null — узла в дереве нет.
 */
export function trail<T extends { id: string }>(
  nodes: Node<T>[],
  id: string,
): Node<T>[] | null {
  for (const node of nodes) {
    if (node.id === id) return [];
    const inside = trail(node.children, id);
    if (inside) return [node, ...inside];
  }
  return null;
}

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

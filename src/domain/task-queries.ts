import { prisma } from "../db";
import { fail } from "./errors";
import { OWNER_OPEN, isClosed, today } from "./task-values";
import { buildTree, type Node } from "./tree";
import type { Task, TaskPriority, TaskStatus } from "../generated/prisma/client";

export type TaskNode = Node<Task>;

/**
 * Убирает закрытые задачи из дерева. Закрытый родитель остаётся, если под ним
 * ещё есть открытое, — иначе живые подзадачи исчезли бы вместе с ним.
 */
export const hideClosed = (nodes: TaskNode[]): TaskNode[] =>
  nodes.flatMap((node) => {
    const children = hideClosed(node.children);
    return isClosed(node) && children.length === 0 ? [] : [{ ...node, children }];
  });

/** Порядок статусов в дереве: работа сверху, закрытое — вниз. */
const TREE_RANK: Record<TaskStatus, number> = {
  needs_human: 0,
  in_progress: 1,
  todo: 2,
  done: 3,
  cancelled: 4,
};

/**
 * Раскладывает ветки по статусу на каждом уровне. Сортировка устойчивая, так что
 * внутри одного статуса остаётся порядок выборки — по времени создания.
 */
export const sortByStatus = (nodes: TaskNode[]): TaskNode[] =>
  [...nodes]
    .sort((a, b) => TREE_RANK[a.status] - TREE_RANK[b.status])
    .map((node) => ({ ...node, children: sortByStatus(node.children) }));

export async function requireTask(id: string) {
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) fail("Задачи не существует");
  return task;
}

/** Задача существует и лежит в этом проекте — граница агента (ADR-0003). */
export async function requireTaskInProject(id: string, projectId: string) {
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task || task.projectId !== projectId) {
    fail(`Задачи ${id} нет в этом проекте — доступны только задачи текущего проекта`);
  }
  return task;
}

/**
 * Дерево задач проекта: в работе сверху, закрытое — внизу. Внутри одного статуса
 * важное идёт раньше неважного — сортировка по статусу устойчива и порядок выборки
 * сохраняет.
 */
export async function listProjectTree(projectId: string): Promise<TaskNode[]> {
  const tasks = await prisma.task.findMany({
    where: { projectId },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
  });
  return sortByStatus(buildTree(tasks, null));
}

/**
 * Плоский список задач — ответ на вопрос «что делать сейчас», и потому
 * единственное чтение, которое прячет ненаступившие сроки (ADR-0004).
 * Просроченное идёт первым, бессрочное — последним; приоритет разбирает
 * задачи внутри одного срока, но срок не перебивает.
 */
export function listTasks(
  projectId: string,
  filter: {
    status?: TaskStatus;
    priority?: TaskPriority;
    assigneeTokenId?: string;
    assignedToOwner?: boolean;
    /** показать и то, чей срок ещё не наступил */
    includeFuture?: boolean;
  } = {},
) {
  const { includeFuture, ...match } = filter;
  return prisma.task.findMany({
    where: {
      projectId,
      ...match,
      ...(includeFuture ? {} : { OR: [{ dueAt: null }, { dueAt: { lte: today() } }] }),
    },
    include: { assignee: true, createdBy: true },
    orderBy: [
      { dueAt: { sort: "asc", nulls: "last" } },
      { priority: "desc" },
      { createdAt: "asc" },
    ],
  });
}

/**
 * Задачи владельца — из всех проектов сразу: у владельца границы проекта нет.
 * Закрытое не показываем, ненаступившие сроки прячутся только от агента
 * (ADR-0004). Порядок тот же: просроченное первым, бессрочное последним.
 */
export const listOwnerTasks = () =>
  prisma.task.findMany({
    where: OWNER_OPEN,
    include: { project: true },
    orderBy: [
      { dueAt: { sort: "asc", nulls: "last" } },
      { priority: "desc" },
      { createdAt: "asc" },
    ],
  });

/** Задача с её поддеревом — то, что агент читает перед работой. */
export async function getTaskTree(id: string): Promise<TaskNode> {
  const task = await requireTask(id);
  const all = await prisma.task.findMany({
    where: { projectId: task.projectId },
    orderBy: { createdAt: "asc" },
  });
  const children = buildTree(all, id);
  return { ...task, children };
}

export function getTask(id: string) {
  return prisma.task.findUnique({
    where: { id },
    include: { assignee: true, createdBy: true, project: true },
  });
}

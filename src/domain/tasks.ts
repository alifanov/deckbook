import { prisma } from "../db";
import type { Actor } from "./actor";
import { recordSystem } from "./comments";
import { fail } from "./errors";
import type { Task, TaskStatus } from "../generated/prisma/client";

export const STATUSES = ["todo", "in_progress", "done", "cancelled"] as const;

export type TaskNode = Task & { children: TaskNode[] };

export function parseStatus(value: string): TaskStatus {
  if (!(STATUSES as readonly string[]).includes(value)) {
    fail(`Статуса «${value}» не существует; допустимы: ${STATUSES.join(", ")}`);
  }
  return value as TaskStatus;
}

async function requireTask(id: string) {
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) fail("Задачи не существует");
  return task;
}

/** Родитель и ребёнок всегда в одном проекте (ADR-0003). */
async function requireParentInProject(parentId: string, projectId: string | null) {
  const parent = await requireTask(parentId);
  if (parent.projectId !== projectId) {
    fail("Родитель и подзадача должны принадлежать одному проекту");
  }
  return parent;
}

export async function createTask(
  input: {
    projectId: string | null;
    parentId?: string | null;
    title: string;
    description?: string;
    isTemplate?: boolean;
  },
  actor: Actor,
) {
  const title = input.title.trim();
  if (!title) fail("У задачи должен быть заголовок");

  let isTemplate = input.isTemplate ?? false;
  if (input.parentId) {
    const parent = await requireParentInProject(input.parentId, input.projectId);
    // подзадача шаблона — тоже шаблон, иначе она всплывёт в обычных выборках
    isTemplate = parent.isTemplate;
  } else if (input.projectId === null && !isTemplate) {
    fail("Задача вне проекта возможна только как глобальный шаблон");
  }

  return prisma.task.create({
    data: {
      projectId: input.projectId,
      parentId: input.parentId ?? null,
      title,
      description: input.description?.trim() ?? "",
      isTemplate,
      createdByTokenId: actor.tokenId,
    },
  });
}

export async function updateTask(
  id: string,
  input: { title?: string; description?: string },
  actor: Actor,
) {
  const before = await requireTask(id);
  const data: { title?: string; description?: string } = {};

  if (input.title !== undefined) {
    const title = input.title.trim();
    if (!title) fail("У задачи должен быть заголовок");
    if (title !== before.title) data.title = title;
  }
  if (input.description !== undefined && input.description !== before.description) {
    data.description = input.description;
  }
  if (Object.keys(data).length === 0) return before;

  const task = await prisma.task.update({ where: { id }, data });
  if (data.title) await recordSystem(id, `Заголовок изменён на «${data.title}»`, actor);
  if (data.description !== undefined) await recordSystem(id, "Описание изменено", actor);
  return task;
}

/** Перемещение — единственная операция, способная порвать дерево. */
export async function moveTask(id: string, newParentId: string | null, actor: Actor) {
  const task = await requireTask(id);
  if (newParentId === id) fail("Задача не может быть собственным родителем");

  if (newParentId) {
    const parent = await requireParentInProject(newParentId, task.projectId);
    // цикл: новый родитель не должен лежать в поддереве задачи
    for (let node: Task | null = parent; node?.parentId; ) {
      if (node.parentId === id) fail("Задачу нельзя перенести внутрь её собственного поддерева");
      node = await prisma.task.findUnique({ where: { id: node.parentId } });
    }
  }

  const moved = await prisma.task.update({
    where: { id },
    data: { parentId: newParentId },
  });
  await recordSystem(
    id,
    newParentId ? "Задача перенесена под другого родителя" : "Задача поднята в корень проекта",
    actor,
  );
  return moved;
}

/**
 * Смена статуса. Закрытие рекуррентной задачи не закрывает её, а возвращает
 * в todo со сдвинутой датой — планировщика в системе нет.
 */
export async function setStatus(id: string, status: TaskStatus, actor: Actor) {
  const task = await requireTask(id);
  if (task.status === status) return task;

  if (status === "done" && task.recurrence !== null) {
    const from = task.dueAt ?? new Date();
    const next = new Date(from.getTime() + task.recurrence * 24 * 60 * 60 * 1000);
    const repeated = await prisma.task.update({
      where: { id },
      data: { status: "todo", lastClosedAt: new Date(), dueAt: next },
    });
    await recordSystem(
      id,
      `Повторяющаяся задача закрыта и открыта заново на ${next.toISOString().slice(0, 10)}`,
      actor,
    );
    return repeated;
  }

  const closing = status === "done" || status === "cancelled";
  const updated = await prisma.task.update({
    where: { id },
    data: { status, lastClosedAt: closing ? new Date() : task.lastClosedAt },
  });
  await recordSystem(id, `Статус: ${task.status} → ${status}`, actor);
  return updated;
}

export async function assignTask(id: string, tokenId: string | null, actor: Actor) {
  const task = await requireTask(id);
  if (tokenId) {
    const token = await prisma.token.findUnique({ where: { id: tokenId } });
    if (!token) fail("Токена не существует");
    if (token.projectId !== task.projectId) fail("Токен выдан на другой проект");
  }

  const updated = await prisma.task.update({
    where: { id },
    data: { assigneeTokenId: tokenId },
  });
  await recordSystem(id, tokenId ? "Задача назначена на агента" : "Назначение снято", actor);
  return updated;
}

export async function setRecurrence(id: string, days: number | null, actor: Actor) {
  if (days !== null && (!Number.isInteger(days) || days < 1)) {
    fail("Интервал повторения — целое число дней, не меньше одного");
  }
  const updated = await prisma.task.update({
    where: { id },
    data: { recurrence: days, dueAt: days === null ? null : new Date() },
  });
  await recordSystem(
    id,
    days === null ? "Повторение снято" : `Задача повторяется каждые ${days} дн.`,
    actor,
  );
  return updated;
}

/** Удаление уносит поддерево и ленту — каскадом на уровне базы. */
export async function deleteTask(id: string) {
  await prisma.task.delete({ where: { id } });
}

function buildTree(tasks: Task[], rootId: string | null): TaskNode[] {
  return tasks
    .filter((t) => t.parentId === rootId)
    .map((t) => ({ ...t, children: buildTree(tasks, t.id) }));
}

/** Дерево задач проекта. Шаблоны в обычную выборку не попадают (ADR-0001). */
export async function listProjectTree(projectId: string): Promise<TaskNode[]> {
  const tasks = await prisma.task.findMany({
    where: { projectId, isTemplate: false },
    orderBy: { createdAt: "asc" },
  });
  return buildTree(tasks, null);
}

export function listTasks(
  projectId: string,
  filter: { status?: TaskStatus; assigneeTokenId?: string } = {},
) {
  return prisma.task.findMany({
    where: { projectId, isTemplate: false, ...filter },
    include: { assignee: true, createdBy: true },
    orderBy: { createdAt: "asc" },
  });
}

/** Задача с её поддеревом — то, что агент читает перед работой. */
export async function getTaskTree(id: string): Promise<TaskNode> {
  const task = await requireTask(id);
  const all = await prisma.task.findMany({
    where: task.projectId
      ? { projectId: task.projectId }
      : { projectId: null, isTemplate: true },
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

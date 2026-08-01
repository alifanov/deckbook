import { prisma } from "../db";
import type { Author } from "./author";
import { recordSystem } from "./comments";
import { fail } from "./errors";
import { buildTree, type Node } from "./tree";
import type { Task, TaskStatus } from "../generated/prisma/client";

export const STATUSES = ["todo", "in_progress", "done", "cancelled"] as const;

export type TaskNode = Node<Task>;

/** Статус из набора или ничего — набор фиксирован и не настраивается. */
export const asStatus = (value: string | null | undefined): TaskStatus | null =>
  (STATUSES as readonly string[]).includes(value ?? "") ? (value as TaskStatus) : null;

export function parseStatus(value: string): TaskStatus {
  const status = asStatus(value);
  if (!status) fail(`Статуса «${value}» не существует; допустимы: ${STATUSES.join(", ")}`);
  return status;
}

/** Срок — день, не момент: и хранение, и сравнение идут по полночи UTC. */
export const asDay = (date: Date): string => date.toISOString().slice(0, 10);

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/** Сегодня как день — граница, по которой срок считается наступившим. */
export const today = () => day(asDay(new Date()));

export function parseDueDate(value: string): Date {
  const raw = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) fail("Срок — дата вида ГГГГ-ММ-ДД, без времени");
  const date = day(raw);
  // 31 февраля разбирается молча и уезжает на 3 марта — ловим обратным ходом
  if (Number.isNaN(date.getTime()) || asDay(date) !== raw) fail(`Даты ${raw} не существует`);
  return date;
}

/** Срок наступил и прошёл — задача опаздывает. */
export const isOverdue = (task: { dueAt: Date | null }) =>
  task.dueAt !== null && task.dueAt < today();

async function requireTask(id: string) {
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) fail("Задачи не существует");
  return task;
}

/**
 * Задача существует и лежит в этом проекте — граница агента (ADR-0003).
 * Шаблон настоящей задачей не считается: в обычных выборках его нет.
 */
export async function requireTaskInProject(id: string, projectId: string) {
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task || task.projectId !== projectId || task.isTemplate) {
    fail(`Задачи ${id} нет в этом проекте — доступны только задачи текущего проекта`);
  }
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
    dueAt?: Date | null;
    assigneeTokenId?: string | null;
  },
  author: Author,
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
      dueAt: input.dueAt ?? null,
      assigneeTokenId: input.assigneeTokenId ?? null,
      createdByTokenId: author.tokenId,
    },
  });
}

/** Срок задачи. null снимает его — задача снова без даты. */
export async function setDueDate(id: string, dueAt: Date | null, author: Author) {
  const before = await requireTask(id);
  if ((before.dueAt?.getTime() ?? null) === (dueAt?.getTime() ?? null)) return before;

  const updated = await prisma.task.update({ where: { id }, data: { dueAt } });
  await recordSystem(id, dueAt ? `Срок: ${asDay(dueAt)}` : "Срок снят", author);
  return updated;
}

export async function updateTask(
  id: string,
  input: { title?: string; description?: string },
  author: Author,
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
  if (data.title) await recordSystem(id, `Заголовок изменён на «${data.title}»`, author);
  if (data.description !== undefined) await recordSystem(id, "Описание изменено", author);
  return task;
}

/** Перемещение — единственная операция, способная порвать дерево. */
export async function moveTask(id: string, newParentId: string | null, author: Author) {
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
    author,
  );
  return moved;
}

/**
 * Смена статуса. Закрытие рекуррентной задачи не закрывает её, а возвращает
 * в todo со сдвинутой датой — планировщика в системе нет.
 */
export async function setStatus(id: string, status: TaskStatus, author: Author) {
  const task = await requireTask(id);
  if (task.status === status) return task;

  if (status === "done" && task.recurrence !== null) {
    const from = task.dueAt ?? today();
    const next = new Date(from.getTime() + task.recurrence * 24 * 60 * 60 * 1000);
    const repeated = await prisma.task.update({
      where: { id },
      data: { status: "todo", lastClosedAt: new Date(), dueAt: next },
    });
    await recordSystem(
      id,
      `Повторяющаяся задача закрыта и открыта заново на ${asDay(next)}`,
      author,
    );
    return repeated;
  }

  const closing = status === "done" || status === "cancelled";
  const updated = await prisma.task.update({
    where: { id },
    data: { status, lastClosedAt: closing ? new Date() : task.lastClosedAt },
  });
  await recordSystem(id, `Статус: ${task.status} → ${status}`, author);
  return updated;
}

export async function assignTask(id: string, tokenId: string | null, author: Author) {
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
  await recordSystem(id, tokenId ? "Задача назначена на агента" : "Назначение снято", author);
  return updated;
}

export const countUnassigned = (projectId: string) =>
  prisma.task.count({ where: { projectId, isTemplate: false, assigneeTokenId: null } });

/**
 * Раздаёт агенту все ничьи задачи проекта разом. Ничья задача не попадает
 * ни в один my_tasks, поэтому копится молча; здесь она разбирается пачкой.
 */
export async function assignUnassigned(projectId: string, tokenId: string, author: Author) {
  const orphans = await prisma.task.findMany({
    where: { projectId, isTemplate: false, assigneeTokenId: null },
    select: { id: true },
  });
  // ponytail: по одной, ради записи в ленту каждой задачи; пачками, если станет тысячи
  for (const { id } of orphans) await assignTask(id, tokenId, author);
  return orphans.length;
}

/** Взять задачу в работу: назначить на себя и перевести в in_progress. */
export async function claimTask(id: string, tokenId: string) {
  const author = { tokenId };
  await assignTask(id, tokenId, author);
  return setStatus(id, "in_progress", author);
}

export async function setRecurrence(id: string, days: number | null, author: Author) {
  if (days !== null && (!Number.isInteger(days) || days < 1)) {
    fail("Интервал повторения — целое число дней, не меньше одного");
  }
  // срок — самостоятельное поле: повтор его не затирает и не уносит с собой,
  // а лишь берёт точку отсчёта, когда её ещё нет
  const before = await requireTask(id);
  const updated = await prisma.task.update({
    where: { id },
    data: { recurrence: days, ...(days !== null && !before.dueAt ? { dueAt: today() } : {}) },
  });
  await recordSystem(
    id,
    days === null ? "Повторение снято" : `Задача повторяется каждые ${days} дн.`,
    author,
  );
  return updated;
}

/** Удаление уносит поддерево и ленту — каскадом на уровне базы. */
export async function deleteTask(id: string) {
  await prisma.task.delete({ where: { id } });
}

/** Дерево задач проекта. Шаблоны в обычную выборку не попадают (ADR-0001). */
export async function listProjectTree(projectId: string): Promise<TaskNode[]> {
  const tasks = await prisma.task.findMany({
    where: { projectId, isTemplate: false },
    orderBy: { createdAt: "asc" },
  });
  return buildTree(tasks, null);
}

/**
 * Плоский список задач — ответ на вопрос «что делать сейчас», и потому
 * единственное чтение, которое прячет ненаступившие сроки (ADR-0004).
 * Просроченное идёт первым, бессрочное — последним.
 */
export function listTasks(
  projectId: string,
  filter: {
    status?: TaskStatus;
    assigneeTokenId?: string;
    /** показать и то, чей срок ещё не наступил */
    includeFuture?: boolean;
  } = {},
) {
  const { includeFuture, ...match } = filter;
  return prisma.task.findMany({
    where: {
      projectId,
      isTemplate: false,
      ...match,
      ...(includeFuture ? {} : { OR: [{ dueAt: null }, { dueAt: { lte: today() } }] }),
    },
    include: { assignee: true, createdBy: true },
    orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
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

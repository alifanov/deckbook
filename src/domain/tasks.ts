import { prisma } from "../db";
import type { Author } from "./author";
import { recordSystem } from "./comments";
import { fail } from "./errors";
import { buildTree, type Node } from "./tree";
import type { Task, TaskPriority, TaskStatus } from "../generated/prisma/client";

export const STATUSES = ["todo", "in_progress", "done", "cancelled"] as const;

/**
 * Владелец в поле исполнителя: формы и фильтры шлют это вместо id токена.
 * С настоящим id не столкнётся — те выдаются как cuid.
 */
export const OWNER_ASSIGNEE = "owner";

/** От важного к неважному — в этом порядке приоритеты и показываются. */
export const PRIORITIES = ["high", "normal", "low"] as const;

export type TaskNode = Node<Task>;

/** Закрытая задача — сделанная или отменённая: работы по ней больше нет. */
export const isClosed = (task: { status: TaskStatus }) =>
  task.status === "done" || task.status === "cancelled";

/**
 * Убирает закрытые задачи из дерева. Закрытый родитель остаётся, если под ним
 * ещё есть открытое, — иначе живые подзадачи исчезли бы вместе с ним.
 */
export const hideClosed = (nodes: TaskNode[]): TaskNode[] =>
  nodes.flatMap((node) => {
    const children = hideClosed(node.children);
    return isClosed(node) && children.length === 0 ? [] : [{ ...node, children }];
  });

/** Статус из набора или ничего — набор фиксирован и не настраивается. */
export const asStatus = (value: string | null | undefined): TaskStatus | null =>
  (STATUSES as readonly string[]).includes(value ?? "") ? (value as TaskStatus) : null;

export function parseStatus(value: string): TaskStatus {
  const status = asStatus(value);
  if (!status) fail(`Статуса «${value}» не существует; допустимы: ${STATUSES.join(", ")}`);
  return status;
}

/** Приоритет из набора или ничего — набор фиксирован, как и у статуса. */
export const asPriority = (value: string | null | undefined): TaskPriority | null =>
  (PRIORITIES as readonly string[]).includes(value ?? "") ? (value as TaskPriority) : null;

export function parsePriority(value: string): TaskPriority {
  const priority = asPriority(value);
  if (!priority) {
    fail(`Приоритета «${value}» не существует; допустимы: ${PRIORITIES.join(", ")}`);
  }
  return priority;
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

/** Задача существует и лежит в этом проекте — граница агента (ADR-0003). */
export async function requireTaskInProject(id: string, projectId: string) {
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task || task.projectId !== projectId) {
    fail(`Задачи ${id} нет в этом проекте — доступны только задачи текущего проекта`);
  }
  return task;
}

/** Родитель и ребёнок всегда в одном проекте (ADR-0003). */
async function requireParentInProject(parentId: string, projectId: string) {
  const parent = await requireTask(parentId);
  if (parent.projectId !== projectId) {
    fail("Родитель и подзадача должны принадлежать одному проекту");
  }
  return parent;
}

export async function createTask(
  input: {
    projectId: string;
    parentId?: string | null;
    title: string;
    description?: string;
    dueAt?: Date | null;
    priority?: TaskPriority;
    assigneeTokenId?: string | null;
  },
  author: Author,
) {
  const title = input.title.trim();
  if (!title) fail("У задачи должен быть заголовок");

  if (input.parentId) await requireParentInProject(input.parentId, input.projectId);

  return prisma.task.create({
    data: {
      projectId: input.projectId,
      parentId: input.parentId ?? null,
      title,
      description: input.description?.trim() ?? "",
      dueAt: input.dueAt ?? null,
      priority: input.priority ?? "normal",
      assigneeTokenId: input.assigneeTokenId ?? null,
      createdByTokenId: author.tokenId,
    },
  });
}

/** Важность задачи. Снять её нельзя — можно только вернуть к normal. */
export async function setPriority(id: string, priority: TaskPriority, author: Author) {
  const before = await requireTask(id);
  if (before.priority === priority) return before;

  const updated = await prisma.task.update({ where: { id }, data: { priority } });
  await recordSystem(id, `Приоритет: ${before.priority} → ${priority}`, author);
  return updated;
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
    data: { assigneeTokenId: tokenId, assignedToOwner: false },
  });
  await recordSystem(id, tokenId ? "Задача назначена на агента" : "Назначение снято", author);
  return updated;
}

/** Задача на владельце: агента у неё нет, в my_tasks она не попадает. */
export async function assignTaskToOwner(id: string, author: Author) {
  await requireTask(id);
  const updated = await prisma.task.update({
    where: { id },
    data: { assigneeTokenId: null, assignedToOwner: true },
  });
  await recordSystem(id, "Задача назначена на владельца", author);
  return updated;
}

/** Ничья — ни агента, ни владельца: такую задачу никто не увидит в своих списках. */
const UNASSIGNED = { assigneeTokenId: null, assignedToOwner: false } as const;

export const countUnassigned = (projectId: string) =>
  prisma.task.count({ where: { projectId, ...UNASSIGNED } });

/**
 * Раздаёт агенту все ничьи задачи проекта разом. Ничья задача не попадает
 * ни в один my_tasks, поэтому копится молча; здесь она разбирается пачкой.
 */
export async function assignUnassigned(projectId: string, tokenId: string, author: Author) {
  const orphans = await prisma.task.findMany({
    where: { projectId, ...UNASSIGNED },
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

/** Дерево задач проекта. */
export async function listProjectTree(projectId: string): Promise<TaskNode[]> {
  const tasks = await prisma.task.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
  });
  return buildTree(tasks, null);
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
    where: { assignedToOwner: true, status: { in: ["todo", "in_progress"] } },
    include: { project: true },
    orderBy: [
      { dueAt: { sort: "asc", nulls: "last" } },
      { priority: "desc" },
      { createdAt: "asc" },
    ],
  });

/** Сводка проекта по статусам. Нули в ней тоже есть — пустой статус это факт. */
export async function countByStatus(projectId: string): Promise<Record<TaskStatus, number>> {
  const rows = await prisma.task.groupBy({
    by: ["status"],
    where: { projectId },
    _count: { _all: true },
  });
  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<TaskStatus, number>;
  for (const row of rows) counts[row.status] = row._count._all;
  return counts;
}

export type DayFlow = { day: string; created: number; closed: number };

/**
 * Темп работы: сколько задач заведено и сколько закрыто в каждый из последних
 * `days` дней, сегодня включительно. Пустые дни остаются в ряду — провал
 * в графике читается только на фоне соседей.
 */
export async function dailyFlow(projectId: string, days = 14): Promise<DayFlow[]> {
  const DAY = 24 * 60 * 60 * 1000;
  const from = new Date(today().getTime() - (days - 1) * DAY);
  const tasks = await prisma.task.findMany({
    where: { projectId, OR: [{ createdAt: { gte: from } }, { lastClosedAt: { gte: from } }] },
    select: { createdAt: true, lastClosedAt: true },
  });

  const flow = new Map<string, DayFlow>();
  for (let i = 0; i < days; i++) {
    const day = asDay(new Date(from.getTime() + i * DAY));
    flow.set(day, { day, created: 0, closed: 0 });
  }
  // задача могла попасть в выборку по одной дате, а второй уехать за окно
  for (const task of tasks) {
    const created = flow.get(asDay(task.createdAt));
    if (created) created.created++;
    const closed = task.lastClosedAt && flow.get(asDay(task.lastClosedAt));
    if (closed) closed.closed++;
  }
  return [...flow.values()];
}

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

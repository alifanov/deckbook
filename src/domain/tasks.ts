import { prisma } from "../db";
import type { Author } from "./author";
import { recordSystem } from "./comments";
import { fail } from "./errors";
import { requireTask } from "./task-queries";
import { UNASSIGNED, asDay, today } from "./task-values";
import type { Task, TaskPriority, TaskStatus } from "../generated/prisma/client";

// словарь значений, чтения и статистика переехали по своим модулям —
// здесь остаются изменения задач, а публичные имена прежние
export * from "./task-queries";
export * from "./task-stats";
export * from "./task-values";

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

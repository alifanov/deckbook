import { prisma } from "../db";
import type { Author } from "./author";
import { fail } from "./errors";
import type { Task } from "../generated/prisma/client";

/**
 * Шаблон — то же дерево задач с признаком, а не отдельная сущность (ADR-0001).
 * Тем же вызовом шаблон переключается между глобальным и проектным:
 * глобальный отличается только тем, что `projectId` у него null.
 */
export async function markAsTemplate(
  taskId: string,
  scope: { global: boolean; projectId?: string },
) {
  const root = await prisma.task.findUnique({ where: { id: taskId } });
  if (!root) fail("Задачи не существует");
  if (root.parentId) fail("Шаблоном становится дерево целиком — начиная с корневой задачи");

  const projectId = scope.global ? null : (scope.projectId ?? root.projectId);
  if (projectId === null && !scope.global) fail("Проектному шаблону нужен проект");

  await prisma.task.updateMany({
    where: { id: { in: await subtreeIds(taskId) } },
    data: { isTemplate: true, projectId },
  });
  return prisma.task.findUniqueOrThrow({ where: { id: taskId } });
}

/** Шаблоны, доступные проекту: его собственные и глобальные. */
export function listTemplates(projectId: string) {
  return prisma.task.findMany({
    where: {
      isTemplate: true,
      parentId: null,
      OR: [{ projectId }, { projectId: null }],
    },
    orderBy: { createdAt: "asc" },
  });
}

async function subtreeIds(rootId: string): Promise<string[]> {
  const ids = [rootId];
  for (let frontier = [rootId]; frontier.length; ) {
    const children = await prisma.task.findMany({
      where: { parentId: { in: frontier } },
      select: { id: true },
    });
    frontier = children.map((c) => c.id);
    ids.push(...frontier);
  }
  return ids;
}

/**
 * Разворачивает шаблон в новое дерево задач. Сам шаблон не меняется,
 * комментарии не копируются, глобальный шаблон остаётся глобальным.
 */
export async function applyTemplate(
  templateId: string,
  target: { projectId: string; parentId?: string | null },
  author: Author,
) {
  const template = await prisma.task.findUnique({ where: { id: templateId } });
  if (!template?.isTemplate) fail("Это не шаблон");
  if (template.projectId !== null && template.projectId !== target.projectId) {
    fail("Шаблон принадлежит другому проекту");
  }

  if (target.parentId) {
    const parent = await prisma.task.findUnique({ where: { id: target.parentId } });
    if (!parent) fail("Родителя не существует");
    if (parent.projectId !== target.projectId) fail("Родитель из другого проекта");
    if (parent.isTemplate) fail("Разворачивать шаблон внутрь шаблона нельзя");
  }

  return copyInto(template, target.parentId ?? null, target.projectId, author);
}

async function copyInto(
  source: Task,
  parentId: string | null,
  projectId: string,
  author: Author,
): Promise<Task> {
  const copy = await prisma.task.create({
    data: {
      projectId,
      parentId,
      title: source.title,
      description: source.description,
      status: "todo",
      isTemplate: false,
      recurrence: source.recurrence,
      createdByTokenId: author.tokenId,
    },
  });

  const children = await prisma.task.findMany({
    where: { parentId: source.id },
    orderBy: { createdAt: "asc" },
  });
  for (const child of children) await copyInto(child, copy.id, projectId, author);

  return copy;
}

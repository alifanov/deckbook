import { prisma } from "../db";
import type { Actor } from "./actor";
import { fail } from "./errors";
import type { Task } from "../generated/prisma/client";

/** Шаблон — то же дерево задач с признаком, а не отдельная сущность (ADR-0001). */
export async function markAsTemplate(taskId: string, global: boolean) {
  const root = await prisma.task.findUnique({ where: { id: taskId } });
  if (!root) fail("Задачи не существует");
  if (root.parentId) fail("Шаблоном становится дерево целиком — начиная с корневой задачи");

  const ids = await subtreeIds(taskId);
  await prisma.task.updateMany({
    where: { id: { in: ids } },
    data: { isTemplate: true, projectId: global ? null : root.projectId },
  });
  return prisma.task.findUnique({ where: { id: taskId } });
}

export async function setTemplateScope(taskId: string, global: boolean, projectId: string) {
  const root = await prisma.task.findUnique({ where: { id: taskId } });
  if (!root?.isTemplate) fail("Это не шаблон");

  const ids = await subtreeIds(taskId);
  await prisma.task.updateMany({
    where: { id: { in: ids } },
    data: { projectId: global ? null : projectId },
  });
  return prisma.task.findUnique({ where: { id: taskId } });
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
  actor: Actor,
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

  return copyInto(template, target.parentId ?? null, target.projectId, actor);
}

async function copyInto(
  source: Task,
  parentId: string | null,
  projectId: string,
  actor: Actor,
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
      createdByTokenId: actor.tokenId,
    },
  });

  const children = await prisma.task.findMany({
    where: { parentId: source.id },
    orderBy: { createdAt: "asc" },
  });
  for (const child of children) await copyInto(child, copy.id, projectId, actor);

  return copy;
}

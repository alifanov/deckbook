import { prisma } from "../db";
import { OWNER_OPEN, STATUSES, UNASSIGNED, asDay, today } from "./task-values";
import type { TaskStatus } from "../generated/prisma/client";

export const countUnassigned = (projectId: string) =>
  prisma.task.count({ where: { projectId, ...UNASSIGNED } });

/** Незакрытые задачи владельца одним числом — для счётчика в хидере. */
export const countOwnerTasks = () => prisma.task.count({ where: OWNER_OPEN });

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

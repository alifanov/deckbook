import { fail } from "./errors";
import type { TaskPriority, TaskStatus } from "../generated/prisma/client";

export const STATUSES = ["todo", "in_progress", "needs_human", "done", "cancelled"] as const;

/**
 * Владелец в поле исполнителя: формы и фильтры шлют это вместо id токена.
 * С настоящим id не столкнётся — те выдаются как cuid.
 */
export const OWNER_ASSIGNEE = "owner";

/** От важного к неважному — в этом порядке приоритеты и показываются. */
export const PRIORITIES = ["high", "normal", "low"] as const;

/** Закрытая задача — сделанная или отменённая: работы по ней больше нет. */
export const isClosed = (task: { status: TaskStatus }) =>
  task.status === "done" || task.status === "cancelled";

/** То же самое наоборот, списком — для запросов в базу. */
export const OPEN_STATUSES: TaskStatus[] = ["todo", "in_progress", "needs_human"];

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

/** Ничья — ни агента, ни владельца: такую задачу никто не увидит в своих списках. */
export const UNASSIGNED = { assigneeTokenId: null, assignedToOwner: false } as const;

/**
 * То, что показывают «Мои задачи»: незакрытое на владельце плюс всё, что упёрлось
 * в needs_human. Такая задача ждёт ответа человека, кому бы ни была назначена, —
 * иначе она застряла бы у агента, которого владелец не видит.
 */
export const OWNER_OPEN = {
  OR: [
    { assignedToOwner: true, status: { in: OPEN_STATUSES } },
    { status: "needs_human" as const },
  ],
};

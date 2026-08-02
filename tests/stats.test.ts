import { describe, expect, it } from "vitest";
import { OWNER } from "../src/domain/author";
import { asDay, countByStatus, createTask, dailyFlow, setStatus, today } from "../src/domain/tasks";
import { prisma } from "../src/db";
import { makeProject } from "./helpers";

const DAY = 24 * 60 * 60 * 1000;
const shifted = (days: number) => new Date(today().getTime() + days * DAY);

describe("сводка по статусам", () => {
  it("считает задачи каждого статуса и оставляет нули", async () => {
    const project = await makeProject();
    const a = await createTask({ projectId: project.id, title: "Раз" }, OWNER);
    const b = await createTask({ projectId: project.id, title: "Два" }, OWNER);
    await createTask({ projectId: project.id, title: "Три" }, OWNER);
    await setStatus(a.id, "in_progress", OWNER);
    await setStatus(b.id, "done", OWNER);

    expect(await countByStatus(project.id)).toEqual({
      todo: 1,
      in_progress: 1,
      done: 1,
      cancelled: 0,
    });
  });

  it("не смешивает проекты", async () => {
    const mine = await makeProject("Мой");
    const other = await makeProject("Чужой");
    await createTask({ projectId: other.id, title: "Не моя" }, OWNER);

    expect((await countByStatus(mine.id)).todo).toBe(0);
  });
});

describe("темп работы по дням", () => {
  it("отдаёт ряд без пропусков, последний день — сегодня", async () => {
    const project = await makeProject();
    const flow = await dailyFlow(project.id, 7);

    expect(flow).toHaveLength(7);
    expect(flow.at(-1)?.day).toBe(asDay(today()));
    expect(flow.every((d) => d.created === 0 && d.closed === 0)).toBe(true);
  });

  it("разносит заведение и закрытие по своим дням", async () => {
    const project = await makeProject();
    const task = await createTask({ projectId: project.id, title: "Работа" }, OWNER);
    await setStatus(task.id, "done", OWNER);
    // заведена позавчера, закрыта сегодня — даты правим напрямую, времени в тесте нет
    await prisma.task.update({
      where: { id: task.id },
      data: { createdAt: shifted(-2) },
    });

    const flow = await dailyFlow(project.id, 7);
    const at = (days: number) => flow.find((d) => d.day === asDay(shifted(days)));

    expect(at(-2)?.created).toBe(1);
    expect(at(-2)?.closed).toBe(0);
    expect(at(0)?.created).toBe(0);
    expect(at(0)?.closed).toBe(1);
  });

  it("не считает то, что вышло за окно", async () => {
    const project = await makeProject();
    const old = await createTask({ projectId: project.id, title: "Старьё" }, OWNER);
    await prisma.task.update({ where: { id: old.id }, data: { createdAt: shifted(-30) } });

    const flow = await dailyFlow(project.id, 7);
    expect(flow.reduce((sum, d) => sum + d.created, 0)).toBe(0);
  });
});

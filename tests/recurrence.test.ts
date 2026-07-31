import { describe, expect, it } from "vitest";
import { OWNER } from "../src/domain/author";
import { prisma } from "../src/db";
import { createTask, setRecurrence, setStatus } from "../src/domain/tasks";
import { makeProject } from "./helpers";

const DAY = 24 * 60 * 60 * 1000;

describe("рекуррентные задачи", () => {
  it("закрытие возвращает задачу в todo со сдвинутой датой", async () => {
    const project = await makeProject();
    const task = await createTask({ projectId: project.id, title: "Обновить зависимости" }, OWNER);
    const repeating = await setRecurrence(task.id, 7, OWNER);
    const dueBefore = repeating.dueAt!;

    const closed = await setStatus(task.id, "done", OWNER);

    expect(closed.status).toBe("todo");
    expect(closed.lastClosedAt).not.toBeNull();
    expect(closed.dueAt!.getTime() - dueBefore.getTime()).toBe(7 * DAY);
  });

  it("не создаёт новых задач", async () => {
    const project = await makeProject();
    const task = await createTask({ projectId: project.id, title: "Повтор" }, OWNER);
    await setRecurrence(task.id, 1, OWNER);

    await setStatus(task.id, "done", OWNER);
    await setStatus(task.id, "done", OWNER);

    expect(await prisma.task.count({ where: { projectId: project.id } })).toBe(1);
  });

  it("обычная задача при закрытии остаётся закрытой", async () => {
    const project = await makeProject();
    const task = await createTask({ projectId: project.id, title: "Разовая" }, OWNER);

    expect((await setStatus(task.id, "done", OWNER)).status).toBe("done");
  });

  it("cancelled закрывает повторяющуюся задачу окончательно", async () => {
    const project = await makeProject();
    const task = await createTask({ projectId: project.id, title: "Повтор" }, OWNER);
    await setRecurrence(task.id, 3, OWNER);

    expect((await setStatus(task.id, "cancelled", OWNER)).status).toBe("cancelled");
  });

  it("снятие повторения даёт задаче закрыться", async () => {
    const project = await makeProject();
    const task = await createTask({ projectId: project.id, title: "Повтор" }, OWNER);
    await setRecurrence(task.id, 3, OWNER);
    await setRecurrence(task.id, null, OWNER);

    expect((await setStatus(task.id, "done", OWNER)).status).toBe("done");
  });

  it("показывает даты создания и последнего закрытия", async () => {
    const project = await makeProject();
    const task = await createTask({ projectId: project.id, title: "Повтор" }, OWNER);
    await setRecurrence(task.id, 2, OWNER);

    const closed = await setStatus(task.id, "done", OWNER);
    expect(closed.createdAt).toBeInstanceOf(Date);
    expect(closed.lastClosedAt).toBeInstanceOf(Date);
  });

  it("отвергает бессмысленный интервал", async () => {
    const project = await makeProject();
    const task = await createTask({ projectId: project.id, title: "Повтор" }, OWNER);

    await expect(setRecurrence(task.id, 0, OWNER)).rejects.toThrow(/не меньше одного/);
  });
});

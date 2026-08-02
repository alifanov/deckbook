import { describe, expect, it } from "vitest";
import { OWNER } from "../src/domain/author";
import { listComments } from "../src/domain/comments";
import { createTask, listTasks, parsePriority, setDueDate, setPriority } from "../src/domain/tasks";
import { makeProject } from "./helpers";

const titles = (tasks: { title: string }[]) => tasks.map((t) => t.title);

describe("приоритет задачи", () => {
  it("по умолчанию обычный", async () => {
    const project = await makeProject();
    const task = await createTask({ projectId: project.id, title: "Задача" }, OWNER);

    expect(task.priority).toBe("normal");
  });

  it("создаётся сразу с заданным приоритетом", async () => {
    const project = await makeProject();
    const task = await createTask(
      { projectId: project.id, title: "Срочное", priority: "high" },
      OWNER,
    );

    expect(task.priority).toBe("high");
  });

  it("смена приоритета оставляет след в ленте", async () => {
    const project = await makeProject();
    const task = await createTask({ projectId: project.id, title: "Задача" }, OWNER);

    expect((await setPriority(task.id, "high", OWNER)).priority).toBe("high");
    const feed = await listComments(task.id);
    expect(feed.at(-1)!.body).toBe("Приоритет: normal → high");
  });

  it("повторная простановка того же приоритета ленту не трогает", async () => {
    const project = await makeProject();
    const task = await createTask({ projectId: project.id, title: "Задача" }, OWNER);
    await setPriority(task.id, "low", OWNER);

    await setPriority(task.id, "low", OWNER);

    expect(await listComments(task.id)).toHaveLength(1);
  });

  it("важное идёт первым среди бессрочных", async () => {
    const project = await makeProject();
    await createTask({ projectId: project.id, title: "Неважное", priority: "low" }, OWNER);
    await createTask({ projectId: project.id, title: "Обычное" }, OWNER);
    await createTask({ projectId: project.id, title: "Важное", priority: "high" }, OWNER);

    expect(titles(await listTasks(project.id))).toEqual(["Важное", "Обычное", "Неважное"]);
  });

  it("срок сильнее приоритета", async () => {
    const project = await makeProject();
    const dated = await createTask({ projectId: project.id, title: "Со сроком" }, OWNER);
    await setDueDate(dated.id, new Date("2020-01-01T00:00:00.000Z"), OWNER);
    await createTask({ projectId: project.id, title: "Важное", priority: "high" }, OWNER);

    expect(titles(await listTasks(project.id))).toEqual(["Со сроком", "Важное"]);
  });

  it("фильтрует по приоритету", async () => {
    const project = await makeProject();
    await createTask({ projectId: project.id, title: "Важное", priority: "high" }, OWNER);
    await createTask({ projectId: project.id, title: "Обычное" }, OWNER);

    expect(titles(await listTasks(project.id, { priority: "high" }))).toEqual(["Важное"]);
  });

  it("отвергает несуществующий приоритет", () => {
    expect(() => parsePriority("urgent")).toThrow(/не существует/);
  });
});

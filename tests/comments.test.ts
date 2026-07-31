import { describe, expect, it } from "vitest";
import { OWNER, agent } from "../src/domain/author";
import { addComment, listComments } from "../src/domain/comments";
import { prisma } from "../src/db";
import {
  assignTask,
  createTask,
  deleteTask,
  moveTask,
  setStatus,
  updateTask,
} from "../src/domain/tasks";
import { makeProject, makeToken } from "./helpers";

describe("лента задачи", () => {
  it("пишет комментарий владельца и агента с правильным автором", async () => {
    const project = await makeProject();
    const { token } = await makeToken(project.id);
    const task = await createTask({ projectId: project.id, title: "Задача" }, OWNER);

    await addComment(task.id, "от владельца", OWNER);
    await addComment(task.id, "от агента", agent(token.id));

    const feed = await listComments(task.id);
    expect(feed.map((c) => [c.kind, c.body, c.authorTokenId])).toEqual([
      ["human", "от владельца", null],
      ["human", "от агента", token.id],
    ]);
  });

  it("порождает системную запись на смену статуса", async () => {
    const project = await makeProject();
    const task = await createTask({ projectId: project.id, title: "Задача" }, OWNER);

    await setStatus(task.id, "in_progress", OWNER);

    const [entry] = await listComments(task.id);
    expect(entry.kind).toBe("system");
    expect(entry.body).toContain("in_progress");
  });

  it("порождает системные записи на назначение, перемещение и правку", async () => {
    const project = await makeProject();
    const { token } = await makeToken(project.id);
    const parent = await createTask({ projectId: project.id, title: "Родитель" }, OWNER);
    const task = await createTask({ projectId: project.id, title: "Задача" }, OWNER);

    await assignTask(task.id, token.id, OWNER);
    await assignTask(task.id, null, OWNER);
    await moveTask(task.id, parent.id, OWNER);
    await updateTask(task.id, { title: "Другой заголовок" }, OWNER);
    await updateTask(task.id, { description: "новое описание" }, OWNER);

    const feed = await listComments(task.id);
    expect(feed.map((c) => c.kind)).toEqual(["system", "system", "system", "system", "system"]);
    expect(feed.map((c) => c.body)).toEqual([
      "Задача назначена на агента",
      "Назначение снято",
      "Задача перенесена под другого родителя",
      "Заголовок изменён на «Другой заголовок»",
      "Описание изменено",
    ]);
  });

  it("отдаёт ленту в хронологическом порядке", async () => {
    const project = await makeProject();
    const task = await createTask({ projectId: project.id, title: "Задача" }, OWNER);

    await addComment(task.id, "первый", OWNER);
    await setStatus(task.id, "in_progress", OWNER);
    await addComment(task.id, "второй", OWNER);

    expect((await listComments(task.id)).map((c) => c.body)).toEqual([
      "первый",
      "Статус: todo → in_progress",
      "второй",
    ]);
  });

  it("удаление задачи уносит её ленту", async () => {
    const project = await makeProject();
    const task = await createTask({ projectId: project.id, title: "Задача" }, OWNER);
    await addComment(task.id, "запись", OWNER);

    await deleteTask(task.id);
    expect(await prisma.comment.count()).toBe(0);
  });
});

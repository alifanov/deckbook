import { describe, expect, it } from "vitest";
import { OWNER } from "../src/domain/author";
import { addComment } from "../src/domain/comments";
import { prisma } from "../src/db";
import { applyTemplate, listTemplates, markAsTemplate } from "../src/domain/templates";
import {
  assignTask,
  createTask,
  getTaskTree,
  listProjectTree,
  listTasks,
  setStatus,
} from "../src/domain/tasks";
import { makeProject, makeToken } from "./helpers";

async function makeBugfixTemplate(projectId: string, global = false) {
  const root = await createTask({ projectId, title: "Исправление бага" }, OWNER);
  const tests = await createTask(
    { projectId, parentId: root.id, title: "Тесты" },
    OWNER,
  );
  await createTask({ projectId, parentId: tests.id, title: "Прогнать линт" }, OWNER);
  await createTask({ projectId, parentId: root.id, title: "Билд" }, OWNER);
  await markAsTemplate(root.id, { global });
  return root;
}

describe("шаблоны", () => {
  it("разворачивается в новое дерево, не меняя сам шаблон", async () => {
    const project = await makeProject();
    const template = await makeBugfixTemplate(project.id);

    const applied = await applyTemplate(template.id, { projectId: project.id }, OWNER);

    const copy = await getTaskTree(applied.id);
    expect(copy.title).toBe("Исправление бага");
    expect(copy.children.map((c) => c.title).sort()).toEqual(["Билд", "Тесты"]);
    expect(copy.children.find((c) => c.title === "Тесты")?.children[0].title).toBe("Прогнать линт");
    expect(copy.isTemplate).toBe(false);

    const untouched = await getTaskTree(template.id);
    expect(untouched.isTemplate).toBe(true);
    expect(untouched.children).toHaveLength(2);
  });

  it("применяется повторно", async () => {
    const project = await makeProject();
    const template = await makeBugfixTemplate(project.id);

    await applyTemplate(template.id, { projectId: project.id }, OWNER);
    await applyTemplate(template.id, { projectId: project.id }, OWNER);

    expect(await listProjectTree(project.id)).toHaveLength(2);
  });

  it("разворачивается внутри указанной ветки", async () => {
    const project = await makeProject();
    const template = await makeBugfixTemplate(project.id);
    const parent = await createTask({ projectId: project.id, title: "Релиз" }, OWNER);

    const applied = await applyTemplate(
      template.id,
      { projectId: project.id, parentId: parent.id },
      OWNER,
    );

    expect(applied.parentId).toBe(parent.id);
  });

  it("создаёт задачи в статусе todo и без назначения", async () => {
    const project = await makeProject();
    const { token } = await makeToken(project.id);
    const template = await makeBugfixTemplate(project.id);
    await setStatus(template.id, "done", OWNER);
    await assignTask(template.id, token.id, OWNER);

    const applied = await applyTemplate(template.id, { projectId: project.id }, OWNER);
    expect(applied.status).toBe("todo");
    expect(applied.assigneeTokenId).toBeNull();
  });

  it("не переносит комментарии шаблона в копию", async () => {
    const project = await makeProject();
    const template = await makeBugfixTemplate(project.id);
    await addComment(template.id, "заметка на будущее", OWNER);

    const applied = await applyTemplate(template.id, { projectId: project.id }, OWNER);
    expect(await prisma.comment.count({ where: { taskId: applied.id } })).toBe(0);
  });

  it("глобальный шаблон разворачивается в текущий проект и остаётся глобальным", async () => {
    const home = await makeProject("Дом");
    const other = await makeProject("Другой");
    const template = await makeBugfixTemplate(home.id, true);

    const applied = await applyTemplate(template.id, { projectId: other.id }, OWNER);

    expect(applied.projectId).toBe(other.id);
    const still = await prisma.task.findUniqueOrThrow({ where: { id: template.id } });
    expect(still.projectId).toBeNull();
    expect(still.isTemplate).toBe(true);
  });

  it("проектный шаблон не разворачивается в чужом проекте", async () => {
    const home = await makeProject("Дом");
    const other = await makeProject("Другой");
    const template = await makeBugfixTemplate(home.id);

    await expect(applyTemplate(template.id, { projectId: other.id }, OWNER)).rejects.toThrow(
      /другому проекту/,
    );
  });

  it("шаблоны не попадают в обычные выборки задач", async () => {
    const project = await makeProject();
    await makeBugfixTemplate(project.id);
    await createTask({ projectId: project.id, title: "Настоящая работа" }, OWNER);

    expect((await listProjectTree(project.id)).map((t) => t.title)).toEqual(["Настоящая работа"]);
    expect((await listTasks(project.id, { status: "todo" })).map((t) => t.title)).toEqual([
      "Настоящая работа",
    ]);
  });

  it("подзадача шаблона тоже шаблон", async () => {
    const project = await makeProject();
    const template = await makeBugfixTemplate(project.id);
    const added = await createTask(
      { projectId: project.id, parentId: template.id, title: "Деплой" },
      OWNER,
    );

    expect(added.isTemplate).toBe(true);
  });

  it("показывает проекту его шаблоны и глобальные", async () => {
    const home = await makeProject("Дом");
    const other = await makeProject("Другой");
    await makeBugfixTemplate(home.id);
    const global = await createTask({ projectId: other.id, title: "Глобальный" }, OWNER);
    await markAsTemplate(global.id, { global: true });

    expect((await listTemplates(home.id)).map((t) => t.title).sort()).toEqual([
      "Глобальный",
      "Исправление бага",
    ]);
  });

  it("переключает шаблон между глобальным и проектным", async () => {
    const project = await makeProject();
    const template = await makeBugfixTemplate(project.id);

    expect((await markAsTemplate(template.id, { global: true })).projectId).toBeNull();
    expect(
      (await markAsTemplate(template.id, { global: false, projectId: project.id })).projectId,
    ).toBe(project.id);
  });
});

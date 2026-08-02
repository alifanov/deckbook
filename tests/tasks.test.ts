import { describe, expect, it } from "vitest";
import { OWNER, agent } from "../src/domain/author";
import {
  assignTask,
  assignTaskToOwner,
  assignUnassigned,
  countUnassigned,
  createTask,
  deleteTask,
  getTaskTree,
  hideClosed,
  listOwnerTasks,
  listProjectTree,
  listTasks,
  moveTask,
  parseStatus,
  setStatus,
  updateTask,
} from "../src/domain/tasks";
import { prisma } from "../src/db";
import { makeProject, makeToken } from "./helpers";

describe("дерево задач", () => {
  it("создаёт задачу с заголовком и описанием", async () => {
    const project = await makeProject();
    const task = await createTask(
      { projectId: project.id, title: "Починить билд", description: "падает на линте" },
      OWNER,
    );

    expect(task.title).toBe("Починить билд");
    expect(task.description).toBe("падает на линте");
    expect(task.status).toBe("todo");
    expect(task.createdByTokenId).toBeNull();
  });

  it("помнит, что задачу создал агент", async () => {
    const project = await makeProject();
    const { token } = await makeToken(project.id);
    const task = await createTask(
      { projectId: project.id, title: "Найденная работа" },
      agent(token.id),
    );

    expect(task.createdByTokenId).toBe(token.id);
  });

  it("вкладывает подзадачи произвольно глубоко", async () => {
    const project = await makeProject();
    let parentId: string | null = null;
    for (let depth = 0; depth < 6; depth++) {
      const task: { id: string } = await createTask(
        { projectId: project.id, parentId, title: `Уровень ${depth}` },
        OWNER,
      );
      parentId = task.id;
    }

    const [root] = await listProjectTree(project.id);
    let depth = 1;
    for (let node = root; node.children.length; depth++) node = node.children[0];
    expect(depth).toBe(6);
  });

  it("отдаёт задачу вместе с поддеревом", async () => {
    const project = await makeProject();
    const root = await createTask({ projectId: project.id, title: "Эпик" }, OWNER);
    const child = await createTask(
      { projectId: project.id, parentId: root.id, title: "Шаг" },
      OWNER,
    );
    await createTask({ projectId: project.id, parentId: child.id, title: "Подшаг" }, OWNER);

    const tree = await getTaskTree(root.id);
    expect(tree.children).toHaveLength(1);
    expect(tree.children[0].children[0].title).toBe("Подшаг");
  });

  it("эпик — это корневая задача с детьми, а не отдельная сущность", async () => {
    const project = await makeProject();
    const epic = await createTask({ projectId: project.id, title: "Эпик" }, OWNER);
    await createTask({ projectId: project.id, parentId: epic.id, title: "Шаг" }, OWNER);
    await createTask({ projectId: project.id, title: "Одиночка" }, OWNER);

    const roots = await listProjectTree(project.id);
    const epics = roots.filter((t) => t.children.length > 0);
    expect(epics.map((e) => e.title)).toEqual(["Эпик"]);
  });

  it("отказывает, если родитель из другого проекта", async () => {
    const a = await makeProject("A");
    const b = await makeProject("B");
    const parent = await createTask({ projectId: a.id, title: "Чужая" }, OWNER);

    await expect(
      createTask({ projectId: b.id, parentId: parent.id, title: "Своя" }, OWNER),
    ).rejects.toThrow(/одному проекту/);
  });

  it("удаляет задачу вместе с поддеревом", async () => {
    const project = await makeProject();
    const root = await createTask({ projectId: project.id, title: "Эпик" }, OWNER);
    await createTask({ projectId: project.id, parentId: root.id, title: "Шаг" }, OWNER);

    await deleteTask(root.id);
    expect(await prisma.task.count()).toBe(0);
  });
});

describe("перемещение", () => {
  it("переносит задачу под другого родителя вместе с поддеревом", async () => {
    const project = await makeProject();
    const oldParent = await createTask({ projectId: project.id, title: "Старый" }, OWNER);
    const newParent = await createTask({ projectId: project.id, title: "Новый" }, OWNER);
    const moved = await createTask(
      { projectId: project.id, parentId: oldParent.id, title: "Переезжает" },
      OWNER,
    );
    const child = await createTask(
      { projectId: project.id, parentId: moved.id, title: "Едет следом" },
      OWNER,
    );

    await moveTask(moved.id, newParent.id, OWNER);

    const tree = await getTaskTree(newParent.id);
    expect(tree.children[0].id).toBe(moved.id);
    expect(tree.children[0].children[0].id).toBe(child.id);
  });

  it("делает вложенную задачу корневой", async () => {
    const project = await makeProject();
    const parent = await createTask({ projectId: project.id, title: "Родитель" }, OWNER);
    const child = await createTask(
      { projectId: project.id, parentId: parent.id, title: "Ребёнок" },
      OWNER,
    );

    await moveTask(child.id, null, OWNER);

    const roots = await listProjectTree(project.id);
    expect(roots.map((t) => t.id).sort()).toEqual([parent.id, child.id].sort());
  });

  it("отказывает переносу задачи внутрь собственного поддерева", async () => {
    const project = await makeProject();
    const root = await createTask({ projectId: project.id, title: "Корень" }, OWNER);
    const child = await createTask(
      { projectId: project.id, parentId: root.id, title: "Ребёнок" },
      OWNER,
    );
    const grandchild = await createTask(
      { projectId: project.id, parentId: child.id, title: "Внук" },
      OWNER,
    );

    await expect(moveTask(root.id, grandchild.id, OWNER)).rejects.toThrow(/поддерева/);
    await expect(moveTask(root.id, root.id, OWNER)).rejects.toThrow(/родителем/);
  });

  it("отказывает переносу в другой проект", async () => {
    const a = await makeProject("A");
    const b = await makeProject("B");
    const task = await createTask({ projectId: a.id, title: "Задача" }, OWNER);
    const foreign = await createTask({ projectId: b.id, title: "Чужой родитель" }, OWNER);

    await expect(moveTask(task.id, foreign.id, OWNER)).rejects.toThrow(/одному проекту/);
  });
});

describe("статусы и назначение", () => {
  it("проходит по всем четырём статусам и отличает cancelled от done", async () => {
    const project = await makeProject();
    const task = await createTask({ projectId: project.id, title: "Задача" }, OWNER);

    expect((await setStatus(task.id, "in_progress", OWNER)).status).toBe("in_progress");
    expect((await setStatus(task.id, "done", OWNER)).status).toBe("done");
    expect((await setStatus(task.id, "cancelled", OWNER)).status).toBe("cancelled");
  });

  it("отвергает статус вне набора", () => {
    expect(() => parseStatus("blocked")).toThrow(/не существует/);
  });

  it("не синхронизирует статусы родителя и детей", async () => {
    const project = await makeProject();
    const parent = await createTask({ projectId: project.id, title: "Родитель" }, OWNER);
    const child = await createTask(
      { projectId: project.id, parentId: parent.id, title: "Ребёнок" },
      OWNER,
    );

    await setStatus(parent.id, "done", OWNER);
    const after = await prisma.task.findUniqueOrThrow({ where: { id: child.id } });
    expect(after.status).toBe("todo");
  });

  it("назначает задачу на агента и снимает назначение", async () => {
    const project = await makeProject();
    const { token } = await makeToken(project.id);
    const task = await createTask({ projectId: project.id, title: "Задача" }, OWNER);

    expect((await assignTask(task.id, token.id, OWNER)).assigneeTokenId).toBe(token.id);
    expect((await assignTask(task.id, null, OWNER)).assigneeTokenId).toBeNull();
  });

  it("не назначает задачу на токен другого проекта", async () => {
    const a = await makeProject("A");
    const b = await makeProject("B");
    const { token } = await makeToken(b.id);
    const task = await createTask({ projectId: a.id, title: "Задача" }, OWNER);

    await expect(assignTask(task.id, token.id, OWNER)).rejects.toThrow(/другой проект/);
  });

  it("фильтрует задачи по статусу и по агенту", async () => {
    const project = await makeProject();
    const { token } = await makeToken(project.id);
    const mine = await createTask({ projectId: project.id, title: "Моя" }, OWNER);
    await createTask({ projectId: project.id, title: "Чужая" }, OWNER);
    await assignTask(mine.id, token.id, OWNER);
    await setStatus(mine.id, "in_progress", OWNER);

    expect((await listTasks(project.id, { status: "in_progress" })).map((t) => t.id)).toEqual([
      mine.id,
    ]);
    expect((await listTasks(project.id, { assigneeTokenId: token.id })).map((t) => t.id)).toEqual([
      mine.id,
    ]);
  });

  it("раздаёт агенту все ничьи задачи разом, чужие не трогает", async () => {
    const project = await makeProject();
    const { token } = await makeToken(project.id);
    const { token: other } = await makeToken(project.id, "Второй");
    const orphan = await createTask({ projectId: project.id, title: "Ничья" }, OWNER);
    const taken = await createTask({ projectId: project.id, title: "Занятая" }, OWNER);
    await assignTask(taken.id, other.id, OWNER);

    expect(await countUnassigned(project.id)).toBe(1);
    expect(await assignUnassigned(project.id, token.id, OWNER)).toBe(1);
    expect(await countUnassigned(project.id)).toBe(0);

    expect((await listTasks(project.id, { assigneeTokenId: token.id })).map((t) => t.id)).toEqual([
      orphan.id,
    ]);
    expect((await listTasks(project.id, { assigneeTokenId: other.id })).map((t) => t.id)).toEqual([
      taken.id,
    ]);
  });

  it("назначает задачу на владельца, снимая агента, и обратно", async () => {
    const project = await makeProject();
    const { token } = await makeToken(project.id);
    const task = await createTask({ projectId: project.id, title: "Задача" }, OWNER);
    await assignTask(task.id, token.id, OWNER);

    const owned = await assignTaskToOwner(task.id, OWNER);
    expect(owned.assignedToOwner).toBe(true);
    expect(owned.assigneeTokenId).toBeNull();

    const back = await assignTask(task.id, token.id, OWNER);
    expect(back.assignedToOwner).toBe(false);
    expect(back.assigneeTokenId).toBe(token.id);
  });

  it("задача на владельце не ничья: раздача агенту её не трогает", async () => {
    const project = await makeProject();
    const { token } = await makeToken(project.id);
    const mine = await createTask({ projectId: project.id, title: "Моя" }, OWNER);
    await createTask({ projectId: project.id, title: "Ничья" }, OWNER);
    await assignTaskToOwner(mine.id, OWNER);

    expect(await countUnassigned(project.id)).toBe(1);
    await assignUnassigned(project.id, token.id, OWNER);

    expect((await listTasks(project.id, { assignedToOwner: true })).map((t) => t.id)).toEqual([
      mine.id,
    ]);
  });

  it("собирает задачи владельца из всех проектов, кроме закрытых", async () => {
    const a = await makeProject("A");
    const b = await makeProject("B");
    const first = await createTask({ projectId: a.id, title: "Первая" }, OWNER);
    const second = await createTask({ projectId: b.id, title: "Вторая" }, OWNER);
    const closed = await createTask({ projectId: b.id, title: "Закрытая" }, OWNER);
    const agents = await createTask({ projectId: a.id, title: "Агентская" }, OWNER);
    for (const task of [first, second, closed]) await assignTaskToOwner(task.id, OWNER);
    await setStatus(closed.id, "done", OWNER);

    const mine = await listOwnerTasks();
    expect(mine.map((t) => t.id).sort()).toEqual([first.id, second.id].sort());
    expect(mine.map((t) => t.id)).not.toContain(agents.id);
    expect(mine.map((t) => t.project.name).sort()).toEqual(["A", "B"]);
  });

  it("правит заголовок и описание", async () => {
    const project = await makeProject();
    const task = await createTask({ projectId: project.id, title: "Было" }, OWNER);

    const updated = await updateTask(task.id, { title: "Стало", description: "детали" }, OWNER);
    expect(updated.title).toBe("Стало");
    expect(updated.description).toBe("детали");
  });
});

describe("скрытие закрытых задач", () => {
  it("убирает закрытые, но держит закрытого родителя с живой подзадачей", async () => {
    const project = await makeProject();
    const open = await createTask({ projectId: project.id, title: "Открытая" }, OWNER);
    const doneLeaf = await createTask({ projectId: project.id, title: "Сделанная" }, OWNER);
    const cancelled = await createTask({ projectId: project.id, title: "Отменённая" }, OWNER);
    const epic = await createTask({ projectId: project.id, title: "Закрытый эпик" }, OWNER);
    const alive = await createTask(
      { projectId: project.id, parentId: epic.id, title: "Живая подзадача" },
      OWNER,
    );
    const buried = await createTask(
      { projectId: project.id, parentId: doneLeaf.id, title: "Тоже сделанная" },
      OWNER,
    );
    for (const task of [doneLeaf, epic, buried]) await setStatus(task.id, "done", OWNER);
    await setStatus(cancelled.id, "cancelled", OWNER);

    const visible = hideClosed(await listProjectTree(project.id));

    expect(visible.map((node) => node.id)).toEqual([open.id, epic.id]);
    expect(visible[1].children.map((node) => node.id)).toEqual([alive.id]);
  });
});

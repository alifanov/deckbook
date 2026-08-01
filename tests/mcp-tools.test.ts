import { beforeEach, describe, expect, it } from "vitest";
import { OWNER } from "../src/domain/author";
import { prisma } from "../src/db";
import { createTask, setRecurrence } from "../src/domain/tasks";
import { markAsTemplate } from "../src/domain/templates";
import { handleMcpRequest } from "../src/mcp/server";
import { makeProject, makeToken } from "./helpers";

let nextId = 1;
let slug: string;
let token: string;
let tokenId: string;
let projectId: string;

beforeEach(async () => {
  const project = await makeProject("Дом");
  const issued = await makeToken(project.id, "Ночной агент");
  slug = project.slug;
  projectId = project.id;
  token = issued.value;
  tokenId = issued.token.id;
});

async function tool(name: string, args: Record<string, unknown> = {}) {
  const response = await handleMcpRequest(
    new Request(`http://localhost/mcp/${slug}`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: nextId++,
        method: "tools/call",
        params: { name, arguments: args },
      }),
    }),
    slug,
  );
  const body = await response.json();
  const text = body.result.content[0].text;
  if (body.result.isError) throw new Error(text);
  return JSON.parse(text);
}

describe("агент работает через MCP", () => {
  it("создаёт задачу и подзадачу, читает поддерево", async () => {
    const root = await tool("create_task", { title: "Починить билд", description: "падает линт" });
    await tool("create_task", { title: "Прогнать тесты", parentTaskId: root.id });

    const tree = await tool("read_task", { taskId: root.id });
    expect(tree.subtasks.map((t: { title: string }) => t.title)).toEqual(["Прогнать тесты"]);

    const created = await prisma.task.findUniqueOrThrow({ where: { id: root.id } });
    expect(created.createdByTokenId).toBe(tokenId);
  });

  it("создаёт задачу сразу на исполнителя, и тот видит её в my_tasks", async () => {
    const created = await tool("create_task", {
      title: "Починить скан",
      assignee: "ночной агент",
    });
    expect(created.assignee).toBe("Ночной агент");
    expect((await tool("my_tasks")).map((t: { id: string }) => t.id)).toEqual([created.id]);

    const info = await tool("project_info");
    expect(info.agents).toEqual(["Ночной агент"]);

    await expect(tool("create_task", { title: "Ничья", assignee: "Кто-то" })).rejects.toThrow(
      /Ночной агент/,
    );
  });

  it("передаёт задачу другому агенту и снимает назначение", async () => {
    const other = await makeToken(projectId, "Дневной агент");
    const task = await createTask(
      { projectId, title: "Чинить скан", assigneeTokenId: tokenId },
      OWNER,
    );

    const moved = await tool("assign_task", { taskId: task.id, assignee: "Дневной агент" });
    expect(moved.assignee).toBe("Дневной агент");
    expect(await tool("my_tasks")).toEqual([]);

    const after = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(after.assigneeTokenId).toBe(other.token.id);

    await tool("assign_task", { taskId: task.id });
    const cleared = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(cleared.assigneeTokenId).toBeNull();
  });

  it("видит только назначенные на него задачи и берёт задачу в работу", async () => {
    const mine = await createTask({ projectId, title: "Моя" }, OWNER);
    await createTask({ projectId, title: "Не моя" }, OWNER);

    expect(await tool("my_tasks")).toEqual([]);

    const claimed = await tool("claim_task", { taskId: mine.id });
    expect(claimed.status).toBe("in_progress");
    expect((await tool("my_tasks")).map((t: { id: string }) => t.id)).toEqual([mine.id]);
  });

  it("меняет статус и не может изобрести свой", async () => {
    const task = await createTask({ projectId, title: "Задача" }, OWNER);

    expect((await tool("set_task_status", { taskId: task.id, status: "done" })).status).toBe("done");
    await expect(tool("set_task_status", { taskId: task.id, status: "blocked" })).rejects.toThrow(
      /не существует/,
    );
  });

  it("закрывает повторяющуюся задачу — она открывается заново", async () => {
    const task = await createTask({ projectId, title: "Обновить зависимости" }, OWNER);
    await setRecurrence(task.id, 7, OWNER);

    const closed = await tool("set_task_status", { taskId: task.id, status: "done" });
    expect(closed.status).toBe("todo");
  });

  it("не показывает в списке задачу с ненаступившим сроком", async () => {
    const soon = await tool("create_task", { title: "Ревью РК", dueAt: "2030-09-01" });
    const now = await tool("create_task", { title: "Текучка" });
    await tool("claim_task", { taskId: soon.id });
    await tool("claim_task", { taskId: now.id });

    const working = await tool("my_tasks");
    expect(working.map((t: { title: string }) => t.title)).toEqual(["Текучка"]);

    const planning = await tool("my_tasks", { includeFuture: true });
    expect(planning.map((t: { title: string }) => t.title)).toContain("Ревью РК");
    expect(planning.find((t: { title: string }) => t.title === "Ревью РК")).toMatchObject({
      dueAt: "2030-09-01",
      overdue: false,
    });
  });

  it("ставит и снимает срок задачи", async () => {
    const task = await tool("create_task", { title: "Ревью РК" });
    await tool("claim_task", { taskId: task.id });

    expect(await tool("set_task_due", { taskId: task.id, dueAt: "2030-09-01" })).toMatchObject({
      dueAt: "2030-09-01",
    });
    expect(await tool("my_tasks")).toEqual([]);
    expect((await tool("my_tasks", { includeFuture: true })).length).toBe(1);

    expect(await tool("set_task_due", { taskId: task.id })).toEqual({ id: task.id });
    await expect(tool("set_task_due", { taskId: task.id, dueAt: "1 сентября" })).rejects.toThrow(
      /ГГГГ-ММ-ДД/,
    );
  });

  it("перемещает задачу и не может замкнуть дерево", async () => {
    const root = await tool("create_task", { title: "Корень" });
    const child = await tool("create_task", { title: "Ребёнок", parentTaskId: root.id });

    expect((await tool("move_task", { taskId: child.id })).parentTaskId).toBeNull();
    await tool("move_task", { taskId: child.id, parentTaskId: root.id });
    await expect(tool("move_task", { taskId: root.id, parentTaskId: child.id })).rejects.toThrow(
      /поддерева/,
    );
  });

  it("пишет и читает ленту задачи", async () => {
    const task = await createTask({ projectId, title: "Задача" }, OWNER);
    await tool("comment_on_task", { taskId: task.id, body: "билд починен" });

    const feed = await tool("read_task_feed", { taskId: task.id });
    expect(feed).toEqual([
      expect.objectContaining({ kind: "human", author: "Ночной агент", body: "билд починен" }),
    ]);
  });

  it("разворачивает шаблон", async () => {
    const template = await createTask({ projectId, title: "Исправление бага" }, OWNER);
    await createTask({ projectId, parentId: template.id, title: "Тесты" }, OWNER);
    await markAsTemplate(template.id, { global: false });

    const templates = await tool("list_templates");
    expect(templates).toEqual([{ id: template.id, title: "Исправление бага" }]);

    const applied = await tool("apply_template", { templateId: template.id });
    expect(applied.subtasks.map((t: { title: string }) => t.title)).toEqual(["Тесты"]);
    expect(applied.id).not.toBe(template.id);
  });

  it("не видит шаблоны среди задач", async () => {
    const template = await createTask({ projectId, title: "Шаблон" }, OWNER);
    await markAsTemplate(template.id, { global: false });

    await expect(tool("read_task", { taskId: template.id })).rejects.toThrow(/нет в этом проекте/);
  });

  it("ведёт дерево документов: папка, документ, запись, перемещение", async () => {
    const folder = await tool("create_folder", { name: "Спеки" });
    const doc = await tool("create_document", { name: "MVP", content: "черновик" });

    await tool("write_document", { documentId: doc.id, content: "# Готово" });
    expect((await tool("read_document", { documentId: doc.id })).content).toBe("# Готово");

    await tool("move_document", { documentId: doc.id, parentFolderId: folder.id });
    const tree = await tool("read_document_tree");
    expect(tree).toEqual([
      expect.objectContaining({
        name: "Спеки",
        kind: "folder",
        children: [expect.objectContaining({ name: "MVP", kind: "document" })],
      }),
    ]);
  });

  it("получает внятный отказ, а не молчаливую правку", async () => {
    const doc = await tool("create_document", { name: "Заметка" });
    await expect(tool("create_document", { name: "Внутри", parentFolderId: doc.id })).rejects.toThrow(
      /только внутрь папки/,
    );
  });
});

import { describe, expect, it } from "vitest";
import { POST } from "../src/app/api/tasks/route";
import { listTasks } from "../src/domain/tasks";
import { revokeToken } from "../src/domain/tokens";
import { makeProject, makeToken } from "./helpers";

function submit(fields: Record<string, string>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  return POST(new Request("http://localhost/api/tasks", { method: "POST", body: form }));
}

describe("создание задачи через интерфейс", () => {
  it("вешает новую задачу на первого агента проекта", async () => {
    const project = await makeProject();
    const { token: first } = await makeToken(project.id, "Первый");
    await makeToken(project.id, "Второй");

    await submit({ intent: "create", projectId: project.id, title: "Задача" });

    const [task] = await listTasks(project.id);
    expect(task.assigneeTokenId).toBe(first.id);
  });

  it("пропускает отозванных агентов", async () => {
    const project = await makeProject();
    const { token: revoked } = await makeToken(project.id, "Отозванный");
    const { token: active } = await makeToken(project.id, "Действующий");
    await revokeToken(revoked.id);

    await submit({ intent: "create", projectId: project.id, title: "Задача" });

    const [task] = await listTasks(project.id);
    expect(task.assigneeTokenId).toBe(active.id);
  });

  it("без агентов задача остаётся ничьей", async () => {
    const project = await makeProject();

    await submit({ intent: "create", projectId: project.id, title: "Задача" });

    const [task] = await listTasks(project.id);
    expect(task.assigneeTokenId).toBeNull();
  });
});

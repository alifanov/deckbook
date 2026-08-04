import { describe, expect, it } from "vitest";
import { POST } from "../src/app/api/tasks/route";
import { listTasks } from "../src/domain/tasks";
import { SESSION_COOKIE, signSession } from "../src/session";
import { makeProject, sessionHeader } from "./helpers";

function createTask(projectId: string, headers: Record<string, string> = {}) {
  const form = new FormData();
  form.append("intent", "create");
  form.append("projectId", projectId);
  form.append("title", "Задача");
  return POST(new Request("http://localhost/api/tasks", { method: "POST", body: form, headers }));
}

describe("route handler проверяет сессию сам, без middleware", () => {
  it("без куки сессии отказывает и задачу не создаёт", async () => {
    const project = await makeProject();

    const response = await createTask(project.id);

    expect(response.status).toBe(403);
    expect(await listTasks(project.id)).toHaveLength(0);
  });

  it("с подделанной подписью отказывает", async () => {
    const project = await makeProject();
    await sessionHeader(); // владелец заведён, поколение сессий — 0

    const response = await createTask(project.id, {
      cookie: `${SESSION_COOKIE}=${Date.now() + 60_000}:0.deadbeef`,
    });

    expect(response.status).toBe(403);
    expect(await listTasks(project.id)).toHaveLength(0);
  });

  it("с просроченной сессией отказывает", async () => {
    const project = await makeProject();
    await sessionHeader(); // владелец заведён, поколение сессий — 0

    const response = await createTask(project.id, {
      cookie: `${SESSION_COOKIE}=${signSession(Date.now() - 1000, 0)}`,
    });

    expect(response.status).toBe(403);
    expect(await listTasks(project.id)).toHaveLength(0);
  });

  it("с действующей сессией работает как раньше", async () => {
    const project = await makeProject();

    const response = await createTask(project.id, await sessionHeader());

    expect(response.status).toBe(303);
    expect(await listTasks(project.id)).toHaveLength(1);
  });

  // Браузер отдаёт куку ровно в том виде, в каком её записал Next: `:` — как `%3A`.
  it("принимает куку в том виде, в каком её кодирует Next", async () => {
    const project = await makeProject();
    const raw = (await sessionHeader()).cookie.slice(`${SESSION_COOKIE}=`.length);

    const response = await createTask(project.id, {
      cookie: `${SESSION_COOKIE}=${encodeURIComponent(raw)}`,
    });

    expect(response.status).toBe(303);
    expect(await listTasks(project.id)).toHaveLength(1);
  });
});

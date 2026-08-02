import { describe, expect, it } from "vitest";
import { OWNER } from "../src/domain/author";
import { listProjects } from "../src/domain/projects";
import { createTask, setStatus } from "../src/domain/tasks";
import { makeProject } from "./helpers";

describe("список проектов", () => {
  it("считает только открытые задачи", async () => {
    const project = await makeProject();
    const working = await createTask({ projectId: project.id, title: "В работе" }, OWNER);
    const finished = await createTask({ projectId: project.id, title: "Сделана" }, OWNER);
    const dropped = await createTask({ projectId: project.id, title: "Отменена" }, OWNER);
    await createTask({ projectId: project.id, title: "Ждёт" }, OWNER);
    await setStatus(working.id, "in_progress", OWNER);
    await setStatus(finished.id, "done", OWNER);
    await setStatus(dropped.id, "cancelled", OWNER);

    const listed = (await listProjects()).find((p) => p.id === project.id);
    expect(listed?._count.tasks).toBe(2);
  });
});

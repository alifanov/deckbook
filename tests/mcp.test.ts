import { describe, expect, it } from "vitest";
import { OWNER } from "../src/domain/actor";
import { prisma } from "../src/db";
import { createDocument } from "../src/domain/documents";
import { createTask } from "../src/domain/tasks";
import { revokeToken } from "../src/domain/tokens";
import { handleMcpRequest } from "../src/mcp/server";
import { makeProject, makeToken } from "./helpers";

let nextId = 1;

function call(slug: string, token: string | null, method: string, params?: unknown) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  return handleMcpRequest(
    new Request(`http://localhost/mcp/${slug}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params }),
    }),
    slug,
  );
}

async function callTool(slug: string, token: string | null, name: string, args = {}) {
  const response = await call(slug, token, "tools/call", { name, arguments: args });
  const body = await response.json();
  const text = body.result?.content?.[0]?.text;
  return {
    status: response.status,
    isError: body.result?.isError === true,
    text: text as string,
    data: body.result?.isError ? undefined : JSON.parse(text ?? "null"),
  };
}

describe("изоляция токена на HTTP-шве", () => {
  it("валидный токен получает название своего проекта", async () => {
    const project = await makeProject("Дом");
    const { value } = await makeToken(project.id);

    const result = await callTool(project.slug, value, "project_info");
    expect(result.data).toEqual({ project: "Дом", slug: project.slug });
  });

  it("токен проекта A к адресу проекта B получает отказ", async () => {
    const a = await makeProject("A");
    const b = await makeProject("B");
    const { value } = await makeToken(a.id);

    const response = await call(b.slug, value, "tools/list");
    expect(response.status).toBe(401);
    expect((await response.json()).error.message).toMatch(/другой проект/);
  });

  it("запрос без токена получает отказ", async () => {
    const project = await makeProject();
    const response = await call(project.slug, null, "tools/list");

    expect(response.status).toBe(401);
    expect((await response.json()).error.message).toMatch(/не передан/);
  });

  it("отозванный токен получает отказ", async () => {
    const project = await makeProject();
    const { token, value } = await makeToken(project.id);
    await revokeToken(token.id);

    const response = await call(project.slug, value, "tools/list");
    expect(response.status).toBe(401);
    expect((await response.json()).error.message).toMatch(/отозван/);
  });

  it("несуществующий токен получает отказ", async () => {
    const project = await makeProject();
    const response = await call(project.slug, "dbk_nowhere", "tools/list");

    expect(response.status).toBe(401);
    expect((await response.json()).error.message).toMatch(/неизвестен/);
  });

  it("успешное обращение обновляет время последнего использования", async () => {
    const project = await makeProject();
    const { token, value } = await makeToken(project.id);
    expect(token.lastUsedAt).toBeNull();

    await call(project.slug, value, "tools/list");

    const after = await prisma.token.findUniqueOrThrow({ where: { id: token.id } });
    expect(after.lastUsedAt).not.toBeNull();
  });

  it("задача чужого проекта не читается даже по идентификатору", async () => {
    const mine = await makeProject("Мой");
    const foreign = await makeProject("Чужой");
    const { value } = await makeToken(mine.id);
    const secret = await createTask({ projectId: foreign.id, title: "Секрет" }, OWNER);

    const result = await callTool(mine.slug, value, "read_task", { taskId: secret.id });
    expect(result.isError).toBe(true);
    expect(result.text).toMatch(/нет в проекте/);
  });

  it("документ чужого проекта не читается даже по идентификатору", async () => {
    const mine = await makeProject("Мой");
    const foreign = await makeProject("Чужой");
    const { value } = await makeToken(mine.id);
    const secret = await createDocument({ projectId: foreign.id, name: "Секрет" }, OWNER);

    const result = await callTool(mine.slug, value, "read_document", { documentId: secret.id });
    expect(result.isError).toBe(true);
    expect(result.text).toMatch(/нет в проекте/);
  });
});

describe("поверхность MCP", () => {
  it("объявляет инструменты и ни у одного нет параметра проекта", async () => {
    const project = await makeProject();
    const { value } = await makeToken(project.id);

    const body = await (await call(project.slug, value, "tools/list")).json();
    const names = body.result.tools.map((t: { name: string }) => t.name);
    expect(names).toContain("my_tasks");
    expect(names).toContain("write_document");

    for (const tool of body.result.tools) {
      const params = Object.keys(tool.inputSchema.properties).join(" ").toLowerCase();
      expect(params).not.toMatch(/project/);
      expect(tool.description.length).toBeGreaterThan(20);
    }
  });

  it("отвечает на initialize описанием текущего проекта", async () => {
    const project = await makeProject("Дом");
    const { value } = await makeToken(project.id);

    const body = await (await call(project.slug, value, "initialize")).json();
    expect(body.result.instructions).toContain("Дом");
  });
});

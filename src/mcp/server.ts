import { agent } from "../domain/actor";
import { DomainError } from "../domain/errors";
import { authenticateToken } from "../domain/tokens";
import { TOOLS, type McpContext } from "./tools";

// ponytail: JSON-RPC поверх одного POST — SSE и сессии MCP-серверу без
// подписок не нужны, поэтому и SDK не нужен.
const PROTOCOL_VERSION = "2025-06-18";

type Rpc = { jsonrpc: "2.0"; id?: string | number | null; method: string; params?: any };

const ok = (id: Rpc["id"], result: unknown) =>
  Response.json({ jsonrpc: "2.0", id, result });

const rpcError = (id: Rpc["id"], code: number, message: string) =>
  Response.json({ jsonrpc: "2.0", id, error: { code, message } });

const unauthorized = (message: string) =>
  Response.json({ jsonrpc: "2.0", id: null, error: { code: -32001, message } }, { status: 401 });

function bearer(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  const [scheme, value] = header.split(" ");
  return scheme?.toLowerCase() === "bearer" && value ? value : null;
}

export async function handleMcpRequest(request: Request, projectSlug: string): Promise<Response> {
  const auth = await authenticateToken(projectSlug, bearer(request));
  if ("error" in auth) return unauthorized(`${auth.error}: доступ к «${projectSlug}» отклонён`);

  let rpc: Rpc;
  try {
    rpc = await request.json();
  } catch {
    return rpcError(null, -32700, "Тело запроса не разобрано как JSON");
  }

  const ctx: McpContext = {
    projectId: auth.project.id,
    projectName: auth.project.name,
    projectSlug: auth.project.slug,
    tokenId: auth.token.id,
    actor: agent(auth.token.id),
  };

  // уведомления ответа не требуют
  if (rpc.id === undefined || rpc.id === null) {
    if (rpc.method?.startsWith("notifications/")) return new Response(null, { status: 202 });
  }

  switch (rpc.method) {
    case "initialize":
      return ok(rpc.id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: `deckbook/${ctx.projectSlug}`, version: "0.1.0" },
        instructions:
          `Ты работаешь в проекте «${ctx.projectName}». Других проектов не существует: ` +
          "ни один инструмент не принимает проект параметром. Задачи образуют дерево любой глубины, " +
          "документы — отдельное дерево папок. Начинай с my_tasks.",
      });

    case "ping":
      return ok(rpc.id, {});

    case "tools/list":
      return ok(rpc.id, {
        tools: TOOLS.map(({ name, description, inputSchema }) => ({
          name,
          description,
          inputSchema,
        })),
      });

    case "tools/call": {
      const tool = TOOLS.find((t) => t.name === rpc.params?.name);
      if (!tool) return rpcError(rpc.id, -32602, `Инструмента «${rpc.params?.name}» нет`);

      try {
        const result = await tool.run(rpc.params?.arguments ?? {}, ctx);
        return ok(rpc.id, {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        });
      } catch (error) {
        // отказ домена — ответ инструмента, а не поломка протокола:
        // агент должен прочитать причину и исправиться
        const message = error instanceof DomainError ? error.message : "Внутренняя ошибка";
        if (!(error instanceof DomainError)) console.error(error);
        return ok(rpc.id, { content: [{ type: "text", text: message }], isError: true });
      }
    }

    default:
      return rpcError(rpc.id
        ?? null, -32601, `Метод «${rpc.method}» не поддерживается`);
  }
}

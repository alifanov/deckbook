import type { Actor } from "../domain/actor";
import { addComment, listComments } from "../domain/comments";
import {
  createDocument,
  createFolder,
  getDocument,
  listDocumentTree,
  moveNode,
  writeDocument,
  type DocumentNode,
} from "../domain/documents";
import { fail } from "../domain/errors";
import {
  createTask,
  getTaskTree,
  listTasks,
  moveTask,
  parseStatus,
  setStatus,
  assignTask,
  type TaskNode,
} from "../domain/tasks";
import { applyTemplate, listTemplates } from "../domain/templates";
import { prisma } from "../db";

/** Проект и агент берутся из адреса и токена — инструменту их не передают. */
export type McpContext = {
  projectId: string;
  projectName: string;
  projectSlug: string;
  tokenId: string;
  actor: Actor;
};

type JsonSchema = {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
};

export type Tool = {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  run: (args: Record<string, any>, ctx: McpContext) => Promise<unknown>;
};

const str = (description: string) => ({ type: "string", description });

/** Задача внутри проекта агента — иначе он вышел за границу (ADR-0003). */
async function requireOwnTask(id: string, ctx: McpContext) {
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task || task.projectId !== ctx.projectId || task.isTemplate) {
    fail(`Задачи ${id} нет в проекте «${ctx.projectName}» — доступны только задачи этого проекта`);
  }
  return task;
}

async function requireOwnDocument(id: string, ctx: McpContext) {
  const node = await prisma.document.findUnique({ where: { id } });
  if (!node || node.projectId !== ctx.projectId) {
    fail(`Документа ${id} нет в проекте «${ctx.projectName}» — доступен только этот проект`);
  }
  return node;
}

const renderTask = (task: TaskNode | Awaited<ReturnType<typeof getTaskTree>>): unknown => ({
  id: task.id,
  title: task.title,
  description: task.description,
  status: task.status,
  assigneeTokenId: task.assigneeTokenId,
  subtasks: task.children.map(renderTask),
});

const renderDoc = (node: DocumentNode): unknown => ({
  id: node.id,
  name: node.name,
  kind: node.isFolder ? "folder" : "document",
  children: node.isFolder ? node.children.map(renderDoc) : undefined,
});

export const TOOLS: Tool[] = [
  {
    name: "project_info",
    description:
      "Возвращает проект, внутри которого ты работаешь. Других проектов для тебя не существует.",
    inputSchema: { type: "object", properties: {} },
    run: async (_args, ctx) => ({ project: ctx.projectName, slug: ctx.projectSlug }),
  },
  {
    name: "my_tasks",
    description:
      "Задачи проекта, назначенные на тебя. Начинай работу с этого списка. Шаблоны сюда не попадают.",
    inputSchema: {
      type: "object",
      properties: { status: str("необязательный фильтр: todo, in_progress, done, cancelled") },
    },
    run: async (args, ctx) => {
      const tasks = await listTasks(ctx.projectId, {
        assigneeTokenId: ctx.tokenId,
        ...(args.status ? { status: parseStatus(args.status) } : {}),
      });
      return tasks.map((t) => ({ id: t.id, title: t.title, status: t.status }));
    },
  },
  {
    name: "read_task",
    description:
      "Читает задачу вместе со всеми подзадачами любой глубины — весь объём работы за один вызов.",
    inputSchema: {
      type: "object",
      properties: { taskId: str("идентификатор задачи") },
      required: ["taskId"],
    },
    run: async (args, ctx) => {
      await requireOwnTask(args.taskId, ctx);
      return renderTask(await getTaskTree(args.taskId));
    },
  },
  {
    name: "create_task",
    description:
      "Создаёт задачу в проекте. Без parentTaskId задача становится корневой; с ним — подзадачей. " +
      "Родитель обязан быть задачей этого же проекта.",
    inputSchema: {
      type: "object",
      properties: {
        title: str("заголовок задачи"),
        description: str("описание, необязательно"),
        parentTaskId: str("родительская задача, необязательно"),
      },
      required: ["title"],
    },
    run: async (args, ctx) => {
      if (args.parentTaskId) await requireOwnTask(args.parentTaskId, ctx);
      const task = await createTask(
        {
          projectId: ctx.projectId,
          parentId: args.parentTaskId ?? null,
          title: args.title,
          description: args.description,
        },
        ctx.actor,
      );
      return { id: task.id, title: task.title, status: task.status };
    },
  },
  {
    name: "move_task",
    description:
      "Переносит задачу под другого родителя вместе со всеми подзадачами. " +
      "Без parentTaskId задача становится корневой. Перенести задачу внутрь её собственного поддерева нельзя.",
    inputSchema: {
      type: "object",
      properties: {
        taskId: str("что переносим"),
        parentTaskId: str("новый родитель; пропусти, чтобы вынести в корень"),
      },
      required: ["taskId"],
    },
    run: async (args, ctx) => {
      await requireOwnTask(args.taskId, ctx);
      if (args.parentTaskId) await requireOwnTask(args.parentTaskId, ctx);
      const task = await moveTask(args.taskId, args.parentTaskId ?? null, ctx.actor);
      return { id: task.id, parentTaskId: task.parentId };
    },
  },
  {
    name: "set_task_status",
    description:
      "Ставит задаче статус: todo, in_progress, done или cancelled. Других статусов не существует. " +
      "cancelled означает «решили не делать». Закрытие повторяющейся задачи возвращает её в todo со сдвинутой датой.",
    inputSchema: {
      type: "object",
      properties: { taskId: str("идентификатор задачи"), status: str("новый статус") },
      required: ["taskId", "status"],
    },
    run: async (args, ctx) => {
      await requireOwnTask(args.taskId, ctx);
      const task = await setStatus(args.taskId, parseStatus(args.status), ctx.actor);
      return { id: task.id, status: task.status, dueAt: task.dueAt };
    },
  },
  {
    name: "claim_task",
    description:
      "Берёт задачу в работу: назначает её на тебя и переводит в in_progress, чтобы другой агент не начал то же самое.",
    inputSchema: {
      type: "object",
      properties: { taskId: str("идентификатор задачи") },
      required: ["taskId"],
    },
    run: async (args, ctx) => {
      await requireOwnTask(args.taskId, ctx);
      await assignTask(args.taskId, ctx.tokenId, ctx.actor);
      const task = await setStatus(args.taskId, "in_progress", ctx.actor);
      return { id: task.id, status: task.status };
    },
  },
  {
    name: "list_templates",
    description: "Заготовки деревьев задач, доступные проекту. Разворачивать их умеет apply_template.",
    inputSchema: { type: "object", properties: {} },
    run: async (_args, ctx) => {
      const templates = await listTemplates(ctx.projectId);
      return templates.map((t) => ({ id: t.id, title: t.title }));
    },
  },
  {
    name: "apply_template",
    description:
      "Разворачивает шаблон в новое дерево задач этого проекта со статусом todo. " +
      "Сам шаблон не меняется. С parentTaskId дерево разворачивается внутри указанной ветки.",
    inputSchema: {
      type: "object",
      properties: {
        templateId: str("идентификатор шаблона из list_templates"),
        parentTaskId: str("куда развернуть, необязательно"),
      },
      required: ["templateId"],
    },
    run: async (args, ctx) => {
      if (args.parentTaskId) await requireOwnTask(args.parentTaskId, ctx);
      const root = await applyTemplate(
        args.templateId,
        { projectId: ctx.projectId, parentId: args.parentTaskId ?? null },
        ctx.actor,
      );
      return renderTask(await getTaskTree(root.id));
    },
  },
  {
    name: "comment_on_task",
    description: "Пишет комментарий в ленту задачи — так ты отчитываешься о сделанном.",
    inputSchema: {
      type: "object",
      properties: { taskId: str("идентификатор задачи"), body: str("текст комментария") },
      required: ["taskId", "body"],
    },
    run: async (args, ctx) => {
      await requireOwnTask(args.taskId, ctx);
      const comment = await addComment(args.taskId, args.body, ctx.actor);
      return { id: comment.id };
    },
  },
  {
    name: "read_task_feed",
    description:
      "Читает ленту задачи в хронологическом порядке: комментарии людей и агентов плюс системные записи об изменениях.",
    inputSchema: {
      type: "object",
      properties: { taskId: str("идентификатор задачи") },
      required: ["taskId"],
    },
    run: async (args, ctx) => {
      await requireOwnTask(args.taskId, ctx);
      const feed = await listComments(args.taskId);
      return feed.map((c) => ({
        kind: c.kind,
        author: c.author?.name ?? "владелец",
        body: c.body,
        at: c.createdAt,
      }));
    },
  },
  {
    name: "read_document_tree",
    description: "Дерево документов и папок проекта. Содержимое документов не возвращает — для этого read_document.",
    inputSchema: { type: "object", properties: {} },
    run: async (_args, ctx) => (await listDocumentTree(ctx.projectId)).map(renderDoc),
  },
  {
    name: "read_document",
    description: "Читает текст документа — контекст перед работой.",
    inputSchema: {
      type: "object",
      properties: { documentId: str("идентификатор документа") },
      required: ["documentId"],
    },
    run: async (args, ctx) => {
      const node = await requireOwnDocument(args.documentId, ctx);
      if (node.isFolder) fail("Это папка, у неё нет содержимого");
      return { id: node.id, name: node.name, content: node.content };
    },
  },
  {
    name: "create_document",
    description:
      "Создаёт документ в проекте. Без parentFolderId — в корне дерева. Вложить документ в документ нельзя, только в папку.",
    inputSchema: {
      type: "object",
      properties: {
        name: str("название документа"),
        content: str("текст, необязательно"),
        parentFolderId: str("папка, необязательно"),
      },
      required: ["name"],
    },
    run: async (args, ctx) => {
      if (args.parentFolderId) await requireOwnDocument(args.parentFolderId, ctx);
      const doc = await createDocument(
        {
          projectId: ctx.projectId,
          parentId: args.parentFolderId ?? null,
          name: args.name,
          content: args.content ?? "",
        },
        ctx.actor,
      );
      return { id: doc.id, name: doc.name };
    },
  },
  {
    name: "write_document",
    description:
      "Перезаписывает текст документа целиком. Предыдущее содержимое пропадает безвозвратно — версий система не хранит. " +
      "Сначала прочитай документ, если хочешь его дополнить, а не заменить.",
    inputSchema: {
      type: "object",
      properties: { documentId: str("идентификатор документа"), content: str("новый текст целиком") },
      required: ["documentId", "content"],
    },
    run: async (args, ctx) => {
      await requireOwnDocument(args.documentId, ctx);
      const doc = await writeDocument(args.documentId, args.content, ctx.actor);
      return { id: doc.id, updatedAt: doc.updatedAt };
    },
  },
  {
    name: "create_folder",
    description: "Создаёт папку в дереве документов проекта.",
    inputSchema: {
      type: "object",
      properties: { name: str("название папки"), parentFolderId: str("папка, необязательно") },
      required: ["name"],
    },
    run: async (args, ctx) => {
      if (args.parentFolderId) await requireOwnDocument(args.parentFolderId, ctx);
      const folder = await createFolder(
        { projectId: ctx.projectId, parentId: args.parentFolderId ?? null, name: args.name },
        ctx.actor,
      );
      return { id: folder.id, name: folder.name };
    },
  },
  {
    name: "move_document",
    description:
      "Переносит документ или папку в другую папку вместе со всем содержимым. " +
      "Без parentFolderId узел поднимается в корень. Папку внутрь самой себя перенести нельзя.",
    inputSchema: {
      type: "object",
      properties: {
        documentId: str("что переносим"),
        parentFolderId: str("новая папка; пропусти, чтобы вынести в корень"),
      },
      required: ["documentId"],
    },
    run: async (args, ctx) => {
      await requireOwnDocument(args.documentId, ctx);
      if (args.parentFolderId) await requireOwnDocument(args.parentFolderId, ctx);
      const node = await moveNode(args.documentId, args.parentFolderId ?? null, ctx.actor);
      return { id: node.id, parentFolderId: node.parentId };
    },
  },
];

import type { TaskPriority } from "../generated/prisma/client";
import type { Author } from "../domain/author";
import { addComment, listComments } from "../domain/comments";
import {
  createDocument,
  createFolder,
  listDocumentTree,
  moveNode,
  requireDocumentInProject,
  writeDocument,
  type DocumentNode,
} from "../domain/documents";
import { fail } from "../domain/errors";
import {
  asDay,
  assignTask,
  claimTask,
  createTask,
  getTaskTree,
  isOverdue,
  listTasks,
  moveTask,
  parseDueDate,
  parsePriority,
  parseStatus,
  requireTaskInProject,
  setDueDate,
  setPriority,
  setStatus,
  type TaskNode,
} from "../domain/tasks";
import { listAgents, resolveAgent } from "../domain/tokens";

/** Проект и агент берутся из адреса и токена — инструменту их не передают. */
export type McpContext = {
  projectId: string;
  projectName: string;
  projectSlug: string;
  projectGoal: string;
  tokenId: string;
  tokenName: string;
  author: Author;
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
const bool = (description: string) => ({ type: "boolean", description });

/** Срок отдаётся днём и сразу с приговором — агенту не нужно считать даты. */
const due = (task: { dueAt: Date | null }) =>
  task.dueAt ? { dueAt: asDay(task.dueAt), overdue: isOverdue(task) } : {};

/** Обычный приоритет ничего не сообщает — в ответ он и не попадает. */
const prio = (task: { priority: TaskPriority }) =>
  task.priority === "normal" ? {} : { priority: task.priority };

// границу проекта проверяет домен: правило одно на обе поверхности
const requireOwnTask = (id: string, ctx: McpContext) => requireTaskInProject(id, ctx.projectId);
const requireOwnDocument = (id: string, ctx: McpContext) =>
  requireDocumentInProject(id, ctx.projectId);

const renderTask = (task: TaskNode | Awaited<ReturnType<typeof getTaskTree>>): unknown => ({
  id: task.id,
  title: task.title,
  description: task.description,
  status: task.status,
  assigneeTokenId: task.assigneeTokenId,
  ...prio(task),
  ...due(task),
  subtasks: task.children.map(renderTask),
});

const renderFeed = (feed: Awaited<ReturnType<typeof listComments>>) =>
  feed.map((c) => ({
    kind: c.kind,
    author: c.author?.name ?? "владелец",
    body: c.body,
    at: c.createdAt,
  }));

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
      "Возвращает проект, внутри которого ты работаешь, его цель и его агентов — тех, на кого " +
      "можно назначать задачи. Других проектов для тебя не существует. " +
      "Цель — то состояние, к которому проект должен прийти: сверяйся с ней, выбирая, за что взяться.",
    inputSchema: { type: "object", properties: {} },
    run: async (_args, ctx) => ({
      project: ctx.projectName,
      slug: ctx.projectSlug,
      // ponytail: пустая цель приезжает словами, а не null — предписаний
      // агенту при этом не даём, пусть решает сам (ADR-0007)
      goal: ctx.projectGoal || "цель не задана",
      me: ctx.tokenName,
      agents: (await listAgents(ctx.projectId)).map((a) => a.name),
    }),
  },
  {
    name: "my_tasks",
    description:
      "Задачи проекта, назначенные на тебя. Начинай работу с этого списка. " +
      "Задачи со сроком в будущем в список не входят — их время ещё не пришло, браться за них рано. " +
      "Сначала идут просроченные, потом сегодняшние, потом бессрочные; внутри одного срока " +
      "первым идёт высокий приоритет. " +
      "includeFuture покажет и будущие — бери его, только если тебя спросили про планы, а не про работу. " +
      "Задача в статусе needs_human ждёт ответа человека — за неё не берись, пока статус не сменится.",
    inputSchema: {
      type: "object",
      properties: {
        status: str("необязательный фильтр: todo, in_progress, needs_human, done, cancelled"),
        priority: str("необязательный фильтр: high, normal, low"),
        includeFuture: bool("показать задачи, чей срок ещё не наступил; по умолчанию false"),
      },
    },
    run: async (args, ctx) => {
      const tasks = await listTasks(ctx.projectId, {
        assigneeTokenId: ctx.tokenId,
        ...(args.status ? { status: parseStatus(args.status) } : {}),
        ...(args.priority ? { priority: parsePriority(args.priority) } : {}),
        includeFuture: args.includeFuture === true,
      });
      return tasks.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        ...prio(t),
        ...due(t),
      }));
    },
  },
  {
    name: "read_task",
    description:
      "Читает задачу вместе со всеми подзадачами любой глубины и лентой задачи (feed) — " +
      "комментарии людей и агентов плюс системные записи. Весь объём работы за один вызов: " +
      "в ленте лежат уточнения и правки постановки, читай её прежде чем браться.",
    inputSchema: {
      type: "object",
      properties: { taskId: str("идентификатор задачи") },
      required: ["taskId"],
    },
    run: async (args, ctx) => {
      await requireOwnTask(args.taskId, ctx);
      const [tree, feed] = await Promise.all([
        getTaskTree(args.taskId),
        listComments(args.taskId),
      ]);
      return { ...(renderTask(tree) as object), feed: renderFeed(feed) };
    },
  },
  {
    name: "create_task",
    description:
      "Создаёт задачу в проекте. Без parentTaskId задача становится корневой; с ним — подзадачей. " +
      "Родитель обязан быть задачей этого же проекта. " +
      "dueAt откладывает задачу: до этого дня она не появится ни в чьём списке работы. " +
      "assignee сразу отдаёт задачу агенту — без него задача ничья и не попадёт ни в один my_tasks. " +
      "Имена агентов проекта отдаёт project_info.",
    inputSchema: {
      type: "object",
      properties: {
        title: str("заголовок задачи"),
        description: str("описание, необязательно"),
        parentTaskId: str("родительская задача, необязательно"),
        dueAt: str("срок в виде ГГГГ-ММ-ДД, необязательно"),
        priority: str("high, normal или low; по умолчанию normal"),
        assignee: str("имя агента-исполнителя из project_info; по умолчанию задача ничья"),
      },
      required: ["title"],
    },
    run: async (args, ctx) => {
      if (args.parentTaskId) await requireOwnTask(args.parentTaskId, ctx);
      const assignee = args.assignee ? await resolveAgent(ctx.projectId, args.assignee) : null;
      const task = await createTask(
        {
          projectId: ctx.projectId,
          parentId: args.parentTaskId ?? null,
          title: args.title,
          description: args.description,
          dueAt: args.dueAt ? parseDueDate(args.dueAt) : null,
          ...(args.priority ? { priority: parsePriority(args.priority) } : {}),
          assigneeTokenId: assignee?.id ?? null,
        },
        ctx.author,
      );
      return {
        id: task.id,
        title: task.title,
        status: task.status,
        assignee: assignee?.name ?? null,
        ...prio(task),
        ...due(task),
      };
    },
  },
  {
    name: "set_task_priority",
    description:
      "Ставит задаче приоритет: high, normal или low. Других приоритетов не существует. " +
      "Приоритет не перебивает срок, а разбирает задачи внутри одного срока: в my_tasks " +
      "важное всплывает выше среди задач с той же датой и среди бессрочных.",
    inputSchema: {
      type: "object",
      properties: { taskId: str("идентификатор задачи"), priority: str("новый приоритет") },
      required: ["taskId", "priority"],
    },
    run: async (args, ctx) => {
      await requireOwnTask(args.taskId, ctx);
      const task = await setPriority(args.taskId, parsePriority(args.priority), ctx.author);
      return { id: task.id, priority: task.priority };
    },
  },
  {
    name: "set_task_due",
    description:
      "Ставит задаче срок — день, в который её надо сделать, в виде ГГГГ-ММ-ДД. " +
      "До этого дня задача пропадает из списков работы, после — числится просроченной. " +
      "Ставь срок, когда работу нельзя начинать раньше определённой даты. " +
      "Вызов без dueAt снимает срок.",
    inputSchema: {
      type: "object",
      properties: {
        taskId: str("идентификатор задачи"),
        dueAt: str("срок в виде ГГГГ-ММ-ДД; пропусти, чтобы снять срок"),
      },
      required: ["taskId"],
    },
    run: async (args, ctx) => {
      await requireOwnTask(args.taskId, ctx);
      const task = await setDueDate(
        args.taskId,
        args.dueAt ? parseDueDate(args.dueAt) : null,
        ctx.author,
      );
      return { id: task.id, ...due(task) };
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
      const task = await moveTask(args.taskId, args.parentTaskId ?? null, ctx.author);
      return { id: task.id, parentTaskId: task.parentId };
    },
  },
  {
    name: "set_task_status",
    description:
      "Ставит задаче статус: todo, in_progress, needs_human, done или cancelled. Других статусов не существует. " +
      "cancelled означает «решили не делать». needs_human означает «дальше без ответа человека не пройти»: " +
      "ставь его, когда упёрся в решение или доступ, который можешь получить только от владельца, — " +
      "задача сразу попадёт владельцу в «Мои задачи», а тебе браться за неё больше не нужно. " +
      "Закрытие повторяющейся задачи возвращает её в todo со сроком, " +
      "сдвинутым на интервал повторения, — до нового срока она снова исчезнет из списков.",
    inputSchema: {
      type: "object",
      properties: { taskId: str("идентификатор задачи"), status: str("новый статус") },
      required: ["taskId", "status"],
    },
    run: async (args, ctx) => {
      await requireOwnTask(args.taskId, ctx);
      const task = await setStatus(args.taskId, parseStatus(args.status), ctx.author);
      return { id: task.id, status: task.status, ...due(task) };
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
      const task = await claimTask(args.taskId, ctx.tokenId);
      return { id: task.id, status: task.status };
    },
  },
  {
    name: "assign_task",
    description:
      "Передаёт задачу другому агенту проекта — тому, чьё дело её делать. " +
      "Имена агентов отдаёт project_info; вызов без assignee оставляет задачу ничьей, " +
      "а ничью задачу не увидит никто. Себе задачу берут через claim_task.",
    inputSchema: {
      type: "object",
      properties: {
        taskId: str("идентификатор задачи"),
        assignee: str("имя агента из project_info; пропусти, чтобы снять назначение"),
      },
      required: ["taskId"],
    },
    run: async (args, ctx) => {
      await requireOwnTask(args.taskId, ctx);
      const assignee = args.assignee ? await resolveAgent(ctx.projectId, args.assignee) : null;
      const task = await assignTask(args.taskId, assignee?.id ?? null, ctx.author);
      return { id: task.id, title: task.title, assignee: assignee?.name ?? null };
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
      const comment = await addComment(args.taskId, args.body, ctx.author);
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
      return renderFeed(await listComments(args.taskId));
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
        ctx.author,
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
      const doc = await writeDocument(args.documentId, args.content, ctx.author);
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
        ctx.author,
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
      const node = await moveNode(args.documentId, args.parentFolderId ?? null, ctx.author);
      return { id: node.id, parentFolderId: node.parentId };
    },
  },
];

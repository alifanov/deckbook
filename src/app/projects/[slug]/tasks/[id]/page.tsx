import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmButton } from "../../../../../confirm";
import { listComments } from "../../../../../domain/comments";
import { getProjectBySlug } from "../../../../../domain/projects";
import {
  asDay,
  getTask,
  getTaskTree,
  isOverdue,
  listTasks,
  OWNER_ASSIGNEE,
  PRIORITIES,
  STATUSES,
  type TaskNode,
} from "../../../../../domain/tasks";
import { listTokens } from "../../../../../domain/tokens";
import { Header } from "../../../../../header";
import {
  Back,
  Banner,
  Dot,
  dueDay,
  Head,
  Icon,
  Markdown,
  moment,
  Prio,
  priorityLabel,
  ProjectNav,
  Reveal,
  statusLabel,
} from "../../../../../ui";

export const dynamic = "force-dynamic";

const Subtree = ({ nodes, slug }: { nodes: TaskNode[]; slug: string }) => (
  <>
    {nodes.map((node) => (
      <div key={node.id}>
        <div className={`item ${node.status}`}>
          <Dot status={node.status} />
          <Link
            href={`/projects/${slug}/tasks/${node.id}`}
            className="grow"
            style={{ fontSize: 16 }}
          >
            {node.title}
          </Link>
          <span className="muted state">{statusLabel(node.status)}</span>
        </div>
        {node.children.length > 0 && (
          <div className="kids">
            <Subtree nodes={node.children} slug={slug} />
          </div>
        )}
      </div>
    ))}
  </>
);

export default async function TaskPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { slug, id } = await params;
  const { error } = await searchParams;

  const project = await getProjectBySlug(slug);
  const task = await getTask(id);
  if (!project || !task || task.projectId !== project.id) notFound();

  const [tree, feed, tokens, candidates, parent] = await Promise.all([
    getTaskTree(id),
    listComments(id),
    listTokens(project.id),
    // владелец видит всё: срок прячет задачи только от агента (ADR-0004)
    listTasks(project.id, { includeFuture: true }),
    task.parentId ? getTask(task.parentId) : null,
  ]);
  const path = `/projects/${slug}/tasks/${id}`;

  return (
    <>
      <Header>
        <ProjectNav slug={slug} at="tasks" />
      </Header>
      <main>
        <p className="crumbs">
          <Link href={`/projects/${slug}`}>{project.name}</Link>
          {parent && (
            <>
              {" / "}
              <Link href={`/projects/${slug}/tasks/${parent.id}`}>{parent.title}</Link>
            </>
          )}
        </p>
        <h1 style={{ marginBottom: 18 }}>{task.title}</h1>
        <Banner error={error} />

        <div className="bar" style={{ gap: 22, marginBottom: 30, fontSize: 14 }}>
          {/* статус меняется в один клик прямо здесь: кнопка на каждый чужой статус */}
          <form className="bar" method="post" action="/api/tasks" style={{ gap: 8 }}>
            <Back path={path} />
            <input type="hidden" name="intent" value="status" />
            <input type="hidden" name="id" value={id} />
            <span className="bar" style={{ gap: 8 }}>
              <Dot status={task.status} />
              {statusLabel(task.status)}
            </span>
            {STATUSES.filter((s) => s !== task.status).map((s) => (
              <button
                key={s}
                className="plain quick"
                type="submit"
                name="status"
                value={s}
                title={`Перевести в «${statusLabel(s)}»`}
              >
                {statusLabel(s)}
              </button>
            ))}
          </form>
          <span className="muted">
            {task.assignedToOwner ? "владелец" : (task.assignee?.name ?? "ничья")}
          </span>
          <Prio task={task} />
          {task.dueAt && (
            <span className={isOverdue(task) ? "bad" : "muted"}>
              {isOverdue(task) ? "просрочена · " : "срок "}
              {dueDay(task.dueAt)}
            </span>
          )}
          {task.recurrence !== null && (
            <span className="muted">повтор {task.recurrence} дн.</span>
          )}
          <span className="spacer" />

          <Reveal label="Изменить" icon="pencil" tone="go" drop wide>
            <form className="row" method="post" action="/api/tasks">
              <Back path={path} />
              <input type="hidden" name="intent" value="priority" />
              <input type="hidden" name="id" value={id} />
              <select name="priority" defaultValue={task.priority}>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {priorityLabel(p)}
                  </option>
                ))}
              </select>
              <button type="submit">
                <Icon name="check" />
                Приоритет
              </button>
            </form>

            <form className="row" method="post" action="/api/tasks">
              <Back path={path} />
              <input type="hidden" name="intent" value="assign" />
              <input type="hidden" name="id" value={id} />
              <select
                name="tokenId"
                defaultValue={
                  task.assignedToOwner ? OWNER_ASSIGNEE : (task.assigneeTokenId ?? "")
                }
              >
                <option value="">не назначена</option>
                <option value={OWNER_ASSIGNEE}>владелец</option>
                {tokens.map((token) => (
                  <option key={token.id} value={token.id}>
                    {token.name}
                  </option>
                ))}
              </select>
              <button type="submit">
                <Icon name="check" />
                Исполнитель
              </button>
            </form>

            <form className="row" method="post" action="/api/tasks">
              <Back path={path} />
              <input type="hidden" name="intent" value="move" />
              <input type="hidden" name="id" value={id} />
              <select name="parentId" defaultValue={task.parentId ?? ""}>
                <option value="">корень проекта</option>
                {candidates
                  .filter((c) => c.id !== id)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      внутрь: {c.title}
                    </option>
                  ))}
              </select>
              <button type="submit">
                <Icon name="move" />
                Перенести
              </button>
            </form>

            <form className="row" method="post" action="/api/tasks">
              <Back path={path} />
              <input type="hidden" name="intent" value="due" />
              <input type="hidden" name="id" value={id} />
              <input
                type="date"
                name="dueAt"
                defaultValue={task.dueAt ? asDay(task.dueAt) : ""}
              />
              <button type="submit">
                <Icon name="calendar" />
                Срок
              </button>
              <span className="muted">пусто — снять</span>
            </form>

            <form className="row" method="post" action="/api/tasks">
              <Back path={path} />
              <input type="hidden" name="intent" value="recurrence" />
              <input type="hidden" name="id" value={id} />
              <input
                type="number"
                name="days"
                min={1}
                placeholder="дней"
                defaultValue={task.recurrence ?? ""}
                style={{ width: 110 }}
              />
              <button type="submit">
                <Icon name="repeat" />
                Повторять
              </button>
              <span className="muted">пусто — снять</span>
            </form>
          </Reveal>
        </div>

        <div className="card" style={{ marginBottom: 36 }}>
          {task.description ? (
            <Markdown text={task.description} />
          ) : (
            <p className="muted" style={{ margin: 0 }}>
              Описания нет.
            </p>
          )}

          <div className="bar rule">
            <span className="muted">
              Создал{" "}
              {task.createdBy ? `агент ${task.createdBy.name}` : "владелец"} ·{" "}
              {moment(task.createdAt)}
            </span>
            <span className="spacer" />
            <Reveal label="Редактировать" icon="pencil" tone="go" drop wide>
              <form method="post" action="/api/tasks">
                <Back path={path} />
                <input type="hidden" name="intent" value="update" />
                <input type="hidden" name="id" value={id} />
                <div className="row" style={{ marginBottom: 10 }}>
                  <input type="text" name="title" defaultValue={task.title} required />
                </div>
                <textarea name="description" defaultValue={task.description} />
                <div className="row" style={{ marginTop: 10 }}>
                  <button type="submit">
                    <Icon name="check" />
                    Сохранить
                  </button>
                </div>
              </form>
            </Reveal>
          </div>
        </div>

        <Head title="Подзадачи" count={tree.children.length}>
          <Reveal label="подзадача" icon="plus" drop>
            <form className="row" method="post" action="/api/tasks">
              <Back path={path} />
              <input type="hidden" name="intent" value="create" />
              <input type="hidden" name="projectId" value={project.id} />
              <input type="hidden" name="parentId" value={id} />
              <input type="text" name="title" placeholder="Заголовок подзадачи" required />
              <button type="submit">
                <Icon name="plus" />
                Добавить
              </button>
            </form>
          </Reveal>
        </Head>

        {tree.children.length === 0 ? (
          <p className="muted">Подзадач нет.</p>
        ) : (
          <div className="card tight list">
            <Subtree nodes={tree.children} slug={slug} />
          </div>
        )}

        <Head title="Лента" count={feed.length} />
        <div className="card">
          {feed.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>
              Записей пока нет.
            </p>
          ) : (
            <div className="feed">
              {feed.map((entry) =>
                entry.kind === "system" ? (
                  <div className="system" key={entry.id}>
                    {moment(entry.createdAt)} — {entry.author?.name ?? "владелец"}:{" "}
                    {entry.body}
                  </div>
                ) : (
                  <div key={entry.id}>
                    <div className="who">
                      {entry.author?.name ?? "владелец"} · {moment(entry.createdAt)}
                    </div>
                    <Markdown text={entry.body} />
                  </div>
                ),
              )}
            </div>
          )}

          <form
            className="row"
            method="post"
            action="/api/tasks"
            style={{ marginTop: feed.length === 0 ? 16 : 22 }}
          >
            <Back path={path} />
            <input type="hidden" name="intent" value="comment" />
            <input type="hidden" name="id" value={id} />
            <input type="text" name="body" placeholder="Написать в ленту" required />
            <button className="icon" type="submit" title="Написать">
              <Icon name="send" size={15} />
            </button>
          </form>
        </div>

        <div className="bar" style={{ gap: 20, marginTop: 26 }}>
          <span className="spacer" />
          <form className="inline" method="post" action="/api/tasks">
            <Back path={path} />
            <input type="hidden" name="intent" value="delete" />
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="after" value={`/projects/${slug}`} />
            <ConfirmButton message="Удалить задачу вместе со всеми подзадачами и лентой?">
              <Icon name="trash" />
              Удалить задачу
            </ConfirmButton>
          </form>
        </div>
      </main>
    </>
  );
}

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
  priorityLabel,
  ProjectNav,
  Reveal,
  statusLabel,
} from "../../../../../ui";

export const dynamic = "force-dynamic";

/** Удаление живёт в своей форме: вложить форму в форму правки нельзя. */
const DELETE_FORM = "task-delete";

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
  searchParams: Promise<{ error?: string; edit?: string }>;
}) {
  const { slug, id } = await params;
  const { error, edit } = await searchParams;

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
  const editing = edit === "1";
  // без folder десктоп открывает папку последней сессии — то есть чужой проект.
  // ветку диплинк задать не умеет: с folder её выбрать уже не дадут
  const fixHref =
    `claude://code/new?q=${encodeURIComponent(`/deckbook:fix-task ${id}`)}` +
    (project.localPath ? `&folder=${encodeURIComponent(project.localPath)}` : "");

  const crumbs = (
    <p className="crumbs">
      <Link href={`/projects/${slug}`}>{project.name}</Link>
      {parent && (
        <>
          {" / "}
          <Link href={`/projects/${slug}/tasks/${parent.id}`}>{parent.title}</Link>
        </>
      )}
    </p>
  );

  /* Правка — отдельный режим страницы, а не панель поверх неё: полей столько,
     что в выпадающем окне они не помещались, а сохранялись по одному. */
  if (editing) {
    return (
      <>
        <Header>
          <ProjectNav slug={slug} at="tasks" />
        </Header>
        <main>
          {crumbs}

          <form id={DELETE_FORM} method="post" action="/api/tasks" hidden>
            <Back path={path} />
            <input type="hidden" name="intent" value="delete" />
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="after" value={`/projects/${slug}`} />
          </form>

          <form method="post" action="/api/tasks">
            <Back path={path} />
            <input type="hidden" name="intent" value="edit" />
            <input type="hidden" name="id" value={id} />

            <input className="title" type="text" name="title" defaultValue={task.title} required />
            <p className="muted" style={{ margin: "0 0 22px", fontSize: 13 }}>
              Правка задачи · изменения применяются по «Сохранить»
            </p>
            <Banner error={error} />

            <div className="card fields pairs" style={{ padding: "14px 18px", marginBottom: 16 }}>
              <span className="name">Статус</span>
              <span className="seg wide">
                {STATUSES.map((s) => (
                  <label key={s}>
                    <input
                      type="radio"
                      name="status"
                      value={s}
                      defaultChecked={s === task.status}
                    />
                    {statusLabel(s)}
                  </label>
                ))}
              </span>

              <span className="name">Исполнитель</span>
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

              <span className="name">Приоритет</span>
              <select name="priority" defaultValue={task.priority}>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {priorityLabel(p)}
                  </option>
                ))}
              </select>

              <span className="name">Родитель</span>
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

              <span className="name">Срок</span>
              <span className="pair">
                <input
                  type="date"
                  name="dueAt"
                  defaultValue={task.dueAt ? asDay(task.dueAt) : ""}
                />
                <span className="muted" style={{ fontSize: 13 }}>
                  пусто — снять
                </span>
              </span>

              <span className="name">Повтор</span>
              <span className="pair">
                <input
                  type="number"
                  name="days"
                  min={1}
                  placeholder="дней"
                  defaultValue={task.recurrence ?? ""}
                  style={{ width: 110 }}
                />
                <span className="muted" style={{ fontSize: 13 }}>
                  дней от закрытия
                </span>
              </span>
            </div>

            <div className="card" style={{ padding: "14px 18px" }}>
              <div className="bar" style={{ alignItems: "baseline", marginBottom: 10 }}>
                <span className="muted">Описание</span>
                <span className="spacer" />
                <span className="muted" style={{ fontSize: 13 }}>
                  markdown · предпросмотр после сохранения
                </span>
              </div>
              <textarea
                name="description"
                defaultValue={task.description}
                style={{ minHeight: 200 }}
              />
              <div className="bar" style={{ gap: 16, marginTop: 16 }}>
                <button type="submit">
                  <Icon name="check" />
                  Сохранить
                </button>
                <Link className="act" href={path}>
                  <Icon name="x" />
                  Отмена
                </Link>
                <span className="spacer" />
                <ConfirmButton
                  form={DELETE_FORM}
                  message="Удалить задачу вместе со всеми подзадачами и лентой?"
                >
                  <Icon name="trash" />
                  Удалить задачу
                </ConfirmButton>
              </div>
            </div>
          </form>
        </main>
      </>
    );
  }

  return (
    <>
      <Header>
        <ProjectNav slug={slug} at="tasks" />
      </Header>
      <main>
        {crumbs}
        <h1 style={{ marginBottom: 18 }}>{task.title}</h1>
        <Banner error={error} />

        <div
          className="card"
          style={{
            padding: "16px 22px",
            marginBottom: 36,
            display: "flex",
            flexDirection: "column",
            gap: 14,
            fontSize: 14,
          }}
        >
          <div className="bar" style={{ gap: 20 }}>
            <span className="bar muted" style={{ gap: 22 }}>
              <span>
                исполнитель{" "}
                <span style={{ color: "var(--text)" }}>
                  {task.assignedToOwner ? "владелец" : (task.assignee?.name ?? "ничья")}
                </span>
              </span>
              <span>
                приоритет{" "}
                <span className={task.priority === "high" ? "bad" : undefined}>
                  {priorityLabel(task.priority)}
                </span>
              </span>
              {task.dueAt && (
                <span>
                  срок{" "}
                  <span className={isOverdue(task) ? "bad" : undefined}>
                    {dueDay(task.dueAt)}
                    {isOverdue(task) && " · просрочена"}
                  </span>
                </span>
              )}
              {task.recurrence !== null && <span>повтор {task.recurrence} дн.</span>}
            </span>
            <span className="spacer" />

            <a className="act go" href={fixHref} title="Открыть задачу в Claude Code">
              <Icon name="login" />
              Исправить
            </a>
            <Link className="act go" href={`${path}?edit=1`}>
              <Icon name="pencil" />
              Изменить
            </Link>
          </div>

          {/* статус меняется в один клик прямо здесь: соседние значения рядом */}
          <div className="bar rule" style={{ gap: 12 }}>
            <span className="muted">Статус</span>
            <form className="seg" method="post" action="/api/tasks">
              <Back path={path} />
              <input type="hidden" name="intent" value="status" />
              <input type="hidden" name="id" value={id} />
              {STATUSES.map((s) => (
                <button
                  key={s}
                  className={s === task.status ? `on ${s}` : undefined}
                  type="submit"
                  name="status"
                  value={s}
                  title={`Перевести в «${statusLabel(s)}»`}
                >
                  {statusLabel(s)}
                </button>
              ))}
            </form>
            <span className="muted">переключается в один клик, без подтверждения</span>
          </div>
        </div>

        <div className="card" style={{ padding: "14px 18px", marginBottom: 36 }}>
          {task.description ? (
            <Markdown text={task.description} />
          ) : (
            <p className="muted" style={{ margin: 0 }}>
              Описания нет.
            </p>
          )}

          <div className="bar rule">
            <span className="muted">
              Создал {task.createdBy ? `агент ${task.createdBy.name}` : "владелец"} ·{" "}
              {moment(task.createdAt)}
            </span>
            <span className="spacer" />
            <Link className="act go" href={`${path}?edit=1`}>
              <Icon name="pencil" />
              Редактировать
            </Link>
          </div>
        </div>

        <Head title="Подзадачи" count={tree.children.length}>
          <Reveal label="подзадача" icon="plus" drop>
            <form className="pill" method="post" action="/api/tasks">
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
        <div className="card" style={{ padding: "14px 18px" }}>
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
            className="pill"
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

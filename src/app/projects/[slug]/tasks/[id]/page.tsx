import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmButton } from "../../../../../confirm";
import { listComments } from "../../../../../domain/comments";
import { getProjectBySlug } from "../../../../../domain/projects";
import {
  getTask,
  getTaskTree,
  listTasks,
  STATUSES,
  type TaskNode,
} from "../../../../../domain/tasks";
import { listTokens } from "../../../../../domain/tokens";
import { Back, Banner, Header, ProjectNav, when } from "../../../../../ui";

export const dynamic = "force-dynamic";

const Subtree = ({ nodes, slug }: { nodes: TaskNode[]; slug: string }) => (
  <ul className="tree">
    {nodes.map((node) => (
      <li key={node.id}>
        <Link href={`/projects/${slug}/tasks/${node.id}`}>{node.title}</Link>{" "}
        <span className={`status ${node.status}`}>{node.status}</span>
        {node.children.length > 0 && <Subtree nodes={node.children} slug={slug} />}
      </li>
    ))}
  </ul>
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

  const [tree, feed, tokens, candidates] = await Promise.all([
    getTaskTree(id),
    listComments(id),
    listTokens(project.id),
    listTasks(project.id),
  ]);
  const path = `/projects/${slug}/tasks/${id}`;

  return (
    <>
      <Header>
        <ProjectNav slug={slug} />
      </Header>
      <main>
        <p className="muted">
          <Link href={`/projects/${slug}`}>← {project.name}</Link>
        </p>
        <h1>{task.title}</h1>
        <Banner error={error} />

        <p className="muted">
          Создал: {task.createdBy ? `агент ${task.createdBy.name}` : "владелец"} ·{" "}
          {when(task.createdAt)}
          {task.recurrence !== null && ` · последнее закрытие: ${when(task.lastClosedAt)}`}
          {task.dueAt && ` · следующая дата: ${when(task.dueAt)}`}
        </p>

        <div className="card">
          <form className="row" method="post" action="/api/tasks">
            <Back path={path} />
            <input type="hidden" name="intent" value="status" />
            <input type="hidden" name="id" value={id} />
            <select name="status" defaultValue={task.status}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button type="submit">Сменить статус</button>
          </form>

          <form className="row" method="post" action="/api/tasks">
            <Back path={path} />
            <input type="hidden" name="intent" value="assign" />
            <input type="hidden" name="id" value={id} />
            <select name="tokenId" defaultValue={task.assigneeTokenId ?? ""}>
              <option value="">не назначена</option>
              {tokens.map((token) => (
                <option key={token.id} value={token.id}>
                  {token.name}
                </option>
              ))}
            </select>
            <button type="submit">Назначить</button>
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
                    {c.title}
                  </option>
                ))}
            </select>
            <button type="submit">Перенести</button>
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
            <button type="submit">Повторять</button>
            <span className="muted">пусто — снять повторение</span>
          </form>
        </div>

        <h2>Заголовок и описание</h2>
        <form method="post" action="/api/tasks">
          <Back path={path} />
          <input type="hidden" name="intent" value="update" />
          <input type="hidden" name="id" value={id} />
          <div className="row">
            <input type="text" name="title" defaultValue={task.title} required />
          </div>
          <textarea name="description" defaultValue={task.description} />
          <div className="row">
            <button type="submit">Сохранить</button>
          </div>
        </form>

        <h2>Подзадачи</h2>
        {tree.children.length > 0 ? (
          <Subtree nodes={tree.children} slug={slug} />
        ) : (
          <p className="muted">Подзадач нет.</p>
        )}
        <form className="row" method="post" action="/api/tasks">
          <Back path={path} />
          <input type="hidden" name="intent" value="create" />
          <input type="hidden" name="projectId" value={project.id} />
          <input type="hidden" name="parentId" value={id} />
          <input type="text" name="title" placeholder="Заголовок подзадачи" required />
          <button type="submit">Добавить подзадачу</button>
        </form>

        <h2>Лента</h2>
        {feed.length === 0 && <p className="muted">Записей пока нет.</p>}
        {feed.map((entry) => (
          <div className={`feed-entry ${entry.kind}`} key={entry.id}>
            <div className="muted">
              {entry.kind === "system" ? "система" : (entry.author?.name ?? "владелец")} ·{" "}
              {when(entry.createdAt)}
            </div>
            <div>{entry.body}</div>
          </div>
        ))}
        <form method="post" action="/api/tasks">
          <Back path={path} />
          <input type="hidden" name="intent" value="comment" />
          <input type="hidden" name="id" value={id} />
          <textarea name="body" placeholder="Комментарий" required />
          <div className="row">
            <button type="submit">Написать</button>
          </div>
        </form>

        <h2>Опасное</h2>
        <div className="row">
          <form method="post" action="/api/tasks">
            <Back path={path} />
            <input type="hidden" name="intent" value="make-template" />
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="scope" value="project" />
            <button type="submit" disabled={task.parentId !== null}>
              Сделать шаблоном проекта
            </button>
          </form>
          <form method="post" action="/api/tasks">
            <Back path={path} />
            <input type="hidden" name="intent" value="delete" />
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="after" value={`/projects/${slug}`} />
            <ConfirmButton message="Удалить задачу вместе со всеми подзадачами и лентой?">
              Удалить задачу
            </ConfirmButton>
          </form>
        </div>
      </main>
    </>
  );
}

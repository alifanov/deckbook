import Link from "next/link";
import { notFound } from "next/navigation";
import { getProjectBySlug } from "../../../domain/projects";
import {
  asStatus,
  listProjectTree,
  listTasks,
  STATUSES,
  type TaskNode,
} from "../../../domain/tasks";
import { listTokens } from "../../../domain/tokens";
import { Back, Banner, Header, ProjectNav } from "../../../ui";

export const dynamic = "force-dynamic";

function Branch({ node, slug }: { node: TaskNode; slug: string }) {
  const link = (
    <>
      <Link href={`/projects/${slug}/tasks/${node.id}`}>{node.title}</Link>{" "}
      <span className={`status ${node.status}`}>{node.status}</span>
      {node.assigneeTokenId && <span className="muted"> · назначена</span>}
      {node.recurrence && <span className="muted"> · повтор {node.recurrence} дн.</span>}
    </>
  );

  if (node.children.length === 0) return <li>{link}</li>;

  return (
    <li>
      <details open>
        <summary>
          {link}{" "}
          <span className="muted">
            {node.parentId === null ? "эпик" : "подзадачи"}: {node.children.length}
          </span>
        </summary>
        <ul className="tree">
          {node.children.map((child) => (
            <Branch key={child.id} node={child} slug={slug} />
          ))}
        </ul>
      </details>
    </li>
  );
}

export default async function ProjectTasksPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string; status?: string; assignee?: string }>;
}) {
  const { slug } = await params;
  const { error, status, assignee } = await searchParams;
  const project = await getProjectBySlug(slug);
  if (!project) notFound();

  const wanted = asStatus(status);
  const filtering = Boolean(wanted || assignee);
  const tree = filtering ? [] : await listProjectTree(project.id);
  const flat = filtering
    ? await listTasks(project.id, {
        ...(wanted ? { status: wanted } : {}),
        ...(assignee ? { assigneeTokenId: assignee } : {}),
      })
    : [];
  const tokens = await listTokens(project.id);
  const path = `/projects/${slug}`;

  return (
    <>
      <Header>
        <ProjectNav slug={slug} />
      </Header>
      <main>
        <h1>{project.name}</h1>
        <Banner error={error} />

        <form className="row" method="get" action={path}>
          <select name="status" defaultValue={status ?? ""}>
            <option value="">Любой статус</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select name="assignee" defaultValue={assignee ?? ""}>
            <option value="">Любой исполнитель</option>
            {tokens.map((token) => (
              <option key={token.id} value={token.id}>
                {token.name}
              </option>
            ))}
          </select>
          <button type="submit">Фильтровать</button>
          {filtering && <Link href={path}>сбросить</Link>}
        </form>

        <h2>{filtering ? "Отобранные задачи" : "Дерево задач"}</h2>

        {filtering ? (
          flat.length === 0 ? (
            <p className="muted">Ничего не подошло.</p>
          ) : (
            <ul className="tree">
              {flat.map((task) => (
                <li key={task.id}>
                  <Link href={`/projects/${slug}/tasks/${task.id}`}>{task.title}</Link>{" "}
                  <span className={`status ${task.status}`}>{task.status}</span>
                  {task.assignee && <span className="muted"> · {task.assignee.name}</span>}
                </li>
              ))}
            </ul>
          )
        ) : tree.length === 0 ? (
          <p className="muted">Задач пока нет.</p>
        ) : (
          <ul className="tree">
            {tree.map((node) => (
              <Branch key={node.id} node={node} slug={slug} />
            ))}
          </ul>
        )}

        <h2>Новая задача</h2>
        <form className="row" method="post" action="/api/tasks">
          <Back path={path} />
          <input type="hidden" name="intent" value="create" />
          <input type="hidden" name="projectId" value={project.id} />
          <input type="text" name="title" placeholder="Заголовок" required />
          <input type="text" name="description" placeholder="Описание" />
          <button type="submit">Создать</button>
        </form>
      </main>
    </>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { getProjectBySlug } from "../../../../domain/projects";
import { getTaskTree, listTasks, type TaskNode } from "../../../../domain/tasks";
import { listTemplates } from "../../../../domain/templates";
import { Back, Banner, Header, Icon, plural, ProjectNav } from "../../../../ui";

export const dynamic = "force-dynamic";

const Steps = ({ nodes }: { nodes: TaskNode[] }) => (
  <>
    {nodes.map((node, n) => (
      <div key={node.id}>
        <span className="n">{n + 1}</span>
        <span>
          {node.title}
          {node.children.length > 0 && (
            <span className="muted"> · вложенных: {node.children.length}</span>
          )}
        </span>
      </div>
    ))}
  </>
);

/** Сколько задач развернётся при применении шаблона. */
const size = (nodes: TaskNode[]): number =>
  nodes.reduce((n, node) => n + 1 + size(node.children), 0);

export default async function TemplatesPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { slug } = await params;
  const { error } = await searchParams;
  const project = await getProjectBySlug(slug);
  if (!project) notFound();

  const templates = await listTemplates(project.id);
  const trees = await Promise.all(templates.map((t) => getTaskTree(t.id)));
  const tasks = await listTasks(project.id);
  const path = `/projects/${slug}/templates`;

  return (
    <>
      <Header>
        <ProjectNav slug={slug} at="templates" />
      </Header>
      <main>
        <h1 style={{ marginBottom: 12 }}>Шаблоны</h1>
        <p className="muted" style={{ margin: "0 0 28px", maxWidth: "62ch" }}>
          Шаблон — обычное дерево задач с признаком заготовки: правится там же, где задачи, и в
          списках не показывается. Пометить дерево шаблоном можно на странице его корневой задачи.
        </p>
        <Banner error={error} />

        {trees.length === 0 && <p className="muted">Шаблонов пока нет.</p>}

        {trees.map((template) => (
          <div className="card" key={template.id}>
            <div className="bar" style={{ alignItems: "baseline" }}>
              <strong style={{ fontSize: 17 }}>{template.title}</strong>
              <span className="muted">
                {template.projectId === null ? "глобальный" : "проектный"} ·{" "}
                {plural(size(template.children), "шаг", "шага", "шагов")}
              </span>
              <span className="spacer" />
              <Link className="act" href={`/projects/${slug}/tasks/${template.id}`}>
                <Icon name="pencil" />
                Править
              </Link>
            </div>

            {template.children.length > 0 && (
              <div className="steps">
                <Steps nodes={template.children} />
              </div>
            )}

            <div className="bar rule" style={{ gap: 8 }}>
              <form className="row" method="post" action="/api/tasks">
                <Back path={path} />
                <input type="hidden" name="intent" value="apply-template" />
                <input type="hidden" name="templateId" value={template.id} />
                <input type="hidden" name="projectId" value={project.id} />
                <select name="parentId" defaultValue="" style={{ minWidth: 240 }}>
                  <option value="">в корень проекта</option>
                  {tasks.map((task) => (
                    <option key={task.id} value={task.id}>
                      внутрь: {task.title}
                    </option>
                  ))}
                </select>
                <button type="submit">
                  <Icon name="check" />
                  Применить
                </button>
              </form>

              <span className="spacer" />

              <form className="inline" method="post" action="/api/tasks">
                <Back path={path} />
                <input type="hidden" name="intent" value="make-template" />
                <input type="hidden" name="id" value={template.id} />
                <input type="hidden" name="projectId" value={project.id} />
                <input
                  type="hidden"
                  name="scope"
                  value={template.projectId === null ? "project" : "global"}
                />
                <button className="act" type="submit">
                  <Icon name="swap" />
                  Сделать {template.projectId === null ? "проектным" : "глобальным"}
                </button>
              </form>
            </div>
          </div>
        ))}
      </main>
    </>
  );
}

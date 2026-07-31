import Link from "next/link";
import { notFound } from "next/navigation";
import { getProjectBySlug } from "../../../../domain/projects";
import { getTaskTree, listTasks, type TaskNode } from "../../../../domain/tasks";
import { listTemplates } from "../../../../domain/templates";
import { Back, Banner, Header, ProjectNav } from "../../../../ui";

export const dynamic = "force-dynamic";

const Steps = ({ nodes }: { nodes: TaskNode[] }) => (
  <ul className="tree">
    {nodes.map((node) => (
      <li key={node.id}>
        {node.title}
        {node.children.length > 0 && <Steps nodes={node.children} />}
      </li>
    ))}
  </ul>
);

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
        <ProjectNav slug={slug} />
      </Header>
      <main>
        <h1>Шаблоны</h1>
        <Banner error={error} />
        <p className="muted">
          Шаблон — обычное дерево задач с признаком заготовки: правится там же, где задачи, и в
          списках задач не показывается. Пометить дерево шаблоном можно на странице его корневой
          задачи.
        </p>

        {trees.length === 0 && <p className="muted">Шаблонов пока нет.</p>}

        {trees.map((template) => (
          <div className="card" key={template.id}>
            <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
              <strong>{template.title}</strong>
              <span className="muted">
                {template.projectId === null ? "глобальный" : "проектный"}
              </span>
              <span style={{ flex: 1 }} />
              <Link href={`/projects/${slug}/tasks/${template.id}`}>править</Link>
            </div>

            <Steps nodes={template.children} />

            <form className="row" method="post" action="/api/tasks">
              <Back path={path} />
              <input type="hidden" name="intent" value="apply-template" />
              <input type="hidden" name="templateId" value={template.id} />
              <input type="hidden" name="projectId" value={project.id} />
              <select name="parentId" defaultValue="">
                <option value="">в корень проекта</option>
                {tasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    внутрь: {task.title}
                  </option>
                ))}
              </select>
              <button type="submit">Применить</button>
            </form>

            <form className="row" method="post" action="/api/tasks">
              <Back path={path} />
              <input type="hidden" name="intent" value="template-scope" />
              <input type="hidden" name="id" value={template.id} />
              <input type="hidden" name="projectId" value={project.id} />
              <input
                type="hidden"
                name="scope"
                value={template.projectId === null ? "project" : "global"}
              />
              <button type="submit">
                Сделать {template.projectId === null ? "проектным" : "глобальным"}
              </button>
            </form>
          </div>
        ))}
      </main>
    </>
  );
}

import Link from "next/link";
import { ConfirmButton } from "../confirm";
import { listProjects } from "../domain/projects";
import { backlogTrend } from "../domain/tasks";
import { Header } from "../header";
import { Trend, TREND_DAYS } from "../trend";
import { Back, Banner, day, Icon, plural, Reveal } from "../ui";

export const dynamic = "force-dynamic";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const projects = await listProjects();
  const trends = await backlogTrend(TREND_DAYS);
  const quiet = new Array<number>(TREND_DAYS).fill(0);

  return (
    <>
      <Header />
      <main>
        <h1>Проекты</h1>
        <Banner error={error} />

        <form className="pill" method="post" action="/api/projects" style={{ marginBottom: 30 }}>
          <Back path="/" />
          <input type="hidden" name="intent" value="create" />
          <input type="text" name="name" placeholder="Название проекта" required />
          <button type="submit">
            <Icon name="plus" />
            Создать проект
          </button>
        </form>

        {projects.length === 0 && <p className="muted">Пока ни одного проекта.</p>}

        {projects.map((project) => (
          <div className="card" key={project.id} style={{ padding: "14px 18px" }}>
            <div className="bar" style={{ alignItems: "baseline" }}>
              <Link
                href={`/projects/${project.slug}`}
                style={{ fontSize: 17, fontWeight: 600 }}
              >
                {project.name}
              </Link>
              <span className="spacer" />
              <Trend trend={trends.get(project.id) ?? quiet} />
              <span className="muted">{day(project.createdAt)}</span>
            </div>

            {project.goal && (
              <p className="muted" style={{ whiteSpace: "pre-wrap", margin: "10px 0 0" }}>
                {project.goal}
              </p>
            )}

            <div className="bar" style={{ gap: 20, marginTop: 12 }}>
              <span className="muted">
                {plural(
                  project._count.tasks,
                  "открытая задача",
                  "открытые задачи",
                  "открытых задач",
                )}{" "}
                ·{" "}
                {plural(project._count.tokens, "агент", "агента", "агентов")}
              </span>
              <span className="spacer" />

              <Reveal label="Переименовать" icon="pencil" drop>
                <form className="pill" method="post" action="/api/projects">
                  <Back path="/" />
                  <input type="hidden" name="intent" value="rename" />
                  <input type="hidden" name="id" value={project.id} />
                  <input type="text" name="name" defaultValue={project.name} required />
                  <button type="submit">
                    <Icon name="check" />
                    Готово
                  </button>
                </form>
              </Reveal>

              <form className="inline" method="post" action="/api/projects">
                <Back path="/" />
                <input type="hidden" name="intent" value="delete" />
                <input type="hidden" name="id" value={project.id} />
                <ConfirmButton message={`Удалить «${project.name}» со всем содержимым?`}>
                  <Icon name="trash" />
                  Удалить
                </ConfirmButton>
              </form>
            </div>
          </div>
        ))}
      </main>
    </>
  );
}

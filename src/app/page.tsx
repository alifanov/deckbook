import Link from "next/link";
import { ConfirmButton } from "../confirm";
import { listProjects } from "../domain/projects";
import { Header } from "../header";
import { Back, Banner, day, Icon, plural, Reveal } from "../ui";

export const dynamic = "force-dynamic";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const projects = await listProjects();

  return (
    <>
      <Header />
      <main>
        <h1>Проекты</h1>
        <Banner error={error} />

        <form className="row" method="post" action="/api/projects" style={{ marginBottom: 30 }}>
          <Back path="/" />
          <input type="hidden" name="intent" value="create" />
          <input type="text" name="name" placeholder="Название проекта" required />
          <button className="plain quick" type="submit">
            <Icon name="plus" />
            Создать проект
          </button>
        </form>

        {projects.length === 0 && <p className="muted">Пока ни одного проекта.</p>}

        {projects.map((project) => (
          <div className="card" key={project.id} style={{ padding: "20px 24px" }}>
            <div className="bar" style={{ alignItems: "baseline" }}>
              <Link
                href={`/projects/${project.slug}`}
                style={{ fontSize: 17, fontWeight: 600 }}
              >
                {project.name}
              </Link>
              <span className="muted">/{project.slug}</span>
              <span className="spacer" />
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

              <Reveal label="Переименовать" icon="pencil" drop bare>
                <form className="row" method="post" action="/api/projects">
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
                <ConfirmButton
                  message={`Удалить «${project.name}» со всем содержимым?`}
                  label="Удалить"
                >
                  <Icon name="trash" />
                </ConfirmButton>
              </form>
            </div>
          </div>
        ))}
      </main>
    </>
  );
}

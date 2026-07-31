import Link from "next/link";
import { ConfirmButton } from "../confirm";
import { listProjects } from "../domain/projects";
import { Back, Banner, Header, when } from "../ui";

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

        <form className="row" method="post" action="/api/projects">
          <Back path="/" />
          <input type="hidden" name="intent" value="create" />
          <input type="text" name="name" placeholder="Название проекта" required />
          <button type="submit">Создать проект</button>
        </form>

        {projects.length === 0 && <p className="muted">Пока ни одного проекта.</p>}

        {projects.map((project) => (
          <div className="card" key={project.id}>
            <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
              <Link href={`/projects/${project.slug}`} style={{ fontWeight: 600 }}>
                {project.name}
              </Link>
              <span className="muted">/{project.slug}</span>
              <span className="spacer" style={{ flex: 1 }} />
              <span className="muted">{when(project.createdAt)}</span>
            </div>

            <form className="row" method="post" action="/api/projects">
              <Back path="/" />
              <input type="hidden" name="intent" value="rename" />
              <input type="hidden" name="id" value={project.id} />
              <input type="text" name="name" defaultValue={project.name} required />
              <button type="submit">Переименовать</button>
            </form>

            <form className="row" method="post" action="/api/projects">
              <Back path="/" />
              <input type="hidden" name="intent" value="delete" />
              <input type="hidden" name="id" value={project.id} />
              <ConfirmButton message={`Удалить «${project.name}» со всем содержимым?`}>
                Удалить проект
              </ConfirmButton>
            </form>
          </div>
        ))}
      </main>
    </>
  );
}

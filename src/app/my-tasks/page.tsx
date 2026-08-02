import Link from "next/link";
import { isOverdue, listOwnerTasks } from "../../domain/tasks";
import { Dot, dueDay, Header, plural, statusLabel } from "../../ui";

export const dynamic = "force-dynamic";

/** Незакрытые задачи владельца — из всех проектов сразу, без границы проекта. */
export default async function MyTasksPage() {
  const tasks = await listOwnerTasks();

  return (
    <>
      <Header />
      <main>
        <div className="bar" style={{ alignItems: "baseline", marginBottom: 22 }}>
          <h1 style={{ margin: 0 }}>Мои задачи</h1>
          <span className="muted">{plural(tasks.length, "задача", "задачи", "задач")}</span>
        </div>

        {tasks.length === 0 ? (
          <p className="muted">На вас ничего не назначено.</p>
        ) : (
          <div className="card tight list">
            {tasks.map((task) => (
              <div className="item" key={task.id}>
                <Dot status={task.status} />
                <Link
                  href={`/projects/${task.project.slug}/tasks/${task.id}`}
                  className="grow"
                >
                  {task.title}
                </Link>
                <Link href={`/projects/${task.project.slug}`} className="muted">
                  {task.project.name}
                </Link>
                {task.dueAt &&
                  (isOverdue(task) ? (
                    <span className="bad">просрочена · {dueDay(task.dueAt)}</span>
                  ) : (
                    <span className="muted">срок {dueDay(task.dueAt)}</span>
                  ))}
                <span className="muted">{statusLabel(task.status)}</span>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}

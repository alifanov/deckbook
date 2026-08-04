import Link from "next/link";
import { isOverdue, listOwnerTasks } from "../../domain/tasks";
import { FilterForm } from "../../filter";
import { Header } from "../../header";
import { Dot, dueDay, Icon, plural, Prio, statusLabel } from "../../ui";

export const dynamic = "force-dynamic";

const PATH = "/my-tasks";

/** Незакрытые задачи владельца — из всех проектов сразу, без границы проекта. */
export default async function MyTasksPage({
  searchParams,
}: {
  searchParams: Promise<{ future?: string }>;
}) {
  const { future } = await searchParams;
  // по умолчанию список — про то, что делать уже сейчас; отложенное на будущее
  // показывается по просьбе
  const includeFuture = future === "1";
  const tasks = await listOwnerTasks(includeFuture);

  return (
    <>
      <Header />
      <main>
        <div className="bar" style={{ alignItems: "baseline", gap: 16, marginBottom: 22 }}>
          <h1 style={{ margin: 0 }}>Мои задачи</h1>
          <span className="muted">{plural(tasks.length, "задача", "задачи", "задач")}</span>
          <span className="spacer" />
          <FilterForm action={PATH}>
            <label className="muted row" style={{ gap: 6, cursor: "pointer" }}>
              <input
                type="checkbox"
                name="future"
                value="1"
                defaultChecked={includeFuture}
                style={{ cursor: "pointer" }}
              />
              Показывать отложенные
            </label>
            <noscript>
              <button className="plain" type="submit">
                <Icon name="filter" />
                Фильтровать
              </button>
            </noscript>
          </FilterForm>
        </div>

        {tasks.length === 0 ? (
          <p className="muted">
            {includeFuture ? "На вас ничего не назначено." : "Сейчас делать нечего."}
          </p>
        ) : (
          <div className="card tight list">
            {tasks.map((task) => (
              <div className={`item ${task.status}`} key={task.id}>
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
                <Prio task={task} />
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

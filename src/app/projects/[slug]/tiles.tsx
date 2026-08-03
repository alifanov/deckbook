import Link from "next/link";
import { STATUSES } from "../../../domain/tasks";
import type { TaskStatus } from "../../../generated/prisma/client";
import { statusLabel } from "../../../ui";

/**
 * Сводка по статусам — она же отбор: плитка ведёт в список своего статуса.
 * Повторный клик по выбранной плитке снимает отбор, иначе из него не выйти.
 * Выбранный исполнитель переносится в ссылку — отборы складываются, а не спорят.
 */
export function Tiles({
  counts,
  path,
  status,
  assignee,
}: {
  counts: Record<TaskStatus, number>;
  path: string;
  status: TaskStatus | null;
  assignee?: string;
}) {
  const href = (tile: TaskStatus) => {
    const query = new URLSearchParams();
    if (tile !== status) query.set("status", tile);
    if (assignee) query.set("assignee", assignee);
    const tail = query.toString();
    return tail ? `${path}?${tail}` : path;
  };

  return (
    <div className="tiles">
      {STATUSES.map((tile) => (
        <Link
          className={`tile ${tile}${tile === status ? " on" : ""}`}
          href={href(tile)}
          key={tile}
        >
          <span className="n">{counts[tile]}</span>
          <span className="muted">{statusLabel(tile)}</span>
        </Link>
      ))}
    </div>
  );
}

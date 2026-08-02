import Link from "next/link";
import { notFound } from "next/navigation";
import { getProjectBySlug } from "../../../domain/projects";
import { FilterForm } from "../../../filter";
import {
  asStatus,
  countByStatus,
  countUnassigned,
  dailyFlow,
  type DayFlow,
  hideClosed,
  isClosed,
  isOverdue,
  listProjectTree,
  listTasks,
  OWNER_ASSIGNEE,
  STATUSES,
  type TaskNode,
} from "../../../domain/tasks";
import type { TaskStatus } from "../../../generated/prisma/client";
import { listTokens } from "../../../domain/tokens";
import {
  Back,
  Banner,
  Dot,
  dueDay,
  Head,
  Header,
  Icon,
  plural,
  Prio,
  ProjectNav,
  Reveal,
  statusLabel,
} from "../../../ui";

export const dynamic = "force-dynamic";

/** Срок и приговор по нему — одинаково в дереве и в отобранном списке. */
const Due = ({ task }: { task: { dueAt: Date | null } }) =>
  task.dueAt ? (
    isOverdue(task) ? (
      <span className="bad">просрочена · {dueDay(task.dueAt)}</span>
    ) : (
      <span className="muted">срок {dueDay(task.dueAt)}</span>
    )
  ) : null;

/** Сводка по статусам: где стоит проект, до того как читать сами задачи. */
const Tiles = ({ counts }: { counts: Record<TaskStatus, number> }) => (
  <div className="tiles">
    {STATUSES.map((s) => (
      <div className={`tile ${s}`} key={s}>
        <span className="n">{counts[s]}</span>
        <span className="muted">{statusLabel(s)}</span>
      </div>
    ))}
  </div>
);

/** Столбик дня: заведено слева, закрыто справа. */
const SLOT = 40;
const FLOOR = 56;

/** Темп работы по дням. ponytail: свой SVG, графическая библиотека тут лишняя. */
function Flow({ flow }: { flow: DayFlow[] }) {
  const peak = Math.max(1, ...flow.map((d) => Math.max(d.created, d.closed)));
  const bar = (value: number) => (value / peak) * FLOOR;

  return (
    <svg
      className="flow"
      viewBox={`0 0 ${flow.length * SLOT} 70`}
      role="img"
      aria-label="Заведённые и закрытые задачи по дням"
    >
      {flow.map((d, i) => (
        <g key={d.day} transform={`translate(${i * SLOT} 0)`}>
          <rect
            className="created"
            x={6}
            y={FLOOR - bar(d.created)}
            width={13}
            height={bar(d.created)}
          />
          <rect
            className="closed"
            x={21}
            y={FLOOR - bar(d.closed)}
            width={13}
            height={bar(d.closed)}
          />
          <text x={20} y={66} textAnchor="middle">
            {Number(d.day.slice(8))}
          </text>
        </g>
      ))}
    </svg>
  );
}

function Branch({ node, slug, top }: { node: TaskNode; slug: string; top?: boolean }) {
  const kids = node.children.length;

  return (
    <>
      <div className={`item ${node.status}`}>
        <Dot status={node.status} />
        <Link
          href={`/projects/${slug}/tasks/${node.id}`}
          className={top && kids > 0 ? undefined : "grow"}
          style={top ? { fontSize: 16, fontWeight: 600 } : undefined}
        >
          {node.title}
        </Link>
        {top && kids > 0 && (
          <>
            <span className="muted">эпик · {kids}</span>
            <span className="spacer" />
          </>
        )}
        {!top && kids > 0 && <span className="muted">подзадачи: {kids}</span>}
        {node.recurrence !== null && (
          <span className="muted">повтор {node.recurrence} дн.</span>
        )}
        <Prio task={node} />
        <Due task={node} />
        <span className="muted state">{statusLabel(node.status)}</span>
      </div>

      {kids > 0 && (
        <div className="kids">
          {node.children.map((child) => (
            <Branch key={child.id} node={child} slug={slug} />
          ))}
        </div>
      )}
    </>
  );
}

export default async function ProjectTasksPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    error?: string;
    status?: string;
    assignee?: string;
    closed?: string;
  }>;
}) {
  const { error, status, assignee, closed } = await searchParams;
  const { slug } = await params;
  const project = await getProjectBySlug(slug);
  if (!project) notFound();

  const wanted = asStatus(status);
  // по умолчанию список — про то, что ещё делать; закрытое показывается по просьбе,
  // а выбранный руками статус говорит сам за себя и этому правилу не подчиняется
  const showClosed = closed === "1" || wanted !== null;
  const filtering = Boolean(wanted || assignee);
  const whole = filtering ? [] : await listProjectTree(project.id);
  const tree = showClosed ? whole : hideClosed(whole);
  const found = filtering
    ? await listTasks(project.id, {
        ...(wanted ? { status: wanted } : {}),
        ...(assignee === OWNER_ASSIGNEE
          ? { assignedToOwner: true }
          : assignee
            ? { assigneeTokenId: assignee }
            : {}),
        // владелец видит всё: срок прячет задачи только от агента (ADR-0004)
        includeFuture: true,
      })
    : [];
  const flat = showClosed ? found : found.filter((task) => !isClosed(task));
  const all = await listTasks(project.id, { includeFuture: true });
  const tokens = await listTokens(project.id);
  const agents = tokens.filter((token) => token.revokedAt === null);
  const orphans = await countUnassigned(project.id);
  const counts = await countByStatus(project.id);
  const flow = await dailyFlow(project.id);
  const path = `/projects/${slug}`;

  return (
    <>
      <Header>
        <ProjectNav slug={slug} at="tasks" />
      </Header>
      <main>
        <div className="bar" style={{ alignItems: "baseline", marginBottom: 10 }}>
          <h1 style={{ margin: 0 }}>{project.name}</h1>
          <span className="muted">{plural(all.length, "задача", "задачи", "задач")}</span>
        </div>

        {/* цель работает, только пока мозолит глаза — потому под заголовком,
            а не на отдельной странице настроек */}
        <div className="bar" style={{ alignItems: "baseline", gap: 10, marginBottom: 22 }}>
          {project.goal ? (
            <span style={{ whiteSpace: "pre-wrap" }}>{project.goal}</span>
          ) : (
            <span className="muted">Цель не задана</span>
          )}
          <span className="spacer" />
          <Reveal label="Цель" drop wide>
            <form method="post" action="/api/projects">
              <Back path={path} />
              <input type="hidden" name="intent" value="goal" />
              <input type="hidden" name="id" value={project.id} />
              <textarea
                name="goal"
                defaultValue={project.goal}
                placeholder="К чему проект должен прийти. Строкой на цель, важное — выше"
              />
              <div className="row" style={{ marginTop: 10 }}>
                <button type="submit">
                  <Icon name="check" />
                  Сохранить
                </button>
              </div>
            </form>
          </Reveal>
        </div>
        <Banner error={error} />

        {/* сводка идёт до фильтров: она про весь проект и от отбора не зависит */}
        <Tiles counts={counts} />
        <div className="card" style={{ marginBottom: 28 }}>
          <div className="bar" style={{ alignItems: "baseline", gap: 16 }}>
            <h2 style={{ margin: 0, fontSize: 15 }}>Заведено и закрыто</h2>
            <span className="muted">за {plural(flow.length, "день", "дня", "дней")}</span>
            <span className="spacer" />
            <span className="muted">
              <span className="swatch" style={{ background: "var(--dot)" }} />
              заведено
            </span>
            <span className="muted">
              <span className="swatch" style={{ background: "var(--dot-done)" }} />
              закрыто
            </span>
          </div>
          <Flow flow={flow} />
        </div>

        <div className="bar" style={{ gap: 8, marginBottom: 28 }}>
          <FilterForm action={path}>
            <select name="status" defaultValue={status ?? ""}>
              <option value="">Любой статус</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s)}
                </option>
              ))}
            </select>
            <select name="assignee" defaultValue={assignee ?? ""}>
              <option value="">Любой исполнитель</option>
              <option value={OWNER_ASSIGNEE}>Владелец</option>
              {tokens.map((token) => (
                <option key={token.id} value={token.id}>
                  {token.name}
                </option>
              ))}
            </select>
            {/* выбранный руками статус уже говорит, что показывать — тогда галочке нечего решать */}
            {!wanted && (
              <label className="muted row" style={{ gap: 6, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  name="closed"
                  value="1"
                  defaultChecked={showClosed}
                  style={{ cursor: "pointer" }}
                />
                Показывать выполненные
              </label>
            )}
            <noscript>
              <button className="plain" type="submit">
                <Icon name="filter" />
                Фильтровать
              </button>
            </noscript>
            {filtering && (
              <Link className="act" href={path} style={{ marginLeft: 6 }}>
                <Icon name="x" />
                Сбросить
              </Link>
            )}
          </FilterForm>

          <span className="spacer" />

          {/* под фильтром места на строке уже нет, да и создавать некуда:
              новая задача всё равно не попадёт в отобранное */}
          {!filtering && (
            <form className="row" method="post" action="/api/tasks">
              <Back path={path} />
              <input type="hidden" name="intent" value="create" />
              <input type="hidden" name="projectId" value={project.id} />
              <input
                type="text"
                name="title"
                placeholder="Новая задача"
                required
                style={{ flex: "none", width: 220, minWidth: 0 }}
              />
              <button type="submit">
                <Icon name="plus" />
                Создать
              </button>
            </form>
          )}
        </div>

        {orphans > 0 && agents.length > 0 && (
          <form className="row notice slim" method="post" action="/api/tasks">
            <Back path={path} />
            <input type="hidden" name="intent" value="assign-unassigned" />
            <input type="hidden" name="projectId" value={project.id} />
            <span style={{ fontSize: 14, color: "var(--accent-ink)" }}>
              Ничьих задач: {orphans} — их не видит ни один агент.
            </span>
            <span className="spacer" />
            <select name="tokenId">
              {agents.map((token) => (
                <option key={token.id} value={token.id}>
                  {token.name}
                </option>
              ))}
            </select>
            <button className="plain" type="submit">
              <Icon name="check" />
              Назначить все
            </button>
          </form>
        )}

        <Head
          title={filtering ? "Отобранные задачи" : "Дерево задач"}
          count={filtering ? flat.length : `${tree.length} верхнего уровня`}
        />

        {filtering ? (
          flat.length === 0 ? (
            <p className="muted">Ничего не подошло.</p>
          ) : (
            <div className="card tight list">
              {flat.map((task) => (
                <div className={`item ${task.status}`} key={task.id}>
                  <Dot status={task.status} />
                  <Link href={`/projects/${slug}/tasks/${task.id}`} className="grow">
                    {task.title}
                  </Link>
                  {(task.assignedToOwner || task.assignee) && (
                    <span className="muted">
                      {task.assignedToOwner ? "владелец" : task.assignee?.name}
                    </span>
                  )}
                  <Prio task={task} />
                  <Due task={task} />
                  <span className="muted state">{statusLabel(task.status)}</span>
                </div>
              ))}
            </div>
          )
        ) : tree.length === 0 ? (
          <p className="muted">Задач пока нет.</p>
        ) : (
          <div className="card tight list">
            {tree.map((node) => (
              <Branch key={node.id} node={node} slug={slug} top />
            ))}
          </div>
        )}
      </main>
    </>
  );
}

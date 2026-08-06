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
  type TaskNode,
} from "../../../domain/tasks";
import { listTokens } from "../../../domain/tokens";
import { Header } from "../../../header";
import {
  Back,
  Banner,
  Dot,
  dueDay,
  Head,
  Icon,
  plural,
  Prio,
  ProjectNav,
  statusLabel,
} from "../../../ui";
import { Tiles } from "./tiles";

export const dynamic = "force-dynamic";

/** Подпись строк «Цель» и «Папка»: одна колонка и в чтении, и в правке. */
const LABEL = { width: 54, flex: "none" } as const;

/** Срок и приговор по нему — одинаково в дереве и в отобранном списке. */
const Due = ({ task }: { task: { dueAt: Date | null } }) =>
  task.dueAt ? (
    isOverdue(task) ? (
      <span className="bad">просрочена · {dueDay(task.dueAt)}</span>
    ) : (
      <span className="muted">срок {dueDay(task.dueAt)}</span>
    )
  ) : null;

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
    meta?: string;
  }>;
}) {
  const { error, status, assignee, closed, meta } = await searchParams;
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
  const editingMeta = meta === "1";

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
            а не на отдельной странице настроек. Путь к чекауту нужен только
            кнопке «Исправить» на задаче, потому живёт тут же, а не в настройках */}
        {editingMeta ? (
          <form
            method="post"
            action="/api/projects"
            style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 22 }}
          >
            <Back path={path} />
            <input type="hidden" name="intent" value="meta" />
            <input type="hidden" name="id" value={project.id} />
            <div className="bar" style={{ alignItems: "flex-start" }}>
              <span className="muted" style={{ ...LABEL, paddingTop: 9 }}>
                Цель
              </span>
              <textarea
                name="goal"
                defaultValue={project.goal}
                placeholder="К чему проект должен прийти. Строкой на цель, важное — выше"
                style={{
                  minHeight: 80,
                  padding: "8px 12px",
                  // цель — фраза, а не код: моноширинный шрифт тут ни к чему
                  fontFamily: "inherit",
                  fontSize: 15,
                  lineHeight: 1.6,
                }}
              />
            </div>
            <div className="bar">
              <span className="muted" style={LABEL}>
                Папка
              </span>
              <input
                type="text"
                className="mono"
                name="localPath"
                defaultValue={project.localPath}
                placeholder="/Users/you/code/project"
                style={{ flex: 1, fontSize: 13 }}
              />
            </div>
            <div className="bar" style={{ gap: 16, paddingLeft: 66, marginTop: 2 }}>
              <button type="submit">
                <Icon name="check" />
                Сохранить
              </button>
              <Link className="act" href={path}>
                <Icon name="x" />
                Отмена
              </Link>
              <span className="muted">пусто — снять</span>
            </div>
          </form>
        ) : (
          <div
            style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 22 }}
          >
            <div className="bar" style={{ alignItems: "baseline" }}>
              <span className="muted" style={LABEL}>
                Цель
              </span>
              {project.goal ? (
                <span style={{ flex: 1, whiteSpace: "pre-wrap" }}>{project.goal}</span>
              ) : (
                <span className="muted" style={{ flex: 1 }}>
                  Цель не задана
                </span>
              )}
              <Link className="act" href={`${path}?meta=1`}>
                <Icon name="pencil" />
                Изменить
              </Link>
            </div>
            <div className="bar" style={{ alignItems: "baseline" }}>
              <span className="muted" style={LABEL}>
                Папка
              </span>
              <span className="mono muted" style={{ flex: 1, fontSize: 13 }}>
                {project.localPath || "не задана"}
              </span>
            </div>
          </div>
        )}
        <Banner error={error} />

        {/* сводка идёт до фильтров: считает она весь проект, а кликом задаёт отбор */}
        <Tiles counts={counts} path={path} status={wanted} assignee={assignee} />
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
            {/* статус выбирается плиткой; форме он нужен скрытым, иначе смена
                исполнителя отправит GET без него и отбор по статусу слетит */}
            {wanted && <input type="hidden" name="status" value={wanted} />}
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
            <form className="pill" method="post" action="/api/tasks">
              <Back path={path} />
              <input type="hidden" name="intent" value="create" />
              <input type="hidden" name="projectId" value={project.id} />
              <input
                type="text"
                name="title"
                placeholder="Новая задача"
                required
                style={{ flex: "none", width: 220 }}
              />
              <button type="submit">
                <Icon name="plus" />
                Создать
              </button>
            </form>
          )}
        </div>

        {orphans > 0 && agents.length > 0 && (
          <div className="notice slim">
            <span style={{ fontSize: 14, color: "var(--accent-ink)" }}>
              Ничьих задач: {orphans} — их не видит ни один агент.
            </span>
            <span className="spacer" />
            <form className="pill" method="post" action="/api/tasks">
              <Back path={path} />
              <input type="hidden" name="intent" value="assign-unassigned" />
              <input type="hidden" name="projectId" value={project.id} />
              <select name="tokenId">
                {agents.map((token) => (
                  <option key={token.id} value={token.id}>
                    {token.name}
                  </option>
                ))}
              </select>
              <button type="submit">
                <Icon name="check" />
                Назначить все
              </button>
            </form>
          </div>
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

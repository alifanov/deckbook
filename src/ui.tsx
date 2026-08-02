import Link from "next/link";
import type { ReactNode } from "react";
import type { TaskStatus } from "./generated/prisma/client";

export function Logo({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden>
      <rect x="1.5" y="2" width="15" height="14" rx="3" stroke="#5d7a42" strokeWidth="1.4" />
      <path
        d="M6 2v9l2.4-1.8L10.8 11V2"
        stroke="#5d7a42"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Штриховые значки 24×24: рисуются цветом текста, размер по месту. */
const GLYPHS = {
  plus: (
    <>
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </>
  ),
  check: <path d="M20 6 9 17l-5-5" />,
  x: (
    <>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </>
  ),
  pencil: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </>
  ),
  trash: (
    <>
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </>
  ),
  filter: <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />,
  down: <path d="m6 9 6 6 6-6" />,
  right: <path d="m9 18 6-6-6-6" />,
  send: (
    <>
      <path d="m5 12 7-7 7 7" />
      <path d="M12 19V5" />
    </>
  ),
  copy: (
    <>
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </>
  ),
  upload: (
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <path d="M12 3v12" />
    </>
  ),
  move: (
    <>
      <path d="M5 9 2 12l3 3" />
      <path d="M9 5l3-3 3 3" />
      <path d="M15 19l-3 3-3-3" />
      <path d="M19 9l3 3-3 3" />
      <path d="M2 12h20" />
      <path d="M12 2v20" />
    </>
  ),
  layers: (
    <>
      <path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
      <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" />
      <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />
    </>
  ),
  ban: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="m4.9 4.9 14.2 14.2" />
    </>
  ),
  swap: (
    <>
      <path d="m16 3 4 4-4 4" />
      <path d="M20 7H4" />
      <path d="m8 21-4-4 4-4" />
      <path d="M4 17h16" />
    </>
  ),
  login: (
    <>
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <polyline points="10 17 15 12 10 7" />
      <path d="M15 12H3" />
    </>
  ),
  logout: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <path d="M21 12H9" />
    </>
  ),
  calendar: (
    <>
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M3 10h18M8 2v4M16 2v4" />
    </>
  ),
  repeat: (
    <>
      <path d="m17 2 4 4-4 4" />
      <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
      <path d="m7 22-4-4 4-4" />
      <path d="M21 13v1a4 4 0 0 1-4 4H3" />
    </>
  ),
} as const;

export type IconName = keyof typeof GLYPHS;

export const Icon = ({ name, size = 14 }: { name: IconName; size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    {GLYPHS[name]}
  </svg>
);

export function Header({ children }: { children?: ReactNode }) {
  return (
    <header className="top">
      <div className="inner">
        <Link className="brand" href="/">
          <Logo />
          Deckbook
        </Link>
        {children}
        <span className="spacer" />
        <form method="post" action="/api/session">
          <input type="hidden" name="intent" value="logout" />
          <button className="act" type="submit">
            <Icon name="logout" />
            Выйти
          </button>
        </form>
      </div>
    </header>
  );
}

const NAV = [
  {
    at: "tasks",
    href: "",
    label: "Задачи",
    glyph: (
      <>
        <rect x="2" y="2.5" width="12" height="11" rx="2.5" />
        <path d="M5.4 8.2l1.8 1.8 3.4-3.6" />
      </>
    ),
  },
  {
    at: "documents",
    href: "/documents",
    label: "Документы",
    glyph: (
      <>
        <path d="M4 1.8h4.6L12.2 5.4v8.8H4z" />
        <path d="M8.4 2v3.6h3.6M6 9h4M6 11.4h3" />
      </>
    ),
  },
  {
    at: "templates",
    href: "/templates",
    label: "Шаблоны",
    glyph: (
      <>
        <rect x="5.2" y="2" width="8.8" height="8.8" rx="2" />
        <path d="M10.4 13.4a2 2 0 0 1-2 1.6H4a2 2 0 0 1-2-2V6.6" />
      </>
    ),
  },
  {
    at: "tokens",
    href: "/tokens",
    label: "Токены",
    glyph: (
      <>
        <circle cx="5.4" cy="8" r="3.2" />
        <path d="M8.6 8H14M11.6 8v2.4M13.2 8v1.8" />
      </>
    ),
  },
] as const;

export type NavAt = (typeof NAV)[number]["at"];

export const ProjectNav = ({ slug, at }: { slug: string; at: NavAt }) => (
  <nav>
    {NAV.map((item) => (
      <Link
        key={item.at}
        className={item.at === at ? "here" : undefined}
        href={`/projects/${slug}${item.href}`}
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          {item.glyph}
        </svg>
        {item.label}
      </Link>
    ))}
  </nav>
);

export const Banner = ({ error }: { error?: string }) =>
  error ? <p className="error">{error}</p> : null;

export const Back = ({ path }: { path: string }) => (
  <input type="hidden" name="back" value={path} />
);

/** Заголовок раздела: имя, счётчик и действия справа. */
export const Head = ({
  title,
  count,
  children,
}: {
  title: string;
  count?: ReactNode;
  children?: ReactNode;
}) => (
  <div className="head">
    <h2>{title}</h2>
    {count !== undefined && count !== null && <span className="muted">{count}</span>}
    {children && (
      <>
        <span className="spacer" />
        {children}
      </>
    )}
  </div>
);

/**
 * Второстепенное действие: в покое — ссылка, по клику раскрывает форму.
 * ponytail: нативный <details>, никакого клиентского состояния.
 */
export const Reveal = ({
  label,
  icon = "pencil",
  tone,
  drop,
  wide,
  children,
}: {
  label: string;
  icon?: IconName;
  tone?: "go" | "bad";
  /** раскрыться поверх раскладки, а не раздвинуть её */
  drop?: boolean;
  wide?: boolean;
  children: ReactNode;
}) => (
  <details className={drop ? "reveal drop" : "reveal"}>
    {/* .act висит на вложенном span: у самого <summary> нельзя менять display,
        иначе он выпадает из дерева доступности и перестаёт быть кнопкой */}
    <summary>
      <span className={tone ? `act ${tone}` : "act"}>
        <Icon name={icon} />
        {label}
      </span>
    </summary>
    <div className={wide ? "pop wide" : "pop"}>{children}</div>
  </details>
);

const STATUS_RU: Record<TaskStatus, string> = {
  todo: "открыта",
  in_progress: "в работе",
  done: "готова",
  cancelled: "отменена",
};

export const statusLabel = (status: TaskStatus) => STATUS_RU[status];

export const Dot = ({ status }: { status: TaskStatus }) => (
  <span className={`dot ${status}`} />
);

/** «14 июля», с годом — только если он не текущий. */
export function day(date: Date | string | null | undefined, utc = false): string {
  if (!date) return "—";
  const value = new Date(date);
  const now = new Date();
  return value.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    ...(value.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
    ...(utc ? { timeZone: "UTC" } : {}),
  });
}

/** Срок хранится как полночь UTC — иначе он съезжает на день назад. */
export const dueDay = (date: Date | string | null | undefined) => day(date, true);

/** «2 августа, 07:12» — для ленты и следов агента. */
export function moment(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const time = new Date(date).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${day(date)}, ${time}`;
}

/** «12 задач», «1 агент» — счётчик с правильным окончанием. */
export const plural = (n: number, one: string, few: string, many: string) => {
  const mod100 = n % 100;
  const mod10 = n % 10;
  if (mod100 >= 11 && mod100 <= 14) return `${n} ${many}`;
  if (mod10 === 1) return `${n} ${one}`;
  if (mod10 >= 2 && mod10 <= 4) return `${n} ${few}`;
  return `${n} ${many}`;
};

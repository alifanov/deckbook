import Link from "next/link";
import type { ReactNode } from "react";

export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden>
      <rect x="12" y="5" width="14" height="19" rx="3" fill="#3d4a68" />
      <clipPath id="deck-logo-card">
        <rect x="6" y="8" width="14" height="19" rx="3" />
      </clipPath>
      <g clipPath="url(#deck-logo-card)">
        <rect x="6" y="8" width="14" height="19" fill="#7aa2f7" />
        <rect x="6" y="8" width="4" height="19" fill="#4d72c4" />
      </g>
    </svg>
  );
}

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
          <button type="submit">Выйти</button>
        </form>
      </div>
    </header>
  );
}

export function ProjectNav({ slug }: { slug: string }) {
  return (
    <>
      <Link href={`/projects/${slug}`}>Задачи</Link>
      <Link href={`/projects/${slug}/documents`}>Документы</Link>
      <Link href={`/projects/${slug}/templates`}>Шаблоны</Link>
      <Link href={`/projects/${slug}/tokens`}>Токены</Link>
    </>
  );
}

export const Banner = ({ error }: { error?: string }) =>
  error ? <p className="error">{error}</p> : null;

export const Back = ({ path }: { path: string }) => (
  <input type="hidden" name="back" value={path} />
);

export const when = (date: Date | null | undefined) =>
  date ? new Date(date).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" }) : "—";

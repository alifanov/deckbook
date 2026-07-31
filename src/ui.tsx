import Link from "next/link";
import type { ReactNode } from "react";

export function Header({ children }: { children?: ReactNode }) {
  return (
    <header className="top">
      <div className="inner">
        <Link className="brand" href="/">
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

// next/link вне Next.js падает: ему нужен контекст App Router, которого нет
// ни в превью-карточке, ни в макете, собранном агентом claude.ai/design.
// Реальный Link всё равно рендерит <a href>, поэтому шим ему эквивалентен.
import type { AnchorHTMLAttributes, ReactNode } from "react";

type Props = { href: string; children?: ReactNode } & Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  "href"
>;

export default function Link({ href, children, ...rest }: Props) {
  return (
    <a href={href} {...rest}>
      {children}
    </a>
  );
}

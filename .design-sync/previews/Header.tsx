import type { ReactNode } from "react";
import { Header, ProjectNav } from "deckbook";

// Карточка превью рисуется на белом фоне, а Deckbook — тёмная система
// (color-scheme: dark в globals.css). Кладём содержимое на её собственный фон,
// иначе карточка показывает не то, что видит пользователь.
const Surface = ({ children }: { children: ReactNode }) => (
  <div style={{ background: "var(--bg)", color: "var(--text)" }}>{children}</div>
);

/** Шапка без содержимого: бренд слева, «Выйти» справа. Так выглядит корень и /login. */
export const Default = () => (
  <Surface>
    <Header />
  </Surface>
);

/** Рабочий вид: внутрь шапки кладётся навигация по разделам проекта. */
export const WithProjectNav = () => (
  <Surface>
    <Header>
      <ProjectNav slug="deckbook" />
    </Header>
  </Surface>
);

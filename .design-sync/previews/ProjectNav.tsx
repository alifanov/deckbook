import type { ReactNode } from "react";
import { Header, ProjectNav } from "deckbook";

// Тёмный фон системы — см. комментарий в Header.tsx.
const Surface = ({ children }: { children: ReactNode }) => (
  <div style={{ background: "var(--bg)", color: "var(--text)" }}>{children}</div>
);

/** Единственное настоящее место навигации — внутри <Header>. */
export const InHeader = () => (
  <Surface>
    <Header>
      <ProjectNav slug="deckbook" />
    </Header>
  </Surface>
);

/** Сами ссылки, без шапки: четыре раздела проекта в порядке следования. */
export const Bare = () => (
  <Surface>
    <div style={{ display: "flex", gap: 16, padding: 16 }}>
      <ProjectNav slug="deckbook" />
    </div>
  </Surface>
);

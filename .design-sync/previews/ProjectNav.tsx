import type { ReactNode } from "react";
import { Icon, Logo, ProjectNav } from "deckbook";

// Подложка карточки: страничный фон системы, см. комментарий в Head.tsx.
const Surface = ({ children }: { children: ReactNode }) => (
  <div style={{ background: "var(--bg)", color: "var(--text)" }}>{children}</div>
);

/**
 * Навигация живёт только внутри шапки: промежутки между ссылками задаёт
 * `.top .inner`, вне его ссылки слипаются. Сам <Header> в дизайн-систему не
 * входит (async-серверный, ходит в базу), поэтому его разметка повторена
 * здесь вручную — это оправа для превью, а не компонент системы.
 */
const Frame = ({ children }: { children: ReactNode }) => (
  <Surface>
    <header className="top">
      <div className="inner">
        <a className="brand" href="/">
          <Logo />
          Deckbook
        </a>
        {children}
        <span className="spacer" />
        <a className="act" href="/my-tasks">
          <Icon name="check" />
          Мои задачи (3)
        </a>
      </div>
    </header>
  </Surface>
);

/** Раздел «Задачи» — то, что видно сразу после перехода в проект. */
export const OnTasks = () => (
  <Frame>
    <ProjectNav slug="deckbook" at="tasks" />
  </Frame>
);

/** Раздел «Документы»: класс `here` переезжает на вторую ссылку. */
export const OnDocuments = () => (
  <Frame>
    <ProjectNav slug="deckbook" at="documents" />
  </Frame>
);

/** Раздел «Токены» — последний из трёх. */
export const OnTokens = () => (
  <Frame>
    <ProjectNav slug="deckbook" at="tokens" />
  </Frame>
);

import type { ReactNode } from "react";
import { Dot, Prio } from "deckbook";

// Подложка карточки: страничный фон системы, см. комментарий в Head.tsx.
const Surface = ({ children }: { children: ReactNode }) => (
  <div style={{ background: "var(--bg)", color: "var(--text)", padding: 16 }}>{children}</div>
);

/**
 * Три приоритета подряд. `normal` не рендерится вовсе — обычный приоритет
 * это отсутствие приоритета, поэтому в середине пусто, и так задумано.
 */
export const AllPriorities = () => (
  <Surface>
    <div style={{ display: "grid", gap: 10 }}>
      <span style={{ display: "flex", gap: 10 }}>
        <Prio task={{ priority: "high" }} />
        <span className="muted">high</span>
      </span>
      <span style={{ display: "flex", gap: 10 }}>
        <Prio task={{ priority: "normal" }} />
        <span className="muted">normal — метки нет</span>
      </span>
      <span style={{ display: "flex", gap: 10 }}>
        <Prio task={{ priority: "low" }} />
        <span className="muted">low</span>
      </span>
    </div>
  </Surface>
);

/** В строке задачи: метка стоит справа, между названием и статусом. */
export const InTaskList = () => (
  <Surface>
    <div style={{ display: "grid", gap: 8 }}>
      <div className="row" style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <Dot status="todo" />
        <span className="grow">Починить куку сессии в formHandler</span>
        <Prio task={{ priority: "high" }} />
        <span className="muted state">открыта</span>
      </div>
      <div className="row" style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <Dot status="todo" />
        <span className="grow">Разложить компоненты по группам</span>
        <Prio task={{ priority: "low" }} />
        <span className="muted state">открыта</span>
      </div>
    </div>
  </Surface>
);

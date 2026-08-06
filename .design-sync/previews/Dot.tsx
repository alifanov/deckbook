import type { ReactNode } from "react";
import { Dot } from "deckbook";

// Подложка карточки: страничный фон системы, см. комментарий в Head.tsx.
const Surface = ({ children }: { children: ReactNode }) => (
  <div style={{ background: "var(--bg)", color: "var(--text)", padding: 16 }}>{children}</div>
);

const STATUSES = [
  ["todo", "открыта"],
  ["in_progress", "в работе"],
  ["needs_human", "нужен человек"],
  ["done", "готова"],
  ["cancelled", "отменена"],
] as const;

/** Все пять статусов: точка — единственный носитель цвета в строке задачи. */
export const AllStatuses = () => (
  <Surface>
    <div style={{ display: "grid", gap: 10 }}>
      {STATUSES.map(([status, label]) => (
        <span key={status} style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Dot status={status} />
          <span className="muted">{label}</span>
        </span>
      ))}
    </div>
  </Surface>
);

/** Настоящее место точки — слева от названия задачи в списке. */
export const InTaskList = () => (
  <Surface>
    <div style={{ display: "grid", gap: 8 }}>
      <div className="row" style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <Dot status="in_progress" />
        <span className="grow">Перевести интерфейс на «Тихий лист»</span>
        <span className="muted state">в работе</span>
      </div>
      <div className="row" style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <Dot status="needs_human" />
        <span className="grow">Ответить на письмо из поддержки</span>
        <span className="muted state">нужен человек</span>
      </div>
      <div className="row" style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <Dot status="done" />
        <span className="grow">Экспорт логов в SigNoz</span>
        <span className="muted state">готова</span>
      </div>
    </div>
  </Surface>
);

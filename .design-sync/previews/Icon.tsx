import type { ReactNode } from "react";
import { Icon } from "deckbook";

// Подложка карточки: страничный фон системы, см. комментарий в Head.tsx.
const Surface = ({ children }: { children: ReactNode }) => (
  <div style={{ background: "var(--bg)", color: "var(--text)", padding: 16 }}>{children}</div>
);

const ALL = [
  "plus",
  "check",
  "x",
  "pencil",
  "trash",
  "filter",
  "down",
  "right",
  "send",
  "copy",
  "upload",
  "move",
  "layers",
  "ban",
  "swap",
  "login",
  "logout",
  "calendar",
  "repeat",
] as const;

/** Весь набор: значки рисуются штрихом и наследуют currentColor. */
export const AllGlyphs = () => (
  <Surface>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 18 }}>
      {ALL.map((name) => (
        <span key={name} style={{ display: "grid", justifyItems: "center", gap: 6, width: 62 }}>
          <Icon name={name} />
          <span className="muted" style={{ fontSize: 11 }}>
            {name}
          </span>
        </span>
      ))}
    </div>
  </Surface>
);

/** Настоящее место значка — внутри `.act`, слева от подписи. */
export const InActions = () => (
  <Surface>
    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
      <button className="act" type="button">
        <Icon name="plus" />
        Создать проект
      </button>
      <button className="act go" type="button">
        <Icon name="check" />
        Готово
      </button>
      <button className="act bad" type="button">
        <Icon name="trash" />
        Удалить
      </button>
    </div>
  </Surface>
);

/** Размер задаётся стороной квадрата; цвет всегда берётся у текста. */
export const Sizes = () => (
  <Surface>
    <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
      <Icon name="layers" />
      <Icon name="layers" size={18} />
      <Icon name="layers" size={24} />
      <span className="muted">
        <Icon name="layers" size={24} />
      </span>
    </div>
  </Surface>
);

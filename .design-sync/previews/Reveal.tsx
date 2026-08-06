import type { ReactNode } from "react";
import { Back, Icon, Reveal } from "deckbook";

// Подложка карточки: страничный фон системы, см. комментарий в Head.tsx.
const Surface = ({ children }: { children: ReactNode }) => (
  <div style={{ background: "var(--bg)", color: "var(--text)", padding: 16 }}>{children}</div>
);

/**
 * Покой — единственное статичное состояние: <details> закрыт, видна только
 * ссылка-действие. Раскрытие ловится кликом, снять его скриншотом нельзя.
 */
export const Closed = () => (
  <Surface>
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <Reveal label="Цель" drop wide>
        <form method="post" action="/api/projects">
          <Back path="/projects/deckbook" />
          <textarea name="goal" rows={3} defaultValue="Хранить задачи и документы агентов." />
        </form>
      </Reveal>
      <Reveal label="Папка" icon="move" drop wide>
        <form className="row" method="post" action="/api/projects">
          <Back path="/projects/deckbook" />
          <input type="text" name="localPath" defaultValue="~/code/deckbook" />
        </form>
      </Reveal>
    </div>
  </Surface>
);

/** Окраска действия: обычное, утвердительное `go`, разрушительное `bad`. */
export const Tones = () => (
  <Surface>
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <Reveal label="Переименовать" icon="pencil" drop>
        <form method="post" action="/api/documents">
          <input type="text" name="title" defaultValue="Архитектура MCP" />
        </form>
      </Reveal>
      <Reveal label="Завершить" icon="check" tone="go" drop>
        <form method="post" action="/api/tasks">
          <button className="act go" type="submit">
            <Icon name="check" />
            Готово
          </button>
        </form>
      </Reveal>
      <Reveal label="Отозвать" icon="ban" tone="bad" drop>
        <form method="post" action="/api/tokens">
          <button className="act bad" type="submit">
            <Icon name="ban" />
            Отозвать
          </button>
        </form>
      </Reveal>
    </div>
  </Surface>
);

/** `bare` — только значок: подпись уходит в title и aria-label. */
export const BareIcon = () => (
  <Surface>
    <div className="row" style={{ display: "flex", gap: 10, alignItems: "center" }}>
      <span>Выпустить токен для агента</span>
      <Reveal label="Настроить срок" icon="calendar" bare drop>
        <form method="post" action="/api/tokens">
          <input type="date" name="expiresAt" />
        </form>
      </Reveal>
      <Reveal label="Скопировать" icon="copy" bare drop>
        <p className="muted">https://deckbook.app/api/mcp/deckbook</p>
      </Reveal>
    </div>
  </Surface>
);

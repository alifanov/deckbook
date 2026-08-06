import type { ReactNode } from "react";
import { CopyField } from "deckbook";

// Подложка карточки: страничный фон системы, см. комментарий в Head.tsx.
const Surface = ({ children }: { children: ReactNode }) => (
  <div style={{ background: "var(--bg)", color: "var(--text)", padding: 16 }}>{children}</div>
);

/** Адрес MCP-сервера проекта — показывается на вкладке «Токены» всегда. */
export const McpUrl = () => (
  <Surface>
    <CopyField value="https://deckbook.example/mcp/deckbook" />
  </Surface>
);

/** Свежевыпущенный токен: значение видно ровно один раз, поэтому его копируют сразу. */
export const IssuedToken = () => (
  <Surface>
    <div className="notice">
      <strong>Токен выпущен — значение показывается один раз:</strong>
      <CopyField value="dbk_7f3c1a9e42b58d06ac1e5f7b9d2340cc" />
    </div>
  </Surface>
);

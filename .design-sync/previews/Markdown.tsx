import type { ReactNode } from "react";
import { Markdown } from "deckbook";

// Подложка карточки: страничный фон системы, см. комментарий в Head.tsx.
const Surface = ({ children }: { children: ReactNode }) => (
  <div style={{ background: "var(--bg)", color: "var(--text)", padding: 16 }}>{children}</div>
);

const DOC = `## Архитектура MCP

Deckbook отдаёт агентам **один** MCP-сервер на проект. Инструменты делятся
на три группы:

- \`my_tasks\`, \`claim_task\`, \`set_task_status\` — работа с задачами;
- \`read_document\`, \`write_document\` — дерево документов;
- \`project_info\` — цель проекта.

Токен передаётся заголовком, срок жизни задаётся при выпуске.
Подробности — на [странице токенов](/projects/deckbook/tokens).
`;

/** Документ целиком: заголовки, списки, код и ссылки в одном потоке. */
export const Document = () => (
  <Surface>
    <Markdown text={DOC} />
  </Surface>
);

/** Комментарий агента в ленте задачи — самый частый и самый короткий случай. */
export const Comment = () => (
  <Surface>
    <Markdown text="Починил: `cookieFrom` теперь декодирует значение через `decodeURIComponent`. Тест на закодированную куку добавлен." />
  </Surface>
);

/** HTML в тексте агента остаётся текстом: рендерер собран с `html: false`. */
export const HtmlIsEscaped = () => (
  <Surface>
    <Markdown text={'Агент прислал `<script>alert(1)</script>` — и это <b>текст</b>, а не разметка.'} />
  </Surface>
);

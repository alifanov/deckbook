import type { ReactNode } from "react";
import { Back } from "deckbook";

// Back — скрытое поле, само по себе оно ничего не рисует. Настоящий его вид —
// внутри формы: именно так он стоит на каждой странице приложения.
// Тёмный фон системы — см. комментарий в Header.tsx.
const Surface = ({ children }: { children: ReactNode }) => (
  <div style={{ background: "var(--bg)", color: "var(--text)", padding: 16 }}>{children}</div>
);

/** Форма создания задачи со страницы проекта: Back задаёт адрес возврата. */
export const InsideForm = () => (
  <Surface>
    <form className="row" method="post" action="/api/tasks">
      <Back path="/projects/deckbook" />
      <input type="hidden" name="intent" value="create" />
      <input type="text" name="title" placeholder="Заголовок" defaultValue="Починить вебхук деплоя" />
      <button type="submit">Создать</button>
    </form>
  </Surface>
);

/** Форма отзыва токена: тот же приём, действие — на другом обработчике. */
export const InRevokeForm = () => (
  <Surface>
    <form className="row" method="post" action="/api/tokens">
      <Back path="/projects/deckbook/tokens" />
      <input type="hidden" name="intent" value="revoke" />
      <span className="muted">codex-agent</span>
      <button className="danger" type="submit">
        Отозвать
      </button>
    </form>
  </Surface>
);

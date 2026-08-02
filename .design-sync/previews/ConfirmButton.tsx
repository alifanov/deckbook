import type { ReactNode } from "react";
import { Back, ConfirmButton } from "deckbook";

// Тёмный фон системы — см. комментарий в Header.tsx.
const Surface = ({ children }: { children: ReactNode }) => (
  <div style={{ background: "var(--bg)", color: "var(--text)", padding: 16 }}>{children}</div>
);

/**
 * Отзыв токена — самое частое место: последняя колонка таблицы «Выпущенные».
 * Без строки таблицы кнопка выглядит просто кнопкой, поэтому контекст важен.
 */
export const RevokeToken = () => (
  <Surface>
    <table>
      <thead>
        <tr>
          <th>Имя</th>
          <th>Последнее использование</th>
          <th />
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>codex-agent</td>
          <td className="muted">02.08.26, 09:14</td>
          <td>
            <form method="post" action="/api/tokens">
              <Back path="/projects/deckbook/tokens" />
              <input type="hidden" name="intent" value="revoke" />
              <ConfirmButton message="Отозвать токен codex-agent? Агент сразу потеряет доступ.">
                Отозвать
              </ConfirmButton>
            </form>
          </td>
        </tr>
      </tbody>
    </table>
  </Surface>
);

/** Удаление документа: тот же компонент в карточке, другой вопрос в confirm(). */
export const DeleteDocument = () => (
  <Surface>
    <div className="card">
      <strong>Архитектура MCP</strong>
      <p className="muted">Обновлён 01.08.26 · 4 подраздела</p>
      <form method="post" action="/api/documents">
        <Back path="/projects/deckbook/documents" />
        <input type="hidden" name="intent" value="delete" />
        <ConfirmButton message="Удалить документ «Архитектура MCP»? Действие необратимо.">
          Удалить
        </ConfirmButton>
      </form>
    </div>
  </Surface>
);

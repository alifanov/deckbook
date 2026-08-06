import type { ReactNode } from "react";
import { Head, Icon, Reveal } from "deckbook";

// Шаблон карточки задаёт белый фон, а страницы Deckbook стоят на var(--bg).
// Без этой подложки иерархия «подложка → панель» в превью читается неверно.
const Surface = ({ children }: { children: ReactNode }) => (
  <div style={{ background: "var(--bg)", color: "var(--text)", padding: 16 }}>{children}</div>
);

/** Заголовок раздела со счётчиком — как над списком подзадач. */
export const WithCount = () => (
  <Surface>
    <Head title="Подзадачи" count={7} />
  </Surface>
);

/** Без счётчика: раздел, в котором считать нечего. */
export const TitleOnly = () => (
  <Surface>
    <Head title="Адрес MCP-сервера" />
  </Surface>
);

/** С действиями справа: они прижимаются к краю через внутренний spacer. */
export const WithActions = () => (
  <Surface>
    <Head title="Выпущенные" count={3}>
      <Reveal label="Выпустить токен" icon="plus" drop wide>
        <form method="post" action="/api/tokens">
          <input type="text" name="name" placeholder="имя агента" />
          <button className="act go" type="submit">
            <Icon name="check" />
            Выпустить
          </button>
        </form>
      </Reveal>
    </Head>
  </Surface>
);

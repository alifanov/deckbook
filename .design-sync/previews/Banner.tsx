import type { ReactNode } from "react";
import { Banner } from "deckbook";

// Подложка карточки: страничный фон системы, см. комментарий в Head.tsx.
const Surface = ({ children }: { children: ReactNode }) => (
  <div style={{ background: "var(--bg)", color: "var(--text)", padding: 16 }}>{children}</div>
);

/** Ошибка из ?error=… — единственный видимый вид баннера. */
export const WithError = () => (
  <Surface>
    <Banner error="Задача не найдена" />
  </Surface>
);

/** Длинный текст переносится внутри рамки, а не растягивает страницу. */
export const LongMessage = () => (
  <Surface>
    <Banner error="Токен отозван: агент больше не видит задачи этого проекта — выпустите новый на вкладке «Токены»." />
  </Surface>
);

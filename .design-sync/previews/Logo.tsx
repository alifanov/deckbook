import type { ReactNode } from "react";
import { Logo } from "deckbook";

// Подложка карточки: страничный фон системы, см. комментарий в Head.tsx.
const Surface = ({ children }: { children: ReactNode }) => (
  <div style={{ background: "var(--bg)", color: "var(--text)", padding: 16 }}>{children}</div>
);

/** Настоящее место знака — в шапке, слева от слова «Deckbook». */
export const InBrand = () => (
  <Surface>
    <a className="brand" href="/" style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
      <Logo />
      Deckbook
    </a>
  </Surface>
);

/** Знак рисуется штрихом акцентного цвета и не зависит от размера текста. */
export const Sizes = () => (
  <Surface>
    <div style={{ display: "flex", gap: 20, alignItems: "flex-end" }}>
      <Logo />
      <Logo size={28} />
      <Logo size={48} />
    </div>
  </Surface>
);

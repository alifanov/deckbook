"use client";

import type { ReactNode } from "react";

/**
 * Фильтр применяется сразу при смене значения — кнопку жать не надо.
 * ponytail: onChange висит на самой форме, событие всплывает от любого поля;
 * без JS форма остаётся обычной GET-формой со своей кнопкой в <noscript>.
 */
export function FilterForm({ action, children }: { action: string; children: ReactNode }) {
  return (
    <form
      className="row"
      method="get"
      action={action}
      onChange={(event) => event.currentTarget.requestSubmit()}
    >
      {children}
    </form>
  );
}

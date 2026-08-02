import Link from "next/link";
import type { ReactNode } from "react";
import { countOwnerTasks } from "./domain/tasks";
import { Icon, Logo } from "./ui";

/**
 * Шапка приложения. Живёт отдельно от ui.tsx: ходит в базу за счётчиком,
 * а ui.tsx подключают и клиентские компоненты.
 */
export async function Header({ children }: { children?: ReactNode }) {
  const mine = await countOwnerTasks();

  return (
    <header className="top">
      <div className="inner">
        <Link className="brand" href="/">
          <Logo />
          Deckbook
        </Link>
        {children}
        <span className="spacer" />
        <Link className="act" href="/my-tasks">
          <Icon name="check" />
          {/* ponytail: ноль в скобках — шум, его не рисуем */}
          Мои задачи{mine > 0 && ` (${mine})`}
        </Link>
        <form method="post" action="/api/session">
          <input type="hidden" name="intent" value="logout" />
          <button className="act" type="submit">
            <Icon name="logout" />
            Выйти
          </button>
        </form>
      </div>
    </header>
  );
}

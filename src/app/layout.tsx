import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Deckbook",
  description: "Личный трекер задач, у которого MCP — основной интерфейс",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}

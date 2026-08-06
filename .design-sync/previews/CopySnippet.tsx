import type { ReactNode } from "react";
import { CopySnippet } from "deckbook";

const URL = "https://deckbook.example/mcp/deckbook";
const TOKEN = "dbk_7f3c1a9e42b58d06ac1e5f7b9d2340cc";

// Подложка карточки: страничный фон системы, см. комментарий в Head.tsx.
const Surface = ({ children }: { children: ReactNode }) => (
  <div style={{ background: "var(--bg)", color: "var(--text)", padding: 16 }}>{children}</div>
);

/** Однострочная команда подключения — переносится по словам, а не режется. */
export const ClaudeCode = () => (
  <Surface>
    <CopySnippet
      value={`claude mcp add --transport http deckbook-deckbook ${URL} --header "Authorization: Bearer ${TOKEN}"`}
    />
  </Surface>
);

/** Многострочный блок конфигурации: у opencode нет флагов, кладут файлом. */
export const OpenCodeConfig = () => (
  <Surface>
    <CopySnippet
      value={JSON.stringify(
        {
          mcp: {
            "deckbook-deckbook": {
              type: "remote",
              url: URL,
              headers: { Authorization: `Bearer ${TOKEN}` },
              enabled: true,
            },
          },
        },
        null,
        2,
      )}
    />
  </Surface>
);

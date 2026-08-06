"use client";

import { Icon } from "./ui";

/** Поле «скопировать одним действием»: адрес MCP-сервера и значение токена. */
export function CopyField({ value }: { value: string }) {
  return (
    <div className="pill copy">
      <input type="text" readOnly value={value} onFocus={(e) => e.currentTarget.select()} />
      <button type="button" onClick={() => navigator.clipboard.writeText(value)}>
        <Icon name="copy" />
        Скопировать
      </button>
    </div>
  );
}

/** То же самое, но для многострочного текста: команда подключения агента. */
export function CopySnippet({ value }: { value: string }) {
  return (
    <div className="snippet">
      <pre>{value}</pre>
      <button className="plain" type="button" onClick={() => navigator.clipboard.writeText(value)}>
        <Icon name="copy" />
        Копировать
      </button>
    </div>
  );
}

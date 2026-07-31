"use client";

/** Поле «скопировать одним действием»: адрес MCP-сервера и значение токена. */
export function CopyField({ value }: { value: string }) {
  return (
    <div className="row">
      <input type="text" readOnly value={value} onFocus={(e) => e.currentTarget.select()} />
      <button type="button" onClick={() => navigator.clipboard.writeText(value)}>
        Скопировать
      </button>
    </div>
  );
}

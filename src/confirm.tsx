"use client";

/** Подтверждение удаления. ponytail: нативный confirm, свой диалог не нужен. */
export function ConfirmButton({
  children,
  message,
  className = "act bad",
  label,
  form,
}: {
  children: React.ReactNode;
  message: string;
  className?: string;
  /** подпись для кнопки без текста */
  label?: string;
  /** id формы, если кнопка стоит не внутри неё: вложить форму в форму нельзя */
  form?: string;
}) {
  return (
    <button
      className={className}
      title={label}
      aria-label={label}
      form={form}
      type="submit"
      onClick={(event) => {
        if (!confirm(message)) event.preventDefault();
      }}
    >
      {children}
    </button>
  );
}

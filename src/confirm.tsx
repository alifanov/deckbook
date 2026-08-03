"use client";

/** Подтверждение удаления. ponytail: нативный confirm, свой диалог не нужен. */
export function ConfirmButton({
  children,
  message,
  className = "act bad",
  label,
}: {
  children: React.ReactNode;
  message: string;
  className?: string;
  /** подпись для кнопки без текста */
  label?: string;
}) {
  return (
    <button
      className={className}
      title={label}
      aria-label={label}
      type="submit"
      onClick={(event) => {
        if (!confirm(message)) event.preventDefault();
      }}
    >
      {children}
    </button>
  );
}

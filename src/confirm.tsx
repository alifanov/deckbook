"use client";

/** Подтверждение удаления. ponytail: нативный confirm, свой диалог не нужен. */
export function ConfirmButton({
  children,
  message,
  className = "act bad",
}: {
  children: React.ReactNode;
  message: string;
  className?: string;
}) {
  return (
    <button
      className={className}
      type="submit"
      onClick={(event) => {
        if (!confirm(message)) event.preventDefault();
      }}
    >
      {children}
    </button>
  );
}

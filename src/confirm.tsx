"use client";

/** Подтверждение удаления. ponytail: нативный confirm, свой диалог не нужен. */
export function ConfirmButton({
  children,
  message,
}: {
  children: React.ReactNode;
  message: string;
}) {
  return (
    <button
      className="danger"
      type="submit"
      onClick={(event) => {
        if (!confirm(message)) event.preventDefault();
      }}
    >
      {children}
    </button>
  );
}

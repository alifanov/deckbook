import { logs, SeverityNumber } from "@opentelemetry/api-logs";

/**
 * Необработанная ошибка: в stderr — как раньше, и записью ERROR в SigNoz.
 * Без OTel-SDK (локально, в тестах) logs API — заглушка: остаётся console.error.
 */
export function logError(error: unknown, attributes: Record<string, string> = {}) {
  console.error(error);

  const failure = error instanceof Error ? error : new Error(String(error));
  // ponytail: logger берём на каждый вызов — провайдер регистрируется
  // в instrumentation.register() позже, чем модуль импортируется
  logs.getLogger("deckbook").emit({
    severityNumber: SeverityNumber.ERROR,
    severityText: "ERROR",
    body: failure.message,
    attributes: {
      "exception.type": failure.name,
      "exception.message": failure.message,
      "exception.stacktrace": failure.stack ?? "",
      ...attributes,
    },
  });
}

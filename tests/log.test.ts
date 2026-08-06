import { logs, type LogRecord } from "@opentelemetry/api-logs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { logError } from "../src/log";

const emitted: LogRecord[] = [];

beforeEach(() => {
  emitted.length = 0;
  vi.spyOn(console, "error").mockImplementation(() => {});
  logs.setGlobalLoggerProvider({
    getLogger: () => ({
      enabled: () => true,
      emit: (record: LogRecord) => void emitted.push(record),
    }),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  logs.disable();
});

describe("logError", () => {
  it("отправляет ошибку записью ERROR с текстом и stack", () => {
    const failure = new Error("база недоступна");
    logError(failure, { "mcp.tool": "create_task" });

    expect(emitted).toHaveLength(1);
    const [record] = emitted;
    expect(record.severityText).toBe("ERROR");
    expect(record.body).toBe("база недоступна");
    expect(record.attributes?.["exception.stacktrace"]).toBe(failure.stack);
    expect(record.attributes?.["mcp.tool"]).toBe("create_task");
  });

  it("не роняется на брошенном не-Error", () => {
    logError("строку тоже кидают");

    expect(emitted[0].body).toBe("строку тоже кидают");
    expect(emitted[0].attributes?.["exception.type"]).toBe("Error");
  });

  it("дублирует ошибку в stderr — локально SDK нет", () => {
    logError(new Error("упало"));

    expect(console.error).toHaveBeenCalledOnce();
  });
});

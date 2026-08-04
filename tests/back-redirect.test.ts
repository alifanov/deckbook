import { describe, expect, it } from "vitest";
import { DomainError } from "../src/domain/errors";
import { formHandler } from "../src/http";
import { sessionHeader } from "./helpers";

/** Форма отправляет `back`; куда в итоге ведёт `Location`. */
async function locationFor(back: string, action: () => Promise<void> = async () => {}) {
  const form = new FormData();
  form.append("back", back);
  const response = await formHandler(action)(
    new Request("http://localhost/api/tasks", {
      method: "POST",
      body: form,
      headers: await sessionHeader(),
    }),
  );
  return response.headers.get("location");
}

describe("поле back уводит только на внутренний путь", () => {
  it("обычный путь работает как раньше", async () => {
    expect(await locationFor("/projects/x")).toBe("/projects/x");
  });

  it("протокол-относительный адрес отбрасывается", async () => {
    expect(await locationFor("//evil.example")).toBe("/");
  });

  it("абсолютный адрес отбрасывается", async () => {
    expect(await locationFor("https://evil.example")).toBe("/");
  });

  // Браузеры трактуют обратный слэш в начале как второй слэш.
  it("обратный слэш отбрасывается", async () => {
    expect(await locationFor("/\\evil.example")).toBe("/");
  });

  it("отказ домена возвращает на внутренний путь с текстом ошибки", async () => {
    const refuse = async () => {
      throw new DomainError("нельзя");
    };

    expect(await locationFor("//evil.example", refuse)).toBe(
      `/?error=${encodeURIComponent("нельзя")}`,
    );
  });
});

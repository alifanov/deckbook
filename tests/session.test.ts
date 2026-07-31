import { describe, expect, it } from "vitest";
import { SESSION_DAYS, isValidSession, signSession } from "../src/session";

const day = 24 * 60 * 60 * 1000;
const alive = () => Date.now() + SESSION_DAYS * day;

describe("сессия владельца", () => {
  it("принимает свою свежую подпись", () => {
    expect(isValidSession(signSession(alive(), 0), 0)).toBe(true);
  });

  it("отвергает чужую и испорченную подпись", () => {
    expect(isValidSession(`${alive()}:0.подделка`, 0)).toBe(false);
    expect(isValidSession("мусор", 0)).toBe(false);
    expect(isValidSession(undefined, 0)).toBe(false);
  });

  it("отвергает просроченную куку", () => {
    expect(isValidSession(signSession(Date.now() - day, 0), 0)).toBe(false);
  });

  it("выход обнуляет уже выданные куки: поколение сдвинулось", () => {
    const issued = signSession(alive(), 0);
    expect(isValidSession(issued, 1)).toBe(false);
  });
});

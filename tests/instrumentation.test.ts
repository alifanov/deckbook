import { describe, expect, it } from "vitest";
import { spanPath } from "../src/instrumentation";

describe("spanPath", () => {
  it("схлопывает cuid задачи в :id", () => {
    expect(spanPath("/api/tasks/cmscw306t000601k3n0f5rm3c")).toBe(
      "/api/tasks/:id",
    );
  });

  it("схлопывает id в середине пути", () => {
    expect(spanPath("/tasks/cmscw306t000601k3n0f5rm3c/comments")).toBe(
      "/tasks/:id/comments",
    );
  });

  it("отрезает query — там могут быть чужие значения", () => {
    expect(spanPath("/my-tasks?status=todo")).toBe("/my-tasks");
  });

  it("короткие сегменты не трогает", () => {
    expect(spanPath("/projects/deckbook")).toBe("/projects/deckbook");
  });
});

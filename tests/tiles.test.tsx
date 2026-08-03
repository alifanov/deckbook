import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Tiles } from "../src/app/projects/[slug]/tiles";
import type { TaskStatus } from "../src/generated/prisma/client";

const counts: Record<TaskStatus, number> = {
  todo: 3,
  in_progress: 1,
  needs_human: 0,
  done: 7,
  cancelled: 2,
};

const html = (status: TaskStatus | null, assignee?: string) =>
  renderToStaticMarkup(
    <Tiles counts={counts} path="/projects/deckbook" status={status} assignee={assignee} />,
  );

describe("плитки статусов", () => {
  it("каждая плитка ведёт в отбор по своему статусу", () => {
    const out = html(null);
    expect(out).toContain('href="/projects/deckbook?status=todo"');
    expect(out).toContain('href="/projects/deckbook?status=in_progress"');
    expect(out).toContain(">7<");
  });

  it("выбранная плитка подсвечена, а клик по ней снимает отбор", () => {
    const out = html("done");
    expect(out).toContain('class="tile done on"');
    expect(out).toContain('href="/projects/deckbook"');
    expect(out).not.toContain("status=done");
  });

  it("выбранный исполнитель переезжает в ссылку", () => {
    expect(html(null, "t1")).toContain('href="/projects/deckbook?status=todo&amp;assignee=t1"');
    expect(html("todo", "t1")).toContain('href="/projects/deckbook?assignee=t1"');
  });
});
